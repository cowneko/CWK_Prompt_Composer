import { makeWindow } from "./preset_manager.js";

// ── Add-to-Tag-List panel ────────────────────────────────────────────────────
class TagEditor {
    constructor() {
        const { win, backdrop, body, closeBtn } = makeWindow({
            title:     "📌 Add Tag to List",
            width:     "420px",
            height:    "auto",
            minWidth:  "340px",
            minHeight: "200px",
            zIndex:    "10002",
        });
        this._win      = win;
        this._backdrop = backdrop;
        this._body     = body;

        // auto height
        Object.assign(this._win.style, { height: "auto" });

        closeBtn.addEventListener("click", () => this.hide());
        this._resolve = null;
    }

    // tagData = TAG_DATA[panelKey], panelKey for the POST
    show(tag, tagData, panelKey) {
        this._body.innerHTML = "";
        this._panelKey = panelKey;

        const mkLabel = (text) => {
            const l = document.createElement("label");
            l.textContent = text;
            Object.assign(l.style, { color: "#a6adc8", fontSize: "12px", fontWeight: "bold", marginBottom: "2px", fontFamily: "Inter, system-ui, sans-serif" });
            return l;
        };

        const mkSelect = () => {
            const s = document.createElement("select");
            Object.assign(s.style, {
                padding:      "6px 10px",
                background:   "#1e2335",
                color:        "#cdd6f4",
                border:       "1px solid #313552",
                borderRadius: "6px",
                fontSize:     "13px",
                cursor:       "pointer",
                width:        "100%",
            });
            return s;
        };

        // ── Tag name ───────────────────────────────────────────────────────
        const tagInput = document.createElement("input");
        tagInput.type  = "text";
        tagInput.value = tag;
        Object.assign(tagInput.style, {
            padding:      "6px 10px",
            background:   "#1e2335",
            color:        "#cdd6f4",
            border:       "1px solid #313552",
            borderRadius: "6px",
            fontSize:     "13px",
            width:        "100%",
            boxSizing:    "border-box",
        });

        // ── Category select ────────────────────────────────────────────────
        const catSelect = mkSelect();
        tagData.forEach(group => {
            const opt = document.createElement("option");
            opt.value       = group.category;
            opt.textContent = group.category;
            catSelect.appendChild(opt);
        });

        // ── Subcategory select ─────────────────────────────────────────────
        const subSelect = mkSelect();

        const populateSubs = (categoryName) => {
            subSelect.innerHTML = "";
            const group = tagData.find(g => g.category === categoryName);
            if (!group) return;
            group.subcategories.forEach(sub => {
                const opt = document.createElement("option");
                opt.value       = sub.name;
                opt.textContent = `${sub.name} (${sub.tags.length})`;
                subSelect.appendChild(opt);
            });
        };
        populateSubs(catSelect.value);
        catSelect.addEventListener("change", () => populateSubs(catSelect.value));

        // ── Status message ─────────────────────────────────────────────────
        const status = document.createElement("div");
        Object.assign(status.style, { fontSize: "12px", minHeight: "18px", textAlign: "center" });

        // ── Buttons ────────────────────────────────────────────────────────
        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "📌 Add Tag";
        Object.assign(confirmBtn.style, {
            padding: "8px 20px", background: "#89b4fa", color: "#141824",
            border: "none", borderRadius: "6px", cursor: "pointer",
            fontWeight: "bold", fontSize: "13px", flex: "1",
            fontFamily: "Inter, system-ui, sans-serif",
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, {
            padding: "8px 20px", background: "#1e2335", color: "#cdd6f4",
            border: "1px solid #313552", borderRadius: "6px", cursor: "pointer",
            fontSize: "13px", flex: "1",
            fontFamily: "Inter, system-ui, sans-serif",
        });
        cancelBtn.addEventListener("click", () => this.hide());

        confirmBtn.addEventListener("click", async () => {
            const tagVal = tagInput.value.trim();
            const catVal = catSelect.value;
            const subVal = subSelect.value;
            if (!tagVal) { status.textContent = "⚠️ Tag name cannot be empty."; status.style.color = "#f9e2af"; return; }

            confirmBtn.disabled   = true;
            confirmBtn.textContent = "Saving…";
            status.textContent    = "";

            try {
                const res  = await fetch("/cwk/add_tag", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ panelKey: this._panelKey, category: catVal, subcategory: subVal, tag: tagVal }),
                });
                const json = await res.json();

                if (json.ok) {
                    status.style.color = "#a6e3a1";
                    status.textContent = `✅ "${tagVal}" added to ${catVal} › ${subVal}`;
                    confirmBtn.textContent = "📌 Add Tag";
                    confirmBtn.disabled    = false;
                    // brief pause then close
                    setTimeout(() => this.hide(), 1200);
                } else if (json.duplicate) {
                    status.style.color    = "#f9e2af";
                    status.textContent    = `⚠️ Already exists in ${json.where}`;
                    confirmBtn.textContent = "📌 Add Tag";
                    confirmBtn.disabled    = false;
                } else {
                    status.style.color    = "#f38ba8";
                    status.textContent    = `❌ ${json.error}`;
                    confirmBtn.textContent = "📌 Add Tag";
                    confirmBtn.disabled    = false;
                }
            } catch (e) {
                status.style.color    = "#f38ba8";
                status.textContent    = `❌ Network error: ${e.message}`;
                confirmBtn.textContent = "📌 Add Tag";
                confirmBtn.disabled    = false;
            }
        });

        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, { display: "flex", gap: "8px" });
        btnRow.append(confirmBtn, cancelBtn);

        // ── Layout ───────────────────────────────────────────────────────────
        const grid = document.createElement("div");
        Object.assign(grid.style, { display: "flex", flexDirection: "column", gap: "10px" });

        const tagGroup = document.createElement("div");
        Object.assign(tagGroup.style, { display: "flex", flexDirection: "column", gap: "4px" });
        tagGroup.append(mkLabel("Tag"), tagInput);

        const catGroup = document.createElement("div");
        Object.assign(catGroup.style, { display: "flex", flexDirection: "column", gap: "4px" });
        catGroup.append(mkLabel("Category"), catSelect);

        const subGroup = document.createElement("div");
        Object.assign(subGroup.style, { display: "flex", flexDirection: "column", gap: "4px" });
        subGroup.append(mkLabel("Subcategory"), subSelect);

        grid.append(tagGroup, catGroup, subGroup, status, btnRow);
        this._body.appendChild(grid);

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
}

export const tagEditor = new TagEditor();