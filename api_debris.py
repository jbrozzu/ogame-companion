import asyncio
from datetime import datetime
from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch, server_memory, CDR_FACTOR, logger

router = APIRouter()

async def monitor_crashes():
    logger.info("🚀 Démarrage du Traqueur de Débris en arrière-plan...")
    while True:
        logger.info("🔍 Vérification silencieuse des pertes de points...")
        mil_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type=3", 300)
        players_root = safe_fetch(f"{BASE_URL}/players.xml")
        
        if mil_root and players_root:
            current_scores = {p.get('id'): int(p.get('score')) for p in mil_root.findall('player')}
            players = {p.get('id'): p.get('name') for p in players_root.findall('player')}
            
            if not server_memory["previous_scores"]:
                logger.info("🧠 Initialisation de la mémoire des scores.")
                server_memory["previous_scores"] = current_scores
            else:
                old_scores = server_memory["previous_scores"]
                crashes_detected = []
                
                for p_id, current_score in current_scores.items():
                    if p_id in old_scores:
                        loss = old_scores[p_id] - current_score
                        if loss * CDR_FACTOR >= 10000:
                            crashes_detected.append((p_id, loss))
                
                if crashes_detected:
                    logger.warning(f"💥 {len(crashes_detected)} CRASH(S) DÉTECTÉ(S) ! Chargement des coordonnées...")
                    univ_root = safe_fetch(f"{BASE_URL}/universe.xml")
                    coords_map = {}
                    if univ_root:
                        for pl in univ_root.findall('planet'):
                            coords_map.setdefault(pl.get('player'), []).append(pl.get('coords'))
                            
                    for p_id, loss in crashes_detected:
                        main_coord = coords_map.get(p_id, [""])[0] if coords_map else ""
                        player_name = players.get(p_id, "Inconnu")
                        
                        logger.warning(f"🎯 CIBLE AJOUTÉE : {player_name} (-{loss} pts)")
                        
                        server_memory["crash_history"].insert(0, {
                            "time": datetime.now().strftime("%H:%M"),
                            "name": player_name,
                            "loss_points": loss,
                            "estimated_resources": loss * CDR_FACTOR,
                            "recyclers_needed": int((loss * CDR_FACTOR) / 25000) + 1,
                            "coords": main_coord
                        })
                
                server_memory["crash_history"] = server_memory["crash_history"][:100]
            server_memory["previous_scores"] = current_scores
        else:
            logger.error("❌ Échec du Traqueur : Impossible de lire l'API OGame ce tour-ci.")
            
        await asyncio.sleep(600)

@router.get("/api/crashes")
def get_crashes(min_debris: int = Query(30000)):
    filtered_crashes = [c for c in server_memory["crash_history"] if c["estimated_resources"] >= min_debris]
    return {"crashes": filtered_crashes}