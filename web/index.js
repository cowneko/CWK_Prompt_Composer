import { app } from "../../scripts/app.js";
import { TAG_DATA, LUCKY_DATA, panelDialog } from "./panel_dialog.js";

// ── Load tag + lucky data ────────────────────────────────────────────────────
async function loadTagData() {
    const keys = ["quality", "aesthetic", "main", "negative"];
    await Promise.all(keys.map(async (key) => {
        try {
            const res = await fetch(`/extensions/CWK_Prompt_Composer/tags/${key}.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            TAG_DATA[key] = await res.json();
        } catch (e) {
            console.error(`[CWK] Failed to load tags/${key}.json:`, e);
            TAG_DATA[key] = [];
        }
    }));
    try {
        const res = await fetch(`/extensions/CWK_Prompt_Composer/tags/lucky.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        Object.assign(LUCKY_DATA, data);
    } catch (e) {
        console.error(`[CWK] Failed to load tags/lucky.json:`, e);
    }
}

// ── Node State ───────────────────────────────────────────────────────────────
const nodeState = {};
function getState(nodeId) {
    if (!nodeState[nodeId]) nodeState[nodeId] = {
        quality: "", main: "", aesthetic: "", negative: "",
        manualPositive: null,
        manualNegative: null,
        activeTab: "composer",
    };
    return nodeState[nodeId];
}

const BUTTONS = [
    { key: "quality",   label: "⭐ Quality Prompt"  },
    { key: "main",      label: "🖼️ Main Prompt"      },
    { key: "aesthetic", label: "🎨 Aesthetic Prompt" },
    { key: "negative",  label: "❌ Negative Prompt"  },
];

const BTN_H   = 28;
const BTN_GAP = 6;
const BTN_PAD = 10;
const TAB_H   = 24;

// ─── Colors (matching CWK Checkpoints Preset Manager) ───────────────────────
const C = {
    bg:       "#1a1f2e",
    bgFull:   "#141824",
    surface:  "#1e2335",
    border:   "#313552",
    text:     "#cdd6f4",
    textDim:  "#6c7086",
    textBlue: "#89b4fa",
    hoverBg:  "#2a2f45",
};

const NODE_COLOR   = "#1e2335";
const NODE_BGCOLOR = "#1a1f2e";

// ─── Parser setting row ──────────────────────────────────────────────────────
const SETTING_ROW_H  = 26;
const SETTING_LABEL_W = 110;
const PARSERS = ["comfy", "A1111"];

const SETTING_ROW = { key: "parser", label: "Parser", widget: "parser", type: "list", options: PARSERS };

// Default preview heights
const DEFAULT_POS_H = 120;
const DEFAULT_NEG_H = 60;

function getTopOffset(node) {
    const slotH    = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
    const numSlots = Math.max(node.outputs?.length ?? 0, node.inputs?.length ?? 0);
    return numSlots > 0 ? Math.ceil((numSlots - 1 + 0.7) * slotH) + 18 : 8;
}

function getButtonRects(node) {
    const w = node.size[0], top = getTopOffset(node);
    return BUTTONS.map((_, i) => ({
        x: BTN_PAD, y: top + i * (BTN_H + BTN_GAP),
        w: w - BTN_PAD * 2, h: BTN_H,
    }));
}

// ── Parser row layout ────────────────────────────────────────────────────────
function getSettingRowY(node) {
    const top = getTopOffset(node);
    return top + BUTTONS.length * BTN_H + (BUTTONS.length - 1) * BTN_GAP + BTN_GAP + 4;
}

function getSettingValueRect(node) {
    const ry = getSettingRowY(node);
    const x  = BTN_PAD + SETTING_LABEL_W;
    const w  = node.size[0] - x - BTN_PAD;
    return { x, y: ry + 1, w, h: SETTING_ROW_H - 2 };
}

// ── Layout rects ─────────────────────────────────────────────────────────────
function getLayoutRects(node) {
    const w = node.size[0];

    const settingBottom = getSettingRowY(node) + SETTING_ROW_H;

    const tabY    = settingBottom + BTN_GAP + 4;
    const halfW   = (w - BTN_PAD * 2 - 4) / 2;

    const previewY = tabY + TAB_H + 4;

    const bottomPad  = 8;
    const availableH = node.size[1] - previewY - bottomPad;

    const posH = Math.max(20, Math.floor((availableH - BTN_GAP) / 1.5));
    const negH = Math.max(10, Math.floor(posH / 2));

    return {
        tabY,
        composerTab: { x: BTN_PAD,            y: tabY, w: halfW, h: TAB_H },
        manualTab:   { x: BTN_PAD + halfW + 4, y: tabY, w: halfW, h: TAB_H },
        previewY,
        posRect: { x: BTN_PAD, y: previewY,                   w: w - BTN_PAD * 2, h: posH },
        negRect: { x: BTN_PAD, y: previewY + posH + BTN_GAP,  w: w - BTN_PAD * 2, h: negH },
    };
}

function getMinNodeHeight(node) {
    const { previewY } = getLayoutRects({ ...node, size: [node.size[0], 9999] });
    return previewY + DEFAULT_POS_H + BTN_GAP + DEFAULT_NEG_H + 8;
}

function syncWidgets(node) {
    const s = getState(node.id);
    const posVal = (s.activeTab === "manual" && s.manualPositive !== null)
        ? s.manualPositive
        : [s.quality, s.main, s.aesthetic].filter(Boolean).join(", ");
    const negVal = (s.activeTab === "manual" && s.manualNegative !== null)
        ? s.manualNegative
        : s.negative;

    const map = {
        quality_prompt:   s.quality,
        main_prompt:      s.main,
        aesthetic_prompt: s.aesthetic,
        negative_prompt:  s.negative,
    };

    if (s.activeTab === "manual") {
        map.quality_prompt   = posVal;
        map.main_prompt      = "";
        map.aesthetic_prompt = "";
        map.negative_prompt  = negVal;
    }

    for (const w of (node.widgets ?? [])) { if (w.name in map) w.value = map[w.name]; }
}

function getPositive(s) {
    if (s.activeTab === "manual" && s.manualPositive !== null) return s.manualPositive;
    return [s.quality, s.main, s.aesthetic].filter(Boolean).join(", ");
}
function getNegative(s) {
    if (s.activeTab === "manual" && s.manualNegative !== null) return s.manualNegative;
    return s.negative;
}

async function openPanel(node, key) {
    const s      = getState(node.id);
    const btn    = BUTTONS.find(b => b.key === key);
    const result = await panelDialog.show({ title: btn.label, panelKey: key, defaultValue: s[key] ?? "" });
    if (result !== null) { s[key] = result; syncWidgets(node); app.graph.setDirtyCanvas(true, true); }
}

// ── Parser widget helpers ────────────────────────────────────────────────────
function getParserValue(node) {
    const w = node.widgets?.find(w => w.name === "parser");
    return w?.value ?? "comfy";
}

function setParserValue(node, val) {
    const w = node.widgets?.find(w => w.name === "parser");
    if (w) { w.value = val; w.callback?.(val); }
    app.canvas.setDirty(true, false);
}

// ── Parser dropdown ──────────────────────────────────────────────────────────
let _parserDropdownOutside = null;

function openParserDropdown(node, currentValue, onCommit) {
    closeParserDropdown();

    const vr   = getSettingValueRect(node);
    const bbox = app.canvas.canvas.getBoundingClientRect();
    const zoom = app.canvas.ds?.scale ?? 1;
    const off  = app.canvas.ds?.offset ?? [0, 0];

    const cx = (node.pos[0] + vr.x) * zoom + off[0] * zoom + bbox.left;
    const cy = (node.pos[1] + vr.y) * zoom + off[1] * zoom + bbox.top;

    const sel = document.createElement("select");
    sel.id    = "cwk-composer-parser-dropdown";
    Object.assign(sel.style, {
        position:     "fixed",
        left:         cx + "px",
        top:          cy + "px",
        width:        (vr.w * zoom) + "px",
        height:       (vr.h * zoom) + "px",
        fontSize:     Math.round(11 * zoom) + "px",
        fontFamily:   "Inter, system-ui, sans-serif",
        background:   C.bgFull,
        color:        C.text,
        border:       `1px solid ${C.textBlue}`,
        borderRadius: "3px",
        outline:      "none",
        zIndex:       "99999",
        cursor:       "pointer",
        padding:      "0 4px",
    });

    for (const opt of PARSERS) {
        const o = document.createElement("option");
        o.value = opt; o.textContent = opt;
        if (String(currentValue) === opt) o.selected = true;
        sel.appendChild(o);
    }

    sel.addEventListener("mousedown", e => e.stopPropagation());
    sel.addEventListener("mouseup",   e => e.stopPropagation());
    sel.addEventListener("click",     e => e.stopPropagation());
    document.body.appendChild(sel);
    sel.focus();
    setTimeout(() => sel.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })), 0);

    let committed = false;
    const commit = () => {
        if (committed) return;
        committed = true;
        closeParserDropdown();
        onCommit(sel.value);
        app.canvas.setDirty(true, false);
    };

    sel.addEventListener("change", commit);
    sel.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter")  { e.preventDefault(); commit(); }
        if (e.key === "Escape") { committed = true; closeParserDropdown(); app.canvas.setDirty(true, false); }
    });

    _parserDropdownOutside = (e) => { if (e.target !== sel) commit(); };
    setTimeout(() => {
        document.addEventListener("mousedown", _parserDropdownOutside, { capture: true });
    }, 100);
}

function closeParserDropdown() {
    const el = document.getElementById("cwk-composer-parser-dropdown");
    if (el) el.remove();
    if (_parserDropdownOutside) {
        document.removeEventListener("mousedown", _parserDropdownOutside, { capture: true });
        _parserDropdownOutside = null;
    }
}

// ── Manual Override Overlay ───────────────────────────────────────────────────
let _manualOverlay = null;

function closeManualOverlay() {
    if (_manualOverlay) { _manualOverlay.remove(); _manualOverlay = null; }
}

function openManualOverlay(node, which) {
    closeManualOverlay();
    const s = getState(node.id);

    const overlay = document.createElement("div");
    _manualOverlay = overlay;
    Object.assign(overlay.style, {
        position: "fixed", zIndex: "9998", background: C.bgFull,
        border: `1px solid ${C.textBlue}`, borderRadius: "10px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.8)", padding: "14px",
        display: "flex", flexDirection: "column", gap: "10px",
        width: "460px", boxSizing: "border-box",
    });

    const titleEl = document.createElement("div");
    titleEl.textContent = which === "positive"
        ? "✅ Edit Positive Prompt (Manual)"
        : "❌ Edit Negative Prompt (Manual)";
    Object.assign(titleEl.style, {
        color: which === "positive" ? "#a6e3a1" : "#f38ba8",
        fontWeight: "bold", fontSize: "13px",
        fontFamily: "Inter, system-ui, sans-serif",
    });

    const ta = document.createElement("textarea");
    ta.value = which === "positive"
        ? (s.manualPositive ?? getPositive(s))
        : (s.manualNegative ?? getNegative(s));
    Object.assign(ta.style, {
        width: "100%", height: "120px", background: C.surface, color: C.text,
        border: `1px solid ${C.border}`, borderRadius: "6px", padding: "8px",
        fontSize: "12px", resize: "vertical", boxSizing: "border-box", fontFamily: "monospace",
    });

    const hint = document.createElement("div");
    hint.textContent = "💡 Type or paste a full prompt. This overrides the composer output.";
    Object.assign(hint.style, { color: C.textDim, fontSize: "11px" });

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });

    const mkBtn = (text, bg, color, onClick) => {
        const btn = document.createElement("button");
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: "6px 16px", background: bg, color,
            border: "none", borderRadius: "6px", cursor: "pointer",
            fontSize: "12px", fontWeight: "bold",
            fontFamily: "Inter, system-ui, sans-serif",
        });
        btn.addEventListener("click", onClick);
        return btn;
    };

    const clearBtn = mkBtn("🗑 Clear Override", "#2a1525", "#f38ba8", () => {
        if (which === "positive") s.manualPositive = null;
        else s.manualNegative = null;
        syncWidgets(node); app.graph.setDirtyCanvas(true, true); closeManualOverlay();
    });
    const cancelBtn  = mkBtn("Cancel",    C.surface, C.text, closeManualOverlay);
    const confirmBtn = mkBtn("✅ Apply",   "#1a2535", "#a6e3a1", () => {
        if (which === "positive") s.manualPositive = ta.value;
        else s.manualNegative = ta.value;
        syncWidgets(node); app.graph.setDirtyCanvas(true, true); closeManualOverlay();
    });

    btnRow.append(clearBtn, cancelBtn, confirmBtn);
    overlay.append(titleEl, ta, hint, btnRow);
    document.body.appendChild(overlay);

    overlay.style.left = (window.innerWidth  / 2 - 230) + "px";
    overlay.style.top  = (window.innerHeight / 2 - 120) + "px";

    const keyHandler = (e) => {
        if (e.key === "Escape")                             { closeManualOverlay(); document.removeEventListener("keydown", keyHandler); }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { confirmBtn.click();   document.removeEventListener("keydown", keyHandler); }
    };
    document.addEventListener("keydown", keyHandler);
    ta.focus(); ta.select();
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

function drawNode(node, ctx) {
    const s        = getState(node.id);
    const w        = node.size[0];
    const h        = node.size[1];
    const top      = getTopOffset(node);
    const isManual = s.activeTab === "manual";

    const { tabY, composerTab, manualTab, posRect, negRect } = getLayoutRects(node);

    ctx.save();

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);

    // Top separator
    ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, top - 8); ctx.lineTo(w - BTN_PAD, top - 8); ctx.stroke();

    // ── Composer buttons ──────────────────────────────────────────────────
    const rects = getButtonRects(node);
    for (let i = 0; i < BUTTONS.length; i++) {
        const { key, label } = BUTTONS[i], r = rects[i], hasValue = !!s[key];
        ctx.fillStyle = hasValue ? "#1a2535" : C.surface;
        ctx.strokeStyle = hasValue ? C.textBlue : C.border;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hasValue ? C.textBlue : C.text;
        ctx.font = "bold 13px Inter,system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2, r.w - 10);
    }

    // ── Parser row ────────────────────────────────────────────────────────
    const sry      = getSettingRowY(node);
    const svr      = getSettingValueRect(node);
    const parserVal = getParserValue(node);
    const isHov    = node._cwkParserHover === true;

    // Separator above parser row
    ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, sry - 4); ctx.lineTo(w - BTN_PAD, sry - 4); ctx.stroke();

    // Hover highlight
    if (isHov) {
        roundRect(ctx, BTN_PAD, sry, w - BTN_PAD * 2, SETTING_ROW_H, 3);
        ctx.fillStyle = C.hoverBg; ctx.fill();
    }

    // Label
    ctx.fillStyle = C.textDim; ctx.font = "11px Inter,system-ui,sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("Parser", BTN_PAD + 4, sry + SETTING_ROW_H / 2);

    // Value box
    roundRect(ctx, svr.x, svr.y, svr.w, svr.h, 4);
    ctx.fillStyle   = C.surface;
    ctx.strokeStyle = isHov ? C.border : "transparent";
    ctx.lineWidth   = 1; ctx.fill(); if (isHov) ctx.stroke();

    // Dropdown arrow
    ctx.fillStyle = isHov ? C.textBlue : C.textDim;
    ctx.font = "9px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("▾", svr.x + svr.w - 5, sry + SETTING_ROW_H / 2);

    // Value text
    ctx.fillStyle = C.text; ctx.font = "11px Inter,system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(parserVal, svr.x + 6, sry + SETTING_ROW_H / 2, svr.w - 18);

    // ── Tab separator ─────────────────────────────────────────────────────
    ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, tabY - 4); ctx.lineTo(w - BTN_PAD, tabY - 4); ctx.stroke();

    // ── Composer tab ──────────────────────────────────────────────────────
    ctx.fillStyle   = !isManual ? "#1a2535" : C.surface;
    ctx.strokeStyle = !isManual ? C.textBlue : C.border;
    ctx.lineWidth   = !isManual ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(composerTab.x, composerTab.y, composerTab.w, composerTab.h, [5, 5, 0, 0]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = !isManual ? C.textBlue : C.textDim;
    ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎨 Composer", composerTab.x + composerTab.w / 2, composerTab.y + composerTab.h / 2);

    // ── Manual tab ────────────────────────────────────────────────────────
    const hasManualOverride = s.manualPositive !== null || s.manualNegative !== null;
    ctx.fillStyle   = isManual ? "#1f2040" : C.surface;
    ctx.strokeStyle = isManual ? C.textBlue : C.border;
    ctx.lineWidth   = isManual ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(manualTab.x, manualTab.y, manualTab.w, manualTab.h, [5, 5, 0, 0]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = isManual ? C.textBlue : C.textDim;
    ctx.font = "bold 11px Inter,system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(
        "✏️ Manual" + (hasManualOverride && !isManual ? " ●" : ""),
        manualTab.x + manualTab.w / 2, manualTab.y + manualTab.h / 2,
    );

    // ── Preview boxes ─────────────────────────────────────────────────────
    if (posRect.h < 10) { ctx.restore(); return; }

    if (!isManual) {
        drawPreviewBox(ctx, { ...posRect, label: "✅ POSITIVE", text: getPositive(s) || "(empty)", color: "#a6e3a1" });
        if (negRect.h >= 10)
            drawPreviewBox(ctx, { ...negRect, label: "❌ NEGATIVE", text: getNegative(s) || "(empty)", color: "#f38ba8" });
    } else {
        drawPreviewBox(ctx, {
            ...posRect,
            label: "✅ POSITIVE" + (s.manualPositive !== null ? " (manual)" : " (click to override)"),
            text: getPositive(s) || "(empty)", color: "#a6e3a1", clickable: true,
        });
        if (negRect.h >= 10)
            drawPreviewBox(ctx, {
                ...negRect,
                label: "❌ NEGATIVE" + (s.manualNegative !== null ? " (manual)" : " (click to override)"),
                text: getNegative(s) || "(empty)", color: "#f38ba8", clickable: true,
            });
    }

    ctx.restore();
}

function drawPreviewBox(ctx, { x, y, w, h, label, text, color, clickable = false }) {
    ctx.fillStyle   = C.bgFull;
    ctx.strokeStyle = clickable ? color + "55" : C.border;
    ctx.lineWidth   = clickable ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.textDim; ctx.font = "bold 9px Inter,system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(label, x + 6, y + 5);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 5); ctx.clip();
    ctx.fillStyle = color; ctx.font = "11px Inter,system-ui,sans-serif"; ctx.textBaseline = "top";
    const lineH = 15, maxW = w - 12, startY = y + 18;
    const maxLines = Math.max(1, Math.floor((h - 22) / lineH));
    const words = text.split(/,\s*/);
    let line = "", lineN = 0;
    for (const word of words) {
        const test = line ? line + ", " + word : word;
        if (ctx.measureText(test).width > maxW && line) {
            if (lineN < maxLines) ctx.fillText(line + (lineN === maxLines - 1 ? "…" : ","), x + 6, startY + lineN * lineH);
            line = word; lineN++;
        } else { line = test; }
    }
    if (line && lineN < maxLines) ctx.fillText(line, x + 6, startY + lineN * lineH);
    ctx.restore();
}

// ── Hit test parser row ──────────────────────────────────────────────────────
function hitTestParserRow(node, lx, ly) {
    const ry = getSettingRowY(node);
    return ly >= ry && ly <= ry + SETTING_ROW_H && lx >= BTN_PAD && lx <= node.size[0] - BTN_PAD;
}

// ── Extension ────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "CWK.PromptComposer",

    async setup() {
        await loadTagData();
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "CWKPromptComposerNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply?.(this, arguments);

            this.color   = NODE_COLOR;
            this.bgcolor = NODE_BGCOLOR;
            this._cwkParserHover = false;

            this.size = [340, 100];
            const minH = getMinNodeHeight(this);
            this.size[1] = minH;
            getState(this.id);

            const HIDDEN = [
                "quality_prompt", "main_prompt", "aesthetic_prompt", "negative_prompt",
                "parser",
            ];
            for (const w of (this.widgets ?? [])) {
                if (HIDDEN.includes(w.name)) {
                    w.type        = "converted-widget";
                    w.hidden      = true;
                    w.computeSize = () => [0, -4];
                }
            }
        };

        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            onDrawForeground?.apply?.(this, arguments);
            if (this.flags?.collapsed) return;
            drawNode(this, ctx);
        };

        const onMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (e, localPos) {
            if (onMouseDown?.apply?.(this, arguments)) return true;
            if (this.flags?.collapsed) return false;

            const [mx, my] = localPos;
            const s        = getState(this.id);
            const { composerTab, manualTab, posRect, negRect } = getLayoutRects(this);
            const rects = getButtonRects(this);

            // Composer buttons
            for (let i = 0; i < BUTTONS.length; i++) {
                const r = rects[i];
                if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                    openPanel(this, BUTTONS[i].key);
                    return true;
                }
            }

            // Parser row
            if (hitTestParserRow(this, mx, my)) {
                openParserDropdown(this, getParserValue(this), val => setParserValue(this, val));
                return true;
            }

            // Composer tab
            if (mx >= composerTab.x && mx <= composerTab.x + composerTab.w &&
                my >= composerTab.y && my <= composerTab.y + composerTab.h) {
                s.activeTab = "composer";
                syncWidgets(this); app.graph.setDirtyCanvas(true, true);
                return true;
            }

            // Manual tab
            if (mx >= manualTab.x && mx <= manualTab.x + manualTab.w &&
                my >= manualTab.y && my <= manualTab.y + manualTab.h) {
                s.activeTab = "manual";
                syncWidgets(this); app.graph.setDirtyCanvas(true, true);
                return true;
            }

            // Manual mode: click preview boxes
            if (s.activeTab === "manual") {
                if (mx >= posRect.x && mx <= posRect.x + posRect.w &&
                    my >= posRect.y && my <= posRect.y + posRect.h) {
                    openManualOverlay(this, "positive");
                    return true;
                }
                if (negRect.h >= 10 &&
                    mx >= negRect.x && mx <= negRect.x + negRect.w &&
                    my >= negRect.y && my <= negRect.y + negRect.h) {
                    openManualOverlay(this, "negative");
                    return true;
                }
            }

            return false;
        };

        const onMouseMove = nodeType.prototype.onMouseMove;
        nodeType.prototype.onMouseMove = function (e, localPos) {
            onMouseMove?.apply?.(this, arguments);
            if (this.flags?.collapsed) return;
            const [mx, my] = localPos;
            const newHov = hitTestParserRow(this, mx, my);
            if (this._cwkParserHover !== newHov) {
                this._cwkParserHover = newHov;
                app.canvas.setDirty(true, false);
            }
        };

        const onMouseLeave = nodeType.prototype.onMouseLeave;
        nodeType.prototype.onMouseLeave = function () {
            onMouseLeave?.apply?.(this, arguments);
            if (this._cwkParserHover) {
                this._cwkParserHover = false;
                app.canvas.setDirty(true, false);
            }
        };

        nodeType.prototype.onSerialize = function (o) {
            o.cwk_state = getState(this.id);
        };
        nodeType.prototype.onConfigure = function (o) {
            if (o.cwk_state) {
                nodeState[this.id] = {
                    quality: "", main: "", aesthetic: "", negative: "",
                    manualPositive: null, manualNegative: null, activeTab: "composer",
                    ...o.cwk_state,
                };
                syncWidgets(this);
            }
        };
    },
});