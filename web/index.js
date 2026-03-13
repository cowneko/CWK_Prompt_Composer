import { app } from "../../scripts/app.js";
import { PromptPanel, loadAllTags } from "./prompt_panel.js";

// ── Node State ───────────────────────────────────────────────────────────────
const nodeState = {};
function getState(nodeId) {
    if (!nodeState[nodeId]) nodeState[nodeId] = {
        positivePanel: null,
        negativePanel: null,
    };
    return nodeState[nodeId];
}

// ── Colors ───────────────────────────────────────────────────────────────────
const NODE_COLOR   = "#1e2335";
const NODE_BGCOLOR = "#1a1f2e";
const C = {
    surface:  "#1e2335",
    border:   "#313552",
    text:     "#cdd6f4",
    textDim:  "#6c7086",
    textBlue: "#89b4fa",
};

const PARSERS = ["comfy", "A1111"];

// ── Extension ────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "CWK.PromptComposer",

    async setup() {
        await loadAllTags();
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "CWKPromptComposerNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply?.(this, arguments);

            this.color   = NODE_COLOR;
            this.bgcolor = NODE_BGCOLOR;

            const state = getState(this.id);

            const widgetMap = {};
            for (const w of (this.widgets ?? [])) {
                widgetMap[w.name] = w;
                if (["positive_prompt", "negative_prompt", "parser"].includes(w.name)) {
                    w.type        = "converted-widget";
                    w.hidden      = true;
                    w.computeSize = () => [0, -4];
                }
            }

            const container = document.createElement("div");
            container.id = `cwk-composer-${this.id}`;
            Object.assign(container.style, {
                display:       "flex",
                flexDirection: "column",
                gap:           "6px",
                padding:       "8px",
                boxSizing:     "border-box",
                width:         "100%",
                height:        "100%",
                fontFamily:    "Inter, system-ui, sans-serif",
                overflow:      "hidden",
            });

            const parserRow = document.createElement("div");
            Object.assign(parserRow.style, { display: "flex", alignItems: "center", gap: "8px", flexShrink: "0" });

            const parserLabel = document.createElement("span");
            parserLabel.textContent = "Parser";
            Object.assign(parserLabel.style, { color: C.textDim, fontSize: "11px" });

            const parserSelect = document.createElement("select");
            Object.assign(parserSelect.style, {
                padding: "2px 6px", background: C.surface, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: "4px",
                fontSize: "11px", cursor: "pointer", outline: "none",
            });
            for (const opt of PARSERS) {
                const o = document.createElement("option");
                o.value = opt; o.textContent = opt;
                if (widgetMap.parser?.value === opt) o.selected = true;
                parserSelect.appendChild(o);
            }
            parserSelect.addEventListener("change", () => {
                if (widgetMap.parser) { widgetMap.parser.value = parserSelect.value; widgetMap.parser.callback?.(parserSelect.value); }
            });
            for (const evt of ["mousedown", "mouseup", "click", "keydown"]) {
                parserSelect.addEventListener(evt, (e) => e.stopPropagation());
            }

            parserRow.append(parserLabel, parserSelect);
            container.appendChild(parserRow);

            const sep = document.createElement("hr");
            Object.assign(sep.style, { border: "none", borderTop: `1px solid ${C.border}`, margin: "0", flexShrink: "0" });
            container.appendChild(sep);

            const panelsContainer = document.createElement("div");
            Object.assign(panelsContainer.style, {
                display:       "flex",
                flexDirection: "column",
                gap:           "6px",
                flex:          "1 1 0",
                minHeight:     "0",
                overflow:      "hidden",
            });

            const positivePanel = new PromptPanel({
                kind: "positive",
                onChange: (val) => { if (widgetMap.positive_prompt) widgetMap.positive_prompt.value = val; },
            });

            const negativePanel = new PromptPanel({
                kind: "negative",
                onChange: (val) => { if (widgetMap.negative_prompt) widgetMap.negative_prompt.value = val; },
            });

            state.positivePanel = positivePanel;
            state.negativePanel = negativePanel;

            if (widgetMap.positive_prompt?.value) positivePanel.setValue(widgetMap.positive_prompt.value);
            if (widgetMap.negative_prompt?.value) negativePanel.setValue(widgetMap.negative_prompt.value);

            panelsContainer.append(positivePanel.el, negativePanel.el);
            container.appendChild(panelsContainer);

            const nodeRef = this;
            const widget = this.addDOMWidget("cwk_composer_ui", "customtext", container, {
                getValue: () => "",
                setValue: () => {},
            });

            widget.computeSize = function (width) {
                const slotH    = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
                const numSlots = Math.max(nodeRef.outputs?.length ?? 0, nodeRef.inputs?.length ?? 0);
                const headerH  = numSlots > 0 ? Math.ceil((numSlots - 1 + 0.7) * slotH) + 18 : 8;
                const titleH   = LiteGraph.NODE_TITLE_HEIGHT ?? 30;
                const available = nodeRef.size[1] - titleH - headerH - 12;
                return [width, Math.max(200, available)];
            };
            widget.serializeValue = () => undefined;

            this.size = [380, 520];
        };

        const origSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (o) {
            origSerialize?.apply?.(this, arguments);
            const state = getState(this.id);
            o.cwk_state = {
                positive: state.positivePanel?.getState() ?? null,
                negative: state.negativePanel?.getState() ?? null,
            };
        };

        const origConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (o) {
            origConfigure?.apply?.(this, arguments);
            if (o.cwk_state) this._cwkPendingState = o.cwk_state;
        };

        const origOnAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function () {
            origOnAdded?.apply?.(this, arguments);
            if (this._cwkPendingState) {
                const state = getState(this.id);
                if (state.positivePanel && this._cwkPendingState.positive) {
                    state.positivePanel.restoreState(this._cwkPendingState.positive);
                }
                if (state.negativePanel && this._cwkPendingState.negative) {
                    state.negativePanel.restoreState(this._cwkPendingState.negative);
                }
                const widgetMap = {};
                for (const w of (this.widgets ?? [])) widgetMap[w.name] = w;
                if (widgetMap.positive_prompt && state.positivePanel) widgetMap.positive_prompt.value = state.positivePanel.getValue();
                if (widgetMap.negative_prompt && state.negativePanel) widgetMap.negative_prompt.value = state.negativePanel.getValue();
                delete this._cwkPendingState;
            }
        };

        const origOnResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function () {
            origOnResize?.apply?.(this, arguments);
            this.setDirtyCanvas?.(true, true);
        };
    },
});