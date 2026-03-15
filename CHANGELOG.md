# Changelog

All notable changes to **CWK Prompt Composer** will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.3.0] - 2026-03-15

### Added
- **📤 Export dialog** — New "📤 Export" button in the tag-mode toolbar opens a panel with checkboxes to select which data to export:
  - Quality tags, Style tags, Main tags, Aesthetic tags, Negative tags (each as `.txt`)
  - Prompt presets (as `cwk_presets.json`)
  - Select All / Select None quick buttons
  - Each selected item downloads as a separate file via browser download
- **`POST /cwk/export` endpoint** — New server endpoint that returns selected tag lists and/or presets as a JSON bundle

### Changed
- **Alphabetical tag insertion** — When adding a tag via "📌 Add to Tag List", the tag is now inserted in **alphabetical order** (case-insensitive) instead of being appended to the end of the file. Uses `bisect.bisect_left` for efficient sorted insertion and rewrites the file to maintain order.

---

## [2.2.0] - 2026-03-15

### Added
- **🎭 Style tag category** — New `style` category with its own `tags/style.txt` file, color (`#a6e3a1`), header button, tag picker, and preset tab — inserted between Quality and Main in the ordering
- **Ctrl+Up/Down weight control in text mode** — Adjust the weight of the tag at the caret using `Ctrl+Up` / `Ctrl+Down`; select multiple tags to adjust all at once
- **Token counter** — Each panel header now shows a live token count badge; turns yellow with chunk count when exceeding 75 tokens
- **Underscore ↔ Space toggle** — Right-click any tag (in text mode or pill mode) to toggle between underscores and spaces
- **Unified right-click context menu** — Both text mode and pill mode now show the same context menu with:
  - **📌 Add to Tag List** with a category submenu (Quality, Style, Main, Aesthetic, Negative)
  - **Underscore ↔ Space toggle**
  - **💾 Save as Preset** / **📋 Load Preset**
- **Text-mode right-click context menu** — Right-clicking in the text editor now opens a context menu for the tag at the caret (previously only available in pill mode)
- **`cleanup_main_tags.py` utility** — Standalone script to remove tags from `main.txt` that already exist in `quality.txt`, `style.txt`, `aesthetic.txt`, or `negative.txt`

### Changed
- **Two-row header layout** — Panel header split into two rows: Row 1 has the title label + token counter; Row 2 has category buttons, Wildcards, and Edit Tags (right-aligned)
- **Edit Tags button right-aligned** — The 🏷 Edit Tags / ✏️ Edit Text toggle button is now pushed to the right side of the button row
- **📌 Add to Tags with category chooser** — "Add to Tag List" now shows a submenu letting you pick which category file (Quality, Style, Main, Aesthetic, Negative) to save the tag to, instead of defaulting to the tag's current category
- **Removed 📌 Add to Tags toolbar button** — Functionality moved to the right-click context menu in both modes
- **Category ordering updated** — quality → style → main → custom/wildcard → aesthetic → negative
- **Preset manager tabs updated** — Now includes a Style tab

### Fixed
- **Right-click menu not closing** — Fixed an issue where the right-click context menu in preview/text mode would not close when clicking outside of it

---

## [2.1.0] - 2026-03-14

### Changed
- **Retain last used prompt** — The node can now retain the last used prompt after refresh/restart, and populate the prompts when dropping a generated image with metadata on the canvas.

---

## [2.0.0] - 2026-03-13

### Added
- **Complete UI rewrite** — Replaced canvas-drawn node with a full DOM widget-based interface embedded directly in the ComfyUI node
- **Dual-mode prompt panels** — Each panel (Positive / Negative) now has two modes:
  - **Text mode** — Contenteditable editor with inline autocomplete and real-time colored syntax highlighting by tag category
  - **Tag mode** — Pill canvas with drag-to-reorder, selection, join/split, move left/right, weight control
- **Inline autocomplete** — Autocomplete suggestions appear as you type (≥2 characters) in text mode, pulling from all tag files + embeddings
  - Color-coded by category (quality, aesthetic, main, negative, embedding)
  - Keyboard navigation: Arrow keys, Tab/Enter to accept, Escape to dismiss
  - Fixed-position dropdown (no longer clipped by container overflow)
- **Tag picker popups** — Header buttons (⭐ Quality, 🎨 Aesthetic, ❌ Negative) open searchable tag picker windows
- **Smart insertion** — Tags inserted at category-aware positions based on ordering: quality → main → custom/wildcard → aesthetic → negative
- **📂 Wildcard loader (server-backed)** — Wildcard `.yaml` files served from the `wildcards/` folder at the custom node root
  - Dropdown file selector (replaces manual file picker)
  - Server caches parsed data; remembers last selected file + category in localStorage
  - 🔄 Refresh button to rescan files
  - Entry list panel grows when window is resized
  - Pick multiple entries without closing the dialog
- **Server-backed presets** — Presets stored as individual `.json` files in `presets/` folder (replaces localStorage)
  - `GET /cwk/presets` — list all presets
  - `POST /cwk/presets` — save a preset
  - `DELETE /cwk/presets/{name}` — delete a preset
  - Tabbed preset manager organized by category with expandable tag previews
  - Import/export as JSON files
- **Recursive embedding scanning** — `/cwk/embeddings` endpoint now uses `os.walk()` to find embeddings in subfolders, returning relative paths like `subfolder/embedding_name`
- **📌 Add to Tags with sanitization** — When saving a tag with spaces, the backend replaces spaces with underscores; the pill is updated in-place with the sanitized version
- **Move selected block** — Toolbar buttons to move selected pills left/right as a group
- **Context menu extensions** — Right-click a pill for Save as Preset, Load Preset options
- **Panel destroy() method** — Cleanup for autocomplete dropdown appended to document.body

### Changed
- **Tags folder moved to root** — `web/tags/` → `tags/` at the custom node root for easier access
- **Tag format changed to plain text** — `.json` tag files replaced with `.txt` files (one tag per line), served via `/cwk/tags/{key}`
- **Danbooru tags auto-downloaded** — `tags/main.txt` is auto-downloaded and cleaned from the danbooru gist on first access
- **Window title bars simplified** — Removed colored dots (🔴🟡🟢) from all `makeWindow()` title bars
- **Parser selector** — Moved to inline dropdown within the node DOM widget (no longer a separate ComfyUI widget)

### Removed
- **Canvas-drawn UI** — Replaced entirely by DOM widget approach
- **Panel dialog system** — Replaced by inline PromptPanel components
- **Tag browser** — Replaced by tag picker popups and inline autocomplete
- **Lucky generator** — Removed in favor of wildcard loader
- **Manual override mode** — No longer needed; text mode provides direct editing
- **localStorage presets** — Replaced by server-backed `.json` file storage

### Technical Details
- DOM widget uses LiteGraph's `addDOMWidget()` with a flex container that distributes space 75/25 between positive and negative panels
- Autocomplete dropdown appended to `document.body` with `position: fixed` to avoid overflow clipping
- `computeSize` calculates available height from node dimensions minus title bar, slots, and padding
- All tag files served via aiohttp routes; add_tag endpoint sanitizes spaces to underscores before writing
- Preset files stored with sanitized filenames; duplicate detection scans all existing `.json` files by name field

---

## [1.2.0] - 2026-03-10

### Added
- **🔌 CLIP input & conditioning outputs** — The node now accepts an optional `CLIP` input and outputs `positive_cond` and `negative_cond` (CONDITIONING) in addition to the string outputs
- **🔤 A1111 prompt parser** — New `parser` dropdown on the node (`comfy` / `A1111`)
  - Full Automatic1111 webui-compatible attention parser, self-contained (no external dependencies)
  - Supports `(word:1.3)`, `((word))`, `[word]`, nested brackets, and `BREAK`
  - Per-token emphasis with mean normalization
- **🎨 Cosmetic refresh** — Node and panel dialog colors updated for visual consistency

### Technical Details
- A1111 parser implemented directly in `nodes.py` — zero dependency on ComfyUI_smZNodes
- Automatic discovery of inner tokenizers and encoders via `_get_tokenizer_info()` / `_get_encoder_info()`
- SDXL output concatenated as `[l_out, g_out]` along embed dim with `g_pooled` for pooled output

---

## [1.1.0] - 2026-03-06

### Added
- **✏️ Manual override mode** — New tab on the node canvas to bypass the composer entirely
- **📂 Wildcard loader** — Load tags from any `.yaml` wildcard file

### Changed
- **Preview box sizing** — Negative prompt preview is now half the height of the positive prompt preview (2:1 ratio)
- `getLayoutRects()` is now the single source of truth for all node layout geometry

---

## [1.0.0] - 2026-03-05

### Added
- Initial release of CWK Prompt Composer custom node for ComfyUI
- Four prompt panels: Quality, Main, Aesthetic, Negative
- Pill canvas with drag-to-reorder, selection, weight control
- Tag browser: flat 2-level and 3-level nested
- Free-type custom tag input
- Join / Split selected pills
- Undo / Redo history
- Preset save / load / rename / delete / export / import
- 🎲 I Feel Lucky random prompt generator
- 📌 Add-to-Tag-List
- Live preview on node canvas
- Curated tag libraries: quality.json, aesthetic.json, main.json, negative.json, lucky.json
- Resizable & draggable panel windows