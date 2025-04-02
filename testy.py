import requests
import json
import time
from datetime import datetime

# Konfigurace
BASE_URL = "http://localhost:5000"
TEST_DEVICE = "200"

def test_device_registration():
    """Test registrace nového zařízení"""
    print("\n=== Test registrace zařízení ===")
    
    # Odeslání GPS dat (automaticky zaregistruje zařízení)
    data = {
        "device": TEST_DEVICE,
        "longitude": 14.4378,
        "latitude": 50.0755,
        "speed": 0.0,
        "altitude": 235.0,
        "accuracy": 1.5,
        "satellites": 8
    }
    
    response = requests.post(f"{BASE_URL}/device_input", json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Ověření, že zařízení bylo zaregistrováno
    response = requests.get(f"{BASE_URL}/device_settings/{TEST_DEVICE}")
    print(f"Device settings status: {response.status_code}")
    print(f"Device settings: {response.json()}")

def test_sleep_interval_update():
    """Test aktualizace odmlky zařízení"""
    print("\n=== Test aktualizace odmlky ===")
    
    # Aktualizace odmlky na 5 minut
    data = {
        "device": TEST_DEVICE,
        "sleep_interval": 300
    }
    
    response = requests.post(f"{BASE_URL}/device_settings", json=data)
    print(f"Update status: {response.status_code}")
    print(f"Update response: {response.json()}")
    
    # Ověření nového nastavení
    response = requests.get(f"{BASE_URL}/device_settings/{TEST_DEVICE}")
    print(f"New settings: {response.json()}")

def test_gps_data_submission():
    """Test odesílání GPS dat"""
    print("\n=== Test odesílání GPS dat ===")
    
    # Simulace pohybu zařízení
    coordinates = [
        {"longitude": 14.4378, "latitude": 50.0755, "speed": 0.0, "altitude": 235.0, "accuracy": 1.5, "satellites": 8},
        {"longitude": 14.4379, "latitude": 50.0756, "speed": 5.0, "altitude": 235.5, "accuracy": 1.2, "satellites": 9},
        {"longitude": 14.4380, "latitude": 50.0757, "speed": 10.0, "altitude": 236.0, "accuracy": 1.0, "satellites": 10}
    ]
    
    for i, coord in enumerate(coordinates):
        data = {
            "device": TEST_DEVICE,
            **coord
        }
        
        response = requests.post(f"{BASE_URL}/device_input", json=data)
        print(f"Submission {i+1} status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Ověření, že jsme dostali správnou odmlku
        if "sleep_interval" in response.json():
            print(f"Received sleep interval: {response.json()['sleep_interval']}")
        
        time.sleep(1)  # Pauza mezi odesíláním

def test_current_coordinates():
    """Test získání aktuálních souřadnic"""
    print("\n=== Test aktuálních souřadnic ===")
    
    response = requests.get(f"{BASE_URL}/current_coordinates")
    print(f"Status: {response.status_code}")
    print(f"Current coordinates: {response.json()}")

def test_device_history():
    """Test získání historie zařízení"""
    print("\n=== Test historie zařízení ===")
    
    response = requests.get(f"{BASE_URL}/device_data?name={TEST_DEVICE}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"History length: {len(data)}")
    if data:
        print(f"Latest position: {data[0]}")

def test_invalid_data():
    """Test validace vstupních dat"""
    print("\n=== Test validace vstupních dat ===")
    
    # Test neplatných souřadnic
    invalid_data = [
        {"device": TEST_DEVICE, "longitude": 181, "latitude": 50.0755},  # Neplatná délka
        {"device": TEST_DEVICE, "longitude": 14.4378, "latitude": 91},   # Neplatná šířka
        {"device": TEST_DEVICE, "longitude": "invalid", "latitude": 50.0755},  # Neplatný typ
        {"device": TEST_DEVICE, "longitude": 14.4378, "latitude": 50.0755, "speed": -1},  # Neplatná rychlost
        {"device": TEST_DEVICE, "longitude": 14.4378, "latitude": 50.0755, "altitude": 10001},  # Neplatná výška
        {"device": TEST_DEVICE, "longitude": 14.4378, "latitude": 50.0755, "accuracy": 101},  # Neplatná přesnost
        {"device": TEST_DEVICE, "longitude": 14.4378, "latitude": 50.0755, "satellites": 51}  # Neplatný počet satelitů
    ]
    
    for i, data in enumerate(invalid_data):
        response = requests.post(f"{BASE_URL}/device_input", json=data)
        print(f"Invalid data test {i+1} status: {response.status_code}")
        print(f"Response: {response.json()}")

def test_sleep_interval_validation():
    """Test validace intervalu odmlky"""
    print("\n=== Test validace intervalu odmlky ===")
    
    invalid_intervals = [
        {"device": TEST_DEVICE, "sleep_interval": 0},    # Příliš krátký interval
        {"device": TEST_DEVICE, "sleep_interval": 3601}, # Příliš dlouhý interval
        {"device": TEST_DEVICE, "sleep_interval": -1},   # Záporný interval
        {"device": TEST_DEVICE, "sleep_interval": "invalid"}  # Neplatný typ
    ]
    
    for i, data in enumerate(invalid_intervals):
        response = requests.post(f"{BASE_URL}/device_settings", json=data)
        print(f"Invalid interval test {i+1} status: {response.status_code}")
        print(f"Response: {response.json()}")

def run_all_tests():
    """Spuštění všech testů"""
    print("=== Spouštím testy GPS systému ===")
    print(f"Čas spuštění: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        test_device_registration()
        test_sleep_interval_update()
        test_gps_data_submission()
        test_current_coordinates()
        test_device_history()
        test_invalid_data()
        test_sleep_interval_validation()
        
        print("\n=== Všechny testy dokončeny ===")
        print(f"Čas dokončení: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except requests.exceptions.ConnectionError:
        print("Chyba: Nelze se připojit k serveru. Ujistěte se, že server běží.")
    except Exception as e:
        print(f"Chyba při spouštění testů: {str(e)}")

if __name__ == "__main__":
    run_all_tests()
