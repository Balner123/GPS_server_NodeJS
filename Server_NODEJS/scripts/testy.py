import requests
import json
import uuid

# --- Konfigurace ---
# Upravte podle vaší lokální instance serveru
BASE_URL = "http://localhost:5000"

# --- Testovací údaje ---
# Zadejte platné přihlašovací údaje k existujícímu účtu na serveru
VALID_USERNAME = "lotr"
VALID_PASSWORD = "Opava123*"

# Unikátní ID zařízení, které budeme registrovat. UUID zajišťuje, že bude pokaždé jiné.
# Můžete nahradit i statickým ID pro opakované testování.
DEVICE_ID_TO_REGISTER = str(uuid.uuid4().hex)[:12].upper()
DEVICE_NAME = "Testovací Zařízení (Python)"

HEADERS = {
    'Content-Type': 'application/json'
}


def test_hw_registration(description, payload, expected_status_code):
    """Otestuje HW registrační endpoint s daným payloadem a očekávaným výsledkem."""
    endpoint = f"{BASE_URL}/api/hw/register-device"
    
    print(f"\n--- Test: {description} ---")
    print(f"-> Endpoint: {endpoint}")
    print(f"-> Payload: {json.dumps(payload)}")

    try:
        response = requests.post(endpoint, headers=HEADERS, data=json.dumps(payload))
        
        print(f"<- Stavový kód: {response.status_code}")
        try:
            print(f"<- Odpověď: {response.json()}")
        except json.JSONDecodeError:
            print(f"<- Odpověď (raw): {response.text}")

        if response.status_code == expected_status_code:
            print(f"[OK] Očekávaný stavový kód ({expected_status_code}) byl přijat.")
            return True
        else:
            print(f"[FAIL] Neočekávaný stavový kód. Očekáváno: {expected_status_code}, Přijato: {response.status_code}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"!! CHYBA PŘIPOJENÍ: {e}")
        return False


if __name__ == "__main__":
    print("=======================================================")
    print("  Spouštím testy pro nový HW registrační proces  ")
    print("=======================================================")

    results = []

    # Test 1: Úspěšná registrace nového zařízení
    payload_success = {
        "username": VALID_USERNAME,
        "password": VALID_PASSWORD,
        "deviceId": DEVICE_ID_TO_REGISTER,
        "name": DEVICE_NAME
    }
    results.append(test_hw_registration("Úspěšná registrace nového zařízení", payload_success, 201))

    # Test 2: Pokus o opětovnou registraci stejného zařízení ke stejnému účtu
    results.append(test_hw_registration("Opětovná registrace (již existuje)", payload_success, 200))

    # Test 3: Pokus o registraci se špatným heslem
    payload_wrong_pass = {
        "username": VALID_USERNAME,
        "password": "spatneHeslo123",
        "deviceId": str(uuid.uuid4().hex)[:12].upper()
    }
    results.append(test_hw_registration("Registrace se špatným heslem", payload_wrong_pass, 401))

    # Test 4: Pokus o registraci s chybějícím deviceId
    payload_missing_id = {
        "username": VALID_USERNAME,
        "password": VALID_PASSWORD
        # chybí deviceId
    }
    results.append(test_hw_registration("Registrace s chybějícím deviceId", payload_missing_id, 400))

    print("\n=======================================================")
    print("                    Souhrn testů                   ")
    print("=======================================================")
    
    total_tests = len(results)
    passed_tests = sum(results)

    if passed_tests == total_tests:
        print(f"[OK] Všechny testy ({passed_tests}/{total_tests}) prošly úspěšně!")
    else:
        print(f"[FAIL] {total_tests - passed_tests} z {total_tests} testů selhalo.")

    print("=======================================================")