import requests
import json
import time
from datetime import datetime

# Konfigurace
#BASE_URL = "http://129.151.193.104:5000/"
BASE_URL = "http://localhost:5000"
TEST_DEVICE = "400"

def send_gps_data(device_id, longitude, latitude, speed=None, altitude=None, accuracy=None, satellites=None):
    """Sends GPS data to the server."""
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

    try:
        response = requests.post(endpoint, headers=headers, data=json.dumps(data))
        print(f"Odesláno na {endpoint}")
        print(f"Stavový kód: {response.status_code}")
        try:
            print(f"Odpověď serveru: {response.json()}")
        except requests.exceptions.JSONDecodeError:
            print(f"Odpověď serveru (raw): {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Chyba při odesílání dat: {e}")

if __name__ == "__main__":
    # Příklad odeslání testovacích dat
    send_gps_data(
        device_id=TEST_DEVICE, 
        longitude=14.42076,  # Example longitude (Prague)
        latitude=50.08804,   # Example latitude (Prague)
        speed=60.5,
        altitude=200.0,
        accuracy=10.0,
        satellites=8
    )
    # Můžete přidat další volání send_gps_data s různými daty nebo v cyklu
    # Například odeslání dat každých 10 sekund po dobu jedné minuty:
    # for i in range(6):
    #     send_gps_data(
    #         device_id=TEST_DEVICE,
    #         longitude=14.42076 + (i * 0.001), # Mírně měníme polohu
    #         latitude=50.08804 + (i * 0.001),
    #         speed=50 + i,
    #         altitude=200 + i
    #     )
    #     print(f"Čekání 10 sekund... ({i+1}/6)")
    #     time.sleep(10)
