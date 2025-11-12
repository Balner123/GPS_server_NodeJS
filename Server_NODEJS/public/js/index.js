// Map initialization
let map;
let markers = {};
let permanentTooltips = false;
const DEVICE_LIST_LIMIT = 7;

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

    const infoToggle = document.getElementById('info-toggle-switch');
    if (infoToggle) {
        permanentTooltips = infoToggle.checked;
        infoToggle.addEventListener('change', (e) => {
            permanentTooltips = e.target.checked;
            // Re-bind tooltips on all existing markers with the new setting
            Object.values(markers).forEach(marker => {
                const content = marker.getTooltip().getContent();
                marker.unbindTooltip();
                marker.bindTooltip(content, { permanent: permanentTooltips, direction: 'auto' });
            });
        });
    }

    loadCurrentCoordinates(true); 
    setInterval(() => loadCurrentCoordinates(false), UPDATE_INTERVAL);
});

// Load devices and populate sidebar
async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
        const devices = await response.json();
        renderDeviceList(devices);
    } catch (error) {
        console.error('Error loading devices (loadDevices):', error);
    }
}

// Create device element
function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'device-item';
    const displayName = device.name || device.device;
    const powerMeta = getPowerStatusMeta(device.power_status, device.power_instruction);
    const statusIndicatorHtml = `
        <span class="status-chip-inline" title="Power status: ${powerMeta.label}">
            <span class="status-dot ${powerMeta.dotClass}"></span>
        </span>
    `;
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="d-flex flex-column">
                <div class="d-flex align-items-center gap-2">
                    ${statusIndicatorHtml}
                    <strong>${displayName}</strong>
                </div>
            </div>
            <div class="timestamp text-end">Last update: ${formatTimestamp(device.timestamp)}</div>
        </div>
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
        
        renderDeviceList(devices);

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
        marker.bindTooltip(popupContent, { permanent: permanentTooltips, direction: 'auto' });
        markers[device.device] = marker;
    }
}

// Create popup content
function createIndexPopup(device) {
    const displayName = device.name || device.device;
    const powerMeta = getPowerStatusMeta(device.power_status, device.power_instruction);
    return `
        <strong>${displayName}</strong><br>
        <small class="timestamp">${formatTimestamp(device.timestamp)}</small><br>
        <small class="text-muted">Power: ${powerMeta.label}</small>
    `;
} 

function renderDeviceList(devices) {
    const devicesList = document.getElementById('devices-list');
    if (!devicesList) {
        console.error('Element #devices-list not found.');
        return;
    }

    devicesList.innerHTML = '';

    if (!Array.isArray(devices) || devices.length === 0) {
        devicesList.innerHTML = '<p class="text-muted p-2">No active devices found.</p>';
        updateHomeDeviceLink(0);
        return;
    }

    const limitedDevices = devices.slice(0, DEVICE_LIST_LIMIT);
    limitedDevices.forEach(device => {
        const deviceElement = createDeviceElement(device);
        devicesList.appendChild(deviceElement);
    });

    if (devices.length > DEVICE_LIST_LIMIT) {
        devicesList.insertAdjacentHTML('beforeend', `<p class="text-muted small mt-2">Showing first ${DEVICE_LIST_LIMIT} devices.</p>`);
    }

    updateHomeDeviceLink(devices.length);
}

function updateHomeDeviceLink(totalDevices) {
    const link = document.getElementById('home-device-list-link');
    if (!link) return;

    if (!totalDevices) {
        link.style.display = 'none';
        return;
    }

    if (totalDevices > DEVICE_LIST_LIMIT) {
        link.style.display = 'inline-block';
        link.textContent = `Show All Devices (${totalDevices})`;
    link.href = '/devices';
    } else {
        link.style.display = 'inline-block';
        link.textContent = 'Manage Devices';
        link.href = '/devices';
    }
}