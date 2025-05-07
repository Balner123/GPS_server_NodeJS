import requests
import json
import time
from datetime import datetime

# Konfigurace
#BASE_URL = "http://129.151.193.104:5000/"
BASE_URL = "http://localhost:5000"
EXISTING_TEST_DEVICE = "400" # Přejmenováno pro srozumitelnost
NEW_TEST_DEVICE = "500"     # Nové testovací zařízení

def send_gps_data(device_id, longitude, latitude, speed=None, altitude=None, accuracy=None, satellites=None):
    """Sends GPS data to the /device_input endpoint."""
    endpoint = BASE_URL + "/device_input"
    data = {
        "device": device_id,
        "longitude": longitude,
        "latitude": latitude
    }
    if speed is not None:
        data["speed"] = speed
    if altitude is not None:
        data["altitude"] = altitude
    if accuracy is not None:
        data["accuracy"] = accuracy
    if satellites is not None:
        data["satellites"] = satellites

    headers = {"Content-Type": "application/json"}
    print(f"\n-> Odesílám GPS data na {endpoint} pro zařízení: {device_id}")
    print(f"   Data: {json.dumps(data)}")

    try:
        response = requests.post(endpoint, headers=headers, data=json.dumps(data))
        print(f"<- Stavový kód: {response.status_code}")
        try:
            response_json = response.json()
            print(f"<- Odpověď serveru: {response_json}")
            return response_json # Vracíme JSON pro další použití
        except requests.exceptions.JSONDecodeError:
            print(f"<- Odpověď serveru (raw): {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"!! Chyba při odesílání GPS dat: {e}")
        return None

def update_device_sleep_interval(device_id, sleep_interval):
    """Updates the sleep interval for a device via /device_settings endpoint."""
    endpoint = BASE_URL + "/device_settings"
    data = {
        "device": device_id,
        "sleep_interval": sleep_interval
    }
    headers = {"Content-Type": "application/json"}
    print(f"\n-> Aktualizuji sleep_interval na {endpoint} pro zařízení: {device_id} na {sleep_interval}s")
    print(f"   Data: {json.dumps(data)}")

    try:
        response = requests.post(endpoint, headers=headers, data=json.dumps(data))
        print(f"<- Stavový kód: {response.status_code}")
        try:
            response_json = response.json()
            print(f"<- Odpověď serveru: {response_json}")
            return response_json
        except requests.exceptions.JSONDecodeError:
            print(f"<- Odpověď serveru (raw): {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"!! Chyba při aktualizaci sleep_interval: {e}")
        return None

if __name__ == "__main__":
    print("=== Zahajuji testování serveru ===")

    # --- Test 1: Odeslání dat pro existující zařízení ---
    print("\n--- Test 1: Odeslání dat pro existující zařízení ({}) ---".format(EXISTING_TEST_DEVICE))
    send_gps_data(
        device_id=EXISTING_TEST_DEVICE,
        longitude=14.42076,
        latitude=50.08804,
        speed=60.5,
        altitude=200.0
    )

    # --- Test 2: Odeslání dat pro nové zařízení (očekáváme defaultní sleep_interval) ---
    print("\n--- Test 2: Odeslání dat pro NOVÉ zařízení ({}) ---".format(NEW_TEST_DEVICE))
    send_gps_data(
        device_id=NEW_TEST_DEVICE,
        longitude=15.00000,
        latitude=50.10000,
        satellites=5
    )

    # --- Test 3: Aktualizace sleep_interval pro existující zařízení ---
    new_interval_existing = 120
    print("\n--- Test 3: Aktualizace sleep_interval pro zařízení {} na {}s ---".format(EXISTING_TEST_DEVICE, new_interval_existing))
    update_device_sleep_interval(EXISTING_TEST_DEVICE, new_interval_existing)

    # --- Test 4: Ověření aktualizovaného sleep_interval pro existující zařízení ---
    print("\n--- Test 4: Ověření aktualizovaného sleep_interval pro zařízení {} ---".format(EXISTING_TEST_DEVICE))
    response_existing = send_gps_data(
        device_id=EXISTING_TEST_DEVICE,
        longitude=14.42176, # Mírně jiná poloha
        latitude=50.08904,
        speed=65.0
    )
    if response_existing and response_existing.get("sleep_interval") == new_interval_existing:
        print(f"   Ověření ÚSPĚŠNÉ: sleep_interval pro {EXISTING_TEST_DEVICE} je {response_existing.get('sleep_interval')}s.")
    elif response_existing:
        print(f"   Ověření NEÚSPĚŠNÉ: sleep_interval pro {EXISTING_TEST_DEVICE} je {response_existing.get('sleep_interval')}s, očekáváno {new_interval_existing}s.")
    else:
        print(f"   Ověření NEÚSPĚŠNÉ: Nelze získat odpověď pro {EXISTING_TEST_DEVICE}.")

    # --- Test 5: Aktualizace sleep_interval pro nové zařízení ---
    new_interval_new_device = 45
    print("\n--- Test 5: Aktualizace sleep_interval pro zařízení {} na {}s ---".format(NEW_TEST_DEVICE, new_interval_new_device))
    update_device_sleep_interval(NEW_TEST_DEVICE, new_interval_new_device)
    
    # --- Test 6: Ověření aktualizovaného sleep_interval pro nové zařízení ---
    print("\n--- Test 6: Ověření aktualizovaného sleep_interval pro zařízení {} ---".format(NEW_TEST_DEVICE))
    response_new = send_gps_data(
        device_id=NEW_TEST_DEVICE,
        longitude=15.00100, # Mírně jiná poloha
        latitude=50.10100,
        accuracy=5.0
    )
    if response_new and response_new.get("sleep_interval") == new_interval_new_device:
        print(f"   Ověření ÚSPĚŠNÉ: sleep_interval pro {NEW_TEST_DEVICE} je {response_new.get('sleep_interval')}s.")
    elif response_new:
        print(f"   Ověření NEÚSPĚŠNÉ: sleep_interval pro {NEW_TEST_DEVICE} je {response_new.get('sleep_interval')}s, očekáváno {new_interval_new_device}s.")
    else:
        print(f"   Ověření NEÚSPĚŠNÉ: Nelze získat odpověď pro {NEW_TEST_DEVICE}.")

    print("\n=== Testování dokončeno ===")
