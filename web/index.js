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

// Default heights for a fresh node (total = 120 + 6 + 60 = 186px of preview)
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

// ── Single source of truth for ALL layout rects ───────────────────────────────
// Derives posH and negH dynamically from node.size[1], always keeping negH = posH/2
function getLayoutRects(node) {
    const w   = node.size[0];
    const top = getTopOffset(node);

    // Y position right after the last button
    const btnsBottom = top + BUTTONS.length * BTN_H + (BUTTONS.length - 1) * BTN_GAP;

    // Tabs sit below buttons with a small gap
    const tabY    = btnsBottom + BTN_GAP + 4;   // 4px for the separator line area
    const halfW   = (w - BTN_PAD * 2 - 4) / 2;

    // Preview area starts right below the tabs
    const previewY = tabY + TAB_H + 4;

    // How much vertical space is available for the two preview boxes
    const bottomPad  = 8;
    const availableH = node.size[1] - previewY - bottomPad;

    // Split available space: posH gets 2 parts, negH gets 1 part
    //   availableH = posH + BTN_GAP + negH  and  negH = posH / 2
    //   => availableH = posH + BTN_GAP + posH/2 = 1.5*posH + BTN_GAP
    //   => posH = (availableH - BTN_GAP) / 1.5
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

// Minimum node height that fits all fixed elements + default preview heights
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
        position: "fixed", zIndex: "9998", background: "#181825",
        border: "1px solid #89b4fa", borderRadius: "10px",
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
    });

    const ta = document.createElement("textarea");
    ta.value = which === "positive"
        ? (s.manualPositive ?? getPositive(s))
        : (s.manualNegative ?? getNegative(s));
    Object.assign(ta.style, {
        width: "100%", height: "120px", background: "#11111b", color: "#cdd6f4",
        border: "1px solid #45475a", borderRadius: "6px", padding: "8px",
        fontSize: "12px", resize: "vertical", boxSizing: "border-box", fontFamily: "monospace",
    });

    const hint = document.createElement("div");
    hint.textContent = "💡 Type or paste a full prompt. This overrides the composer output.";
    Object.assign(hint.style, { color: "#6c7086", fontSize: "11px" });

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });

    const mkBtn = (text, bg, color, onClick) => {
        const btn = document.createElement("button");
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: "6px 16px", background: bg, color,
            border: "none", borderRadius: "6px", cursor: "pointer",
            fontSize: "12px", fontWeight: "bold",
        });
        btn.addEventListener("click", onClick);
        return btn;
    };

    const clearBtn = mkBtn("🗑 Clear Override", "#3b1f1f", "#f38ba8", () => {
        if (which === "positive") s.manualPositive = null;
        else s.manualNegative = null;
        syncWidgets(node); app.graph.setDirtyCanvas(true, true); closeManualOverlay();
    });
    const cancelBtn  = mkBtn("Cancel",    "#313244", "#cdd6f4", closeManualOverlay);
    const confirmBtn = mkBtn("✅ Apply",   "#1f3b2a", "#a6e3a1", () => {
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
function drawNode(node, ctx) {
    const s        = getState(node.id);
    const w        = node.size[0];
    const top      = getTopOffset(node);
    const isManual = s.activeTab === "manual";

    // All rects derived live from current node.size
    const { tabY, composerTab, manualTab, posRect, negRect } = getLayoutRects(node);

    ctx.save();

    // Top separator
    ctx.strokeStyle = "#313244"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, top - 8); ctx.lineTo(w - BTN_PAD, top - 8); ctx.stroke();

    // ── Composer buttons ──────────────────────────────────────────────────
    const rects = getButtonRects(node);
    for (let i = 0; i < BUTTONS.length; i++) {
        const { key, label } = BUTTONS[i], r = rects[i], hasValue = !!s[key];
        const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        grad.addColorStop(0, hasValue ? "#2a3a2a" : "#313244");
        grad.addColorStop(1, hasValue ? "#1a2a1a" : "#252535");
        ctx.fillStyle = grad; ctx.strokeStyle = hasValue ? "#a6e3a1" : "#45475a"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hasValue ? "#a6e3a1" : "#cdd6f4";
        ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2, r.w - 10);
    }

    // Tab separator
    ctx.strokeStyle = "#313244"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, tabY - 4); ctx.lineTo(w - BTN_PAD, tabY - 4); ctx.stroke();

    // ── Composer tab ──────────────────────────────────────────────────────
    ctx.fillStyle   = !isManual ? "#1f3b2a" : "#252535";
    ctx.strokeStyle = !isManual ? "#a6e3a1" : "#45475a";
    ctx.lineWidth   = !isManual ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(composerTab.x, composerTab.y, composerTab.w, composerTab.h, [5, 5, 0, 0]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = !isManual ? "#a6e3a1" : "#6c7086";
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎨 Composer", composerTab.x + composerTab.w / 2, composerTab.y + composerTab.h / 2);

    // ── Manual tab ────────────────────────────────────────────────────────
    const hasManualOverride = s.manualPositive !== null || s.manualNegative !== null;
    ctx.fillStyle   = isManual ? "#2a1f3b" : "#252535";
    ctx.strokeStyle = isManual ? "#89b4fa" : "#45475a";
    ctx.lineWidth   = isManual ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(manualTab.x, manualTab.y, manualTab.w, manualTab.h, [5, 5, 0, 0]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = isManual ? "#89b4fa" : "#6c7086";
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(
        "✏️ Manual" + (hasManualOverride && !isManual ? " ●" : ""),
        manualTab.x + manualTab.w / 2, manualTab.y + manualTab.h / 2,
    );

    // ── Preview boxes — only draw if there is enough room ─────────────────
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
    ctx.fillStyle   = "#11111b";
    ctx.strokeStyle = clickable ? color + "55" : "#313244";
    ctx.lineWidth   = clickable ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#6c7086"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(label, x + 6, y + 5);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 5); ctx.clip();
    ctx.fillStyle = color; ctx.font = "11px sans-serif"; ctx.textBaseline = "top";
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
            // Start with a sensible default height then let getMinNodeHeight finalise it
            this.size = [340, 100];  // temp height; getMinNodeHeight reads size[0] only
            const minH = getMinNodeHeight(this);
            this.size[1] = minH;
            getState(this.id);
            const HIDDEN = ["quality_prompt", "main_prompt", "aesthetic_prompt", "negative_prompt"];
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

            // Always recompute rects from current size
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

            // Manual mode: click preview boxes to edit
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