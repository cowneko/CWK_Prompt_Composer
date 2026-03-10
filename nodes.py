import json
import os
import re
import torch
import logging
from contextlib import contextmanager

import server
from aiohttp import web
from comfy import model_management

logger = logging.getLogger("[CWK_Prompt_Composer]")

# ── Tag directory ─────────────────────────────────────────────────────────────
TAG_DIR = os.path.join(os.path.dirname(__file__), "web", "tags")


@server.PromptServer.instance.routes.post("/cwk/add_tag")
async def add_tag(request):
    try:
        data        = await request.json()
        panel_key   = data.get("panelKey")
        category    = data.get("category")
        subcategory = data.get("subcategory")
        tag         = data.get("tag", "").strip()

        if not all([panel_key, category, subcategory, tag]):
            return web.json_response({"ok": False, "error": "Missing fields"}, status=400)

        filepath = os.path.join(TAG_DIR, f"{panel_key}.json")
        if not os.path.exists(filepath):
            return web.json_response({"ok": False, "error": f"File not found: {panel_key}.json"}, status=404)

        with open(filepath, "r", encoding="utf-8") as f:
            tag_data = json.load(f)

        for group in tag_data:
            if group.get("category") == category:
                for sub in group.get("subcategories", []):
                    if sub.get("name") == subcategory:
                        if tag in sub["tags"]:
                            return web.json_response({
                                "ok": False,
                                "duplicate": True,
                                "where": f"{category} › {subcategory}"
                            })
                        sub["tags"].append(tag)
                        sub["tags"].sort()
                        with open(filepath, "w", encoding="utf-8") as f:
                            json.dump(tag_data, f, indent=2, ensure_ascii=False)
                        return web.json_response({"ok": True})

        return web.json_response(
            {"ok": False, "error": "Category or subcategory not found"}, status=404
        )

    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════════════
#  A1111-STYLE CLIP ENCODING — SELF-CONTAINED
# ═══════════════════════════════════���══════════════════════════════════════════

# ── A1111 attention parser ────────────────────────────────────────────────────

_re_attention = re.compile(r"""
\\\(|
\\\)|
\\\[|
\\]|
\\\\|
\\|
\(|
\[|
:\s*([+-]?[.\d]+)\s*\)|
\)|
]|
[^\\()\[\]:]+|
:
""", re.X)

_re_break = re.compile(r"\s*\bBREAK\b\s*", re.S)


def parse_prompt_attention(text):
    res = []
    round_brackets = []
    square_brackets = []
    round_bracket_multiplier = 1.1
    square_bracket_multiplier = 1 / 1.1

    def multiply_range(start_position, multiplier):
        for p in range(start_position, len(res)):
            res[p][1] *= multiplier

    for m in _re_attention.finditer(text):
        chunk = m.group(0)
        weight = m.group(1)

        if chunk.startswith('\\'):
            res.append([chunk[1:], 1.0])
        elif chunk == '(':
            round_brackets.append(len(res))
        elif chunk == '[':
            square_brackets.append(len(res))
        elif weight is not None and round_brackets:
            multiply_range(round_brackets.pop(), float(weight))
        elif chunk == ')' and round_brackets:
            multiply_range(round_brackets.pop(), round_bracket_multiplier)
        elif chunk == ']' and square_brackets:
            multiply_range(square_brackets.pop(), square_bracket_multiplier)
        else:
            parts = re.split(_re_break, chunk)
            for i, part in enumerate(parts):
                if i > 0:
                    res.append(["BREAK", -1])
                res.append([part, 1.0])

    for pos in round_brackets:
        multiply_range(pos, round_bracket_multiplier)
    for pos in square_brackets:
        multiply_range(pos, square_bracket_multiplier)

    if len(res) == 0:
        res = [["", 1.0]]

    i = 0
    while i + 1 < len(res):
        if res[i][1] == res[i + 1][1]:
            res[i][0] += res[i + 1][0]
            res.pop(i + 1)
        else:
            i += 1

    return res


# ── Tokenizer/encoder discovery ───────────────────────────────────────────────

CHUNK_LENGTH = 75


def _get_tokenizer_info(clip):
    """
    Discover inner tokenizer(s) and dict keys.
    Returns dict of {key: SDTokenizer}.
      SD1.5:  {"l": <SDTokenizer>}
      SDXL:   {"g": <SDXLClipGTokenizer>, "l": <SDTokenizer>}
    """
    tokenizer_wrapper = clip.tokenizer
    result = {}
    try:
        sample = tokenizer_wrapper.tokenize_with_weights("")
        if isinstance(sample, dict):
            for key in sample.keys():
                for attr_name in ["clip_" + key, key]:
                    obj = getattr(tokenizer_wrapper, attr_name, None)
                    if obj is not None and hasattr(obj, 'tokenizer') and hasattr(obj, 'start_token'):
                        result[key] = obj
                        break
    except Exception:
        pass

    if not result:
        for attr_name in dir(tokenizer_wrapper):
            if attr_name.startswith('_'):
                continue
            obj = getattr(tokenizer_wrapper, attr_name, None)
            if obj is not None and hasattr(obj, 'tokenizer') and hasattr(obj, 'start_token'):
                key = attr_name.replace('clip_', '')
                result[key] = obj

    return result


def _get_encoder_info(clip):
    """
    Discover inner encoder(s).
    Returns dict of {key: SDClipModel}.
      SD1.5:  {"l": <SDClipModel>}
      SDXL:   {"g": <SDXLClipG>, "l": <SDClipModel>}
    """
    encoder_wrapper = clip.cond_stage_model
    result = {}

    for attr_name in dir(encoder_wrapper):
        if attr_name.startswith('_'):
            continue
        obj = getattr(encoder_wrapper, attr_name, None)
        if obj is not None and hasattr(obj, 'encode') and hasattr(obj, 'special_tokens'):
            key = attr_name.replace('clip_', '')
            result[key] = obj

    return result


# ── A1111 tokenize ────────────────────────────────────────────────────────────

def _a1111_tokenize(inner_tokenizer, text):
    """
    Returns: list of (tokens_77, weights_77)
    """
    parsed = parse_prompt_attention(text)

    hf_tokenizer = inner_tokenizer.tokenizer
    start_token  = inner_tokenizer.start_token
    end_token    = inner_tokenizer.end_token
    pad_token    = getattr(inner_tokenizer, 'pad_token', end_token)

    try:
        vocab = hf_tokenizer.get_vocab()
        comma_token = vocab.get(',</w>', None)
    except Exception:
        comma_token = None

    text_fragments = [t for t, _ in parsed]
    tokenized = hf_tokenizer(text_fragments, truncation=False, add_special_tokens=False)["input_ids"]

    chunks = []
    cur_tokens = []
    cur_weights = []
    last_comma = -1

    def finish_chunk():
        nonlocal cur_tokens, cur_weights, last_comma

        to_add = CHUNK_LENGTH - len(cur_tokens)
        if to_add > 0:
            cur_tokens += [end_token] * to_add
            cur_weights += [1.0] * to_add

        final_tokens  = [start_token] + cur_tokens[:CHUNK_LENGTH] + [end_token]
        final_weights = [1.0]         + cur_weights[:CHUNK_LENGTH] + [1.0]

        chunks.append((final_tokens, final_weights))
        cur_tokens = []
        cur_weights = []
        last_comma = -1

    for frag_tokens, (text_frag, weight) in zip(tokenized, parsed):
        if text_frag == 'BREAK' and weight == -1:
            finish_chunk()
            continue

        pos = 0
        while pos < len(frag_tokens):
            token = frag_tokens[pos]

            if token == comma_token:
                last_comma = len(cur_tokens)
            elif (len(cur_tokens) == CHUNK_LENGTH
                  and last_comma != -1
                  and len(cur_tokens) - last_comma <= 20):
                brk = last_comma + 1
                reloc_t = cur_tokens[brk:]
                reloc_w = cur_weights[brk:]
                cur_tokens  = cur_tokens[:brk]
                cur_weights = cur_weights[:brk]
                finish_chunk()
                cur_tokens  = reloc_t
                cur_weights = reloc_w

            if len(cur_tokens) == CHUNK_LENGTH:
                finish_chunk()

            cur_tokens.append(token)
            cur_weights.append(weight)
            pos += 1

    if cur_tokens or not chunks:
        finish_chunk()

    return chunks


# ── A1111-style encode — direct transformer call ─────────────────────────────
#
# The key difference from the previous approach:
# Instead of calling clip.encode_from_tokens() which uses ComfyUI's
# ClipTokenWeightEncoder (weight formula: (z-z_empty)*w + z_empty),
# we call the encoder's .encode() method DIRECTLY, then apply
# A1111 emphasis (z * w, mean-normalized) ourselves.
#
# This matches exactly what smZ's ClassicTextProcessingEngine does:
#   1. encode_with_transformers(tokens)  → raw z, pooled
#   2. z = z * multipliers              → per-token scaling
#   3. z = z * (original_mean/new_mean) → mean normalization


def _encode_single_clip_a1111(encoder, chunks, pad_token):
    """
    Encode chunks through a single CLIP encoder with A1111 emphasis.
    encoder: an SDClipModel instance (has .encode() and .special_tokens)
    chunks: list of (tokens_77, weights_77)
    Returns: (cond_tensor, pooled_tensor)
    """
    target_device = model_management.intermediate_device()
    zs = []
    first_pooled = None

    for tokens_77, weights_77 in chunks:
        # Build token tensor [1, 77]
        tokens_tensor = [tokens_77]

        # Replace pad tokens after first end_token if pad != end
        end_token = encoder.special_tokens.get("end", tokens_77[-1])
        pt = encoder.special_tokens.get("pad", end_token)
        if pt != end_token:
            processed = list(tokens_77)
            try:
                end_idx = processed.index(end_token)
                for k in range(end_idx + 1, len(processed)):
                    processed[k] = pt
                tokens_tensor = [processed]
            except ValueError:
                pass

        # Call encoder.encode() directly — this runs the transformer
        # and returns (output_tensor, pooled) without any weight application
        o = encoder.encode(tokens_tensor)
        z = o[0]        # shape: [1, 77, embed_dim]
        pooled = o[1] if len(o) > 1 else None

        if first_pooled is None and pooled is not None:
            first_pooled = pooled[0:1].to(target_device)

        # Apply A1111 emphasis: multiply per-token, mean-normalize
        weights_tensor = torch.tensor(
            [weights_77], dtype=z.dtype, device=z.device
        )

        original_mean = z.mean()
        z = z * weights_tensor.unsqueeze(-1).expand_as(z)
        new_mean = z.mean()
        if new_mean.abs() > 1e-8:
            z = z * (original_mean / new_mean)

        zs.append(z)

    if not zs:
        return None, None

    cond = torch.cat(zs, dim=1).to(target_device)
    return cond, first_pooled


def _encode_a1111(clip, text):
    """
    Full A1111-style encode:
    1) Parse with A1111 attention parser
    2) Tokenize into 75-token chunks with per-token weights
    3) Encode tokens directly through each CLIP transformer
    4) Apply per-token emphasis with mean normalization
    """
    tokenizer_map = _get_tokenizer_info(clip)
    encoder_map   = _get_encoder_info(clip)

    if not tokenizer_map or not encoder_map:
        logger.warning("[CWK] Could not discover CLIP internals, falling back to comfy")
        return _encode_comfy(clip, text)

    # Ensure the model is loaded
    clip.load_model()

    # Set clip options (layer, device)
    clip.cond_stage_model.reset_clip_options()
    if clip.layer_idx is not None:
        clip.cond_stage_model.set_clip_options({"layer": clip.layer_idx})
    clip.cond_stage_model.set_clip_options({"execution_device": clip.patcher.load_device})

    # Tokenize with A1111 parser for each sub-tokenizer
    all_chunks = {}
    for key, inner_tok in tokenizer_map.items():
        all_chunks[key] = _a1111_tokenize(inner_tok, text)

    # Encode each sub-model
    results = {}
    for key in sorted(encoder_map.keys()):
        if key not in all_chunks:
            continue
        encoder = encoder_map[key]
        pad_token = encoder.special_tokens.get("pad", encoder.special_tokens.get("end", 0))
        cond, pooled = _encode_single_clip_a1111(encoder, all_chunks[key], pad_token)
        if cond is not None:
            results[key] = (cond, pooled)

    if not results:
        return _encode_comfy(clip, text)

    # Combine: SD1.5 = just "l", SDXL = concat [l, g] along embed_dim
    if len(results) == 1:
        key = list(results.keys())[0]
        final_cond, pooled = results[key]
    else:
        # SDXL: l_out and g_out concatenated, pooled from g
        l_cond, l_pooled = results.get("l", (None, None))
        g_cond, g_pooled = results.get("g", (None, None))

        if l_cond is None or g_cond is None:
            return _encode_comfy(clip, text)

        # Cut to same sequence length (should already match)
        cut_to = min(l_cond.shape[1], g_cond.shape[1])
        final_cond = torch.cat([l_cond[:, :cut_to], g_cond[:, :cut_to]], dim=-1)
        pooled = g_pooled  # SDXL uses clip_g pooled

    out_dict = {}
    if pooled is not None:
        out_dict["pooled_output"] = pooled

    return [[final_cond, out_dict]]


# ── Default comfy encode ──────────────────────────────────────────────────────

def _encode_comfy(clip, text):
    tokens = clip.tokenize(text)
    output = clip.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
    cond   = output.pop("cond")
    return [[cond, output]]


def _encode_with_parser(clip, text, parser):
    if parser == "A1111":
        return _encode_a1111(clip, text)
    else:
        return _encode_comfy(clip, text)


# ── Node ──────────────────────────────────────────────────────────────────────

class CWKPromptComposerNode:
    PARSERS = ["comfy", "A1111"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "quality_prompt":   ("STRING", {"default": "", "multiline": True}),
                "main_prompt":      ("STRING", {"default": "", "multiline": True}),
                "aesthetic_prompt": ("STRING", {"default": "", "multiline": True}),
                "negative_prompt":  ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "clip":   ("CLIP",),
                "parser": (cls.PARSERS, {"default": "comfy"}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("positive_prompt", "negative_prompt", "positive_cond", "negative_cond")
    FUNCTION     = "compose"
    CATEGORY     = "CWK"

    def compose(self, quality_prompt, main_prompt, aesthetic_prompt, negative_prompt,
                clip=None, parser="comfy"):
        positive = ", ".join(p for p in [quality_prompt, main_prompt, aesthetic_prompt] if p.strip())
        negative = negative_prompt.strip()

        if clip is None:
            return (positive, negative, [], [])

        pos_cond = _encode_with_parser(clip, positive, parser)
        neg_cond = _encode_with_parser(clip, negative, parser)

        return (positive, negative, pos_cond, neg_cond)


# ── Mappings ──────────────────────────────────────────────────────────────────
NODE_CLASS_MAPPINGS        = {"CWKPromptComposerNode": CWKPromptComposerNode}
NODE_DISPLAY_NAME_MAPPINGS = {"CWKPromptComposerNode": "CWK Prompt Composer"}