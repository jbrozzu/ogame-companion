from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch

router = APIRouter()

@router.get("/api/profiler")
def get_profiler(player_name: str = Query(...)):
    players_root = safe_fetch(f"{BASE_URL}/players.xml")
    if not players_root: return {"error": "API indisponible"}
    
    target_id, target_name, target_status = None, "", ""
    for p in players_root.findall('player'):
        if p.get('name').lower() == player_name.lower().strip():
            target_id, target_name, target_status = p.get('id'), p.get('name'), p.get('status') or ""
            break
            
    if not target_id: return {"error": "Joueur introuvable"}
        
    univ_root = safe_fetch(f"{BASE_URL}/universe.xml")
    planets = []
    if univ_root:
        for pl in univ_root.findall('planet'):
            if pl.get('player') == target_id:
                planets.append({"coords": pl.get('coords'), "name": pl.get('name'), "has_moon": pl.find('moon') is not None})
    planets.sort(key=lambda x: [int(c) for c in x['coords'].split(':')])

    scores = {}
    for t_id, t_name in {0: 'Général', 1: 'Économie', 2: 'Recherche', 3: 'Militaire', 7: 'Honneur'}.items():
        hs_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type={t_id}")
        if hs_root:
            for p in hs_root.findall('player'):
                if p.get('id') == target_id:
                    scores[t_name] = {"score": int(p.get('score')), "rank": int(p.get('position'))}
                    break

    return {"name": target_name, "status": target_status, "scores": scores, "planets": planets}