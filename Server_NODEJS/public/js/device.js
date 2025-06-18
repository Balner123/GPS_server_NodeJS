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
    // Initialize map
    map = L.map('history-map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load device list
    loadDevices();

    // Check for device name in URL and pre-select it
    const urlParams = new URLSearchParams(window.location.search);
    const deviceNameFromUrl = urlParams.get('name');
    if (deviceNameFromUrl) {
        selectDevice(decodeURIComponent(deviceNameFromUrl));
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
        const deviceNameFromUrl = urlParams.get('name');
        if (deviceNameFromUrl && deviceNameFromUrl !== selectedDevice) {
            selectDevice(decodeURIComponent(deviceNameFromUrl));
        }
    });

    // Set up sleep interval form
    const form = document.getElementById('device-settings-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            handleSleepIntervalUpdate(e);
        });
    }

    document.getElementById('toggle-history-btn')?.addEventListener('click', () => {
        isShowingAllHistory = !isShowingAllHistory;
        renderPositionTable();
    });
});


async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_coordinates`); 
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
    div.dataset.deviceName = device.device;
    
    const deviceInfo = document.createElement('div');
    deviceInfo.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1"><strong>${device.device}</strong></h6>
            <small class="text-muted">${formatTimestamp(device.timestamp)}</small>
        </div>
        <small class="text-muted">Last position: ${formatCoordinate(device.latitude)}, ${formatCoordinate(device.longitude)}</small>
    `;
    deviceInfo.style.flexGrow = '1';
    deviceInfo.addEventListener('click', () => selectDevice(device.device));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-danger btn-sm ms-3';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.title = `Delete device ${device.device}`;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteDevice(device.device);
    });

    div.appendChild(deviceInfo);
    div.appendChild(deleteButton);
    
    return div;
}

// Select device
async function selectDevice(deviceName) {
    if (selectedDevice === deviceName) return; // Do nothing if the same device is clicked again

    // Update the browser's URL without reloading the page
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?name=${encodeURIComponent(deviceName)}`;
    window.history.pushState({path: newUrl}, '', newUrl);

    selectedDevice = deviceName;
    isShowingAllHistory = false; // Reset view
    clearMapAndData(); // Clear everything for the new device
    
    // Update active state in the list
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.deviceName === deviceName) { 
            item.classList.add('active');
        }
    });
    
    const settingsCard = document.getElementById('device-settings-card');
    if (settingsCard) {
        settingsCard.style.display = 'block';
    } else {
        return;
    }
    
    // Load current sleep interval settings
    try {
        const response = await fetch(`${API_BASE_URL}/device_settings/${deviceName}`);
        if (!response.ok) {
            if (response.status === 404) {
                 document.getElementById('interval-days').value = 0;
                 document.getElementById('interval-hours').value = 0;
                 document.getElementById('interval-minutes').value = 0;
                 document.getElementById('interval-seconds').value = 0;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } else {
            const settings = await response.json();
            const dhms = secondsToDhms(settings.sleep_interval === null || settings.sleep_interval === undefined ? 0 : settings.sleep_interval);
            document.getElementById('interval-days').value = dhms.d;
            document.getElementById('interval-hours').value = dhms.h;
            document.getElementById('interval-minutes').value = dhms.m;
            document.getElementById('interval-seconds').value = dhms.s;
        }
    } catch (error) {
        document.getElementById('interval-days').value = 0;
        document.getElementById('interval-hours').value = 0;
        document.getElementById('interval-minutes').value = 0;
        document.getElementById('interval-seconds').value = 0;
        displayAlert(`Error loading settings for ${deviceName}.`, 'danger');
    }
    
    // Initial data load for the selected device
    await loadDeviceData(true);
}

// Load device data (position history)
async function loadDeviceData(isInitialLoad = false) {
    if (!selectedDevice) return;

    try {
        const response = await fetch(`${API_BASE_URL}/device_data?name=${selectedDevice}`);
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

async function handleSleepIntervalUpdate(e) {
    e.preventDefault();
    if (!selectedDevice) {
        displayAlert('Nejprve vyberte zařízení.', 'warning');
        return;
    }

    const days = document.getElementById('interval-days').value || 0;
    const hours = document.getElementById('interval-hours').value || 0;
    const minutes = document.getElementById('interval-minutes').value || 0;
    const seconds = document.getElementById('interval-seconds').value || 0;
    const totalSeconds = dhmsToSeconds(days, hours, minutes, seconds);

    try {
        const response = await fetch(`${API_BASE_URL}/device_settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ device: selectedDevice, sleep_interval: totalSeconds })
        });

        const result = await response.json();

        if (!response.ok) {
            // Použijeme zprávu ze serveru, pokud je k dispozici, jinak obecnou chybu
             throw new Error(result.message || result.error || 'Došlo k chybě při aktualizaci.');
        }

        if (result.success) {
            displayAlert(result.message || 'Interval spánku byl úspěšně aktualizován!', 'success');
        } else {
            // Tento blok by se neměl vykonat, pokud je !response.ok správně ošetřeno výše
            throw new Error(result.message || 'Aktualizace se nezdařila.');
        }

    } catch (error) {
        displayAlert(`Chyba: ${error.message}`, 'danger');
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

async function handleDeleteDevice(deviceName) {
    if (!confirm(`Are you sure you want to delete device "${deviceName}"? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/delete_device/${deviceName}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete device');
        }

        displayAlert(`Device "${deviceName}" has been deleted.`, 'success');
        await loadDevices();

        if (selectedDevice === deviceName) {
            selectedDevice = null;
            clearMapAndData();
            document.getElementById('device-settings-card').style.display = 'none';
        }

    } catch (error) {
        displayAlert(`An error occurred: ${error.message}`, 'danger');
    }
}