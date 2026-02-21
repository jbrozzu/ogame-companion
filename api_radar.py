from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch, logger

router = APIRouter()

@router.get("/api/radar")
def get_radar(min_rank: int = Query(1), max_rank: int = Query(4000), min_ratio: int = Query(15), inactives_only: bool = Query(True)):
    logger.info(f"📡 Scan Radar lancé : Rang {min_rank}-{max_rank}, Ratio > {min_ratio}")
    
    eco_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type=1")
    mil_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type=3")
    players_root = safe_fetch(f"{BASE_URL}/players.xml")
    univ_root = safe_fetch(f"{BASE_URL}/universe.xml")

    if not all([eco_root, mil_root, players_root, univ_root]):
        logger.error("❌ Scan Radar avorté : Fichiers manquants ou Timeout.")
        return {"error": "L'API OGame ne répond pas (Timeout). Réessayez dans 1 minute."}

    players_data = {p.get('id'): {'name': p.get('name'), 'status': p.get('status') or ""} for p in players_root.findall('player')}
    mil_scores = {p.get('id'): int(p.get('score')) for p in mil_root.findall('player')}
    coords_map = {}
    for pl in univ_root.findall('planet'):
        coords_map.setdefault(pl.get('player'), []).append(pl.get('coords'))

    targets = []
    for p in eco_root.findall('player'):
        p_id, eco_score, rank = p.get('id'), int(p.get('score')), int(p.get('position'))
        if not (min_rank <= rank <= max_rank): continue
        if p_id in players_data:
            player, mil_score, status = players_data[p_id], mil_scores.get(p_id, 0), players_data[p_id]['status']
            if 'v' in status: continue
            if inactives_only and ('i' not in status and 'I' not in status): continue
            if eco_score > 5000:
                ratio = eco_score / max(mil_score, 1)
                if ratio >= min_ratio:
                    targets.append({
                        "name": player['name'], "rank": rank, "eco": eco_score, "mil": mil_score,
                        "ratio": round(ratio, 1), "status": status, "coords": coords_map.get(p_id, [])
                    })
                    
    logger.info(f"✅ Scan terminé : {len(targets)} frigos trouvés.")
    return {"count": len(targets), "targets": sorted(targets, key=lambda x: x['ratio'], reverse=True)}