import requests
import json
import time

# --- Configuration ---
BASE_URL = "http://localhost:5000"
# This must match the ID of a device that is already registered in the system
# and has a geofence defined somewhere else (e.g., around Prague).
DEVICE_ID = "0123456789" 

# --- Headers ---
headers = {
    "Content-Type": "application/json"
}

def send_single_location():
    """
    Sends a single, hardcoded GPS location to the server.
    This location is in Sydney, Australia, intended to be outside any
    geofence defined in Europe to trigger an alert.
    """
    url = f"{BASE_URL}/api/devices/input"
    
    # Coordinates for Sydney, Australia
    payload = {
        "device": DEVICE_ID,
        "latitude": -33.8688,
        "longitude": 151.2093,
        "speed": 120,
        "altitude": 25,
        "accuracy": 5.0,
        "satellites": 9,
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }

    print(f"--- Sending a single location from Australia for device {DEVICE_ID}... ---")
    print(f"Coordinates: Lat={payload['latitude']}, Lng={payload['longitude']}")
    
    try:
        # The API can accept a single object, which is what we send here.
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("Response Body (not JSON):")
            print(response.text)

    except requests.exceptions.RequestException as e:
        print(f"An error occurred while sending data: {e}")


if __name__ == "__main__":
    send_single_location()
