let myConfig = { coords: "1:1:1", techComb: 10, techImp: 8, vaisseau: "GT", vitesseUniv: 10 };
let currentRadarTargets = [];
let favoris = JSON.parse(localStorage.getItem('ogame_favoris') || '[]');

window.onload = () => {
    const saved = localStorage.getItem('ogame_config');
    if(saved) {
        myConfig = JSON.parse(saved);
        document.getElementById('myCoords').value = myConfig.coords;
        document.getElementById('techComb').value = myConfig.techComb;
        document.getElementById('techImp').value = myConfig.techImp;
        document.getElementById('vaisseauType').value = myConfig.vaisseau;
        document.getElementById('vitesseUniv').value = myConfig.vitesseUniv || 10;
    }
    afficherFavoris();
    lancerCompteARebours(); // NOUVEAU : Lance l'horloge au démarrage
};

// --- NOUVEAU : Le Compte à Rebours ---
function lancerCompteARebours() {
    setInterval(() => {
        let now = new Date();
        let nextHour = new Date();
        nextHour.setHours(now.getHours() + 1, 0, 0, 0); // Vise la prochaine heure pile (xx:00:00)
        
        let diffSecs = Math.floor((nextHour - now) / 1000);
        let m = Math.floor(diffSecs / 60);
        let s = diffSecs % 60;
        
        // Ajout d'un zéro devant les secondes si < 10 (ex: 4m 09s)
        let formattedSecs = s < 10 ? "0" + s : s;
        
        let el = document.getElementById('nextUpdateCountdown');
        if(el) el.innerText = `${m}m ${formattedSecs}s`;
    }, 1000);
}

function saveConfig() {
    myConfig.coords = document.getElementById('myCoords').value;
    myConfig.techComb = parseInt(document.getElementById('techComb').value);
    myConfig.techImp = parseInt(document.getElementById('techImp').value);
    myConfig.vaisseau = document.getElementById('vaisseauType').value;
    myConfig.vitesseUniv = parseInt(document.getElementById('vitesseUniv').value);
    localStorage.setItem('ogame_config', JSON.stringify(myConfig));
    
    const btn = document.getElementById('btnSaveConfig');
    if(btn) {
        btn.innerText = "✅ Enregistré !";
        btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        btn.classList.add('bg-green-600', 'hover:bg-green-500');
        setTimeout(() => {
            btn.innerText = "Enregistrer";
            btn.classList.remove('bg-green-600', 'hover:bg-green-500');
            btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }, 2000);
    }
}

function changerOnglet(onglet) {
    ['radar', 'debris', 'profiler', 'parser', 'config'].forEach(id => {
        document.getElementById(`view-${id}`).classList.add('hidden');
    });
    document.getElementById(`view-${onglet}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-neon');
        btn.classList.add('text-gray-500');
    });
    document.getElementById(`nav-${onglet}`).classList.remove('text-gray-500');
    document.getElementById(`nav-${onglet}`).classList.add('text-neon');

    if(onglet === 'debris') chargerDebris();
}

function calculerVol(targetCoords, typeVaisseau = myConfig.vaisseau) {
    if(!targetCoords || !targetCoords.includes(':') || !myConfig.coords.includes(':')) {
        return { temps: "N/A", deut: "N/A", dureeBrute: 9999999 };
    }
    
    const [g1, s1, p1] = myConfig.coords.split(':').map(Number);
    const [g2, s2, p2] = targetCoords.split(':').map(Number);

    let dist = 0;
    if (g1 != g2) dist = Math.abs(g1 - g2) * 20000;
    else if (s1 != s2) dist = 2700 + 95 * Math.abs(s1 - s2);
    else dist = 1000 + 5 * Math.abs(p1 - p2);

    let vitesseBase, consoBase, techUtilisee, multiplicateur;
    
    if (typeVaisseau === "PT") {
        vitesseBase = 5000; consoBase = 10;
        techUtilisee = (myConfig.techImp >= 5) ? myConfig.techImp : myConfig.techComb;
        multiplicateur = (myConfig.techImp >= 5) ? 0.2 : 0.1;
    } else if (typeVaisseau === "GT") {
        vitesseBase = 7500; consoBase = 50;
        techUtilisee = myConfig.techComb; multiplicateur = 0.1;
    } else if (typeVaisseau === "REC") {
        vitesseBase = 2000; consoBase = 300;
        techUtilisee = (myConfig.techImp >= 17) ? myConfig.techImp : myConfig.techComb;
        multiplicateur = (myConfig.techImp >= 17) ? 0.2 : 0.1;
    }

    let vitesse = vitesseBase * (1 + (techUtilisee * multiplicateur));
    let dureeSec = 10 + (3500 / myConfig.vitesseUniv) * Math.sqrt((10 * dist) / vitesse);
    
    // --- NOUVEAU : Formatage en Heures, Minutes, Secondes ---
    let h = Math.floor(dureeSec / 3600);
    let min = Math.floor((dureeSec % 3600) / 60);
    let sec = Math.floor(dureeSec % 60);
    
    // N'affiche l'heure que si le trajet fait plus de 60 minutes
    let tempsStr = h > 0 ? `${h}h ${min}m ${sec}s` : `${min}m ${sec}s`;
    
    let coutDeut = 1 + Math.round((consoBase * dist) / 35000);

    return { temps: tempsStr, deut: coutDeut, dureeBrute: dureeSec };
}

async function lancerScan() {
    const btnText = document.getElementById('btnText');
    const area = document.getElementById('resultsArea');
    btnText.innerText = "Analyse...";
    try {
        const response = await fetch(`/api/radar?min_rank=${document.getElementById('minRank').value}&max_rank=${document.getElementById('maxRank').value}&min_ratio=${document.getElementById('minRatio').value}&inactives_only=${document.getElementById('inactivesOnly').checked}`);
        const data = await response.json();
        
        if(data.error) {
            btnText.innerText = "Erreur Serveur";
            area.innerHTML = `<div class="text-center text-red-400 mt-6 p-4 border border-dashed border-red-900 rounded-lg">❌ ${data.error}</div>`;
            return;
        }

        btnText.innerText = `Cibles : ${data.count}`;
        
        currentRadarTargets = data.targets.map(t => {
            let bestLog = { temps: "N/A", deut: "N/A", dureeBrute: 9999999 };
            let bestCoord = "";
            
            if (t.coords && t.coords.length > 0) {
                t.coords.forEach(c => {
                    let log = calculerVol(c);
                    if (log.dureeBrute < bestLog.dureeBrute) {
                        bestLog = log;
                        bestCoord = c;
                    }
                });
            }
            return {...t, tempsStr: bestLog.temps, deut: bestLog.deut, dureeBrute: bestLog.dureeBrute, bestCoord: bestCoord};
        });
        
        document.getElementById('sortButtons').classList.remove('hidden');
        afficherRadar('ratio'); 
    } catch (e) { btnText.innerText = "Erreur Web"; }
    setTimeout(() => btnText.innerText = "Relancer le Scan", 2000);
}

function afficherRadar(mode) {
    const area = document.getElementById('resultsArea');
    area.innerHTML = "";
    
    if(mode === 'ratio') currentRadarTargets.sort((a, b) => b.ratio - a.ratio);
    if(mode === 'temps') currentRadarTargets.sort((a, b) => a.dureeBrute - b.dureeBrute);
    
    document.getElementById('btnSortRatio').className = "flex-1 text-xs font-bold py-2 rounded border transition " + (mode === 'ratio' ? "bg-gray-800 text-neon border-neon" : "bg-gray-800 text-white border-gray-600 hover:border-neon");
    document.getElementById('btnSortTemps').className = "flex-1 text-xs font-bold py-2 rounded border transition " + (mode === 'temps' ? "bg-gray-800 text-neon border-neon" : "bg-gray-800 text-white border-gray-600 hover:border-neon");

    currentRadarTargets.forEach(t => {
        const statusTag = (t.status.includes('i') || t.status.includes('I')) ? `<span class="bg-blue-900 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Inactif</span>` : '';
        const favIcon = favoris.includes(t.name) ? '⭐️' : '☆';
        
        const card = `
        <div class="card p-4 rounded-xl shadow border-l-2 border-transparent hover:border-neon transition">
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-lg text-white flex items-center">${t.name} ${statusTag} <span class="ml-2 cursor-pointer text-xl" onclick="toggleFavori('${t.name}')">${favIcon}</span></h3>
                <span class="text-gray-500 text-xs font-mono">Top ${t.rank}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm mb-3 bg-gray-800 p-2 rounded border border-gray-700">
                <div><span class="text-gray-400 text-xs">💰 Éco:</span> <br><span class="font-mono text-green-400 text-sm">${t.eco.toLocaleString()}</span></div>
                <div><span class="text-gray-400 text-xs">🛡️ Mil:</span> <br><span class="font-mono text-red-400 text-sm">${t.mil.toLocaleString()}</span></div>
            </div>
            <div class="flex justify-between items-center bg-gray-900 p-2 rounded mb-3 border border-gray-800">
                <span class="text-neon text-xs font-mono">⏱️ ${t.tempsStr}</span>
                <span class="text-blue-300 text-xs font-mono">💧 ${t.deut} Deut</span>
            </div>
            <div class="border-t border-gray-700 pt-3 flex flex-wrap gap-2">
                ${t.coords.map(c => {
                    let isBest = (c === t.bestCoord);
                    let colorClass = isBest ? "bg-neon text-gray-900 font-bold border-neon" : "bg-gray-700 text-gray-200 hover:bg-neon hover:text-gray-900 border-transparent";
                    return `<span class="${colorClass} cursor-pointer px-2 py-1 rounded text-xs font-mono shadow transition border" onclick="navigator.clipboard.writeText('${c}')">${c}</span>`;
                }).join('')}
            </div>
        </div>`;
        area.insertAdjacentHTML('beforeend', card);
    });
}

async function chargerDebris() {
    const area = document.getElementById('crashesArea');
    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>📡 Recherche...</p>";
    try {
        const response = await fetch(`/api/crashes?min_debris=${document.getElementById('minDebrisInput').value}`);
        const data = await response.json();
        area.innerHTML = data.crashes.length === 0 ? `<div class="text-center text-gray-400 mt-6 p-4 border border-dashed border-gray-700 rounded-lg">Aucun CDR.</div>` : "";
        
        data.crashes.forEach(c => {
            const recTime = c.coords ? calculerVol(c.coords, "REC").temps : "Inconnu";
            
            const card = `
            <div class="card p-4 rounded-xl shadow border-l-4 border-l-neon relative overflow-hidden mb-3">
                <div class="absolute -right-4 -top-4 text-6xl opacity-10">☄️</div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-white text-md z-10 cursor-pointer hover:text-neon underline decoration-dashed" onclick="lancerRechercheDepuisDebris('${c.name}')">🎯 ${c.name}</h3>
                    <span class="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">${c.time}</span>
                </div>
                <div class="text-sm bg-gray-800 p-3 rounded border border-gray-700 mb-2 z-10 relative">
                    <p class="text-gray-400 mb-1 flex justify-between"><span>Perte :</span> <span class="text-red-400 font-mono font-bold">-${c.loss_points.toLocaleString()}</span></p>
                    <p class="text-gray-400 flex justify-between"><span>CDR :</span> <span class="text-neon font-mono font-bold">~${c.estimated_resources.toLocaleString()}</span></p>
                </div>
                <div class="flex justify-between items-center z-10 relative bg-gray-700/50 p-2 rounded">
                    <span class="text-xs text-gray-300">🚜 Recycleurs : <span class="text-white font-bold">${c.recyclers_needed.toLocaleString()}</span></span>
                    <span class="text-xs text-neon font-mono">⏱️ ${recTime}</span>
                </div>
            </div>`;
            area.insertAdjacentHTML('beforeend', card);
        });
    } catch (e) { area.innerHTML = "<p class='text-center text-red-400 mt-4'>❌ Erreur</p>"; }
}

function lancerRechercheDepuisDebris(nom) {
    changerOnglet('profiler');
    document.getElementById('searchPlayerName').value = nom;
    chercherJoueur();
}

function toggleFavori(nom) {
    if(favoris.includes(nom)) favoris = favoris.filter(n => n !== nom);
    else favoris.push(nom);
    localStorage.setItem('ogame_favoris', JSON.stringify(favoris));
    afficherFavoris();
    if(document.getElementById('view-radar').classList.contains('hidden') === false) afficherRadar('ratio');
}

function afficherFavoris() {
    const area = document.getElementById('favoritesArea');
    if(favoris.length === 0) { area.innerHTML = ""; return; }
    let html = `<div class="flex flex-wrap gap-2">`;
    favoris.forEach(f => {
        html += `<span class="bg-yellow-900/50 border border-yellow-600 text-yellow-300 text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-yellow-800" onclick="document.getElementById('searchPlayerName').value='${f}'; chercherJoueur();">⭐️ ${f}</span>`;
    });
    html += `</div>`;
    area.innerHTML = html;
}

async function chercherJoueur() {
    const input = document.getElementById('searchPlayerName').value.trim();
    const area = document.getElementById('profilerResults');
    if(!input) return;
    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>⏳ Faisceau en cours...</p>";
    try {
        const response = await fetch(`/api/profiler?player_name=${encodeURIComponent(input)}`);
        const data = await response.json();
        if(data.error) { area.innerHTML = `<div class="text-center text-red-400 mt-4 p-4 border border-dashed border-red-900 rounded-lg">❌ ${data.error}</div>`; return; }

        if (data.type === "alliance") {
            let html = `<div class="border-t border-gray-700 pt-4"><h3 class="font-bold text-xl text-neon mb-4">${data.name} (${data.members.length} membres)</h3><div class="space-y-3">`;
            data.members.forEach(m => {
                let status = m.status ? `<span class="text-[10px] text-blue-400">[${m.status}]</span>` : '';
                html += `<div class="bg-gray-800 p-3 rounded border border-gray-700"><div class="font-bold text-white mb-2">${m.name} ${status}</div><div class="flex flex-wrap gap-1">${m.coords.map(c => `<span class="bg-gray-700 text-xs px-2 py-1 rounded">${c}</span>`).join('')}</div></div>`;
            });
            area.innerHTML = html + "</div></div>";
        } else {
            const favIcon = favoris.includes(data.name) ? '⭐️' : '☆';
            let scoresHtml = `<div class="grid grid-cols-2 gap-2 text-sm bg-gray-800 p-3 rounded border border-gray-700 mb-4">`;
            for (const [cat, info] of Object.entries(data.scores)) { scoresHtml += `<div class="flex justify-between border-b border-gray-700 pb-1"><span class="text-gray-400">${cat}:</span><span class="text-white font-mono">${info.score.toLocaleString()} <span class="text-xs text-neon">(#${info.rank})</span></span></div>`; }
            scoresHtml += `</div>`;

            let planetsHtml = `<h4 class="text-sm text-gray-400 mb-2">Empire Immobilier :</h4><div class="space-y-2">`;
            data.planets.forEach(p => {
                const moon = p.has_moon ? `🌘` : '';
                planetsHtml += `<div class="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700"><span class="font-bold text-gray-200 cursor-pointer" onclick="navigator.clipboard.writeText('${p.coords}')">${p.coords} ${moon}</span><span class="text-xs text-gray-500">${p.name}</span></div>`;
            });
            area.innerHTML = `<div class="border-t border-gray-700 pt-4 mt-2"><h3 class="font-bold text-xl text-white mb-4">${data.name} <span class="cursor-pointer" onclick="toggleFavori('${data.name}'); chercherJoueur();">${favIcon}</span></h3>${scoresHtml}${planetsHtml}</div></div>`;
        }
    } catch (error) { area.innerHTML = "<p class='text-center text-red-400'>❌ Erreur.</p>"; }
}

function analyserRapport() {
    let text = document.getElementById('rapportText').value.replace(/[\.\s]/g, ''); 
    let box = document.getElementById('parserResult');
    
    let metal = text.match(/M[eé]tal:?(\d+)/i) ? parseInt(text.match(/M[eé]tal:?(\d+)/i)[1]) : 0;
    let cristal = text.match(/Cristal:?(\d+)/i) ? parseInt(text.match(/Cristal:?(\d+)/i)[1]) : 0;
    let deut = text.match(/Deut[eé]rium:?(\d+)/i) ? parseInt(text.match(/Deut[eé]rium:?(\d+)/i)[1]) : 0;
    
    let total = metal + cristal + deut;
    if(total === 0) {
        box.innerHTML = "❌ Rapport non reconnu. Vérifie le format du texte copié.";
        box.classList.remove('hidden'); return;
    }

    let capaVaisseau = (myConfig.vaisseau === "PT") ? 5000 : 25000;
    let nbVaisseaux = Math.ceil((total / 2) / capaVaisseau); 
    
    box.innerHTML = `
        <div class="flex justify-between border-b border-gray-700 pb-2 mb-2">
            <span class="text-gray-400">Volable (50%)</span>
            <span class="text-green-400 font-bold">${(total / 2).toLocaleString()}</span>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-gray-400">Flotte requise :</span>
            <span class="bg-gray-800 px-3 py-1 rounded text-neon font-bold border border-gray-600">${nbVaisseaux.toLocaleString()} ${myConfig.vaisseau}</span>
        </div>
    `;
    box.classList.remove('hidden');
}