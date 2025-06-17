// Map initialization
let map;
let markers = {};

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map
    map = L.map('map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load data (map and device list)
    loadCurrentCoordinates(); // This will now populate both map and device list

    // Set up automatic update (map and device list)
    setInterval(loadCurrentCoordinates, UPDATE_INTERVAL);
});

// Load device list (this function can remain for other potential uses,
// but for the main list update, we now rely on loadCurrentCoordinates)
async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_coordinates`);
        const devices = await response.json();
        
        const devicesList = document.getElementById('devices-list');
        devicesList.innerHTML = '';
        
        devices.forEach(device => {
            const deviceElement = createDeviceElement(device);
            devicesList.appendChild(deviceElement);
        });
    } catch (error) {
        console.error('Error loading devices (loadDevices):', error);
    }
}

// Create device element
function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'device-item';
    div.innerHTML = `
        <span class="device-status active"></span>
        <strong>${device.device}</strong>
        <div class="timestamp">Last update: ${formatTimestamp(device.timestamp)}</div>
    `;
    
    div.addEventListener('click', () => {
        window.location.href = `/device?name=${encodeURIComponent(device.device)}`;
    });
    
    return div;
}

// Load current coordinates and update device list
async function loadCurrentCoordinates() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_coordinates`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const devices = await response.json();
        
        // --- Update device list (sidebar) ---
        const devicesList = document.getElementById('devices-list');
        if (devicesList) {
            devicesList.innerHTML = ''; // Clear existing list

            if (devices.length === 0) {
                devicesList.innerHTML = '<p class="text-muted p-2">No active devices found.</p>';
            } else {
                devices.forEach(device => {
                    const deviceElement = createDeviceElement(device); // Use existing function
                    devicesList.appendChild(deviceElement);
                });
            }
        } else {
            console.error('Element #devices-list not found.');
        }
        // --- End of device list update ---

        // Update markers on the map (existing logic)
        devices.forEach(device => {
            updateDeviceMarker(device);
        });
    } catch (error) {
        console.error('Error loading coordinates and updating UI:', error);
    }
}

// Update device marker
function updateDeviceMarker(device) {
    const position = [device.latitude, device.longitude];
    
    if (markers[device.device]) {
        markers[device.device].setLatLng(position);
    } else {
        const marker = L.marker(position).addTo(map);
        marker.bindPopup(createIndexPopup(device));
        markers[device.device] = marker;
    }
}

// Create popup content
function createIndexPopup(device) {
    return `
        <strong>${device.device}</strong><br>
        <small class="timestamp">${formatTimestamp(device.timestamp)}</small>
    `;
} 