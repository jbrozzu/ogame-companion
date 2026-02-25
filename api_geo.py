from fastapi import APIRouter, Request
from config import server_memory, logger
import requests
import time

router = APIRouter()

@router.get("/api/geo/checkin")
async def geo_checkin(request: Request):
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(',')[0] if forwarded else request.client.host
    try:
        response = requests.get(f"http://ip-api.com/json/{ip}")
        data = response.json()
        if data["status"] == "success":
            user_id = f"visiteur_{int(time.time())}"
            server_memory["geo_data"][user_id] = {
                "ip": ip,
                "city": data.get("city"),
                "country": data.get("country"),
                "date": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            logger.info(f"📍 Localisation auto : {data.get('city')} ({ip})")
    except Exception:
        pass
    return {"status": "ok"}

@router.get("/api/geo/list")
def get_geo_list():
    return {"visiteurs": list(server_memory["geo_data"].values())}