let currentUnit = "metric";
let lastSummaryText = "";

function setUnit(unit) {
    if(unit === currentUnit) return;
    currentUnit = unit;

    document.querySelectorAll("#unitToggle button").forEach(b => {
        b.classList.toggle("active", b.dataset.unit === unit);
    });

    const p = document.getElementById("peso");
    const a = document.getElementById("altura");
    const c1 = document.getElementById("cuello");
    const c2 = document.getElementById("cintura");
    const c3 = document.getElementById("cadera");
    const pm = document.getElementById("pesoMeta");

    [p, a, c1, c2, c3, pm].forEach(el => el.value = "");

    if(unit === "imperial") {
        p.placeholder = "Peso (lb)";
        a.placeholder = "Altura (in)";
        c1.placeholder = "Cuello (in)";
        c2.placeholder = "Cintura (in)";
        c3.placeholder = "Cadera (in) — mujeres";
        pm.placeholder = "Peso objetivo (lb)";
    } else {
        p.placeholder = "Peso (kg)";
        a.placeholder = "Altura (cm)";
        c1.placeholder = "Cuello (cm)";
        c2.placeholder = "Cintura (cm)";
        c3.placeholder = "Cadera (cm) — mujeres";
        pm.placeholder = "Peso objetivo (kg)";
    }
}

function toggleAccordion(id) {
    document.getElementById(id).classList.toggle("open");
}

function lbToKg(lb) { return lb * 0.453592; }
function inToCm(inch) { return inch * 2.54; }
function log10(x) { return Math.log(x) / Math.LN10; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function clearFieldErrors() {
    document.getElementById("err-basico").classList.remove("show");
    document.querySelectorAll("input.invalid").forEach(el => el.classList.remove("invalid"));
}

function calcular() {
    clearFieldErrors();

    const edad = +document.getElementById("edad").value;
    const sexo = document.getElementById("sexo").value;
    const actividad = +document.getElementById("actividad").value;
    const objetivo = document.getElementById("objetivo").value;
    const formulaSel = document.getElementById("formula").value;
    const macroPreset = document.getElementById("macroPreset").value;

    let peso = +document.getElementById("peso").value;
    let altura = +document.getElementById("altura").value;
    let cuello = +document.getElementById("cuello").value;
    let cintura = +document.getElementById("cintura").value;
    let cadera = +document.getElementById("cadera").value;
    let pesoMeta = +document.getElementById("pesoMeta").value;

    let hasError = false;
    if(!edad || edad < 10 || edad > 100) { document.getElementById("edad").classList.add("invalid"); hasError = true; }
    if(!peso || peso <= 0) { document.getElementById("peso").classList.add("invalid"); hasError = true; }
    if(!altura || altura <= 0) { document.getElementById("altura").classList.add("invalid"); hasError = true; }

    if(hasError) {
        document.getElementById("err-basico").classList.add("show");
        return;
    }

    const btn = document.getElementById("btnCalcular");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Analizando...";

    setTimeout(() => {
        procesarCalculo({edad, sexo, actividad, objetivo, formulaSel, macroPreset, peso, altura, cuello, cintura, cadera, pesoMeta});
        btn.disabled = false;
        btn.textContent = originalLabel;
    }, 200);
}

function procesarCalculo(input) {
    let {edad, sexo, actividad, objetivo, formulaSel, macroPreset, peso, altura, cuello, cintura, cadera, pesoMeta} = input;
    const unitAtCalc = currentUnit;

    if(currentUnit === "imperial") {
        peso = lbToKg(peso);
        altura = inToCm(altura);
        if(cuello) cuello = inToCm(cuello);
        if(cintura) cintura = inToCm(cintura);
        if(cadera) cadera = inToCm(cadera);
        if(pesoMeta) pesoMeta = lbToKg(pesoMeta);
    }

    const imc = peso / ((altura/100)**2);

    let grasaCorporal = null;
    if(cuello && cintura && (sexo === "hombre" || cadera)) {
        if(sexo === "hombre" && cintura > cuello) {
            grasaCorporal = 495 / (1.0324 - 0.19077 * log10(cintura - cuello) + 0.15456 * log10(altura)) - 450;
        } else if(sexo === "mujer" && (cintura + cadera) > cuello) {
            grasaCorporal = 495 / (1.29579 - 0.35004 * log10(cintura + cadera - cuello) + 0.22100 * log10(altura)) - 450;
        }
        if(grasaCorporal !== null && (isNaN(grasaCorporal) || grasaCorporal < 3 || grasaCorporal > 60)) grasaCorporal = null;
    }

    const tmbMifflin = sexo === "hombre" ? 10*peso + 6.25*altura - 5*edad + 5 : 10*peso + 6.25*altura - 5*edad - 161;
    const tmbHarris = sexo === "hombre" ? 88.362 + 13.397*peso + 4.799*altura - 5.677*edad : 447.593 + 9.247*peso + 3.098*altura - 4.330*edad;
    
    let tmbKatch = null;
    if(grasaCorporal !== null) {
        tmbKatch = 370 + 21.6 * (peso * (1 - grasaCorporal/100));
    }

    let tmb = tmbMifflin;
    let formulaUsada = "mifflin";
    if(formulaSel === "harris") { tmb = tmbHarris; formulaUsada = "harris"; }
    if(formulaSel === "katch" && tmbKatch !== null) { tmb = tmbKatch; formulaUsada = "katch"; }

    const tdee = tmb * actividad;
    const ajustes = { deficit_agresivo: -750, deficit: -500, mantenimiento: 0, superavit: 300, superavit_agresivo: 500 };
    let calorias = tdee + (ajustes[objetivo] || 0);
    const piso = sexo === "hombre" ? 1500 : 1200;
    if(calorias < piso) calorias = piso;

    let proteina, grasa, carbs;
    if(macroPreset === "keto") {
        proteina = (calorias * 0.25) / 4;
        grasa = (calorias * 0.70) / 9;
        carbs = (calorias * 0.05) / 4;
    } else {
        const ratios = { balanced: {p:2.2, g:0.9}, highprotein: {p:2.6, g:0.8}, lowcarb: {p:2.2, g:1.2} }[macroPreset] || {p:2.2, g:0.9};
        proteina = peso * ratios.p;
        grasa = peso * ratios.g;
        carbs = Math.max(0, (calorias - (proteina*4 + grasa*9)) / 4);
    }

    const agua = peso * 35;
    const pesoIdeal = sexo === "hombre" ? 50 + 2.3 * Math.max(altura/2.54 - 60, 0) : 45.5 + 2.3 * Math.max(altura/2.54 - 60, 0);
    const ritmoSemanal = (calorias - tdee) * 7 / 7700;
    const nivel = imc < 18.5 ? "bajo" : imc < 25 ? "normal" : imc < 30 ? "sobrepeso" : "alto";

    renderResults({
        imc, nivel, tmb, tmbMifflin, tmbHarris, tmbKatch, formulaUsada, tdee, calorias,
        proteina, grasa, carbs, agua, pesoIdeal, grasaCorporal, ritmoSemanal, unitAtCalc
    });
}

function renderResults(d) {
    const { imc, nivel, tmb, tmbMifflin, tmbHarris, tmbKatch, formulaUsada, tdee, calorias, proteina, grasa, carbs, agua, pesoIdeal, grasaCorporal, ritmoSemanal } = d;
    const nivelLabel = { bajo: "Bajo peso", normal: "Normal", sobrepeso: "Sobrepeso", alto: "Alto" }[nivel];
    const imcPos = clamp(((imc - 15) / (40 - 15)) * 100, 0, 100);

    const totalKcal = proteina*4 + carbs*4 + grasa*9;
    const pP = totalKcal ? (proteina*4/totalKcal)*100 : 0;
    const pC = totalKcal ? (carbs*4/totalKcal)*100 : 0;
    const pG = totalKcal ? (grasa*9/totalKcal)*100 : 0;
    const circ = 2 * Math.PI * 40;

    const donut = `
    <svg width="88" height="88" viewBox="0 0 100 100" style="flex:none;transform:rotate(-90deg)">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#7fb2ff" stroke-width="12" stroke-dasharray="${(pP/100)*circ} ${circ}" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#6be3a6" stroke-width="12" stroke-dasharray="${(pC/100)*circ} ${circ}" stroke-dashoffset="${-((pP/100)*circ)}" stroke-linecap="round"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#ffc766" stroke-width="12" stroke-dasharray="${(pG/100)*circ} ${circ}" stroke-dashoffset="${-(((pP+pC)/100)*circ)}" stroke-linecap="round"/>
    </svg>`;

    document.getElementById("resultado").innerHTML = `
    <div class="card accent">
        <h3>Calorías objetivo</h3>
        <p>${calorias.toFixed(0)} kcal</p>
        <small>TDEE: ${tdee.toFixed(0)} kcal</small>
    </div>
    <div class="card">
        <h3>IMC</h3>
        <p>${imc.toFixed(2)}</p>
        <span class="badge ${nivel}">${nivelLabel}</span>
        <div class="imc-gauge">
            <div class="gauge-track">
                <span class="gauge-seg-bajo" style="width:14%"></span>
                <span class="gauge-seg-normal" style="width:26%"></span>
                <span class="gauge-seg-sobrepeso" style="width:20%"></span>
                <span class="gauge-seg-alto" style="width:40%"></span>
            </div>
            <div class="gauge-marker"><i style="left:${imcPos}%"></i></div>
        </div>
    </div>
    <div class="card">
        <h3>TMB <span class="info">${formulaUsada.toUpperCase()}</span></h3>
        <p>${tmb.toFixed(0)} kcal</p>
        <div class="formula-compare">
            <div class="formula-row ${formulaUsada==='mifflin'?'active':''}"><span>Mifflin</span><b>${tmbMifflin.toFixed(0)}</b></div>
            <div class="formula-row ${formulaUsada==='harris'?'active':''}"><span>Harris</span><b>${tmbHarris.toFixed(0)}</b></div>
            <div class="formula-row ${formulaUsada==='katch'?'active':''}"><span>Katch</span><b>${tmbKatch ? tmbKatch.toFixed(0) : '—'}</b></div>
        </div>
    </div>
    <div class="card">
        <h3>Peso ideal (Devine)</h3>
        <p>${pesoIdeal.toFixed(1)} kg</p>
    </div>
    <div class="card">
        <h3>Grasa corporal</h3>
        <p>${grasaCorporal ? grasaCorporal.toFixed(1) + '%' : '—'}</p>
    </div>
    <div class="card">
        <h3>Agua recomendada</h3>
        <p>${(agua/1000).toFixed(2)} L</p>
    </div>
    <div class="card wide macro-card">
        ${donut}
        <div class="macro-legend">
            <div class="legend-row"><span><span class="dot" style="background:#7fb2ff"></span>Proteína</span><span class="val">${proteina.toFixed(0)} g</span></div>
            <div class="legend-row"><span><span class="dot" style="background:#6be3a6"></span>Carbohidratos</span><span class="val">${carbs.toFixed(0)} g</span></div>
            <div class="legend-row"><span><span class="dot" style="background:#ffc766"></span>Grasas</span><span class="val">${grasa.toFixed(0)} g</span></div>
        </div>
    </div>
    <div class="card wide">
        <h3>Ritmo semanal estimado</h3>
        <p>${ritmoSemanal >= 0 ? "+" : ""}${ritmoSemanal.toFixed(2)} kg / semana</p>
        <div class="pace-bar"><div class="pace-bar-fill" style="width:${clamp(((ritmoSemanal+1)/2)*100,0,100)}%"></div></div>
    </div>`;

    document.getElementById("resultActions").classList.add("show");
    lastSummaryText = `Fitness Life - Resultado:\nIMC: ${imc.toFixed(2)}\nCalorías: ${calorias.toFixed(0)} kcal\nProteínas: ${proteina.toFixed(0)}g`;
}

function copiarResumen(e) {
    if(!lastSummaryText) return;
    navigator.clipboard.writeText(lastSummaryText);
    const btn = e ? e.currentTarget : document.querySelector(".result-actions button");
    const original = btn.textContent;
    btn.textContent = "¡Copiado!";
    setTimeout(() => btn.textContent = "Copiar resumen", 1500);
}

function resetForm() {
    ["edad", "peso", "altura", "cuello", "cintura", "cadera", "pesoMeta"].forEach(id => document.getElementById(id).value = "");
    clearFieldErrors();
    ["bfAccordion", "formulaAccordion", "metaAccordion"].forEach(id => document.getElementById(id).classList.remove("open"));
    document.getElementById("resultado").innerHTML = `<p class="placeholder">Tu análisis aparecerá aquí</p>`;
    document.getElementById("resultActions").classList.remove("show");
    if(currentUnit !== "metric") setUnit("metric");
}