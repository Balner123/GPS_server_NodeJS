let map;
let selectedDevice = null;
let polyline = null;
let markers = [];
let lastTimestamp = null;
let completeDeviceHistory = [];
let isShowingAllHistory = false;
const HISTORY_ROW_LIMIT = 5;

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds

// --- Helper functions for time conversion (Client-side) ---

// Converts total seconds to an object {d, h, m, s}
function secondsToDhms(totalSeconds) {
    totalSeconds = Number(totalSeconds);
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return { d: 0, h: 0, m: 0, s: 0 };
    }
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return { d, h, m, s };
}

// Helper function to ensure two-digit format with leading zero
function pad(num) {
    return String(num).padStart(2, '0');
}

// Helper function to convert DHMS to seconds
function dhmsToSeconds(d, h, m, s) {
     return Number(d) * 24 * 3600 + Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// --- End of helper functions ---

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the device detail page by looking for a specific element
    if (document.getElementById('history-map')) {
        initializeApp();
    }
});

function initializeApp() {
    // Initialize map
    map = L.map('history-map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load device list
    loadDevices();

    // Check for device name in URL and pre-select it
    const urlParams = new URLSearchParams(window.location.search);
    const deviceIdFromUrl = urlParams.get('id'); // Změna z 'name' na 'id'
    if (deviceIdFromUrl) {
        selectDevice(decodeURIComponent(deviceIdFromUrl));
    }

    // Set up automatic update
    setInterval(() => {
        if (selectedDevice) {
           loadDeviceData(); // Periodically check for new data for the selected device
        }
    }, UPDATE_INTERVAL);

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const deviceIdFromUrl = urlParams.get('id'); // Změna z 'name' na 'id'
        if (deviceIdFromUrl && deviceIdFromUrl !== selectedDevice) {
            selectDevice(decodeURIComponent(deviceIdFromUrl));
        }
    });

    // Set up sleep interval form
    const form = document.getElementById('device-settings-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            handleSettingsUpdate(e);
        });
    }

    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            const batchSettings = document.getElementById('batch-settings');
            if (e.target.value === 'batch') {
                batchSettings.style.display = 'block';
            } else {
                batchSettings.style.display = 'none';
                document.getElementById('interval-send').value = 1;
            }
        });
    }

    document.getElementById('toggle-history-btn')?.addEventListener('click', () => {
        isShowingAllHistory = !isShowingAllHistory;
        renderPositionTable();
    });
}


async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`); 
        if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
        }
        const devices = await response.json();
        
        const devicesList = document.getElementById('devices-list');
        devicesList.innerHTML = ''; 
        
        if (devices.length === 0) {
            devicesList.innerHTML = '<p class="text-muted">No active devices found.</p>';
            return;
        }

        devices.forEach(device => {
            const deviceElement = createDeviceElement(device);
            devicesList.appendChild(deviceElement);
        });

    } catch (error) {
        const devicesList = document.getElementById('devices-list');
        if(devicesList) devicesList.innerHTML = '<p class="text-danger">Error loading device list.</p>';
    }
}


function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'list-group-item list-group-item-action device-item d-flex justify-content-between align-items-center'; 
    div.dataset.deviceId = device.device; // Používáme ID pro data atribut
    
    // Použijeme jméno zařízení, pokud existuje, jinak ID jako fallback.
    const displayName = device.name || device.device;
    
    const deviceInfo = document.createElement('div');
    deviceInfo.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1"><strong>${displayName}</strong></h6>
            <small class="text-muted">${formatTimestamp(device.timestamp)}</small>
        </div>
        <small class="text-muted">Last position: ${formatCoordinate(device.latitude)}, ${formatCoordinate(device.longitude)}</small>
    `;
    deviceInfo.style.flexGrow = '1';
    // Kliknutí na prvek vybere zařízení podle jeho unikátního ID
    deviceInfo.addEventListener('click', () => selectDevice(device.device));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-danger btn-sm ms-3';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    // Titulek tlačítka zobrazuje displayName pro lepší čitelnost
    deleteButton.title = `Delete device ${displayName}`;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // Mazání se vždy provádí přes unikátní ID
        handleDeleteDevice(device.device);
    });

    div.appendChild(deviceInfo);
    div.appendChild(deleteButton);
    
    return div;
}

// Select device
async function selectDevice(deviceId) { // Změna parametru z deviceName na deviceId
    if (selectedDevice === deviceId) return; // Do nothing if the same device is clicked again

    // Update the browser's URL without reloading the page
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?id=${encodeURIComponent(deviceId)}`; // Změna z 'name' na 'id'
    window.history.pushState({path: newUrl}, '', newUrl);

    selectedDevice = deviceId; // Ukládáme si ID
    isShowingAllHistory = false; // Reset view
    clearMapAndData(); // Clear everything for the new device
    
    // Update active state in the list
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.deviceId === deviceId) { // Porovnáváme s data-device-id
            item.classList.add('active');
        }
    });
    
    const settingsCard = document.getElementById('device-settings-card');
    if (settingsCard) {
        settingsCard.style.display = 'block';
    } else {
        return;
    }
    
    // Load current device settings
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/settings/${deviceId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const settings = await response.json();
        const dhms = secondsToDhms(settings.interval_gps || 0);
        document.getElementById('interval-gps-days').value = dhms.d;
        document.getElementById('interval-gps-hours').value = dhms.h;
        document.getElementById('interval-gps-minutes').value = dhms.m;
        document.getElementById('interval-gps-seconds').value = dhms.s;
        document.getElementById('interval-send').value = settings.interval_send || 1;

        const modeSelect = document.getElementById('mode-select');
        const batchSettings = document.getElementById('batch-settings');
        if (settings.interval_send > 1) {
            modeSelect.value = 'batch';
            batchSettings.style.display = 'block';
        } else {
            modeSelect.value = 'simple';
            batchSettings.style.display = 'none';
        }

    } catch (error) {
        displayAlert(`Error loading settings for ${deviceId}.`, 'danger');
    }
    
    // Initial data load for the selected device
    await loadDeviceData(true);
}

// Load device data (position history)
async function loadDeviceData(isInitialLoad = false) {
    if (!selectedDevice) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/data?id=${selectedDevice}`); // Změna z 'name' na 'id'
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const allData = await response.json();
        let dataToRender;

        if (isInitialLoad) {
            dataToRender = allData;
            if (allData.length > 0) {
                lastTimestamp = allData.reduce((max, p) => p.timestamp > max ? p.timestamp : max, allData[0].timestamp);
            }
        } else {
            dataToRender = allData.filter(p => !lastTimestamp || (new Date(p.timestamp) > new Date(lastTimestamp)));
            if (dataToRender.length > 0) {
                lastTimestamp = dataToRender.reduce((max, p) => p.timestamp > max ? p.timestamp : max, dataToRender[0].timestamp);
            }
        }

        if (dataToRender.length > 0) {
            updateMap(dataToRender, isInitialLoad);
        }
        
        completeDeviceHistory = allData;
        renderPositionTable();

    } catch (error) {
        document.getElementById('positions-table').innerHTML = '<tr><td colspan="7" class="text-danger">Error loading position history.</td></tr>';
    }
}

function clearMapAndData() {
    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    lastTimestamp = null;
    completeDeviceHistory = [];
    document.getElementById('positions-table').innerHTML = '';
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (toggleBtn) {
        toggleBtn.style.display = 'none';
    }
}

// Update map
function updateMap(data, isFullUpdate) {
    if (!data || data.length === 0) {
         return;
    }

    const coordinates = data.map(point => [
        Number(point.latitude),
        Number(point.longitude)
    ]).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));

    if (coordinates.length === 0) {
        return;
    }

    if (isFullUpdate && coordinates.length > 0) {
        polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);
        map.fitBounds(polyline.getBounds().pad(0.1));
    } else if (polyline) {
        coordinates.forEach(coord => polyline.addLatLng(coord));
    }

    data.forEach((point) => {
         if (isNaN(Number(point.latitude)) || isNaN(Number(point.longitude))) return;

        const marker = L.marker([
            Number(point.latitude),
            Number(point.longitude)
        ])
            .bindPopup(createDevicePopup(point))
            .addTo(map);
        markers.push(marker);
    });

    map.fitBounds(coordinates, { padding: [50, 50] });
}

function renderPositionTable() {
    const dataToRender = isShowingAllHistory 
        ? completeDeviceHistory 
        : completeDeviceHistory.slice(0, HISTORY_ROW_LIMIT);

    updateTable(dataToRender);
    updateToggleButton();
}

function updateToggleButton() {
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (!toggleBtn) return;

    if (completeDeviceHistory.length > HISTORY_ROW_LIMIT) {
        toggleBtn.style.display = 'block';
        toggleBtn.textContent = isShowingAllHistory 
            ? 'Zobrazit méně' 
            : `Zobrazit vše (${completeDeviceHistory.length})`;
    } else {
        toggleBtn.style.display = 'none';
    }
}

// Update table
function updateTable(data) {
    const tbody = document.getElementById('positions-table');
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No position history available for this device.</td></tr>';
        return;
    }

    const sortedData = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedData.forEach(point => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatTimestamp(point.timestamp)}</td>
            <td>${formatCoordinate(point.latitude)}</td>
            <td>${formatCoordinate(point.longitude)}</td>
            <td>${formatSpeed(point.speed)}</td>
            <td>${formatAltitude(point.altitude)}</td>
            <td>${formatAccuracy(point.accuracy)}</td>
            <td>${point.satellites !== null ? point.satellites : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
}

function createDevicePopup(point) {
    return `
        <strong>Time:</strong> ${formatTimestamp(point.timestamp)}<br>
        <strong>Speed:</strong> ${formatSpeed(point.speed)}<br>
        <strong>Altitude:</strong> ${formatAltitude(point.altitude)}
    `;
}

function formatCoordinate(coord) {
    return coord !== null ? Number(coord).toFixed(6) : 'N/A';
}

function formatSpeed(speed) {
    return speed !== null ? `${Number(speed).toFixed(2)} km/h` : 'N/A';
}

function formatAltitude(altitude) {
    return altitude !== null ? `${Number(altitude).toFixed(2)} m` : 'N/A';
}

function formatAccuracy(accuracy) {
    return accuracy !== null ? `${Number(accuracy).toFixed(2)} m` : 'N/A';
}

async function handleSettingsUpdate(e) {
    e.preventDefault();
    if (!selectedDevice) {
        displayAlert('Please select a device first.', 'warning');
        return;
    }

    const days = document.getElementById('interval-gps-days').value || 0;
    const hours = document.getElementById('interval-gps-hours').value || 0;
    const minutes = document.getElementById('interval-gps-minutes').value || 0;
    const seconds = document.getElementById('interval-gps-seconds').value || 0;
    const intervalGps = dhmsToSeconds(days, hours, minutes, seconds);
    
    const mode = document.getElementById('mode-select').value;
    let intervalSend = 1;
    if (mode === 'batch') {
        intervalSend = document.getElementById('interval-send').value || 1;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                deviceId: selectedDevice, 
                interval_gps: intervalGps,
                interval_send: parseInt(intervalSend, 10)
            })
        });

        const result = await response.json();

        if (!response.ok) {
             throw new Error(result.message || result.error || 'An error occurred while updating settings.');
        }

        if (result.success) {
            displayAlert(result.message || 'Settings updated successfully!', 'success');
        } else {
            throw new Error(result.message || 'Update failed.');
        }

    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

function displayAlert(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.error('Toast container not found!');
        return;
    }

    const toastId = `toast-${Date.now()}`;
    // Map Bootstrap alert types to background color classes
    const bgClass = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-secondary';

    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        delay: 5000 // Auto-hide after 5 seconds
    });
    
    toast.show();

    // Remove the toast from DOM after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

async function handleDeleteDevice(deviceId) { // Změna z deviceName na deviceId
    const deviceElement = document.querySelector(`.device-item[data-device-id='${deviceId}']`);
    const displayName = deviceElement ? (deviceElement.querySelector('strong').textContent) : deviceId;

    if (!confirm(`Are you sure you want to permanently delete device '${displayName}' and all its associated data? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/delete/${deviceId}`, { // Používáme deviceId
            method: 'POST',
        });

            if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to delete device.');
        }

        const result = await response.json();
            displayAlert(result.message, 'success');
                
        // If the deleted device was the selected one, clear the details view
        if (selectedDevice === deviceId) { // Porovnáváme ID
                selectedDevice = null;
                clearMapAndData();
            document.getElementById('device-settings-card').style.display = 'none';
            const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
        }

        // Remove the device from the list
        if (deviceElement) {
            deviceElement.remove();
        }

        // Check if the list is now empty
        const devicesList = document.getElementById('devices-list');
        if (devicesList && devicesList.children.length === 0) {
            devicesList.innerHTML = '<p class="text-muted">No active devices found.</p>';
        }

    } catch (error) {
        console.error('Error deleting device:', error);
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return 'N/A';
    }
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}