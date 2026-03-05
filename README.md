# CWK Prompt Composer

A custom node for [ComfyUI](https://github.com/comfyanonymous/ComfyUI) that lets you compose positive and negative prompts using a visual **pill-based editor** with tag browsing, presets, drag-to-reorder, weight control, and a lucky prompt generator.

---

## ✨ Features

- **4 prompt panels** — Quality, Main, Aesthetic, and Negative prompts, each with their own curated tag library
- **Pill canvas** — Each tag is a draggable, reorderable pill; click to select, drag to rearrange
- **Weight control** — Right-click any pill to set its emphasis weight (e.g. `(tag:1.3)`)
- **Tag browser** — Browse tags organised by category and subcategory with a live filter
  - Flat 2-level browser for Quality / Aesthetic / Negative panels
  - 3-level nested browser for the Main panel
- **Free-type input** — Type any custom tag and press Enter to add it instantly
- **Join / Split** — Merge selected pills with `_` or split underscore-joined pills apart
- **Undo / Redo** — Full history (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y)
- **Presets** — Save, load, rename, export (JSON) and import presets per panel
- **🎲 I Feel Lucky** — Generate a random coherent prompt from subject / clothing / expression / action / environment pools
- **🔞 NSFW toggle** — Opt-in to include adult content in the Lucky generator
- **📌 Add to Tag List** — Pin any custom or free-typed tag back into the persistent JSON tag library
- **Live preview** — The node canvas shows live previews of the assembled positive and negative prompts
- **Keyboard shortcuts** — `Esc` to cancel, `Ctrl+Enter` to confirm, `Ctrl+Z/Y` for undo/redo

---

## 📦 Installation

### Via ComfyUI Manager (recommended)
Search for **CWK Prompt Composer** in the ComfyUI Manager and install directly.

### Manual installation
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/cowneko/CWK_Prompt_Composer.git
```
Then restart ComfyUI.

---

## 🗂️ File Structure

```
CWK_Prompt_Composer/
├── __init__.py              ← Node registration + web directory
├── nodes.py                 ← Python node + /cwk/add_tag API route
└── web/
    ├── index.js             ← Extension entry, node draw & state
    ├── pill_canvas.js       ← PillCanvas widget + category colours
    ├── tag_browser.js       ← Flat & 3-level nested tag browsers
    ├── panel_dialog.js      ← Panel dialog, Lucky generator, NSFW toggle
    ├── preset_manager.js    ← Preset manager, window builder, storage helpers
    └── tags/
        ├── quality.json     ← Quality prompt tags
        ├── aesthetic.json   ← Aesthetic / style tags
        ├── main.json        ← Main subject / clothing / action / environment tags
        ├── negative.json    ← Negative prompt tags
        └── lucky.json       ← Lucky prompt pools (SFW + NSFW)
```

---

## 🖱️ Usage

1. Add the **CWK Prompt Composer** node to your workflow.
2. Click any of the four buttons on the node (⭐ Quality, 🖼️ Main, 🎨 Aesthetic, ❌ Negative) to open its panel.
3. Browse or filter tags in the bottom browser and click to add them as pills.
4. Type a custom tag in the input bar and press **Enter**.
5. Drag pills to reorder. Right-click a pill to set its weight or add it to the tag library.
6. Click **✅ Confirm** — the assembled prompt string is written back to the node widget.
7. The node outputs `positive_prompt` (Quality + Main + Aesthetic joined) and `negative_prompt`.

### Keyboard shortcuts (inside a panel)
| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Confirm |
| `Escape` | Cancel |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo |

---

## 🎨 Tag Categories

| Panel | Categories |
|---|---|
| **Quality** | Resolution, Detail, Rendering, Award Winning |
| **Aesthetic** | Framing, Art Style, Era, Mood, Color Palette, Lighting |
| **Main** | Characters, Clothing, Action, Environment, NSFW |
| **Negative** | Quality Issues, Anatomy, Faces, Hands, Composition |

---

## 🔧 Adding Tags Permanently

Right-click any pill in the canvas → **📌 Add to Tag List**, or click the **📌** button next to the free-type input. Choose the category and subcategory, then click **Add Tag**. The tag is written directly to the corresponding JSON file on disk.

---

## 📋 Presets

- **💾 Save Preset** — saves the current pill set under a name (stored in `localStorage`)
- **📋 Manage Presets** — load, rename, delete, export or import presets as JSON files

---

## 🪪 License

[MIT License](LICENSE) — © 2026 cowneko