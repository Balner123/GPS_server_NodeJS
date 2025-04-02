import requests
import json
import time
from datetime import datetime

# Konfigurace
BASE_URL = "http://129.151.193.104:5000"
TEST_DEVICE = "450"  # Stejné ID jako v ESP32 kódu

def test_device_registration():
    """Test registrace nového zařízení a odeslání GPS dat"""
    print("\n=== Test registrace zařízení a odeslání GPS dat ===")
    
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

def test_gps_data_submission():
    """Test odesílání GPS dat"""
    print("\n=== Test odesílání GPS dat ===")
    
    # Simulace pohybu zařízení
    coordinates = [
        {"longitude": 14.4378, "latitude": 50.0755, "speed": 0.0, "altitude": 235.0, "accuracy": 1.5, "satellites": 8},
        {"longitude": 14.4379, "latitude": 50.0756, "speed": 5.0, "altitude": 235.5, "accuracy": 1.2, "satellites": 9}
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

def run_all_tests():
    """Spuštění všech testů"""
    print("=== Spouštím testy GPS systému ===")
    print(f"Čas spuštění: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        test_device_registration()
        test_gps_data_submission()
        test_current_coordinates()
        
        print("\n=== Všechny testy dokončeny ===")
        print(f"Čas dokončení: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except requests.exceptions.ConnectionError:
        print("Chyba: Nelze se připojit k serveru. Ujistěte se, že server běží.")
    except Exception as e:
        print(f"Chyba při spouštění testů: {str(e)}")

if __name__ == "__main__":
    run_all_tests()
