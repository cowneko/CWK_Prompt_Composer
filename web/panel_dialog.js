import { PillCanvas }    from "./pill_canvas.js";
import { buildTagBrowser } from "./tag_browser.js";
import { presetManager, loadPresets, savePresets, makeWindow } from "./preset_manager.js";
import { tagEditor }     from "./tag_editor.js";
import { wildcardLoader } from "./wildcard_loader.js";

// ── Tag data store (filled by index.js) ─────────────────────────────────────
export const TAG_DATA   = { quality: [], aesthetic: [], main: [], negative: [] };
export let   LUCKY_DATA = {};

// ── NSFW toggle ──────────────────────────────────────────────────────────────
const NSFW_KEY = "cwk_nsfw_enabled";
function getNsfw()    { return localStorage.getItem(NSFW_KEY) === "true"; }
function setNsfw(val) { localStorage.setItem(NSFW_KEY, val ? "true" : "false"); }

// ── Lucky prompt generator ───────────────────────────────────────────────────
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateLuckyPrompt(nsfw) {
    const d = LUCKY_DATA;
    const pick = (sfwKey, nsfwKey) => {
        const pool = (nsfw && nsfwKey && d[nsfwKey]?.length)
            ? [...(d[sfwKey] || []), ...(d[nsfwKey] || [])]
            : (d[sfwKey] || []);
        return pool.length ? pickRandom(pool) : null;
    };
    return [
        pick("subject",     "nsfw_subject"),
        pick("clothing",    "nsfw_clothing"),
        pick("expression",  null),
        pick("action",      "nsfw_action"),
        pick("environment", null),
    ].filter(Boolean).map(p => ({ id: Math.random().toString(36).slice(2), text: p, category: "custom", weight: 1.0 }));
}

// ── Panel Dialog ─────────────────────────────────────────────────────────────
export class PanelDialog {
    constructor() {
        this._resolve  = null;
        this._canvas   = null;
        this._panelKey = null;

        const { win, backdrop, body, closeBtn, titleLabel } = makeWindow({
            title:     "",
            width:     "700px",
            height:    "600px",
            minWidth:  "480px",
            minHeight: "400px",
            zIndex:    "9999",
        });
        this._win        = win;
        this._backdrop   = backdrop;
        this._body       = body;
        this._titleLabel = titleLabel;
        closeBtn.addEventListener("click", () => this._cancel());
    }

    show({ title, panelKey, defaultValue = "" }) {
        this._panelKey = panelKey;
        this._canvas   = new PillCanvas(() => {});
        this._canvas.setValue(defaultValue);
        this._titleLabel.textContent = title;
        this._body.innerHTML = "";

        // wire up "Add to Tag List" callback
        this._canvas.onAddToList = (tag) => {
            tagEditor.show(tag, TAG_DATA[panelKey], panelKey);
        };

        const mkBtn = (text, bg, onClick) => {
            const btn = document.createElement("button");
            btn.textContent = text;
            Object.assign(btn.style, { padding: "5px 12px", background: bg, color: "#cdd6f4", border: "1px solid #313552", borderRadius: "6px", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap", fontFamily: "Inter, system-ui, sans-serif" });
            btn.addEventListener("click", onClick);
            return btn;
        };

        // ── Free-type input ────────────────────────────────────────────────
        const freeInput = document.createElement("input");
        freeInput.type        = "text";
        freeInput.placeholder = "✏️ Type a custom tag and press Enter…";
        Object.assign(freeInput.style, { flex: "1", padding: "5px 10px", background: "#1e2335", color: "#cdd6f4", border: "1px solid #313552", borderRadius: "6px", fontSize: "12px", minWidth: "0" });
        freeInput.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.stopPropagation();
            const val = freeInput.value.trim();
            if (val) { this._canvas.addTag(val, "custom"); freeInput.value = ""; }
        });

        // 📌 add free-typed tag to list
        const pinBtn = mkBtn("📌", "#1a2535", () => {
            const val = freeInput.value.trim();
            if (!val) return;
            tagEditor.show(val, TAG_DATA[panelKey], panelKey);
        });
        pinBtn.title = "Add this tag to the JSON list";

        const undoBtn = mkBtn("↩ Undo", "#1a2535", () => this._canvas.undo());
        const redoBtn = mkBtn("↪ Redo", "#1a2535", () => this._canvas.redo());

        const freeRow = document.createElement("div");
        Object.assign(freeRow.style, { display: "flex", gap: "6px", alignItems: "center", flexShrink: "0" });
        freeRow.append(freeInput, pinBtn, undoBtn, redoBtn);

        // ── Lucky row (main panel only) ────────────────────────────────────
        const extraRows = [];
        if (panelKey === "main") {
            let nsfwOn = getNsfw();
            const nsfwToggle = document.createElement("button");
            const updateNsfwBtn = () => {
                nsfwToggle.textContent = nsfwOn ? "🔞 NSFW: ON" : "🔒 NSFW: OFF";
                Object.assign(nsfwToggle.style, {
                    padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                    fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap", border: "1px solid",
                    fontFamily: "Inter, system-ui, sans-serif",
                    background:  nsfwOn ? "#2a1525" : "#1a2535",
                    color:       nsfwOn ? "#f38ba8" : "#6c7086",
                    borderColor: nsfwOn ? "#f38ba8" : "#313552",
                    transition:  "all 0.15s",
                });
            };
            updateNsfwBtn();
            nsfwToggle.addEventListener("click", () => { nsfwOn = !nsfwOn; setNsfw(nsfwOn); updateNsfwBtn(); });

            const luckyBtn = document.createElement("button");
            luckyBtn.textContent = "🎲 I Feel Lucky";
            Object.assign(luckyBtn.style, { padding: "5px 14px", background: "#1f2040", color: "#cba6f7", border: "1px solid #cba6f7", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", whiteSpace: "nowrap", fontFamily: "Inter, system-ui, sans-serif" });
            luckyBtn.addEventListener("click", () => this._canvas.setLucky(generateLuckyPrompt(getNsfw())));

            const luckyRow = document.createElement("div");
            Object.assign(luckyRow.style, { display: "flex", gap: "8px", alignItems: "center", flexShrink: "0" });
            luckyRow.append(luckyBtn, nsfwToggle);
            extraRows.push(luckyRow);
        }

        // ── Toolbar ────────────────────────────────────────────────────────
        const wildcardBtn = document.createElement("button");
        wildcardBtn.textContent = "📂 Wildcards";
        Object.assign(wildcardBtn.style, {
            padding: "5px 12px", background: "#1a2535", color: "#89dceb",
            border: "1px solid #89dceb55", borderRadius: "6px", cursor: "pointer",
            fontSize: "12px", whiteSpace: "nowrap",
            fontFamily: "Inter, system-ui, sans-serif",
        });
        wildcardBtn.title = "Load tags from a .yaml wildcard file";
        wildcardBtn.addEventListener("click", () => {
            wildcardLoader.show((tag) => {
                if (tag) this._canvas.addTag(tag, "custom");
            });
        });

        const toolbar = document.createElement("div");
        Object.assign(toolbar.style, { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", flexShrink: "0" });
        toolbar.append(
            mkBtn("🗑 Clear",          "#2a1525", () => this._canvas.clear()),
            mkBtn("🔗 Join",           "#1a2535", () => this._canvas.joinSelected()),
            mkBtn("✂ Split",           "#1a2535", () => this._canvas.splitSelected()),
            wildcardBtn,
            mkBtn("💾 Save Preset",    "#1a2535", () => this._savePreset()),
            mkBtn("📋 Manage Presets", "#1f2040", () => presetManager.show(this._panelKey, this._canvas)),
        );

        // ── Browser ────────────────────────────────────────────────────────
        const browser       = buildTagBrowser(TAG_DATA[panelKey], panelKey, (tag, category) => this._canvas.addTag(tag, category));
        const browserScroll = document.createElement("div");
        Object.assign(browserScroll.style, { overflowY: "auto", flex: "1", minHeight: "0" });
        browserScroll.appendChild(browser);

        // ── Bottom bar ─────────────────────────────────────────────────────
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, { padding: "8px 20px", background: "#1e2335", color: "#cdd6f4", border: "1px solid #313552", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontFamily: "Inter, system-ui, sans-serif" });
        cancelBtn.addEventListener("click", () => this._cancel());

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "✅ Confirm";
        Object.assign(confirmBtn.style, { padding: "8px 24px", background: "#89b4fa", color: "#141824", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", fontFamily: "Inter, system-ui, sans-serif" });
        confirmBtn.addEventListener("click", () => this._confirm());

        const bottomBar = document.createElement("div");
        Object.assign(bottomBar.style, { display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: "0" });
        bottomBar.append(cancelBtn, confirmBtn);

        const hr = document.createElement("hr");
        Object.assign(hr.style, { border: "none", borderTop: "1px solid #313552", margin: "0", flexShrink: "0" });

        this._body.append(
            this._canvas.el,
            freeRow,
            ...extraRows,
            toolbar,
            hr,
            browserScroll,
            bottomBar,
        );

        // ── Keyboard shortcuts ─────────────────────────────────────────────
        this._keyHandler = (e) => {
            if (e.key === "Escape")                                         { this._cancel();              return; }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey))              { this._confirm();             return; }
            if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey)  { e.preventDefault(); this._canvas.undo(); return; }
            if ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
                (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); this._canvas.redo(); return; }
        };
        document.addEventListener("keydown", this._keyHandler);

        this._backdrop.style.display = "block";
        this._win.style.display      = "flex";
        this._win.style.left         = "50%";
        this._win.style.top          = "60px";
        this._win.style.transform    = "translateX(-50%)";

        return new Promise((resolve) => { this._resolve = resolve; });
    }

    _confirm() {
        document.removeEventListener("keydown", this._keyHandler);
        const value = this._canvas?.getValue() ?? "";
        this._backdrop.style.display = "none";
        this._win.style.display      = "none";
        this._resolve?.(value);
        this._resolve = null;
    }

    _cancel() {
        document.removeEventListener("keydown", this._keyHandler);
        this._backdrop.style.display = "none";
        this._win.style.display      = "none";
        this._resolve?.(null);
        this._resolve = null;
    }

    _savePreset() {
        const name = window.prompt("Preset name:");
        if (!name?.trim()) return;
        const presets = loadPresets(this._panelKey);
        presets[name.trim()] = this._canvas.getValue();
        savePresets(this._panelKey, presets);
        alert(`✅ Preset "${name.trim()}" saved!`);
    }
}

export const panelDialog = new PanelDialog();