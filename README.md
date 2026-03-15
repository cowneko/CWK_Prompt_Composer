# CWK Prompt Composer

A custom node for [ComfyUI](https://github.com/comfyanonymous/ComfyUI) that lets you compose positive and negative prompts using a visual **pill-based editor** with inline autocomplete, colored syntax highlighting, tag pickers, server-backed presets, wildcard file support, and **built-in CLIP encoding with A1111-compatible prompt parsing**.

---

## ✨ Features

- **Dual prompt panels** — Positive and Negative prompts, each with a text editor and pill-based tag editor mode
- **Inline autocomplete** — Start typing in text mode and get suggestions from all tag categories + embeddings, with color-coded results by category
- **Colored syntax highlighting** — Tags are colored by category (quality, style, aesthetic, main, negative, wildcard, embedding, custom) in real-time as you type
- **Pill canvas** — Switch to tag mode for a draggable, reorderable pill view; click to select, drag to rearrange
- **Weight control** — Right-click any pill to set its emphasis weight (e.g. `(tag:1.3)`); use `Ctrl+Up/Down` in text mode to adjust weight at caret; select multiple tags and `Ctrl+Up/Down` to adjust all at once
- **Tag pickers** — Browse Quality, Style, Aesthetic, and Negative tags via popup pickers with live search filtering
- **Smart insertion** — Tags are inserted at category-aware positions: quality → style → main → custom/wildcard → aesthetic → negative
- **Join / Split** — Merge selected pills with `_` or split underscore-joined pills apart
- **Move selected** — Move selected pills left/right with toolbar buttons
- **Undo / Redo** — Full history in pill mode
- **Server-backed presets** — Save, load, delete, export (JSON) and import presets stored as individual `.json` files in the `presets/` folder
- **Tabbed preset manager** — Presets organized by category (Quality, Style, Main, Aesthetic, Negative) with expandable tag previews
- **📂 Wildcard loader** — Browse `.yaml` wildcard files from the `wildcards/` folder, select categories/keys, pick entries or roll random — with file caching and last-selection memory
- **📌 Add to Tags** — Right-click any tag (in text mode or pill mode) and choose **Add to Tag List** with a category submenu to save it to the correct `.txt` file — tags are inserted **alphabetically**
- **Underscore ↔ Space toggle** — Right-click any tag to switch between underscores and spaces
- **📤 Export** — Export selected tag files (quality, style, main, aesthetic, negative) and/or prompt presets as downloadable `.txt` / `.json` files via a checkbox dialog
- **Token counter** — Each panel header displays a live token count with chunk indicator when exceeding 75 tokens
- **🔌 Built-in CLIP encoding** — Optional `CLIP` input with `positive_cond` and `negative_cond` conditioning outputs — no separate CLIP Text Encode node needed
- **🔤 A1111 prompt parser** — Selectable `parser` option (`comfy` / `A1111`) for Automatic1111-compatible prompt weighting with per-token emphasis and mean normalization
- **Embedding support** — Recursive scanning of all embedding folders; embeddings appear in autocomplete as `embedding:name`
- **Keyboard shortcuts** — Arrow keys + Tab/Enter for autocomplete navigation, Escape to dismiss, Ctrl+Up/Down to adjust tag weight

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
├── nodes.py                 ← Python node, CLIP encoding, A1111 parser, API endpoints
├── tags/                    ← Tag libraries (plain text, one tag per line, alphabetically sorted)
│   ├── quality.txt
│   ├── style.txt            ← Style/medium tags
│   ├── aesthetic.txt
│   ├── main.txt             ← Auto-downloaded from danbooru on first use
│   └── negative.txt
├── wildcards/               ← Place .yaml wildcard files here
│   └── example_poses.yaml
├── presets/                  ← Server-backed preset storage (individual .json files)
└── web/
    ├── index.js             ← Extension entry, DOM widget, node state & serialization
    ├── prompt_panel.js      ← PromptPanel: text/pill modes, autocomplete, presets, tag pickers, export
    ├── pill_canvas.js       ← PillCanvas widget + category colours
    ├── preset_manager.js    ← makeWindow helper, PresetManager class
    ├── tag_editor.js        ← Add-to-Tag-List dialog
    ├── wildcard_loader.js   ← Wildcard .yaml file loader & picker (server-backed)
    └── autocomplete.js      ← Autocomplete engine (unified tag index)
```

---

## 🖱️ Usage

1. Add the **CWK Prompt Composer** node to your workflow.
2. Connect a **CLIP** model to the optional `clip` input (to get conditioning outputs directly).
3. Choose a **parser** (`comfy` or `A1111`) from the dropdown on the node.
4. **Text mode** (default) — Type directly in the editor. Autocomplete appears after 2 characters. Tags are syntax-highlighted by category. Use `Ctrl+Up/Down` to adjust weight of the tag at the caret (or of a multi-tag selection).
5. **Tag mode** — Click **🏷 Edit Tags** to switch to the pill canvas. Drag to reorder, right-click for weight/context menu.
6. Use the header buttons (⭐ Quality, 🎭 Style, 🎨 Aesthetic, ❌ Negative, 📂 Wildcards) to open tag pickers.
7. In pill mode, use the toolbar for Join, Split, Move, Undo/Redo, Clear, Save Preset, Presets, and **📤 Export**.
8. Right-click any tag (in either mode) to access **Add to Tag List** (with category chooser), **Underscore ↔ Space toggle**, **Save as Preset**, and **Load Preset**.
9. Use **📤 Export** to select which tag files and/or presets to download — each tag file exports as `.txt`, presets as `.json`.

### Outputs

| Output | Type | Description |
|---|---|---|
| `positive_prompt` | STRING | Assembled positive prompt string |
| `negative_prompt` | STRING | Assembled negative prompt string |
| `positive_cond` | CONDITIONING | Encoded positive conditioning (requires CLIP input) |
| `negative_cond` | CONDITIONING | Encoded negative conditioning (requires CLIP input) |

### 🔤 Parser options

| Parser | Behaviour |
|---|---|
| `comfy` | Default ComfyUI syntax — weights applied as `(z - z_empty) × w + z_empty` |
| `A1111` | Automatic1111 webui syntax — `(word:1.3)`, `((word))`, `[word]`, `BREAK` — per-token emphasis with mean normalization, identical to smZ CLIP Text Encode++ |

> **Note:** The A1111 parser is fully self-contained. It does **not** require ComfyUI_smZNodes to be installed.

### 📂 Wildcard loader
Click **📂 Wildcards** in any panel header. Select a wildcard file from the dropdown (loaded from the `wildcards/` folder), choose a category/key, then click an entry to insert it or use **🎲 Insert Random Entry**. The loader remembers your last selected file and category.

### 📋 Presets
- **💾 Save Preset** — Save current pills (or selected pills) with a name and category. Stored as individual `.json` files in the `presets/` folder.
- **📋 Presets** — Open the tabbed preset manager to browse, load, delete, export all, or import from JSON files.

### 📤 Export
Click **📤 Export** in the tag-mode toolbar. A dialog with checkboxes lets you select which data to export:
- **⭐ Quality Tags** → `quality.txt`
- **🎭 Style Tags** → `style.txt`
- **🖼️ Main Tags** → `main.txt`
- **🎨 Aesthetic Tags** → `aesthetic.txt`
- **❌ Negative Tags** → `negative.txt`
- **📋 Prompt Presets** → `cwk_presets.json`

Each selected item downloads as a separate file. Tag files export as plain `.txt` (one tag per line), presets as `.json`.

### 📌 Adding Tags Permanently
Right-click any tag in text mode or pill mode and select **📌 Add to Tag List**. A category submenu lets you choose which `.txt` file (Quality, Style, Main, Aesthetic, Negative) the tag should be saved to. Spaces are automatically converted to underscores, and the tag is inserted in **alphabetical order**.

---

## 🎨 Tag Categories & Colors

| Category | Color | Source |
|---|---|---|
| Quality | 🟡 `#f9e2af` | `tags/quality.txt` |
| Style | 🟢 `#a6e3a1` | `tags/style.txt` |
| Aesthetic | 🟣 `#cba6f7` | `tags/aesthetic.txt` |
| Main | 🔵 `#89dceb` | `tags/main.txt` (danbooru) |
| Negative | 🔴 `#f38ba8` | `tags/negative.txt` |
| Embedding | ⚪ `#cdd6f4` | Auto-detected from ComfyUI |
| Wildcard | 🟢 `#94e2d5` | `wildcards/*.yaml` |
| Custom | ⚪ `#cdd6f4` | Free-typed tags |

---

## 🔌 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/cwk/tags/{key}` | Serve tag file as plain text (quality, style, aesthetic, main, negative) |
| POST | `/cwk/add_tag` | Add a tag to a tag file in alphabetical order (`{ key, tag }`) |
| POST | `/cwk/export` | Export selected tag files and/or presets (`{ items: [...] }`) |
| GET | `/cwk/embeddings` | List all embedding names (recursive) |
| GET | `/cwk/wildcards` | List all `.yaml` files in `wildcards/` |
| GET | `/cwk/wildcards/{filename}` | Serve raw YAML content of a wildcard file |
| GET | `/cwk/presets` | List all saved presets |
| POST | `/cwk/presets` | Save a preset (`{ name, category, pills }`) |
| DELETE | `/cwk/presets/{name}` | Delete a preset by name |

---

## 🪪 License

[MIT License](LICENSE) — © 2026 cowneko