# Changelog

All notable changes to **CWK Prompt Composer** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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