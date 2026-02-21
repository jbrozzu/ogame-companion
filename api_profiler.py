from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch, logger

router = APIRouter()

@router.get("/api/profiler")
def get_profiler(player_name: str = Query(...)):
    query = player_name.strip()
    logger.info(f"🕵️ Renseignement demandé sur : {query}")
    
    if query.startswith('[') and query.endswith(']'):
        tag = query[1:-1].lower()
        alliances_root = safe_fetch(f"{BASE_URL}/alliances.xml")
        players_root = safe_fetch(f"{BASE_URL}/players.xml")
        univ_root = safe_fetch(f"{BASE_URL}/universe.xml")
        
        if not all([alliances_root, players_root, univ_root]): 
            logger.error(f"❌ Profiler (Alliance) échoué : Timeout de l'API OGame.")
            return {"error": "L'API OGame ne répond pas. Réessayez."}
        
        ally_id, ally_name = None, ""
        for a in alliances_root.findall('alliance'):
            if a.get('tag').lower() == tag:
                ally_id, ally_name = a.get('id'), a.get('name')
                break
        if not ally_id: return {"error": "Alliance introuvable"}
        
        members = []
        for p in players_root.findall('player'):
            if p.get('alliance') == ally_id:
                members.append({"id": p.get('id'), "name": p.get('name'), "status": p.get('status') or ""})
                
        coords_map = {}
        for pl in univ_root.findall('planet'):
            coords_map.setdefault(pl.get('player'), []).append(pl.get('coords'))
            
        alliance_data = [{"name": m['name'], "status": m['status'], "coords": coords_map.get(m['id'], [])[:3]} for m in members]
        return {"type": "alliance", "name": f"[{tag.upper()}] {ally_name}", "members": alliance_data}
    
    players_root = safe_fetch(f"{BASE_URL}/players.xml")
    if not players_root: 
        logger.error(f"❌ Profiler (Joueur) échoué : Timeout de l'API OGame.")
        return {"error": "L'API OGame ne répond pas. Réessayez."}
    
    target_id, target_name, target_status = None, "", ""
    for p in players_root.findall('player'):
        if p.get('name').lower() == query.lower():
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

    logger.info(f"✅ Renseignement réussi pour {target_name}")
    return {"type": "player", "name": target_name, "status": target_status, "scores": scores, "planets": planets}