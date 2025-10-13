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

# --- Headers ---
headers = {
    "Content-Type": "application/json"
}

def register_device():
    """
    Pokusí se zaregistrovat zařízení na serveru pomocí jména a hesla.
    """
    # Správná URL pro registraci hardwaru
    url = f"{BASE_URL}/api/hw/register-device"
    payload = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "deviceId": DEVICE_ID,
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
            
        # 200: již zaregistrováno, 201: vytvořeno, 409: již zaregistrováno jinému uživateli
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

def send_clustered_location_data():
    """
    Odešle 3 velmi blízké GPS polohy a 1 vzdálenou pro otestování shlukování.
    """
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
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
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
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    })
    print(f"Připraven vzdálený bod: lat={far_lat}, lon={far_lon}")
    time.sleep(2)


    print(f"\n--- Odesílání {len(data_points)} poloh pro zařízení {DEVICE_ID}... ---")
    
    try:
        # API přijímá jak jeden objekt, tak pole objektů
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
    print("Spouštím testovací skript pro shlukování poloh...")
    # 1. Pokus o registraci zařízení
    if register_device():
        # 2. Pokud je registrace úspěšná, odešleme testovací data
        send_clustered_location_data()
    else:
        print("\nRegistrace selhala. Zkontrolujte přihlašovací údaje a stav serveru.")
