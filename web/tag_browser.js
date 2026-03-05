import { categoryColor } from "./pill_canvas.js";

// ── Flat browser (quality / aesthetic / negative) ────────────────────────────
function buildFlatBrowser(tagData, onTagClick) {
    const filterInput = document.createElement("input");
    filterInput.type        = "text";
    filterInput.placeholder = "🔍 Filter tags…";
    Object.assign(filterInput.style, {
        width:        "100%",
        padding:      "6px 10px",
        background:   "#1e1e2e",
        color:        "#cdd6f4",
        border:       "1px solid #45475a",
        borderRadius: "6px",
        fontSize:     "13px",
        boxSizing:    "border-box",
        marginBottom: "8px",
    });

    const browserContent = document.createElement("div");
    Object.assign(browserContent.style, { display: "flex", flexDirection: "column", gap: "6px" });

    function renderBrowser(filter = "") {
        browserContent.innerHTML = "";
        const q = filter.toLowerCase().trim();

        for (const group of tagData) {
            const groupColor = categoryColor(group.category);
            for (const sub of group.subcategories) {
                const matchedTags = q ? sub.tags.filter(t => t.toLowerCase().includes(q)) : sub.tags;
                if (matchedTags.length === 0) continue;

                let collapsed = !q;

                const arrow = document.createElement("span");
                arrow.textContent = "▼";
                Object.assign(arrow.style, {
                    fontSize: "10px", transition: "transform 0.15s",
                    display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "",
                    color: groupColor,
                });

                const header = document.createElement("div");
                Object.assign(header.style, {
                    display: "flex", alignItems: "center", gap: "6px", cursor: "pointer",
                    padding: "4px 6px", borderRadius: "4px", background: "#1e1e2e",
                    fontSize: "12px", fontWeight: "bold", userSelect: "none",
                    borderLeft: `3px solid ${groupColor}`,
                });

                const catLabel = document.createElement("span");
                catLabel.textContent = `${group.category}  ›  ${sub.name}`;
                catLabel.style.color = groupColor;

                const countLabel = document.createElement("span");
                countLabel.textContent = `(${matchedTags.length})`;
                Object.assign(countLabel.style, { color: "#6c7086", fontWeight: "normal" });

                header.append(arrow, catLabel, countLabel);

                const tagsEl = document.createElement("div");
                Object.assign(tagsEl.style, {
                    display: collapsed ? "none" : "flex",
                    flexWrap: "wrap", gap: "4px", padding: "4px 4px 4px 16px",
                });

                matchedTags.forEach(tag => {
                    const chip = document.createElement("div");
                    chip.textContent = tag;
                    Object.assign(chip.style, {
                        padding: "2px 8px", borderRadius: "10px", background: "#1e1e2e",
                        border: `1px solid ${groupColor}88`, color: groupColor + "cc",
                        fontSize: "11px", cursor: "pointer", userSelect: "none", transition: "all 0.1s",
                    });
                    chip.addEventListener("mouseenter", () => { chip.style.background = groupColor + "22"; chip.style.borderColor = groupColor; chip.style.color = groupColor; });
                    chip.addEventListener("mouseleave", () => { chip.style.background = "#1e1e2e"; chip.style.borderColor = groupColor + "88"; chip.style.color = groupColor + "cc"; });
                    chip.addEventListener("click", () => onTagClick(tag, group.category));
                    tagsEl.appendChild(chip);
                });

                header.addEventListener("click", () => {
                    collapsed             = !collapsed;
                    tagsEl.style.display  = collapsed ? "none" : "flex";
                    arrow.style.transform = collapsed ? "rotate(-90deg)" : "";
                });

                browserContent.appendChild(header);
                browserContent.appendChild(tagsEl);
            }
        }
    }

    renderBrowser();
    filterInput.addEventListener("input", () => renderBrowser(filterInput.value));

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", flexDirection: "column" });
    wrapper.append(filterInput, browserContent);
    return wrapper;
}

// ── 3-level nested browser (main panel) ──────────────────────────────────────
function buildNestedBrowser(tagData, onTagClick) {
    const filterInput = document.createElement("input");
    filterInput.type        = "text";
    filterInput.placeholder = "🔍 Filter tags…";
    Object.assign(filterInput.style, {
        width:        "100%",
        padding:      "6px 10px",
        background:   "#1e1e2e",
        color:        "#cdd6f4",
        border:       "1px solid #45475a",
        borderRadius: "6px",
        fontSize:     "13px",
        boxSizing:    "border-box",
        marginBottom: "8px",
    });

    const browserContent = document.createElement("div");
    Object.assign(browserContent.style, { display: "flex", flexDirection: "column", gap: "4px" });

    function renderBrowser(filter = "") {
        browserContent.innerHTML = "";
        const q = filter.toLowerCase().trim();

        for (const group of tagData) {
            const groupColor = categoryColor(group.category);

            // ── count total matching tags across all subcategories ────────
            const totalMatch = group.subcategories.reduce((n, s) => {
                return n + (q ? s.tags.filter(t => t.toLowerCase().includes(q)).length : s.tags.length);
            }, 0);
            if (totalMatch === 0) continue;

            // ── Level 1 : Category header ─────────────────────────────────
            let catCollapsed = !q;

            const catArrow = document.createElement("span");
            catArrow.textContent = "▼";
            Object.assign(catArrow.style, {
                fontSize: "10px", transition: "transform 0.15s", display: "inline-block",
                transform: catCollapsed ? "rotate(-90deg)" : "", color: groupColor,
            });

            const catLabel = document.createElement("span");
            catLabel.textContent = group.category;
            catLabel.style.color = groupColor;

            const catCount = document.createElement("span");
            catCount.textContent = `(${totalMatch})`;
            Object.assign(catCount.style, { color: "#6c7086", fontWeight: "normal", fontSize: "11px" });

            const catHeader = document.createElement("div");
            Object.assign(catHeader.style, {
                display: "flex", alignItems: "center", gap: "6px", cursor: "pointer",
                padding: "5px 8px", borderRadius: "6px", background: "#1e1e2e",
                fontSize: "12px", fontWeight: "bold", userSelect: "none",
                borderLeft: `3px solid ${groupColor}`,
            });
            catHeader.append(catArrow, catLabel, catCount);

            // ─��� Level 1 body (holds all subcategories) ────────────────────
            const catBody = document.createElement("div");
            Object.assign(catBody.style, {
                display:       catCollapsed ? "none" : "flex",
                flexDirection: "column",
                gap:           "3px",
                paddingLeft:   "12px",
                marginBottom:  "2px",
            });

            catHeader.addEventListener("click", () => {
                catCollapsed          = !catCollapsed;
                catBody.style.display = catCollapsed ? "none" : "flex";
                catArrow.style.transform = catCollapsed ? "rotate(-90deg)" : "";
            });

            // ── Level 2 : Subcategory headers ─────────────────────────────
            for (const sub of group.subcategories) {
                const matchedTags = q ? sub.tags.filter(t => t.toLowerCase().includes(q)) : sub.tags;
                if (matchedTags.length === 0) continue;

                let subCollapsed = !q;

                const subArrow = document.createElement("span");
                subArrow.textContent = "▼";
                Object.assign(subArrow.style, {
                    fontSize: "9px", transition: "transform 0.15s", display: "inline-block",
                    transform: subCollapsed ? "rotate(-90deg)" : "", color: groupColor + "aa",
                });

                const subLabel = document.createElement("span");
                subLabel.textContent = sub.name;
                Object.assign(subLabel.style, { color: groupColor + "bb" });

                const subCount = document.createElement("span");
                subCount.textContent = `(${matchedTags.length})`;
                Object.assign(subCount.style, { color: "#6c7086", fontWeight: "normal", fontSize: "10px" });

                const subHeader = document.createElement("div");
                Object.assign(subHeader.style, {
                    display: "flex", alignItems: "center", gap: "5px", cursor: "pointer",
                    padding: "3px 6px", borderRadius: "4px", background: "#181825",
                    fontSize: "11px", fontWeight: "bold", userSelect: "none",
                    borderLeft: `2px solid ${groupColor}55`,
                });
                subHeader.append(subArrow, subLabel, subCount);

                // ── Level 3 : Tags ─────────────────────────────────────────
                const tagsEl = document.createElement("div");
                Object.assign(tagsEl.style, {
                    display:  subCollapsed ? "none" : "flex",
                    flexWrap: "wrap",
                    gap:      "4px",
                    padding:  "4px 4px 4px 12px",
                });

                matchedTags.forEach(tag => {
                    const chip = document.createElement("div");
                    chip.textContent = tag;
                    Object.assign(chip.style, {
                        padding: "2px 8px", borderRadius: "10px", background: "#1e1e2e",
                        border: `1px solid ${groupColor}66`, color: groupColor + "aa",
                        fontSize: "11px", cursor: "pointer", userSelect: "none", transition: "all 0.1s",
                    });
                    chip.addEventListener("mouseenter", () => { chip.style.background = groupColor + "22"; chip.style.borderColor = groupColor; chip.style.color = groupColor; });
                    chip.addEventListener("mouseleave", () => { chip.style.background = "#1e1e2e"; chip.style.borderColor = groupColor + "66"; chip.style.color = groupColor + "aa"; });
                    chip.addEventListener("click", () => onTagClick(tag, group.category));
                    tagsEl.appendChild(chip);
                });

                subHeader.addEventListener("click", () => {
                    subCollapsed          = !subCollapsed;
                    tagsEl.style.display  = subCollapsed ? "none" : "flex";
                    subArrow.style.transform = subCollapsed ? "rotate(-90deg)" : "";
                });

                catBody.appendChild(subHeader);
                catBody.appendChild(tagsEl);
            }

            browserContent.appendChild(catHeader);
            browserContent.appendChild(catBody);
        }
    }

    renderBrowser();
    filterInput.addEventListener("input", () => renderBrowser(filterInput.value));

    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, { display: "flex", flexDirection: "column" });
    wrapper.append(filterInput, browserContent);
    return wrapper;
}

// ── Public entry point ────���───────────────────────────────────────────────────
export function buildTagBrowser(tagData, panelKey, onTagClick) {
    return panelKey === "main"
        ? buildNestedBrowser(tagData, onTagClick)
        : buildFlatBrowser(tagData, onTagClick);
}