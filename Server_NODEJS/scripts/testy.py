import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

import requests

# --- Configuration ---
#BASE_URL = "https://lotr-system.xyz"
BASE_URL = "http://localhost:5000"

# Změňte tyto údaje, aby odpovídaly existujícímu uživateli na serveru
TEST_USERNAME = "lotr"
TEST_PASSWORD = "lotr"

# Unikátní ID pro naše testovací zařízení (10 znaků dle HW specifikace)
DEVICE_ID = "0123855789"

# Default power status reported by this test device
DEFAULT_POWER_STATUS = "ON"

# --- Headers ---
HEADERS = {"Content-Type": "application/json"}


@dataclass
class DeviceState:
    power_status: str = DEFAULT_POWER_STATUS
    uptime: int = 60

    def apply_instruction(self, instruction: Optional[str]) -> None:
        """Apply server instruction locally and update the simulated power status."""
        normalized = (instruction or "NONE").upper()
        if normalized == "TURN_OFF" and self.power_status != "OFF":
            print("Instrukce TURN_OFF přijatá – zařízení přechází do OFF režimu.")
            self.power_status = "OFF"


def json_request(method: str, url: str, payload: Dict) -> Optional[requests.Response]:
    try:
        response = requests.request(method, url, headers=HEADERS, data=json.dumps(payload))
        print(f"Status Code: {response.status_code}")
        try:
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("Tělo odpovědi (není JSON):")
            print(response.text)
        return response
    except requests.exceptions.RequestException as exc:
        print(f"HTTP chyba: {exc}")
        return None


def register_device() -> bool:
    """Register the device using the unified endpoint (spec #1)."""
    url = f"{BASE_URL}/api/devices/register"
    payload = {
        "client_type": "HW",
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "device_id": DEVICE_ID,
        "name": "HW Spec Test Device"
    }

    print(f"--- Registrace zařízení {DEVICE_ID} pro uživatele {TEST_USERNAME} ---")
    response = json_request("POST", url, payload)
    if response is None:
        return False

    if response.status_code in (200, 201, 409):
        # 200 already exists, 201 created, 409 owned by someone else (acceptable for test telemetry)
        print("Registrace úspěšná / zařízení již existuje.")
        return True

    print("Registrace selhala.")
    return False


def build_handshake_payload(state: DeviceState) -> Dict:
    """Compose handshake payload including required telemetry (spec #2 & #6)."""
    return {
        "client_type": "HW",
        "device_id": DEVICE_ID,
        "power_status": state.power_status,
    }


def perform_handshake(state: DeviceState) -> Optional[Dict]:
    url = f"{BASE_URL}/api/devices/handshake"
    payload = build_handshake_payload(state)

    print(f"\n--- Handshake ({datetime.utcnow().isoformat()}Z) ---")
    response = json_request("POST", url, payload)
    if response is None:
        return None

    if response.status_code != 200:
        print("Handshake nevrátil 200.")
        return None

    body = response.json()
    if not body.get("registered"):
        print("Zařízení není registrováno – handshake specifikace.")
        return None

    return body


def send_clustered_location_data(state: DeviceState, include_extra_data: bool = True) -> bool:
    """Send clustered GPS points with current power status (spec #3)."""
    url = f"{BASE_URL}/api/devices/input"

    base_lat = 50.08804
    base_lon = 14.42076
    timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    data_points = []
    for i in range(3):
        lat = base_lat + (i * 0.00001)
        lon = base_lon + (i * 0.00001)
        point = {
            "device": DEVICE_ID,
            "latitude": lat,
            "longitude": lon,
            "speed": 0,
            "altitude": 200,
            "accuracy": 1.0,
            "satellites": 10,
            "timestamp": timestamp,
            "power_status": state.power_status,
            "client_type": "HW"
        }
        data_points.append(point)
        print(f"Blízký bod {i+1}: lat={lat}, lon={lon}, power={state.power_status}")
        time.sleep(1)

    far_point = {
        "device": DEVICE_ID,
        "latitude": base_lat + 0.01,
        "longitude": base_lon + 0.01,
        "speed": 50,
        "altitude": 210,
        "accuracy": 5.0,
        "satellites": 12,
        "timestamp": timestamp,
        "power_status": state.power_status,
        "client_type": "HW"
    }

    data_points.append(far_point)
    print(f"Vzdálený bod: lat={far_point['latitude']}, lon={far_point['longitude']}, power={state.power_status}")

    print(f"\n--- Odesílání {len(data_points)} poloh ---")
    response = json_request("POST", url, data_points)
    if response is None:
        return False

    return response.status_code == 200


def main() -> int:
    print("Spouštím testovací skript podle HW_comm_requirements...")

    if not register_device():
        print("Registrace selhala. Zkontrolujte přihlašovací údaje a stav serveru.")
        return 1

    state = DeviceState()

    # Handshake #1 – zjistíme aktuální instrukci
    handshake = perform_handshake(state)
    if not handshake:
        print("Handshake se nezdařil, končím.")
        return 1

    instruction = handshake.get("power_instruction", "NONE") or "NONE"
    print(f"Instrukce ze serveru: {instruction}")
    state.apply_instruction(instruction)

    # Po aplikaci instrukce odešleme aktuální data
    if not send_clustered_location_data(state):
        print("Odeslání dat se nezdařilo.")
        return 1


    follow_up = perform_handshake(state)
    if follow_up:
        print(f"Instrukce po potvrzení stavu: {follow_up.get('power_instruction', 'NONE')}")

    print("Hotovo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
