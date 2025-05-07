import requests
import json
import time
from datetime import datetime

# Configuration
#BASE_URL = "http://129.151.193.104:5000/"
BASE_URL = "http://localhost:5000"
EXISTING_TEST_DEVICE = "500" # Renamed for clarity
NEW_TEST_DEVICE = "ADAM"     # New test device

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
    print(f"\n-> Sending GPS data to {endpoint} for device: {device_id}")
    print(f"   Data: {json.dumps(data)}")

    try:
        response = requests.post(endpoint, headers=headers, data=json.dumps(data))
        print(f"<- Status code: {response.status_code}")
        try:
            response_json = response.json()
            print(f"<- Server response: {response_json}")
            return response_json # Return JSON for further use
        except requests.exceptions.JSONDecodeError:
            print(f"<- Server response (raw): {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"!! Error sending GPS data: {e}")
        return None

def update_device_sleep_interval(device_id, sleep_interval):
    """Updates the sleep interval for a device via /device_settings endpoint."""
    endpoint = BASE_URL + "/device_settings"
    data = {
        "device": device_id,
        "sleep_interval": sleep_interval
    }
    headers = {"Content-Type": "application/json"}
    print(f"\n-> Updating sleep_interval at {endpoint} for device: {device_id} to {sleep_interval}s")
    print(f"   Data: {json.dumps(data)}")

    try:
        response = requests.post(endpoint, headers=headers, data=json.dumps(data))
        print(f"<- Status code: {response.status_code}")
        try:
            response_json = response.json()
            print(f"<- Server response: {response_json}")
            return response_json
        except requests.exceptions.JSONDecodeError:
            print(f"<- Server response (raw): {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"!! Error updating sleep_interval: {e}")
        return None

if __name__ == "__main__":
    print("=== Starting server tests ===")

    # --- Test 1: Send data for existing device ---
    print("\n--- Test 1: Sending data for existing device ({}) ---".format(EXISTING_TEST_DEVICE))
    send_gps_data(
        device_id=EXISTING_TEST_DEVICE,
        longitude=14.42076,
        latitude=50.08804,
        speed=60.5,
        altitude=200.0
    )

    # --- Test 2: Send data for new device (expecting default sleep_interval) ---
    print("\n--- Test 2: Sending data for NEW device ({}) ---".format(NEW_TEST_DEVICE))
    send_gps_data(
        device_id=NEW_TEST_DEVICE,
        longitude=15.00000,
        latitude=50.10000,
        satellites=5
    )

    # --- Test 3: Update sleep_interval for existing device ---
    new_interval_existing = 120
    print("\n--- Test 3: Updating sleep_interval for device {} to {}s ---".format(EXISTING_TEST_DEVICE, new_interval_existing))
    update_device_sleep_interval(EXISTING_TEST_DEVICE, new_interval_existing)

    # --- Test 4: Verify updated sleep_interval for existing device ---
    print("\n--- Test 4: Verifying updated sleep_interval for device {} ---".format(EXISTING_TEST_DEVICE))
    response_existing = send_gps_data(
        device_id=EXISTING_TEST_DEVICE,
        longitude=14.42176, # Slightly different position
        latitude=50.08904,
        speed=65.0
    )
    if response_existing and response_existing.get("sleep_interval") == new_interval_existing:
        print(f"   Verification SUCCESSFUL: sleep_interval for {EXISTING_TEST_DEVICE} is {response_existing.get('sleep_interval')}s.")
    elif response_existing:
        print(f"   Verification FAILED: sleep_interval for {EXISTING_TEST_DEVICE} is {response_existing.get('sleep_interval')}s, expected {new_interval_existing}s.")
    else:
        print(f"   Verification FAILED: Cannot get response for {EXISTING_TEST_DEVICE}.")

    # --- Test 5: Update sleep_interval for new device ---
    new_interval_new_device = 45
    print("\n--- Test 5: Updating sleep_interval for device {} to {}s ---".format(NEW_TEST_DEVICE, new_interval_new_device))
    update_device_sleep_interval(NEW_TEST_DEVICE, new_interval_new_device)
    
    # --- Test 6: Verify updated sleep_interval for new device ---
    print("\n--- Test 6: Verifying updated sleep_interval for device {} ---".format(NEW_TEST_DEVICE))
    response_new = send_gps_data(
        device_id=NEW_TEST_DEVICE,
        longitude=15.00100, # Slightly different position
        latitude=50.10100,
        accuracy=5.0
    )
    if response_new and response_new.get("sleep_interval") == new_interval_new_device:
        print(f"   Verification SUCCESSFUL: sleep_interval for {NEW_TEST_DEVICE} is {response_new.get('sleep_interval')}s.")
    elif response_new:
        print(f"   Verification FAILED: sleep_interval for {NEW_TEST_DEVICE} is {response_new.get('sleep_interval')}s, expected {new_interval_new_device}s.")
    else:
        print(f"   Verification FAILED: Cannot get response for {NEW_TEST_DEVICE}.")

    print("\n=== Testing finished ===")
