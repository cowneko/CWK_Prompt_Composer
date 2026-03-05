# Changelog

All notable changes to **CWK Prompt Composer** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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