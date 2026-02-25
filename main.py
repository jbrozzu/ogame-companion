import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import warnings
from config import logger # On importe notre nouveau logger

from api_radar import router as radar_router
from api_debris import router as debris_router, monitor_crashes
from api_profiler import router as profiler_router
from api_geo import router as geo_router

os.environ['PYTHONWARNINGS'] = 'ignore:urllib3 v2 only supports OpenSSL'
warnings.filterwarnings("ignore")

app = FastAPI(title="OGame Companion API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(radar_router)
app.include_router(debris_router)
app.include_router(profiler_router)
app.include_router(geo_router)

@app.on_event("startup")
async def startup_event():
    logger.info("🟢 DÉMARRAGE DU SERVEUR : Lancement des tâches de fond...")
    asyncio.create_task(monitor_crashes())

@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.get("/app.js")
def read_js():
    return FileResponse("app.js")