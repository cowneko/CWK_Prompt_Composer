import { makeWindow } from "./preset_manager.js";

// ── Minimal YAML wildcard parser ─────────────────────────────────────────────
// Supports the standard A1111/ComfyUI wildcard format:
//   key:
//     - value 1
//     - value 2
//   # or flat list at root:
//   - value 1
//   - value 2
// Returns: { [key: string]: string[] }  OR  { __root__: string[] } for flat lists
function parseWildcardYaml(text) {
    const lines   = text.split(/\r?\n/);
    const result  = {};
    let curKey    = null;

    for (let raw of lines) {
        const line = raw.trimEnd();
        if (!line || line.trimStart().startsWith("#")) continue; // blank / comment

        // key:   (top-level mapping key, no leading spaces)
        const keyMatch = line.match(/^([A-Za-z0-9 _\-./]+):\s*$/);
        if (keyMatch && !line.startsWith(" ") && !line.startsWith("\t")) {
            curKey = keyMatch[1].trim();
            if (!result[curKey]) result[curKey] = [];
            continue;
        }

        // - value   (list item, may be indented)
        const listMatch = line.match(/^[\s]*-\s+(.+)$/);
        if (listMatch) {
            const val = listMatch[1].trim();
            if (curKey === null) {
                // flat root list
                if (!result["__root__"]) result["__root__"] = [];
                result["__root__"].push(val);
            } else {
                result[curKey].push(val);
            }
            continue;
        }

        // inline list: key: [a, b, c]
        const inlineMatch = line.match(/^([A-Za-z0-9 _\-./]+):\s*\[(.+)\]$/);
        if (inlineMatch) {
            const k  = inlineMatch[1].trim();
            const vs = inlineMatch[2].split(",").map(s => s.trim()).filter(Boolean);
            result[k] = vs;
            curKey    = k;
            continue;
        }

        // bare value (no dash, no colon) — treat as root entry
        const bare = line.trim();
        if (bare && !bare.includes(":")) {
            if (!result["__root__"]) result["__root__"] = [];
            result["__root__"].push(bare);
        }
    }

    return result;
}

// ── Wildcard Loader Dialog ───────────────────────────────────────────────────
class WildcardLoader {
    constructor() {
        const { win, backdrop, body, closeBtn } = makeWindow({
            title:     "📂 Load from Wildcard",
            width:     "500px",
            height:    "auto",
            minWidth:  "380px",
            minHeight: "200px",
            zIndex:    "10003",
        });
        this._win      = win;
        this._backdrop = backdrop;
        this._body     = body;
        Object.assign(this._win.style, { height: "auto" });
        closeBtn.addEventListener("click", () => this.hide());

        this._callback = null;
        this._data     = {};   // parsed YAML: { key: string[] }
        this._fileName = "";
    }

    show(onTagSelected) {
        this._callback = onTagSelected;
        this._data     = {};
        this._fileName = "";
        this._render();
        this._backdrop.style.display = "block";
        this._win.style.display      = "flex";
        this._win.style.left         = "50%";
        this._win.style.top          = "160px";
        this._win.style.transform    = "translateX(-50%)";
    }

    hide() {
        this._backdrop.style.display = "none";
        this._win.style.display      = "none";
    }

    _render() {
        this._body.innerHTML = "";

        // ── Step 1: File picker ────────────────────────────────────────────
        const step1 = this._mkSection("Step 1 — Choose a .yaml wildcard file");

        const fileRow = document.createElement("div");
        Object.assign(fileRow.style, { display: "flex", gap: "8px", alignItems: "center" });

        const fileLabel = document.createElement("span");
        fileLabel.textContent = this._fileName || "No file selected";
        Object.assign(fileLabel.style, {
            flex: "1", fontSize: "12px",
            color: this._fileName ? "#cdd6f4" : "#6c7086",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        });

        const browseBtn = document.createElement("button");
        browseBtn.textContent = "📂 Browse…";
        Object.assign(browseBtn.style, {
            padding: "6px 14px", background: "#1f2d3b", color: "#89dceb",
            border: "1px solid #89dceb55", borderRadius: "6px",
            cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap",
        });

        const fileInput = document.createElement("input");
        fileInput.type   = "file";
        fileInput.accept = ".yaml,.yml";
        fileInput.style.display = "none";

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            if (!file) return;
            try {
                const text     = await file.text();
                this._data     = parseWildcardYaml(text);
                this._fileName = file.name;
                this._render(); // re-render with data
            } catch (e) {
                alert("❌ Failed to parse YAML: " + e.message);
            }
        });
        browseBtn.addEventListener("click", () => fileInput.click());

        fileRow.append(fileLabel, browseBtn, fileInput);
        step1.appendChild(fileRow);
        this._body.appendChild(step1);

        // ── Step 2: Category / key picker (only once file is loaded) ──────
        if (Object.keys(this._data).length === 0) return;

        const keys = Object.keys(this._data);

        const step2 = this._mkSection("Step 2 — Select a category / key");

        const keySelect = document.createElement("select");
        Object.assign(keySelect.style, {
            width:        "100%",
            padding:      "6px 10px",
            background:   "#1e1e2e",
            color:        "#cdd6f4",
            border:       "1px solid #45475a",
            borderRadius: "6px",
            fontSize:     "13px",
            cursor:       "pointer",
            boxSizing:    "border-box",
        });
        for (const k of keys) {
            const opt = document.createElement("option");
            opt.value       = k;
            opt.textContent = k === "__root__" ? `(root list — ${this._data[k].length} entries)` : `${k}  (${this._data[k].length})`;
            keySelect.appendChild(opt);
        }
        step2.appendChild(keySelect);
        this._body.appendChild(step2);

        // ── Step 3: Pick or roll ───────────────────────────────────────────
        const step3 = this._mkSection("Step 3 — Pick an entry");

        // Value list (scrollable)
        const listWrap = document.createElement("div");
        Object.assign(listWrap.style, {
            maxHeight: "200px", overflowY: "auto", background: "#11111b",
            border: "1px solid #313244", borderRadius: "6px", padding: "6px",
            display: "flex", flexWrap: "wrap", gap: "4px",
        });

        const renderList = (key) => {
            listWrap.innerHTML = "";
            const values = this._data[key] || [];
            if (values.length === 0) {
                const empty = document.createElement("span");
                empty.textContent = "(no entries)";
                Object.assign(empty.style, { color: "#45475a", fontSize: "12px", padding: "4px" });
                listWrap.appendChild(empty);
                return;
            }
            for (const val of values) {
                const chip = document.createElement("div");
                chip.textContent = val;
                Object.assign(chip.style, {
                    padding: "2px 10px", borderRadius: "10px", background: "#1e1e2e",
                    border: "1px solid #89dceb55", color: "#89dcebcc",
                    fontSize: "11px", cursor: "pointer", userSelect: "none", transition: "all 0.1s",
                });
                chip.addEventListener("mouseenter", () => { chip.style.background = "#89dceb22"; chip.style.borderColor = "#89dceb"; chip.style.color = "#89dceb"; });
                chip.addEventListener("mouseleave", () => { chip.style.background = "#1e1e2e";   chip.style.borderColor = "#89dceb55"; chip.style.color = "#89dcebcc"; });
                chip.addEventListener("click", () => {
                    this._callback?.(val);
                    this.hide();
                });
                listWrap.appendChild(chip);
            }
        };

        renderList(keySelect.value);
        keySelect.addEventListener("change", () => renderList(keySelect.value));
        step3.appendChild(listWrap);

        // Random roll button
        const rollBtn = document.createElement("button");
        rollBtn.textContent = "🎲 Insert Random Entry";
        Object.assign(rollBtn.style, {
            marginTop: "8px", padding: "7px 16px", width: "100%",
            background: "#2a1f3b", color: "#cba6f7",
            border: "1px solid #cba6f7", borderRadius: "6px",
            cursor: "pointer", fontSize: "12px", fontWeight: "bold",
        });
        rollBtn.addEventListener("click", () => {
            const values = this._data[keySelect.value] || [];
            if (!values.length) return;
            const pick = values[Math.floor(Math.random() * values.length)];
            this._callback?.(pick);
            this.hide();
        });
        step3.appendChild(rollBtn);
        this._body.appendChild(step3);

        // ── Cancel ─────────────────────────────────────────────────────────
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Close";
        Object.assign(cancelBtn.style, {
            marginTop: "4px", padding: "6px 18px", background: "#313244",
            color: "#cdd6f4", border: "none", borderRadius: "6px",
            cursor: "pointer", fontSize: "12px", alignSelf: "flex-end",
        });
        cancelBtn.addEventListener("click", () => this.hide());
        this._body.appendChild(cancelBtn);
    }

    _mkSection(labelText) {
        const wrap = document.createElement("div");
        Object.assign(wrap.style, { display: "flex", flexDirection: "column", gap: "6px" });
        const lbl = document.createElement("div");
        lbl.textContent = labelText;
        Object.assign(lbl.style, { color: "#89b4fa", fontSize: "11px", fontWeight: "bold", letterSpacing: "0.04em", textTransform: "uppercase" });
        wrap.appendChild(lbl);
        return wrap;
    }
}

export const wildcardLoader = new WildcardLoader();