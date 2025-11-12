"""Simple integration script that reproduces the offline backlog scenario.

1. Perform an initial handshake for a hardware device.
2. Send four consecutive POST batches with four location points each.
3. Report per-batch success/failure to help debug server ingestion.

The script reuses the same credentials/device identifier as ``testy.py``.
Adjust BASE_URL or credentials if you run against a different instance.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

import requests

BASE_URL = "http://localhost:5000"
TEST_USERNAME = "lotr"
TEST_PASSWORD = "lotr"
DEVICE_ID = "0123855789"
DEFAULT_POWER_STATUS = "ON"
HEADERS = {"Content-Type": "application/json"}


@dataclass
class DeviceState:
    power_status: str = DEFAULT_POWER_STATUS

    def handshake_payload(self) -> Dict[str, str]:
        return {
            "client_type": "HW",
            "device_id": DEVICE_ID,
            "power_status": self.power_status,
        }


def json_request(method: str, url: str, payload: Dict | List) -> Optional[requests.Response]:
    try:
        response = requests.request(method, url, headers=HEADERS, data=json.dumps(payload), timeout=15)
    except requests.exceptions.RequestException as exc:
        print(f"HTTP chyba: {exc}")
        return None

    print(f"{method} {url} -> {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2))
    except json.JSONDecodeError:
        print(response.text)
    return response


def register_device() -> bool:
    payload = {
        "client_type": "HW",
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "device_id": DEVICE_ID,
        "name": "Batch Test Device",
    }
    response = json_request("POST", f"{BASE_URL}/api/devices/register", payload)
    if response is None:
        return False
    if response.status_code in (200, 201, 409):
        print("Registrace proběhla (nebo zařízení už existuje).")
        return True
    print("Registrace selhala.")
    return False


def perform_handshake(state: DeviceState) -> Optional[Dict]:
    response = json_request("POST", f"{BASE_URL}/api/devices/handshake", state.handshake_payload())
    if response is None or response.status_code != 200:
        print("Handshake se nezdařil.")
        return None
    body = response.json()
    if not body.get("registered"):
        print("Zařízení není registrováno.")
        return None
    return body


def build_batch(batch_index: int) -> Iterable[Dict]:
    base_lat = 49.993
    base_lon = 17.954
    timestamp = datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")

    for point_index in range(4):
        offset = (batch_index * 4 + point_index) * 0.00001
        yield {
            "device": DEVICE_ID,
            "name": "HW_BATCH_TEST",
            "latitude": base_lat + offset,
            "longitude": base_lon + offset,
            "speed": 0.5 + point_index,
            "altitude": 280 + point_index,
            "accuracy": 1.5,
            "satellites": 7,
            "timestamp": timestamp,
            "power_status": DEFAULT_POWER_STATUS,
            "client_type": "HW",
        }


def send_batch(batch_index: int) -> bool:
    payload = list(build_batch(batch_index))
    print(f"\n--- Odesílám batch #{batch_index + 1} ({len(payload)} bodů) ---")
    response = json_request("POST", f"{BASE_URL}/api/devices/input", payload)
    if response is None:
        return False
    if response.status_code != 200:
        print("Server vrátil chybu, batch nebyl přijat.")
        return False
    return True


def main() -> int:
    print("Spouštím scénář: handshake + 4 dávky po čtyřech bodech...")

    if not register_device():
        return 1

    state = DeviceState()
    handshake = perform_handshake(state)
    if handshake is None:
        return 1

    print("Startuji dávky...")
    all_ok = True
    for batch_idx in range(4):
        success = send_batch(batch_idx)
        all_ok = all_ok and success
        time.sleep(1)

    print("\nShrnutí:")
    if all_ok:
        print("Všechny dávky přijaty se stavem 200.")
    else:
        print("Některé dávky selhaly, zkontrolujte logy výše.")

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
