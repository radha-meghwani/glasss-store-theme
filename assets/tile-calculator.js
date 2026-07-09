// tile-calculator.js

document.addEventListener("DOMContentLoaded", () => {
    const calculator = document.getElementById("TileCalculatorWrapper");
    if (!calculator) return;

    // --- 1. Shopify Data & Config ---
    const dataEl = document.getElementById("TileCalculatorData");
    if (!dataEl) return;
    const shopifyData = JSON.parse(dataEl.textContent);

    const TILE_CONFIG = {
        quarterSheet: {
            tiles: 49,
            area: 0.024
        },
        sheet: {
            tiles: 196,
            area: 0.0961
        },
        box: {
            sheets: 14,
            area: 1.3454
        }
    };

    let selectedVariantId = shopifyData.selected_variant_id;
    
    function getVariantById(id) {
        return shopifyData.product.variants.find(v => v.id == id) || shopifyData.product.variants[0];
    }
    
    function getVariantType(title) {
        const t = (title || '').toLowerCase();
        if (t.includes('box') || t.includes('doos')) return 'box';
        if (t.includes('quarter') || t.includes('kwart') || t.includes('¼')) return 'quarterSheet';
        return 'sheet';
    }

    // --- 2. DOM Elements ---
    const openMainBtn = document.getElementById("OpenMainCalcBtn");
    const closeMainBtn = document.getElementById("CloseMainCalcBtn");
    const cancelMainBtn = document.getElementById("CancelMainCalcBtn");
    const mainModal = document.getElementById("MainCalcModal");
    const applyMainBtn = document.getElementById("ApplyMainCalcBtn");

    const openShapeBtn = document.getElementById("OpenShapeCalcBtn");
    const closeShapeBtn = document.getElementById("CloseShapeModalBtn");
    const cancelShapeBtn = document.getElementById("CancelShapeBtn");
    const shapeModal = document.getElementById("ShapeModal");
    const takeQtyBtn = document.getElementById("TakeQtyBtn");

    // Inputs
    const m2Input = document.getElementById("m2val");
    const lossCb = document.getElementById("loss-cb");
    const lossPctInput = document.getElementById("loss-pct");
    let qtyInput = document.querySelector('input[name="quantity"]');

    // UI Updates
    const resultEmpty = document.getElementById("result-empty");
    const resultFilled = document.getElementById("result-filled");
    const resultTarget = document.getElementById("result-target");
    const breakdown = document.getElementById("breakdown");
    const cvgNeeded = document.getElementById("cvg-needed");
    const cvgSurplus = document.getElementById("cvg-surplus");
    const cvgLblNeeded = document.getElementById("cvg-lbl-needed");
    const cvgLblSurplus = document.getElementById("cvg-lbl-surplus");
    const summaryTiles = document.getElementById("summary-tiles");
    const summaryCoverage = document.getElementById("summary-coverage");
    const livePriceTotal = document.getElementById("LivePriceTotal");
    const packagingTable = document.getElementById("PackagingTable");

    // --- 3. Initialization ---
    function init() {
        // Populate packaging table
        packagingTable.innerHTML = `
            <tr><td>Kwart-vel (¼ vel)</td><td>${TILE_CONFIG.quarterSheet.tiles} tegels · ${TILE_CONFIG.quarterSheet.area.toFixed(4).replace('.', ',')} m²</td></tr>
            <tr><td>Vel (1 sheet)</td><td>${TILE_CONFIG.sheet.tiles} tegels · ${TILE_CONFIG.sheet.area.toFixed(4).replace('.', ',')} m²</td></tr>
            <tr><td>Doos (${TILE_CONFIG.box.sheets} vellen)</td><td>${(TILE_CONFIG.box.sheets * TILE_CONFIG.sheet.tiles).toLocaleString('nl-BE')} tegels · ${TILE_CONFIG.box.area.toFixed(4).replace('.', ',')} m²</td></tr>
        `;

        detectVariantChange();
        calc();
    }

    // --- 4. Modals ---
    function openModal(modal) {
        modal.classList.add("open");
        document.body.classList.add("calculator-open");
    }

    function closeModal(modal) {
        modal.classList.remove("open");
        if (!document.querySelector('.modal-overlay.open')) {
            document.body.classList.remove("calculator-open");
        }
    }

    openMainBtn.addEventListener("click", () => openModal(mainModal));
    closeMainBtn.addEventListener("click", () => closeModal(mainModal));
    cancelMainBtn.addEventListener("click", () => closeModal(mainModal));
    applyMainBtn.addEventListener("click", () => closeModal(mainModal));

    openShapeBtn.addEventListener("click", () => openModal(shapeModal));
    closeShapeBtn.addEventListener("click", () => closeModal(shapeModal));
    cancelShapeBtn.addEventListener("click", () => closeModal(shapeModal));

    [mainModal, shapeModal].forEach(modal => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (shapeModal.classList.contains("open")) closeModal(shapeModal);
            else if (mainModal.classList.contains("open")) closeModal(mainModal);
        }
    });

    // --- 5. Main Calculator Logic ---
    function adj(delta) {
        let v = parseFloat(m2Input.value) || 0;
        v = Math.max(0, Math.round((v + delta) * 100) / 100);
        m2Input.value = v === 0 ? '' : v.toFixed(2);
        calc();
    }

    function toggleLoss() {
        const on = lossCb.checked;
        const st = document.getElementById("loss-stepper");
        st.style.opacity = on ? '1' : '0.35';
        st.style.pointerEvents = on ? 'auto' : 'none';
        calc();
    }

    function adjLoss(delta) {
        let v = parseInt(lossPctInput.value) || 0;
        v = Math.min(50, Math.max(0, v + delta));
        lossPctInput.value = v;
        calc();
    }

    document.getElementById("BtnMinusArea").addEventListener("click", () => adj(-0.01));
    document.getElementById("BtnPlusArea").addEventListener("click", () => adj(0.01));
    m2Input.addEventListener("input", calc);

    lossCb.addEventListener("change", toggleLoss);
    document.getElementById("BtnMinusLoss").addEventListener("click", () => adjLoss(-5));
    document.getElementById("BtnPlusLoss").addEventListener("click", () => adjLoss(5));
    lossPctInput.addEventListener("input", calc);

    function calc() {
        const raw = parseFloat(m2Input.value);
        const currentVariant = getVariantById(selectedVariantId);
        const variantType = getVariantType(currentVariant.title);
        
        if (!raw || raw <= 0) {
            resultEmpty.style.display = '';
            resultFilled.classList.remove('visible');
            updateShopify(0, currentVariant);
            return;
        }

        const withLoss = lossCb.checked;
        const lossPct = (parseInt(lossPctInput.value) || 0) / 100;
        const needed = raw;
        const target = withLoss ? raw * (1 + lossPct) : raw;

        // Breakdown logic (visual)
        const BOX_M2 = TILE_CONFIG.box.area;
        const SHEET_M2 = TILE_CONFIG.sheet.area;
        const QSHEET_M2 = TILE_CONFIG.quarterSheet.area;
        
        let rem = target;
        const boxes = Math.floor(rem / BOX_M2); rem -= boxes * BOX_M2;
        const sheets = Math.floor(rem / SHEET_M2); rem -= sheets * SHEET_M2;
        const qsheets = rem > 0.0005 ? Math.ceil(rem / QSHEET_M2) : 0;
        
        const totalCovered = boxes * BOX_M2 + sheets * SHEET_M2 + qsheets * QSHEET_M2;
        const totalTiles = boxes * TILE_CONFIG.box.sheets * TILE_CONFIG.sheet.tiles + sheets * TILE_CONFIG.sheet.tiles + qsheets * TILE_CONFIG.quarterSheet.tiles;

        resultEmpty.style.display = 'none';
        resultFilled.classList.add('visible');

        const targetStr = withLoss
            ? `${needed.toFixed(2)} m² + ${Math.round(lossPct*100)}% verlies = ${target.toFixed(2)} m²`
            : `${needed.toFixed(2)} m²`;
        resultTarget.textContent = targetStr;

        const units = [
            { qty: boxes, name: boxes === 1 ? 'Doos' : 'Dozen', sub: `${TILE_CONFIG.box.sheets} vellen · ${BOX_M2} m²` },
            { qty: sheets, name: sheets === 1 ? 'Vel' : 'Vellen', sub: `${TILE_CONFIG.sheet.tiles} tegels · ${SHEET_M2} m²` },
            { qty: qsheets, name: qsheets === 1 ? 'Kwart-vel' : 'Kwart-vellen', sub: `${TILE_CONFIG.quarterSheet.tiles} tegels · ${QSHEET_M2} m²` }
        ];
        const hl = boxes > 0 ? 0 : sheets > 0 ? 1 : 2;
        
        let html = '';
        units.forEach((u, i) => {
            const isZero = u.qty === 0;
            const isHL = i === hl && !isZero;
            html += `<div class="breakdown-unit${isZero ? ' zero' : ''}${isHL ? ' highlight' : ''}">`;
            if (isHL) html += `<div class="bu-label">Hoofdverpakking</div>`;
            html += `<div class="bu-qty">${u.qty}</div><div class="bu-name">${u.name}</div><div class="bu-sub">${u.sub}</div></div>`;
        });
        breakdown.innerHTML = html;

        const surplus = totalCovered - needed;
        const pctNeeded = Math.min((needed / totalCovered) * 100, 100);
        const pctSurplus = Math.max(((totalCovered - needed) / totalCovered) * 100, 0);
        cvgNeeded.style.width = pctNeeded + '%';
        cvgSurplus.style.left = pctNeeded + '%';
        cvgSurplus.style.width = pctSurplus + '%';
        
        cvgLblNeeded.textContent = `Benodigd: ${needed.toFixed(2)} m²`;
        cvgLblSurplus.textContent = surplus > 0.0005 ? `+${surplus.toFixed(4)} m² speling` : 'exact';
        summaryTiles.innerHTML = `<strong>${totalTiles.toLocaleString('nl-BE')}</strong> tegeltjes totaal`;
        summaryCoverage.innerHTML = `Dekt <strong>${totalCovered.toFixed(4)} m²</strong>`;

        // Calculate REQUIRED QUANTITY based on variant
        const requiredSheets = Math.ceil(target / TILE_CONFIG.sheet.area);
        let variantQty = 0;
        if (variantType === 'box') {
            variantQty = Math.ceil(requiredSheets / TILE_CONFIG.box.sheets);
        } else if (variantType === 'quarterSheet') {
            variantQty = Math.ceil(target / TILE_CONFIG.quarterSheet.area);
        } else {
            variantQty = requiredSheets; // default to sheets
        }

        updateShopify(variantQty, currentVariant);
    }

    function formatMoney(cents) {
        return '€' + (cents / 100).toFixed(2).replace('.', ',');
    }

    function updateShopify(quantity, variant) {
        if (!qtyInput) qtyInput = document.querySelector('input[name="quantity"]');
        if (qtyInput && quantity > 0) {
            qtyInput.value = quantity;
            if (document.activeElement !== qtyInput) {
                qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        
        const totalCents = quantity * variant.price;
        livePriceTotal.textContent = formatMoney(totalCents);
    }

    // --- 6. Detect Variant Changes ---
    function detectVariantChange() {
        if (!qtyInput) qtyInput = document.querySelector('input[name="quantity"]');
        let form = qtyInput ? qtyInput.closest('form') : document.querySelector('form[action^="/cart/add"]');
        
        if (form) {
            form.addEventListener('change', (e) => {
                setTimeout(() => {
                    const urlParams = new URLSearchParams(window.location.search);
                    const variantIdFromUrl = urlParams.get('variant');
                    const idInput = form.querySelector('input[name="id"], select[name="id"]');
                    
                    let newId = variantIdFromUrl || (idInput ? idInput.value : null);
                    if (newId && newId != selectedVariantId) {
                        selectedVariantId = newId;
                        calc();
                    }
                }, 50);
            });
        }

        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                const urlParams = new URLSearchParams(window.location.search);
                const variantIdFromUrl = urlParams.get('variant');
                if (variantIdFromUrl && variantIdFromUrl != selectedVariantId) {
                    selectedVariantId = variantIdFromUrl;
                    calc();
                }
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // --- 7. Shape Calculator ---
    let currentDim = '2d';
    let currentShape = 'rect';
    const PI = Math.PI;

    const SHAPE_CONFIG = {
        rect: { dim: '2d', formula: 'Breedte × Hoogte', fields: [{ key: 'a', label: 'Breedte', unit: 'cm' }, { key: 'b', label: 'Hoogte', unit: 'cm' }], addLabel: '+ Rechthoek toevoegen', calc: (v) => (v.a / 100) * (v.b / 100), describe: (v) => `${v.a}×${v.b} cm` },
        circle: { dim: '2d', formula: 'π × straal²', fields: [{ key: 'a', label: 'Straal', unit: 'cm' }], addLabel: '+ Cirkel toevoegen', calc: (v) => PI * Math.pow(v.a / 100, 2), describe: (v) => `π×${v.a}² cm` },
        triangle: { dim: '2d', formula: '(Basis × Hoogte) / 2', fields: [{ key: 'a', label: 'Basis', unit: 'cm' }, { key: 'b', label: 'Hoogte', unit: 'cm' }], addLabel: '+ Driehoek toevoegen', calc: (v) => ((v.a / 100) * (v.b / 100)) / 2, describe: (v) => `(${v.a}×${v.b})/2 cm` },
        sphere: { dim: '3d', formula: '4 × π × straal²', fields: [{ key: 'a', label: 'Straal', unit: 'cm' }], addLabel: '+ Bol toevoegen', calc: (v) => 4 * PI * Math.pow(v.a / 100, 2), describe: (v) => `4π×${v.a}² cm` },
        cylinder: { dim: '3d', formula: '2 × π × r × (r + h)', fields: [{ key: 'a', label: 'Straal', unit: 'cm' }, { key: 'b', label: 'Hoogte', unit: 'cm' }], addLabel: '+ Cilinder toevoegen', calc: (v) => 2 * PI * (v.a / 100) * ((v.a / 100) + (v.b / 100)), describe: (v) => `2π×${v.a}×(${v.a}+${v.b}) cm` },
        cone: { dim: '3d', formula: 'π × r × (r + s) — s = √(r² + h²)', fields: [{ key: 'a', label: 'Straal (basis)', unit: 'cm' }, { key: 'b', label: 'Hoogte', unit: 'cm' }], addLabel: '+ Kegel toevoegen', calc: (v) => { const r = v.a / 100; const h = v.b / 100; const s = Math.sqrt(r * r + h * h); return PI * r * (r + s); }, describe: (v) => { const s = Math.sqrt(v.a * v.a + v.b * v.b).toFixed(1); return `π×${v.a}×(${v.a}+${s}) cm`; } }
    };

    const allSections = { rect: [{ a: 0, b: 0 }], circle: [{ a: 0 }], triangle: [{ a: 0, b: 0 }], sphere: [{ a: 0 }], cylinder: [{ a: 0, b: 0 }], cone: [{ a: 0, b: 0 }] };

    function setDim(dim) {
        currentDim = dim;
        document.getElementById('card-2d').className = 'how-to-card' + (dim === '2d' ? ' active-2d' : '');
        document.getElementById('card-3d').className = 'how-to-card' + (dim === '3d' ? ' active-3d' : '');
        document.getElementById('panel-2d').style.display = dim === '2d' ? '' : 'none';
        document.getElementById('panel-3d').style.display = dim === '3d' ? '' : 'none';
        document.getElementById('note-3d').classList.toggle('visible', dim === '3d');
        currentShape = dim === '2d' ? 'rect' : 'sphere';
        updateShapeBtns();
        renderSections();
        calcAllShapes();
    }

    document.getElementById('card-2d').addEventListener('click', () => setDim('2d'));
    document.getElementById('card-3d').addEventListener('click', () => setDim('3d'));

    function selectShape(shape) {
        currentShape = shape;
        updateShapeBtns();
        renderSections();
        calcAllShapes();
    }

    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectShape(e.currentTarget.dataset.shape));
    });

    function updateShapeBtns() {
        const panel = currentDim === '2d' ? 'panel-2d' : 'panel-3d';
        document.querySelectorAll(`#${panel} .shape-btn`).forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`#${panel} .shape-btn[data-shape="${currentShape}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    function renderSections() {
        const shape = currentShape;
        const cfg = SHAPE_CONFIG[shape];
        if (!cfg) return;
        const dim = cfg.dim;
        const secs = allSections[shape];
        const containerId = dim === '2d' ? 'sections-2d-container' : 'sections-3d-container';
        const formulaId = dim === '2d' ? 'formula-2d-label' : 'formula-3d-label';
        const addBtnId = dim === '2d' ? 'add-2d-btn' : 'add-3d-btn';

        document.getElementById(formulaId).innerHTML = `Formule: <span>${cfg.formula}</span>${secs.length > 1 ? ' — meerdere worden opgeteld' : ''}`;
        document.getElementById(addBtnId).textContent = cfg.addLabel;

        let html = '';
        secs.forEach((sec, i) => {
            const secArea = calcSectionArea(shape, sec);
            html += `<div class="shape-form">`;
            if (secs.length > 1) {
                html += `<div class="shape-form-header">
                            <span class="shape-form-label">Vlak ${i + 1}</span>
                            <span class="shape-form-right">
                                <span class="shape-form-area" style="display: ${secArea > 0 ? 'inline' : 'none'}">${secArea > 0 ? secArea.toFixed(4).replace('.', ',') + ' m²' : ''}</span>
                                <button class="shape-form-del" data-idx="${i}" type="button" title="Verwijderen">×</button>
                            </span>
                         </div>`;
            }
            html += `<div class="dim-row">`;
            cfg.fields.forEach(f => {
                const val = sec[f.key];
                html += `<div class="dim-field">
                            <div class="dim-label">${f.label}</div>
                            <div class="dim-input-wrap">
                                <input class="dim-input" type="number" min="0" placeholder="0" value="${val || ''}" data-key="${f.key}" data-idx="${i}">
                                <span class="dim-unit">${f.unit}</span>
                            </div>
                         </div>`;
            });
            html += `</div></div>`;
        });
        
        const container = document.getElementById(containerId);
        container.innerHTML = html;
        
        container.querySelectorAll('.dim-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                const key = e.target.dataset.key;
                allSections[shape][idx][key] = parseFloat(e.target.value) || 0;
                
                calcAllShapes();
                
                const area = calcSectionArea(shape, allSections[shape][idx]);
                const areaSpan = container.querySelector(`.shape-form:nth-child(${parseInt(idx)+1}) .shape-form-area`);
                if (areaSpan) {
                    areaSpan.textContent = area > 0 ? `${area.toFixed(4).replace('.', ',')} m²` : '';
                    areaSpan.style.display = area > 0 ? 'inline' : 'none';
                }
            });
        });
        
        container.querySelectorAll('.shape-form-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.dataset.idx;
                if (allSections[shape].length > 1) {
                    allSections[shape].splice(idx, 1);
                    renderSections();
                    calcAllShapes();
                }
            });
        });
    }

    document.getElementById('add-2d-btn').addEventListener('click', addSection);
    document.getElementById('add-3d-btn').addEventListener('click', addSection);

    function addSection() {
        const shape = currentShape;
        const cfg = SHAPE_CONFIG[shape];
        if (!cfg) return;
        const newSec = {};
        cfg.fields.forEach(f => { newSec[f.key] = 0; });
        allSections[shape].push(newSec);
        renderSections();
        calcAllShapes();
    }

    function calcSectionArea(shape, sec) {
        const cfg = SHAPE_CONFIG[shape];
        if (!cfg) return 0;
        const v = {};
        cfg.fields.forEach(f => { v[f.key] = parseFloat(sec[f.key]) || 0; });
        const allFilled = cfg.fields.every(f => v[f.key] > 0);
        if (!allFilled) return 0;
        return cfg.calc(v);
    }

    function calcAllShapes() {
        let totalM2 = 0;
        const parts = [];
        const shape = currentShape;
        const cfg = SHAPE_CONFIG[shape];
        const secs = allSections[shape];

        secs.forEach((sec, i) => {
            const area = calcSectionArea(shape, sec);
            totalM2 += area;
            if (area > 0) {
                const v = {};
                cfg.fields.forEach(f => { v[f.key] = parseFloat(sec[f.key]) || 0; });
                const desc = cfg.describe(v);
                parts.push(secs.length > 1 ? `vlak ${i + 1}: ${desc}` : desc);
            }
        });

        document.getElementById('shape-result').textContent = totalM2.toFixed(4).replace('.', ',') + ' m²';
        document.getElementById('shape-formula-out').textContent = parts.length > 0 ? parts.join(' + ') : '';

        return totalM2;
    }

    takeQtyBtn.addEventListener("click", () => {
        const total = calcAllShapes();
        if (total > 0) {
            m2Input.value = total.toFixed(2);
            calc();
        }
        closeModal(shapeModal);
    });

    // Run Init
    init();
});