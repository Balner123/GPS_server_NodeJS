// Map initialization
let map;
let markers = {};

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize map WITHOUT a view. It will be set after loading devices.
    map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    loadCurrentCoordinates(true); 
    setInterval(() => loadCurrentCoordinates(false), UPDATE_INTERVAL);
});

// Load devices and populate sidebar
async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
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
    const displayName = device.name || device.device;
    div.innerHTML = `
        <span class="device-status active"></span>
        <strong>${displayName}</strong>
        <div class="timestamp">Last update: ${formatTimestamp(device.timestamp)}</div>
    `;
    
    div.addEventListener('click', () => {
        window.location.href = `/devices?id=${encodeURIComponent(device.device)}`;
    });
    
    return div;
}

// Load current coordinates and update device list
async function loadCurrentCoordinates(isInitialLoad = false) {
        showLoadingIndicator(); 
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const devices = await response.json();
        
        // --- Update device list (sidebar) ---
        const devicesList = document.getElementById('devices-list');
        if (devicesList) {
            devicesList.innerHTML = '';

            if (devices.length === 0) {
                devicesList.innerHTML = '<p class="text-muted p-2">No active devices found.</p>';
            } else {
                devices.forEach(device => {
                    const deviceElement = createDeviceElement(device);
                    devicesList.appendChild(deviceElement);
                });
            }
        } else {
            console.error('Element #devices-list not found.');
        }

        // Update markers on the map
        devices.forEach(device => {
            updateDeviceMarker(device);
        });

        // On initial load, adjust map to show all markers
        if (isInitialLoad) {
            const deviceMarkers = Object.values(markers);
            if (deviceMarkers.length > 0) {
                const featureGroup = L.featureGroup(deviceMarkers);
                map.fitBounds(featureGroup.getBounds().pad(0.1)); // pad(0.1) adds a small margin
            } else {
                // If there are no devices, set a default view
                map.setView([50.0755, 14.4378], 13);
            }
        }

    } catch (error) {
        console.error('Error loading coordinates and updating UI:', error);
    }
}

// Update device marker
function updateDeviceMarker(device) {
    const position = [device.latitude, device.longitude];
    const popupContent = createIndexPopup(device);

    if (markers[device.device]) {
        markers[device.device].setLatLng(position)
            .setTooltipContent(popupContent);
    } else {
        const marker = L.marker(position).addTo(map);
        marker.bindTooltip(popupContent, { permanent: true, direction: 'auto' });
        markers[device.device] = marker;
    }
}

// Create popup content
function createIndexPopup(device) {
    const displayName = device.name || device.device;
    return `
        <strong>${displayName}</strong><br>
        <small class="timestamp">${formatTimestamp(device.timestamp)}</small>
    `;
} 