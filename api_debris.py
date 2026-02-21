import asyncio
from datetime import datetime
from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch, server_memory, CDR_FACTOR

router = APIRouter()

async def monitor_crashes():
    while True:
        # On utilise le cache de 5 minutes (300s) pour les points militaires
        mil_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type=3", 300)
        players_root = safe_fetch(f"{BASE_URL}/players.xml")
        univ_root = safe_fetch(f"{BASE_URL}/universe.xml") # Ajouté pour trouver les planètes
        
        if mil_root and players_root and univ_root:
            current_scores = {p.get('id'): int(p.get('score')) for p in mil_root.findall('player')}
            players = {p.get('id'): p.get('name') for p in players_root.findall('player')}
            
            # On cartographie les planètes
            coords_map = {}
            for pl in univ_root.findall('planet'):
                coords_map.setdefault(pl.get('player'), []).append(pl.get('coords'))
            
            if not server_memory["previous_scores"]:
                server_memory["previous_scores"] = current_scores
            else:
                old_scores = server_memory["previous_scores"]
                for p_id, current_score in current_scores.items():
                    if p_id in old_scores:
                        loss = old_scores[p_id] - current_score
                        if loss * CDR_FACTOR >= 10000:
                            # On récupère sa planète principale pour calculer le temps de vol
                            main_coord = coords_map.get(p_id, [""])[0] 
                            
                            server_memory["crash_history"].insert(0, {
                                "time": datetime.now().strftime("%H:%M"),
                                "name": players.get(p_id, "Inconnu"),
                                "loss_points": loss,
                                "estimated_resources": loss * CDR_FACTOR,
                                "recyclers_needed": int((loss * CDR_FACTOR) / 25000) + 1,
                                "coords": main_coord # La donnée manquante est réparée !
                            })
                server_memory["crash_history"] = server_memory["crash_history"][:100]
                server_memory["previous_scores"] = current_scores
        await asyncio.sleep(600)

@router.get("/api/crashes")
def get_crashes(min_debris: int = Query(30000)):
    filtered_crashes = [c for c in server_memory["crash_history"] if c["estimated_resources"] >= min_debris]
    return {"crashes": filtered_crashes}