import requests
import xml.etree.ElementTree as ET

SERVER_ID = "s278-fr"
BASE_URL = f"https://{SERVER_ID}.ogame.gameforge.com/api"
CDR_FACTOR = 500

# Mémoire partagée du serveur
server_memory = {"previous_scores": {}, "crash_history": []}

def safe_fetch(url):
    """Fonction commune pour télécharger les XML"""
    try:
        return ET.fromstring(requests.get(url, timeout=10).content)
    except:
        return None