import requests
import json

# --- Konfigurace ---
BASE_URL = "http://localhost:5000"
# DŮLEŽITÉ: Toto ID zařízení MUSÍ být předem ručně zaregistrováno v systému
# pod nějakým uživatelským účtem, aby tento test uspěl.
TEST_DEVICE_ID = "0123456789" # Příklad ID, změňte dle potřeby
TEST_DEVICE_NAME = "Moje Testovací GPS" # Jméno, které zařízení posílá

def send_gps_data(device_id, device_name, longitude, latitude):
    """Odešle GPS data vč. jména na server."""
    endpoint = f"{BASE_URL}/device_input"
    data = {
        "device": device_id,
        "name": device_name,
        "longitude": longitude,
        "latitude": latitude
    }
    
    print(f"-> Odesílám GPS data pro registrované zařízení: {device_id} (Jméno: '{device_name}')")
    print(f"   Data: {json.dumps(data)}")

    try:
        # Použijeme parametr `json` pro automatickou serializaci a nastavení hlavičky
        response = requests.post(endpoint, json=data)
        print(f"<- Stavový kód odpovědi: {response.status_code}")

        if response.status_code != 200:
            print(f"<- Neočekávaný stavový kód: {response.status_code}")
            print(f"   Tělo odpovědi: {response.text}")
            return "error"
        
        # Pro úspěšný stavový kód (200) se pokusíme dekódovat JSON
        try:
            response_json = response.json()
            print(f"<- Odpověď serveru (JSON): {response_json}")
            return "json"
        except json.JSONDecodeError:
            print(f"<- Odpověď serveru není platný JSON: {response.text}")
            return "raw"

    except requests.exceptions.RequestException as e:
        print(f"!! Chyba při odesílání GPS dat: {e}")
        return None

if __name__ == "__main__":
    print("=== Spouštím test odeslání dat pro REGISTROVANÉ zařízení ===")
    print("POZNÁMKA: Tento test bude úspěšný pouze pokud je zařízení '{TEST_DEVICE_ID}' již registrováno v databázi.")
    
    # Odešleme testovací data vč. jména
    response_type = send_gps_data(TEST_DEVICE_ID, TEST_DEVICE_NAME, 14.421, 50.089)

    # Ověření výsledku
    if response_type == "json":
        print("\n[OK] Ověření ÚSPĚŠNÉ: Server přijal data a odpověděl ve formátu JSON, jak se očekávalo.")
    else:
        print(f"\n[FAIL] Ověření SELHALO: Očekávala se odpověď JSON, ale byla přijata odpověď typu '{response_type}'.")
        print("      Možné příčiny: ")
        print(f"      1. Zařízení s ID '{TEST_DEVICE_ID}' není registrováno v databázi.")
        print("      2. Server má interní chybu (zkontrolujte logy serveru).")

    print("\n=== Test dokončen ===")
