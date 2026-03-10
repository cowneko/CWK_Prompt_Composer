# Changelog

All notable changes to **CWK Prompt Composer** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] - 2026-03-10

### Added
- **🔌 CLIP input & conditioning outputs** — The node now accepts an optional `CLIP` input and outputs `positive_cond` and `negative_cond` (CONDITIONING) in addition to the string outputs
  - Eliminates the need for separate CLIP Text Encode nodes in most workflows
  - Works with SD1.5, SDXL, and Illustrious/Pony models
- **🔤 A1111 prompt parser** — New `parser` dropdown on the node (`comfy` / `A1111`)
  - `comfy` — default ComfyUI weight syntax
  - `A1111` — full Automatic1111 webui-compatible attention parser, self-contained (no external dependencies)
    - Supports `(word:1.3)`, `((word))`, `[word]`, nested brackets, and `BREAK`
    - Per-token emphasis with mean normalization — identical results to smZ's CLIP Text Encode++
    - Parses prompt into weighted token chunks, encodes through the raw CLIP transformer, then applies `z × weights × (original_mean / new_mean)` post-hoc
    - Works with both single-CLIP (SD1.5) and dual-CLIP (SDXL) models
- **🎨 Cosmetic refresh** — Node and panel dialog colors updated for visual consistency
  - Node title bar and body both use `#1a1f2e` to match the CWK Checkpoints Preset Manager style
  - Panel dialog lower area (below the tag browser) changed to `#1a1f2e` for a unified look across all four prompt panels (Quality, Main, Aesthetic, Negative)

### Technical Details
- A1111 parser implemented directly in `nodes.py` — zero dependency on ComfyUI_smZNodes
- Calls `encoder.encode()` directly (raw transformer forward pass) instead of ComfyUI's `encode_token_weights()` to avoid ComfyUI's `(z - z_empty) * w + z_empty` weight formula
- Automatic discovery of inner tokenizers and encoders via `_get_tokenizer_info()` / `_get_encoder_info()` — handles SD1Tokenizer (`{"l": ...}`) and SDXLTokenizer (`{"g": ..., "l": ...}`) transparently
- SDXL output concatenated as `[l_out, g_out]` along embed dim with `g_pooled` for pooled output, matching ComfyUI's native `SDXLClipModel.encode_token_weights()` behavior

---

## [1.1.0] - 2026-03-06

### Added
- **✏️ Manual override mode** — New tab on the node canvas to bypass the composer entirely
  - Switch between 🎨 Composer and ✏️ Manual tabs directly on the node
  - Click the positive or negative preview box in Manual mode to open a textarea editor (type or paste any prompt)
  - **✅ Apply** saves the override; **🗑 Clear Override** reverts to the composer value
  - Active overrides indicated by a `●` dot on the Manual tab when in Composer view
  - Manual state fully serialised and restored with the workflow JSON
  - Keyboard shortcuts: `Ctrl+Enter` to apply, `Escape` to cancel
- **📂 Wildcard loader** — Load tags from any `.yaml` wildcard file
  - Accessible via the **📂 Wildcards** toolbar button in every panel dialog
  - 3-step UI: pick a `.yaml`/`.yml` file → select a key/category → pick an entry or roll random
  - Supports keyed lists, flat root lists, inline `[a, b, c]` format, and bare values
  - Selected entry is inserted as a custom pill in the active canvas
  - New file: `web/wildcard_loader.js`

### Changed
- **Preview box sizing** — Negative prompt preview is now half the height of the positive prompt preview (2:1 ratio) for better visual balance
- Preview heights scale dynamically and proportionally when the node is resized
- `getLayoutRects()` is now the single source of truth for all node layout geometry (draw + hit-testing always in sync)
- Default node height calculated precisely to fit all content at spawn (`getMinNodeHeight()`)
- `tag_editor.js` added to file structure documentation

---

## [1.0.0] - 2026-03-05

### Added
- Initial release of CWK Prompt Composer custom node for ComfyUI
- Four prompt panels: Quality, Main, Aesthetic, Negative
- Pill canvas with drag-to-reorder, selection, weight control (right-click)
- Tag browser: flat 2-level (Quality/Aesthetic/Negative) and 3-level nested (Main)
- Live filter search in tag browser
- Free-type custom tag input with Enter-to-add
- Join / Split selected pills
- Full undo / redo history (up to 100 steps)
- Preset save / load / rename / delete / export / import (JSON)
- 🎲 I Feel Lucky random prompt generator (Main panel)
- 🔞 NSFW toggle for Lucky generator (opt-in, stored in localStorage)
- 📌 Add-to-Tag-List: persist custom tags back to JSON files via `/cwk/add_tag` API
- Live positive/negative preview drawn directly on the ComfyUI node canvas
- Node serialisation: state saved and restored with workflow JSON
- Keyboard shortcuts: Ctrl+Enter confirm, Escape cancel, Ctrl+Z/Y undo/redo
- Curated tag libraries: quality.json, aesthetic.json, main.json, negative.json, lucky.json
- Resizable & draggable panel windows