# Change Log
- 2025-11-12: Adjusted `MainActivity` to avoid restarting `LocationService` when the power state is OFF and to use the Android 14 broadcast registration flags. Updated `LocationService` to register the location provider receiver with the required exported flag on newer Android versions.
- 2025-11-12: Updated `LocationService` to refresh the next update timestamp after each location fix so the countdown in `MainActivity` continues ticking.
- 2025-11-12: Ensured TURN_OFF instructions trigger a single transition to `PowerState.OFF`, shut down `LocationService`, and send an explicit acknowledgement handshake so the server can clear the instruction.
- 2025-11-12: Prevented configuration refreshes from restarting `LocationService` while a TURN_OFF instruction is active or the app is already powered down.
