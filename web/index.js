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
        // LUCKY_DATA is exported as `let` so we mutate its keys
        const data = await res.json();
        Object.assign(LUCKY_DATA, data);
    } catch (e) {
        console.error(`[CWK] Failed to load tags/lucky.json:`, e);
    }
}

// ── Node State ───────────────────────────────────────────────────────────────
const nodeState = {};
function getState(nodeId) {
    if (!nodeState[nodeId]) nodeState[nodeId] = { quality: "", main: "", aesthetic: "", negative: "" };
    return nodeState[nodeId];
}

const BUTTONS = [
    { key: "quality",   label: "⭐ Quality Prompt"  },
    { key: "main",      label: "🖼️ Main Prompt"      },
    { key: "aesthetic", label: "🎨 Aesthetic Prompt" },
    { key: "negative",  label: "❌ Negative Prompt"  },
];

const BTN_H = 28, BTN_GAP = 6, BTN_PAD = 10;

function getTopOffset(node) {
    const slotH    = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
    const numSlots = Math.max(node.outputs?.length ?? 0, node.inputs?.length ?? 0);
    return numSlots > 0 ? Math.ceil((numSlots - 1 + 0.7) * slotH) + 18 : 8;
}

function getButtonRects(node) {
    const w = node.size[0], top = getTopOffset(node);
    return BUTTONS.map((_, i) => ({ x: BTN_PAD, y: top + i * (BTN_H + BTN_GAP), w: w - BTN_PAD * 2, h: BTN_H }));
}

function syncWidgets(node) {
    const s   = getState(node.id);
    const map = { quality_prompt: s.quality, main_prompt: s.main, aesthetic_prompt: s.aesthetic, negative_prompt: s.negative };
    for (const w of (node.widgets ?? [])) { if (w.name in map) w.value = map[w.name]; }
}

function getPositive(s) { return [s.quality, s.main, s.aesthetic].filter(Boolean).join(", "); }

async function openPanel(node, key) {
    const s      = getState(node.id);
    const btn    = BUTTONS.find(b => b.key === key);
    const result = await panelDialog.show({ title: btn.label, panelKey: key, defaultValue: s[key] ?? "" });
    if (result !== null) { s[key] = result; syncWidgets(node); app.graph.setDirtyCanvas(true, true); }
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function drawNode(node, ctx) {
    const s = getState(node.id), rects = getButtonRects(node), w = node.size[0], top = getTopOffset(node);
    ctx.save();
    ctx.strokeStyle = "#313244"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(BTN_PAD, top - 8); ctx.lineTo(w - BTN_PAD, top - 8); ctx.stroke();

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

    const lastRect = rects[rects.length - 1];
    const previewY = lastRect.y + lastRect.h + BTN_GAP * 2;
    const previewH = node.size[1] - previewY - 8;
    if (previewH < 30) { ctx.restore(); return; }
    const halfH = Math.floor((previewH - BTN_GAP) / 2);
    drawPreviewBox(ctx, { x: BTN_PAD, y: previewY,                   w: w - BTN_PAD * 2, h: halfH, label: "✅ POSITIVE", text: getPositive(s) || "(empty)", color: "#a6e3a1" });
    drawPreviewBox(ctx, { x: BTN_PAD, y: previewY + halfH + BTN_GAP, w: w - BTN_PAD * 2, h: halfH, label: "❌ NEGATIVE", text: s.negative || "(empty)",     color: "#f38ba8" });
    ctx.restore();
}

function drawPreviewBox(ctx, { x, y, w, h, label, text, color }) {
    ctx.fillStyle = "#11111b"; ctx.strokeStyle = "#313244"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#6c7086"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(label, x + 6, y + 5);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 5); ctx.clip();
    ctx.fillStyle = color; ctx.font = "11px sans-serif"; ctx.textBaseline = "top";
    const lineH = 15, maxW = w - 12, startY = y + 18, maxLines = Math.max(1, Math.floor((h - 22) / lineH));
    const words = text.split(/,\s*/);
    let line = "", lineN = 0;
    for (const word of words) {
        const test = line ? line + ", " + word : word;
        if (ctx.measureText(test).width > maxW && line) {
            if (lineN < maxLines) ctx.fillText(line + (lineN === maxLines - 1 ? "…" : ","), x + 6, startY + lineN * lineH);
            line = word; lineN++;
        } else line = test;
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
            this.size = [340, 420];
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
            const [mx, my] = localPos, rects = getButtonRects(this);
            for (let i = 0; i < BUTTONS.length; i++) {
                const r = rects[i];
                if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
                    openPanel(this, BUTTONS[i].key);
                    return true;
                }
            }
            return false;
        };

        nodeType.prototype.onSerialize = function (o) { o.cwk_state = getState(this.id); };
        nodeType.prototype.onConfigure = function (o) {
            if (o.cwk_state) { nodeState[this.id] = { ...o.cwk_state }; syncWidgets(this); }
        };
    },
});