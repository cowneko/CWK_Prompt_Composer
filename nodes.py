import json
import os

import server
from aiohttp import web

# ── Tag directory ─────────────────────────────────────────────────────────────
TAG_DIR = os.path.join(os.path.dirname(__file__), "web", "tags")

# ── Route: add a tag to a JSON file ──────────────────────────────────────────
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


# ── Node ──────────────────────────────────────────────────────────────────────
class CWKPromptComposerNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "quality_prompt":   ("STRING", {"default": "", "multiline": True}),
                "main_prompt":      ("STRING", {"default": "", "multiline": True}),
                "aesthetic_prompt": ("STRING", {"default": "", "multiline": True}),
                "negative_prompt":  ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive_prompt", "negative_prompt")
    FUNCTION     = "compose"
    CATEGORY     = "CWK"

    def compose(self, quality_prompt, main_prompt, aesthetic_prompt, negative_prompt):
        positive = ", ".join(p for p in [quality_prompt, main_prompt, aesthetic_prompt] if p.strip())
        negative = negative_prompt.strip()
        return (positive, negative)


# ── Mappings ──────────────────────────────────────────────────────────────────
NODE_CLASS_MAPPINGS     = {"CWKPromptComposerNode": CWKPromptComposerNode}
NODE_DISPLAY_NAME_MAPPINGS = {"CWKPromptComposerNode": "CWK Prompt Composer"}