// --- VARIABLES GLOBALES ET CONFIGURATION ---
let myConfig = {
    coords: "1:1:1",
    techComb: 10,
    techImp: 8,
    vaisseau: "GT"
};

// Chargement de la config au démarrage de l'application
window.onload = () => {
    const saved = localStorage.getItem('ogame_config');
    if(saved) {
        myConfig = JSON.parse(saved);
        document.getElementById('myCoords').value = myConfig.coords;
        document.getElementById('techComb').value = myConfig.techComb;
        document.getElementById('techImp').value = myConfig.techImp;
        document.getElementById('vaisseauType').value = myConfig.vaisseau;
    }
};

// Sauvegarde de la config dans le navigateur
function saveConfig() {
    myConfig.coords = document.getElementById('myCoords').value;
    myConfig.techComb = parseInt(document.getElementById('techComb').value);
    myConfig.techImp = parseInt(document.getElementById('techImp').value);
    myConfig.vaisseau = document.getElementById('vaisseauType').value;
    localStorage.setItem('ogame_config', JSON.stringify(myConfig));
    alert("Configuration enregistrée avec succès !");
}

// Gestion des onglets
function changerOnglet(onglet) {
    document.getElementById('view-radar').classList.add('hidden');
    document.getElementById('view-debris').classList.add('hidden');
    document.getElementById('view-profiler').classList.add('hidden');
    document.getElementById('view-config').classList.add('hidden');
    
    document.getElementById(`view-${onglet}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-neon');
        btn.classList.add('text-gray-500', 'hover:text-gray-300');
    });
    
    const activeBtn = document.getElementById(`nav-${onglet}`);
    activeBtn.classList.remove('text-gray-500', 'hover:text-gray-300');
    activeBtn.classList.add('text-neon');

    if(onglet === 'debris') chargerDebris();
}

// --- L'ALGORITHME LOGISTIQUE COMPLET (TEMPS + DEUTÉRIUM) ---
function calculerVol(targetCoords) {
    if(!myConfig.coords.includes(':')) return { temps: "N/A", deut: "N/A" };
    
    const [g1, s1, p1] = myConfig.coords.split(':').map(Number);
    const [g2, s2, p2] = targetCoords.split(':').map(Number);

    // 1. Calcul de la distance
    let dist = 0;
    if (g1 != g2) dist = Math.abs(g1 - g2) * 20000;
    else if (s1 != s2) dist = 2700 + 95 * Math.abs(s1 - s2);
    else dist = 1000 + 5 * Math.abs(p1 - p2);

    // 2. Caractéristiques des vaisseaux
    let vitesseBase = (myConfig.vaisseau === "PT") ? 5000 : 7500;
    let consoBase = (myConfig.vaisseau === "PT") ? 10 : 50;

    // 3. Application des technologies moteurs
    let techUtilisee = (myConfig.vaisseau === "PT" && myConfig.techImp >= 5) ? myConfig.techImp : myConfig.techComb;
    let multiplicateur = (myConfig.vaisseau === "PT" && myConfig.techImp >= 5) ? 0.2 : 0.1;
    let vitesse = vitesseBase * (1 + (techUtilisee * multiplicateur));

    // 4. Calcul du temps (Formule pour univers vitesse flotte rapide x10)
    let dureeSec = 10 + (3500 / 10) * Math.sqrt((10 * dist) / vitesse);
    let min = Math.floor(dureeSec / 60);
    let sec = Math.floor(dureeSec % 60);

    // 5. Calcul de la consommation de Deutérium (pour 1 vaisseau à 100% de vitesse)
    let coutDeut = 1 + Math.round((consoBase * dist) / 35000);

    return { temps: `${min}m ${sec}s`, deut: coutDeut };
}

// --- MODULE RADAR (AVEC AFFICHAGE DE LA LOGISTIQUE) ---
async function lancerScan() {
    const btnText = document.getElementById('btnText');
    const resultsArea = document.getElementById('resultsArea');
    const minRank = document.getElementById('minRank').value;
    const maxRank = document.getElementById('maxRank').value;
    const minRatio = document.getElementById('minRatio').value;
    const inactives = document.getElementById('inactivesOnly').checked;

    btnText.innerText = "Analyse en cours...";
    resultsArea.innerHTML = "";

    try {
        const response = await fetch(`/api/radar?min_rank=${minRank}&max_rank=${maxRank}&min_ratio=${minRatio}&inactives_only=${inactives}`);
        const data = await response.json();
        btnText.innerText = `Cibles trouvées : ${data.count}`;

        if(data.count === 0) {
            resultsArea.innerHTML = `<div class="text-center text-gray-400 mt-6 p-4 border border-dashed border-gray-700 rounded-lg">Aucun frigo trouvé avec ces critères.</div>`;
            return;
        }

        data.targets.forEach(t => {
            // Calculer la logistique pour la première planète de la cible
            const logistique = calculerVol(t.coords[0]);
            
            const statusTag = (t.status.includes('i') || t.status.includes('I')) ? `<span class="bg-blue-900 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Inactif</span>` : '';
            
            const card = `
            <div class="card p-4 rounded-xl shadow border-l-2 border-transparent hover:border-neon transition">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="font-bold text-lg text-white flex items-center">${t.name} ${statusTag}</h3>
                    <span class="text-gray-500 text-xs font-mono">Top ${t.rank}</span>
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-sm mb-3 bg-gray-800 p-2 rounded border border-gray-700">
                    <div><span class="text-gray-400 text-xs">💰 Éco:</span> <br><span class="font-mono text-green-400 text-sm">${t.eco.toLocaleString()}</span></div>
                    <div><span class="text-gray-400 text-xs">🛡️ Mil:</span> <br><span class="font-mono text-red-400 text-sm">${t.mil.toLocaleString()}</span></div>
                </div>

                <div class="flex justify-between items-center bg-gray-900 p-2 rounded mb-3 border border-gray-800">
                    <span class="text-neon text-xs font-mono flex items-center gap-1">⏱️ ${logistique.temps}</span>
                    <span class="text-blue-300 text-xs font-mono flex items-center gap-1">💧 ${logistique.deut} Deut/vaisseau</span>
                </div>

                <div class="border-t border-gray-700 pt-3">
                    <div class="flex flex-wrap gap-2">
                        ${t.coords.map(c => `<span class="bg-gray-700 hover:bg-neon hover:text-gray-900 cursor-pointer text-gray-200 px-2 py-1 rounded text-xs font-mono transition shadow" onclick="navigator.clipboard.writeText('${c}')">${c}</span>`).join('')}
                    </div>
                </div>
            </div>`;
            resultsArea.insertAdjacentHTML('beforeend', card);
        });
    } catch (error) { 
        btnText.innerText = "Erreur de connexion"; 
    }
    setTimeout(() => btnText.innerText = "Relancer le Scan", 2000);
}

// --- MODULE DÉBRIS ---
async function chargerDebris() {
    const area = document.getElementById('crashesArea');
    const minDebris = document.getElementById('minDebrisInput').value;
    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>📡 Recherche de CDR en cours...</p>";
    try {
        const response = await fetch(`/api/crashes?min_debris=${minDebris}`);
        const data = await response.json();
        
        if(data.crashes.length === 0) {
            area.innerHTML = `<div class="text-center text-gray-400 mt-6 p-4 border border-dashed border-gray-700 rounded-lg">Aucun CDR détecté pour le moment.</div>`;
            return;
        }
        
        area.innerHTML = ""; 
        data.crashes.forEach(c => {
            const card = `
            <div class="card p-4 rounded-xl shadow border-l-4 border-l-neon relative overflow-hidden mb-3">
                <div class="absolute -right-4 -top-4 text-6xl opacity-10">☄️</div>
                <div class="flex justify-between items-start mb-2"><h3 class="font-bold text-white text-md z-10">⚔️ ${c.name}</h3><span class="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">${c.time}</span></div>
                <div class="text-sm bg-gray-800 p-3 rounded border border-gray-700 mb-2 z-10 relative">
                    <p class="text-gray-400 mb-1 flex justify-between"><span>Points perdus :</span> <span class="text-red-400 font-mono font-bold">-${c.loss_points.toLocaleString()} pts</span></p>
                    <p class="text-gray-400 flex justify-between"><span>Taille du CDR :</span> <span class="text-neon font-mono font-bold">~${c.estimated_resources.toLocaleString()}</span></p>
                </div>
                <div class="flex items-center gap-2 mt-3 z-10 relative bg-gray-700/50 p-2 rounded"><span class="text-lg">🚜</span><span class="text-sm text-gray-300">Recycleurs requis : <span class="text-white font-bold ml-1">${c.recyclers_needed.toLocaleString()}</span></span></div>
            </div>`;
            area.insertAdjacentHTML('beforeend', card);
        });
    } catch (error) { 
        area.innerHTML = "<p class='text-center text-red-400 mt-4'>❌ Erreur de connexion au serveur.</p>"; 
    }
}

// --- MODULE PROFILER ---
async function chercherJoueur() {
    const searchInput = document.getElementById('searchPlayerName').value.trim();
    const area = document.getElementById('profilerResults');
    
    if(!searchInput) return;

    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>⏳ Analyse de la cible en cours...</p>";
    try {
        const response = await fetch(`/api/profiler?player_name=${encodeURIComponent(searchInput)}`);
        const data = await response.json();
        
        if(data.error) { 
            area.innerHTML = `<div class="text-center text-red-400 mt-4 p-4 border border-dashed border-red-900 rounded-lg">❌ ${data.error}</div>`; 
            return; 
        }

        const statusTag = (data.status.includes('i') || data.status.includes('I')) ? `<span class="bg-blue-900 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Inactif</span>` : '';
        const vacTag = data.status.includes('v') ? `<span class="bg-yellow-900 text-yellow-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Vacances</span>` : '';
        const banditTag = data.status.includes('o') ? `<span class="bg-red-900 text-red-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Bandit</span>` : '';

        let scoresHtml = `<div class="grid grid-cols-2 gap-2 text-sm bg-gray-800 p-3 rounded border border-gray-700 mb-4">`;
        for (const [cat, info] of Object.entries(data.scores)) {
            scoresHtml += `<div class="flex justify-between border-b border-gray-700 pb-1"><span class="text-gray-400">${cat}:</span><span class="text-white font-mono">${info.score.toLocaleString()} <span class="text-xs text-neon">(#${info.rank})</span></span></div>`;
        }
        scoresHtml += `</div>`;

        let planetsHtml = `<h4 class="text-sm text-gray-400 mb-2">Empire Immobilier (${data.planets.length}) :</h4><div class="space-y-2">`;
        data.planets.forEach(p => {
            const moonAlert = p.has_moon ? `<span class="text-yellow-400 ml-1 text-lg" title="Lune détectée !">🌘</span>` : '';
            planetsHtml += `<div class="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700"><span class="font-bold text-gray-200 cursor-pointer hover:text-neon" onclick="navigator.clipboard.writeText('${p.coords}')">${p.coords} ${moonAlert}</span><span class="text-xs text-gray-500">${p.name}</span></div>`;
        });
        planetsHtml += `</div>`;

        area.innerHTML = `
            <div class="border-t border-gray-700 pt-4 mt-2">
                <h3 class="font-bold text-xl text-white flex items-center mb-4">${data.name} ${statusTag} ${vacTag} ${banditTag}</h3>
                ${scoresHtml}
                ${planetsHtml}
            </div>`;
    } catch (error) { 
        area.innerHTML = "<p class='text-center text-red-400 mt-4'>❌ Erreur de connexion.</p>"; 
    }
}