import requests
import json
from datetime import datetime, timedelta

# --- Configuration ---
BASE_URL = "http://localhost:5000"  # Change this if your server runs elsewhere
TEST_DEVICE_ID = "TEST-HW-01"

# --- User credentials for registration ---
# IMPORTANT: This user must exist in the database before running the script.
USERNAME = "lotr"
PASSWORD = "lotr"


def register_device():
    """Attempts to register the test device using the new hardware registration endpoint."""
    print(f"--- 1. Attempting to register device: {TEST_DEVICE_ID} ---")
    url = f"{BASE_URL}/api/hw/register-device"
    payload = {
        "username": USERNAME,
        "password": PASSWORD,
        "deviceId": TEST_DEVICE_ID,
        "name": "Python Test Device"
    }
    headers = {'Content-Type': 'application/json'}

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        print(f"Status Code: {response.status_code}")
        print(f"Response JSON: {response.json()}")
        
        if response.status_code in [200, 201, 409]:
            print("Registration call was successful or device already exists.")
            return True
        else:
            print("Registration call failed.")
            return False

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return False


def send_gps_data():
    """Sends a batch of GPS data points to the server."""
    print(f"\n--- 2. Sending GPS data for device: {TEST_DEVICE_ID} ---")
    url = f"{BASE_URL}/api/devices/input"
    
    # Create a batch of 3 data points with timestamps going back in time
    now = datetime.utcnow()
    data_points = [
        {
            "device": TEST_DEVICE_ID,
            "latitude": 50.08804,
            "longitude": 14.42076,
            "speed": 50.5,
            "altitude": 200.1,
            "accuracy": 10.2,
            "satellites": 8,
            "timestamp": (now - timedelta(minutes=2)).isoformat() + "Z"
        },
        {
            "device": TEST_DEVICE_ID,
            "latitude": 50.08850,
            "longitude": 14.42150,
            "speed": 52.0,
            "altitude": 201.5,
            "accuracy": 9.8,
            "satellites": 9,
            "timestamp": (now - timedelta(minutes=1)).isoformat() + "Z"
        },
        {
            "device": TEST_DEVICE_ID,
            "latitude": 50.08900,
            "longitude": 14.42250,
            "speed": 48.0,
            "altitude": 202.0,
            "accuracy": 11.0,
            "satellites": 8,
            "timestamp": now.isoformat() + "Z"
        }
    ]

    headers = {'Content-Type': 'application/json'}

    try:
        response = requests.post(url, headers=headers, data=json.dumps(data_points))
        print(f"Status Code: {response.status_code}")
        print(f"Response JSON: {response.json()}")

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    # First, we need to register the device.
    # The server will associate TEST_DEVICE_ID with the user 'lotr'.
    if register_device():
        # If registration was successful (or device was already registered), send some data.
        send_gps_data()