import asyncio
from datetime import datetime
from fastapi import APIRouter, Query
from config import BASE_URL, safe_fetch, server_memory, CDR_FACTOR

router = APIRouter()

async def monitor_crashes():
    while True:
        # CORRECTION ICI : type=3 pour surveiller les points Militaires !
        mil_root = safe_fetch(f"{BASE_URL}/highscore.xml?category=1&type=3")
        players_root = safe_fetch(f"{BASE_URL}/players.xml")
        
        if mil_root and players_root:
            current_scores = {p.get('id'): int(p.get('score')) for p in mil_root.findall('player')}
            players = {p.get('id'): p.get('name') for p in players_root.findall('player')}
            
            if not server_memory["previous_scores"]:
                server_memory["previous_scores"] = current_scores
            else:
                old_scores = server_memory["previous_scores"]
                for p_id, current_score in current_scores.items():
                    if p_id in old_scores:
                        loss = old_scores[p_id] - current_score
                        if loss * CDR_FACTOR >= 10000:
                            server_memory["crash_history"].insert(0, {
                                "time": datetime.now().strftime("%H:%M"),
                                "name": players.get(p_id, "Inconnu"),
                                "loss_points": loss,
                                "estimated_resources": loss * CDR_FACTOR,
                                "recyclers_needed": int((loss * CDR_FACTOR) / 25000) + 1
                            })
                server_memory["crash_history"] = server_memory["crash_history"][:100]
                server_memory["previous_scores"] = current_scores
        await asyncio.sleep(600)

@router.get("/api/crashes")
def get_crashes(min_debris: int = Query(30000)):
    filtered_crashes = [c for c in server_memory["crash_history"] if c["estimated_resources"] >= min_debris]
    return {"crashes": filtered_crashes}