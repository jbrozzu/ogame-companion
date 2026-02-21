import requests
import xml.etree.ElementTree as ET
import time

SERVER_ID = "s278-fr"
BASE_URL = f"https://{SERVER_ID}.ogame.gameforge.com/api"
CDR_FACTOR = 500

# Mémoire partagée du serveur
server_memory = {"previous_scores": {}, "crash_history": []}

# NOUVEAU : Le Cache pour éviter de se faire bannir l'IP par Gameforge
xml_cache = {}

def safe_fetch(url, cache_duration=3600):
    """Télécharge le XML, ou utilise la version en mémoire si elle a moins d'une heure"""
    current_time = time.time()
    
    if url in xml_cache and (current_time - xml_cache[url]['time']) < cache_duration:
        return xml_cache[url]['data']
        
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = ET.fromstring(response.content)
            xml_cache[url] = {'time': current_time, 'data': data}
            return data
    except:
        pass
    return None