function changerOnglet(onglet) {
    document.getElementById('view-radar').classList.add('hidden');
    document.getElementById('view-debris').classList.add('hidden');
    document.getElementById('view-profiler').classList.add('hidden');
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
        const response = await fetch(`http://127.0.0.1:8000/api/radar?min_rank=${minRank}&max_rank=${maxRank}&min_ratio=${minRatio}&inactives_only=${inactives}`);
        const data = await response.json();
        btnText.innerText = `Cibles trouvées : ${data.count}`;

        if(data.count === 0) {
            resultsArea.innerHTML = `<div class="text-center text-gray-400 mt-6 p-4 border border-dashed border-gray-700 rounded-lg">Aucun frigo trouvé.</div>`;
            return;
        }

        data.targets.forEach(t => {
            const statusTag = (t.status.includes('i') || t.status.includes('I')) ? `<span class="bg-blue-900 text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold ml-2 uppercase">Inactif</span>` : '';
            const card = `
            <div class="card p-4 rounded-xl shadow">
                <div class="flex justify-between items-start mb-2"><h3 class="font-bold text-lg text-white flex items-center">${t.name} ${statusTag}</h3><span class="text-gray-500 text-xs font-mono">Top ${t.rank}</span></div>
                <div class="grid grid-cols-2 gap-2 text-sm mb-3 bg-gray-800 p-2 rounded border border-gray-700"><div><span class="text-gray-400">💰 Éco:</span> <br><span class="font-mono text-green-400">${t.eco.toLocaleString()}</span></div><div><span class="text-gray-400">🛡️ Mil:</span> <br><span class="font-mono text-red-400">${t.mil.toLocaleString()}</span></div></div>
                <div class="flex justify-between items-center text-sm mb-3"><span class="text-gray-400">Ratio de vulnérabilité :</span><span class="font-bold text-neon bg-gray-800 px-2 py-1 rounded">${t.ratio}x</span></div>
                <div class="border-t border-gray-700 pt-3"><div class="flex flex-wrap gap-2">${t.coords.map(c => `<span class="bg-gray-700 hover:bg-gray-600 cursor-pointer text-gray-200 px-2 py-1 rounded text-xs font-mono transition shadow" onclick="navigator.clipboard.writeText('${c}')">${c}</span>`).join('')}</div></div>
            </div>`;
            resultsArea.insertAdjacentHTML('beforeend', card);
        });
    } catch (error) { btnText.innerText = "Erreur de connexion"; }
    setTimeout(() => btnText.innerText = "Relancer le Scan", 2000);
}

async function chargerDebris() {
    const area = document.getElementById('crashesArea');
    const minDebris = document.getElementById('minDebrisInput').value;
    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>📡 Recherche de champs de débris en cours...</p>";
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/crashes?min_debris=${minDebris}`);
        const data = await response.json();
        if(data.crashes.length === 0) {
            area.innerHTML = `<div class="text-center text-gray-400 mt-6 p-4 border border-dashed border-gray-700 rounded-lg">Aucune flotte détruite détectée pour l'instant.</div>`;
            return;
        }
        area.innerHTML = ""; 
        data.crashes.forEach(c => {
            const card = `
            <div class="card p-4 rounded-xl shadow border-l-4 border-l-neon relative overflow-hidden">
                <div class="absolute -right-4 -top-4 text-6xl opacity-10">☄️</div>
                <div class="flex justify-between items-start mb-2"><h3 class="font-bold text-white text-md z-10">⚔️ Cible : ${c.name}</h3><span class="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">${c.time}</span></div>
                <div class="text-sm bg-gray-800 p-3 rounded border border-gray-700 mb-2 z-10 relative"><p class="text-gray-400 mb-1 flex justify-between"><span>Points perdus :</span> <span class="text-red-400 font-mono font-bold">-${c.loss_points.toLocaleString()} pts</span></p><p class="text-gray-400 flex justify-between"><span>Taille du CDR :</span> <span class="text-neon font-mono font-bold">~${c.estimated_resources.toLocaleString()}</span></p></div>
                <div class="flex items-center gap-2 mt-3 z-10 relative bg-gray-700/50 p-2 rounded"><span class="text-lg">🚜</span><span class="text-sm text-gray-300">Recycleurs requis : <span class="text-white font-bold ml-1">${c.recyclers_needed.toLocaleString()}</span></span></div>
            </div>`;
            area.insertAdjacentHTML('beforeend', card);
        });
    } catch (error) { area.innerHTML = "<p class='text-center text-red-400 mt-4'>❌ Erreur de connexion au serveur radar.</p>"; }
}

async function chercherJoueur() {
    const searchInput = document.getElementById('searchPlayerName').value.trim();
    const area = document.getElementById('profilerResults');
    if(!searchInput) return;

    area.innerHTML = "<p class='text-center text-gray-400 mt-4'>⏳ Faisceau en cours de calcul...</p>";
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/profiler?player_name=${encodeURIComponent(searchInput)}`);
        const data = await response.json();
        if(data.error) { area.innerHTML = `<div class="text-center text-red-400 mt-4 p-4 border border-dashed border-red-900 rounded-lg">❌ ${data.error}</div>`; return; }

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

        area.innerHTML = `<div class="border-t border-gray-700 pt-4 mt-2"><h3 class="font-bold text-xl text-white flex items-center mb-4">${data.name} ${statusTag} ${vacTag} ${banditTag}</h3>${scoresHtml}${planetsHtml}</div>`;
    } catch (error) { area.innerHTML = "<p class='text-center text-red-400 mt-4'>❌ Erreur de connexion.</p>"; }
}