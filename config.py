import requests
import xml.etree.ElementTree as ET
import time
import logging

# Configuration des logs pour qu'ils s'affichent proprement sur Render
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

SERVER_ID = "s278-fr"
BASE_URL = f"https://{SERVER_ID}.ogame.gameforge.com/api"
CDR_FACTOR = 500

# Mémoire partagée du serveur
server_memory = {"previous_scores": {}, "crash_history": [], "geo_data": {}}
xml_cache = {}

def safe_fetch(url, cache_duration=3600):
    """Télécharge le XML avec gestion des timeouts et logs détaillés"""
    current_time = time.time()
    
    if url in xml_cache and (current_time - xml_cache[url]['time']) < cache_duration:
        return xml_cache[url]['data']
        
    try:
        logger.info(f"🌐 Téléchargement API : {url.split('/')[-1]}...")
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = ET.fromstring(response.content)
            xml_cache[url] = {'time': current_time, 'data': data}
            logger.info(f"✅ Succès : {url.split('/')[-1]}")
            return data
        else:
            logger.warning(f"⚠️ Erreur HTTP {response.status_code} sur {url}")
            
    except requests.exceptions.Timeout:
        logger.error(f"❌ TIMEOUT (Trop long) : Les serveurs OGame n'ont pas répondu pour {url}")
    except Exception as e:
        logger.error(f"❌ ERREUR INCONNUE sur {url} : {str(e)}")
        
    return None