import requests
import json
import random
import time

# --- Configuration ---
BASE_URL = "http://localhost:5000"
# Change these credentials to match a user on your server
TEST_USERNAME = "lotr"
TEST_PASSWORD = "Opava123*"
# This can be any unique string to identify the hardware
DEVICE_ID = "0123456789"

# --- Headers ---
headers = {
    "Content-Type": "application/json"
}

def register_device():
    """
    Attempts to register the device with the server using a username and password.
    """
    url = f"{BASE_URL}/api/hw/register-device"
    payload = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "deviceId": DEVICE_ID,
        "name": "Python Test Device"
    }
    
    print(f"--- Attempting to register device {DEVICE_ID} to user {TEST_USERNAME}... ---")
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("Response Body (not JSON):")
            print(response.text)
            
        return response.status_code in [200, 201, 409] # 200: already registered, 201: created, 409: already registered to another user
        
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during registration: {e}")
        return False

def send_location_data():
    """
    Sends a batch of simulated GPS location data to the server.
    """
    url = f"{BASE_URL}/api/devices/input"
    
    # Simulate a batch of 3 data points
    data_points = []
    for i in range(3):
        data_points.append({
            "device": DEVICE_ID,
            "latitude": round(50.08804 + (random.uniform(-0.01, 0.01)), 6),
            "longitude": round(14.42076 + (random.uniform(-0.01, 0.01)), 6),
            "speed": round(random.uniform(0, 60), 2),
            "altitude": round(random.uniform(150, 250), 2),
            "accuracy": round(random.uniform(1, 5), 2),
            "satellites": random.randint(4, 12),
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        })
        time.sleep(1) # Wait a second between points

    print(f"\n--- Sending {len(data_points)} location data points for device {DEVICE_ID}... ---")
    
    try:
        # The API can accept a single object or an array of objects
        response = requests.post(url, headers=headers, data=json.dumps(data_points))
        
        print(f"Status Code: {response.status_code}")
        try:
            print("Response JSON:")
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
            # The server should respond with the device's sleep intervals
            if "interval_gps" in response_json:
                print(f"\nReceived intervals from server: GPS={response_json.get('interval_gps')}s, Send={response_json.get('interval_send')} cycles")
        except json.JSONDecodeError:
            print("Response Body (not JSON):")
            print(response.text)

    except requests.exceptions.RequestException as e:
        print(f"An error occurred while sending data: {e}")


if __name__ == "__main__":
    # 1. Try to register the device
    # If registration is successful (or device is already registered), proceed to send data
    if register_device():
        # 2. Send a batch of location data
        send_location_data()
    else:
        print("\nRegistration failed. Please check the username/password and server status.")
