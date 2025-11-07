import requests
import json
import time

# --- Configuration ---
BASE_URL = "http://localhost:5000"
# Změňte tyto údaje, aby odpovídaly existujícímu uživateli na serveru
TEST_USERNAME = "lotr"
TEST_PASSWORD = "lotr"
# Unikátní ID pro naše testovací zařízení
DEVICE_ID = "0123556789"

# Default power status reported by this test device
DEFAULT_POWER_STATUS = "ON"

# --- Headers ---
headers = {
    "Content-Type": "application/json"
}

def register_device():
    """Register the device using the unified endpoint."""
    url = f"{BASE_URL}/api/devices/register"
    payload = {
        "client_type": "HW",
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "device_id": DEVICE_ID,
        "name": "Cluster Test Device"
    }
    
    print(f"--- Pokus o registraci zařízení {DEVICE_ID} pro uživatele {TEST_USERNAME}... ---")
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Odpověď JSON:")
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("Tělo odpovědi (není JSON):")
            print(response.text)
            
        # 200: already registered, 201: created, 409: registered to another account
        if response.status_code in [200, 201]:
            print("Registrace úspěšná nebo zařízení již existuje.")
            return True
        elif response.status_code == 409:
            print("Zařízení je již registrováno k jinému účtu.")
            return True # Považujeme za úspěch pro účely testování odesílání dat
        else:
            return False
        
    except requests.exceptions.RequestException as e:
        print(f"Během registrace nastala chyba: {e}")
        return False

def perform_handshake(power_status=DEFAULT_POWER_STATUS):
    """Run the unified handshake to fetch config and potential power instruction."""
    url = f"{BASE_URL}/api/devices/handshake"
    payload = {
        "client_type": "HW",
        "device_id": DEVICE_ID,
        "power_status": power_status
    }

    print(f"\n--- Handshake pro zařízení {DEVICE_ID} ---")
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        print(f"Status Code: {response.status_code}")
        try:
            body = response.json()
            print(json.dumps(body, indent=2))
        except json.JSONDecodeError:
            body = None
            print("Tělo odpovědi (není JSON):")
            print(response.text)

        if response.status_code == 200 and body:
            if not body.get("registered", False):
                print("Zařízení není registrováno – handshake selhal.")
                return None
            return body
        else:
            print("Handshake selhal.")
            return None
    except requests.exceptions.RequestException as exc:
        print(f"Během handshake nastala chyba: {exc}")
        return None


def send_clustered_location_data(power_instruction=None, instruction_token=None):
    """Send clustered GPS points, optionally acknowledging a power instruction."""
    url = f"{BASE_URL}/api/devices/input"
    
    # Základní poloha
    base_lat = 50.08804
    base_lon = 14.42076
    
    data_points = []
    # 3 blízké body
    for i in range(3):
        # Přidáme velmi malý posun (cca 1.1 metru na každý krok)
        lat = base_lat + (i * 0.00001)
        lon = base_lon + (i * 0.00001)
        
        data_points.append({
            "device": DEVICE_ID,
            "latitude": lat,
            "longitude": lon,
            "speed": 0,
            "altitude": 200,
            "accuracy": 1.0,
            "satellites": 10,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "power_status": DEFAULT_POWER_STATUS,
            "client_type": "HW"
        })
        print(f"Připraven blízký bod {i+1}: lat={lat}, lon={lon}")
        # Krátká pauza pro zajištění unikátního časového razítka
        time.sleep(2)

    # 1 vzdálený bod (posun o cca 1 km)
    far_lat = base_lat + 0.01
    far_lon = base_lon + 0.01
    data_points.append({
        "device": DEVICE_ID,
        "latitude": far_lat,
        "longitude": far_lon,
        "speed": 50,
        "altitude": 210,
        "accuracy": 5.0,
        "satellites": 12,
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "power_status": DEFAULT_POWER_STATUS,
        "client_type": "HW"
    })
    print(f"Připraven vzdálený bod: lat={far_lat}, lon={far_lon}")
    time.sleep(2)


    print(f"\n--- Odesílání {len(data_points)} poloh pro zařízení {DEVICE_ID}... ---")
    
    if power_instruction and instruction_token:
        print(f"Detekována instrukce {power_instruction} – odešleme ACK {instruction_token} a změníme stav na OFF.")
        for point in data_points:
            point["power_instruction_ack"] = instruction_token
            point["power_status"] = "OFF"

    try:
        response = requests.post(url, headers=headers, data=json.dumps(data_points))
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Odpověď JSON:")
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("Tělo odpovědi (není JSON):")
            print(response.text)

    except requests.exceptions.RequestException as e:
        print(f"Během odesílání dat nastala chyba: {e}")


if __name__ == "__main__":
    print("Spouštím testovací skript pro shlukování poloh a handshake...")
    if not register_device():
        print("\nRegistrace selhala. Zkontrolujte přihlašovací údaje a stav serveru.")
        raise SystemExit(1)

    handshake_info = perform_handshake(DEFAULT_POWER_STATUS)
    if not handshake_info:
        print("Handshake se nezdařil, končím.")
        raise SystemExit(1)

    instruction = handshake_info.get("power_instruction")
    token = handshake_info.get("instruction_token")

    send_clustered_location_data(power_instruction=instruction, instruction_token=token)
