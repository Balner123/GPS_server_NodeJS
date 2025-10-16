let map;
let selectedDevice = null;
let polyline = null;
let markers = [];
let lastTimestamp = null;
let completeDeviceHistory = [];
let isShowingAllHistory = false;
const HISTORY_ROW_LIMIT = 5;
let expandedClusters = new Set(); // State for expanded cluster rows

let drawnItems, drawControl;

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('cs-CZ', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

function secondsToDhms(totalSeconds) {
    totalSeconds = Number(totalSeconds);
    if (isNaN(totalSeconds) || totalSeconds < 0) return { d: 0, h: 0, m: 0, s: 0 };
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return { d, h, m, s };
}

function pad(num) {
    return String(num).padStart(2, '0');
}

function dhmsToSeconds(d, h, m, s) {
    return Number(d) * 24 * 3600 + Number(h) * 3600 + Number(m) * 60 + Number(s);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('history-map')) {
        initializeApp();
    }
});

function initializeApp() {
    map = L.map('history-map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // --- Leaflet.draw Initialization ---
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
        position: 'topright',
        edit: {
            featureGroup: drawnItems,
            remove: false
        },
        draw: {
            polygon: { allowIntersection: false, showArea: true },
            circle: {},
            polyline: false,
            rectangle: false,
            marker: false,
            circlemarker: false
        }
    });

    map.on(L.Draw.Event.CREATED, (e) => {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
    });

    document.getElementById('toggle-draw-mode').addEventListener('click', function(e) {
        e.preventDefault();
        if (!selectedDevice) {
            displayAlert('Please select a device first.', 'warning');
            return;
        }
        // Toggle the draw control on the map
        if (document.querySelector('.leaflet-draw')) {
             map.removeControl(drawControl);
        } else {
             map.addControl(drawControl);
        }
    });

    document.getElementById('save-geofence-btn').addEventListener('click', function(e) {
        e.preventDefault();
        if (!selectedDevice) {
            displayAlert('Please select a device first.', 'warning');
            return;
        }
        const layers = drawnItems.getLayers();
        if (layers.length === 0) {
            displayAlert('No geofence drawn to save.', 'info');
            return;
        }
        
        const layer = layers[0];
        let geofenceData;

        if (layer instanceof L.Circle) {
            const latlng = layer.getLatLng();
            geofenceData = {
                type: 'circle',
                lat: latlng.lat,
                lng: latlng.lng,
                radius: layer.getRadius()
            };
        } else {
            geofenceData = layer.toGeoJSON();
        }

        sendGeofenceToBackend(geofenceData);
    });

    document.getElementById('delete-geofence-btn').addEventListener('click', function(e) {
        e.preventDefault();
        if (!selectedDevice) {
            displayAlert('Please select a device first.', 'warning');
            return;
        }
        drawnItems.clearLayers();
        sendGeofenceToBackend(null);
    });
    // --- End Leaflet.draw ---

    loadDevices();

    const urlParams = new URLSearchParams(window.location.search);
    const deviceIdFromUrl = urlParams.get('id');
    if (deviceIdFromUrl) {
        selectDevice(decodeURIComponent(deviceIdFromUrl));
    }

    setInterval(() => {
        if (selectedDevice) {
           loadDeviceData();
        }
    }, UPDATE_INTERVAL);

    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const deviceIdFromUrl = urlParams.get('id');
        if (deviceIdFromUrl && deviceIdFromUrl !== selectedDevice) {
            selectDevice(decodeURIComponent(deviceIdFromUrl));
        }
    });

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

    // Add a single, delegated event listener for expanding/collapsing cluster rows
    const tableBody = document.getElementById('positions-table');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const clusterRow = e.target.closest('.cluster-row');
            if (!clusterRow) return;

            const clusterId = clusterRow.dataset.clusterId;

            // Update the state
            if (expandedClusters.has(clusterId)) {
                expandedClusters.delete(clusterId);
            } else {
                expandedClusters.add(clusterId);
            }

            // Re-render the table to reflect the new state
            renderPositionTable();
        });
    }

    setInterval(checkForAlerts, 15000); // Check for new alerts every 15 seconds

    document.getElementById('export-gpx-btn')?.addEventListener('click', () => {
        if (selectedDevice) {
            window.open(`${API_BASE_URL}/api/devices/export/gpx/${selectedDevice}`, '_blank');
        }
    });
}

async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
    div.dataset.deviceId = device.device;

    const displayName = device.name || device.device;

    const deviceInfo = document.createElement('div');
    deviceInfo.style.flexGrow = '1';
    deviceInfo.style.cursor = 'pointer';
    deviceInfo.addEventListener('click', () => selectDevice(device.device));

    const alertIcon = device.has_unread_alerts ? '<i class="fas fa-exclamation-triangle text-danger ms-2"></i>' : '';

    deviceInfo.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1"><strong>${displayName}</strong>${alertIcon}</h6>
            <small class="text-muted">${formatTimestamp(device.timestamp)}</small>
        </div>
    `;

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'd-flex align-items-center';

    if (device.has_unread_alerts) {
        const clearAlertsButton = document.createElement('button');
        clearAlertsButton.className = 'btn btn-warning btn-sm ms-2';
        clearAlertsButton.innerHTML = '<i class="fas fa-bell-slash"></i>';
        clearAlertsButton.title = `Clear all alerts for ${displayName}`;
        clearAlertsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            handleClearDeviceAlerts(device.device);
        });
        buttonGroup.appendChild(clearAlertsButton);
    }

    const renameButton = document.createElement('button');
    renameButton.className = 'btn btn-primary btn-sm ms-2';
    renameButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    renameButton.title = `Rename device ${displayName}`;
    renameButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleRenameDevice(device.device, displayName);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-danger btn-sm ms-2';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.title = `Delete device ${displayName}`;
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteDevice(device.device);
    });

    buttonGroup.appendChild(renameButton);
    buttonGroup.appendChild(deleteButton);

    div.appendChild(deviceInfo);
    div.appendChild(buttonGroup);

    return div;
}

async function selectDevice(deviceId) {
    if (selectedDevice === deviceId) return;

    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?id=${encodeURIComponent(deviceId)}`;
    window.history.pushState({path: newUrl}, '', newUrl);

    selectedDevice = deviceId;
    isShowingAllHistory = false;
    clearMapAndData();
    
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.deviceId === deviceId) {
            item.classList.add('active');
        }
    });
    
    const settingsCard = document.getElementById('device-settings-card');
    const infoCard = document.getElementById('device-info-card');
    if (settingsCard && infoCard) {
        settingsCard.style.display = 'block';
        infoCard.style.display = 'block';
        document.getElementById('info-device-id').textContent = deviceId;
        const exportBtn = document.getElementById('export-gpx-btn');
        if (exportBtn) {
            exportBtn.style.display = 'block';
        }
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/settings/${deviceId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const settings = await response.json();
        
        if (infoCard) {
            document.getElementById('info-registration-date').textContent = formatTimestamp(settings.created_at);
        }
        
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

        if (settings.geofence) {
            // Handle custom circle format
            if (settings.geofence.type === 'circle') {
                const circle = L.circle([settings.geofence.lat, settings.geofence.lng], { 
                    radius: settings.geofence.radius,
                    color: '#ff7800',
                    weight: 2
                }).addTo(drawnItems);
                map.fitBounds(circle.getBounds());
            } 
            // Handle standard GeoJSON format for polygons
            else if (settings.geofence.type === 'Feature') {
                const geofenceLayer = L.geoJSON(settings.geofence, {
                    style: { color: '#ff7800', weight: 2 }
                }).addTo(drawnItems);
                map.fitBounds(geofenceLayer.getBounds());
            }
        }

    } catch (error) {
        displayAlert(`Error loading settings for ${deviceId}.`, 'danger');
    }
    
    await loadDeviceData(true);
}

async function loadDeviceData(isInitialLoad = false) {
    if (!selectedDevice) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/data?id=${selectedDevice}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const allData = await response.json();

        // Always update the complete history
        completeDeviceHistory = allData;

        // Always redraw the map with the full history.
        // The 'isInitialLoad' flag now only controls whether to fit the bounds.
        updateMap(completeDeviceHistory, isInitialLoad);
        
        // Update the table with the latest data
        renderPositionTable();

    } catch (error) {
        document.getElementById('positions-table').innerHTML = '<tr><td colspan="7" class="text-danger">Error loading position history.</td></tr>';
    }
}

function clearMapAndData() {
    if (polyline) map.removeLayer(polyline);
    polyline = null;
    drawnItems.clearLayers();
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    lastTimestamp = null;
    completeDeviceHistory = [];
    document.getElementById('positions-table').innerHTML = '';
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (toggleBtn) toggleBtn.style.display = 'none';
    const exportBtn = document.getElementById('export-gpx-btn');
    if (exportBtn) {
        exportBtn.style.display = 'none';
    }
}

function updateMap(data, fitBounds) {
    if (!data) return;

    // Always clear existing layers before drawing new ones
    if (polyline) map.removeLayer(polyline);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const coordinates = data.map(p => [Number(p.latitude), Number(p.longitude)]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
    
    if (coordinates.length > 0) {
        polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);

        data.forEach((point) => {
            if (isNaN(Number(point.latitude)) || isNaN(Number(point.longitude))) return;
            const marker = L.marker([Number(point.latitude), Number(point.longitude)])
                .bindTooltip(createDevicePopup(point), { permanent: true, direction: 'auto' })
                .addTo(map);
            markers.push(marker);
        });

        // Only fit bounds on the initial load to prevent the map from moving on updates
        if (fitBounds) {
            map.fitBounds(polyline.getBounds().pad(0.1));
        }
    }
}

function renderPositionTable() {
    const dataToRender = isShowingAllHistory ? completeDeviceHistory : completeDeviceHistory.slice(0, HISTORY_ROW_LIMIT);
    updateTable(dataToRender);
    updateToggleButton();
}

function updateToggleButton() {
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (!toggleBtn) return;

    if (completeDeviceHistory.length > HISTORY_ROW_LIMIT) {
        toggleBtn.style.display = 'block';
        toggleBtn.textContent = isShowingAllHistory ? 'Zobrazit méně' : `Zobrazit vše (${completeDeviceHistory.length})`;
    } else {
        toggleBtn.style.display = 'none';
    }
}

function updateTable(data) {
    const tbody = document.getElementById('positions-table');
    tbody.innerHTML = ''; // Clear previous content
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No position history available.</td></tr>';
        return;
    }

    const sortedData = data.sort((a, b) => new Date(b.startTime || b.timestamp) - new Date(a.startTime || a.timestamp));

    sortedData.forEach((point) => {
        if (point.type === 'cluster') {
            const clusterId = `cluster-${point.startTime}`;
            const clusterRow = document.createElement('tr');
            clusterRow.className = 'cluster-row table-info';
            clusterRow.dataset.clusterId = clusterId;
            clusterRow.style.cursor = 'pointer';

            const isExpanded = expandedClusters.has(clusterId);

            clusterRow.innerHTML = `
                <td><i class="fas ${isExpanded ? 'fa-minus-circle' : 'fa-plus-circle'} me-2"></i>${formatTimestamp(point.startTime)} - ${formatTimestamp(point.endTime)}</td>
                <td>${formatCoordinate(point.latitude)}</td>
                <td>${formatCoordinate(point.longitude)}</td>
                <td>N/A (Cluster)</td>
                <td>N/A</td>
                <td>Less ${point.clusterThreshold}m</td>
                <td>${point.originalPoints.length} points</td>
            `;
            tbody.appendChild(clusterRow);

            // Create and append hidden child rows for each original point in the cluster
            point.originalPoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(originalPoint => {
                const childRow = document.createElement('tr');
                childRow.className = `child-row child-of-${clusterId} ${isExpanded ? '' : 'd-none'}`;
                childRow.style.backgroundColor = 'rgba(0,0,0,0.02)';

                childRow.innerHTML = `
                    <td style="padding-left: 2.5rem;">${formatTimestamp(originalPoint.timestamp)}</td>
                    <td>${formatCoordinate(originalPoint.latitude)}</td>
                    <td>${formatCoordinate(originalPoint.longitude)}</td>
                    <td>${formatSpeed(originalPoint.speed)}</td>
                    <td>${formatAltitude(originalPoint.altitude)}</td>
                    <td>${formatAccuracy(originalPoint.accuracy)}</td>
                    <td>${originalPoint.satellites !== null ? originalPoint.satellites : 'N/A'}</td>
                `;
                tbody.appendChild(childRow);
            });
        } else {
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
        }
    });
}

function createDevicePopup(point) {
    if (point.type === 'cluster') {
        return `<strong>Cluster (${point.originalPoints.length} points)</strong><br>
                <strong>From:</strong> ${formatTimestamp(point.startTime)}<br>
                <strong>To:</strong> ${formatTimestamp(point.endTime)}`;
    } else {
        return `<strong>Time:</strong> ${formatTimestamp(point.timestamp)}<br>
                <strong>Speed:</strong> ${formatSpeed(point.speed)}<br>
                <strong>Altitude:</strong> ${formatAltitude(point.altitude)}`;
    }
}

function formatCoordinate(coord) { return coord !== null ? Number(coord).toFixed(6) : 'N/A'; }
function formatSpeed(speed) { return speed !== null ? `${Number(speed).toFixed(2)} km/h` : 'N/A'; }
function formatAltitude(altitude) { return altitude !== null ? `${Number(altitude).toFixed(2)} m` : 'N/A'; }
function formatAccuracy(accuracy) { return accuracy !== null ? `${Number(accuracy).toFixed(2)} m` : 'N/A'; }

async function handleSettingsUpdate(e) {
    e.preventDefault();
    if (!selectedDevice) return displayAlert('Please select a device first.', 'warning');

    const days = document.getElementById('interval-gps-days').value || 0;
    const hours = document.getElementById('interval-gps-hours').value || 0;
    const minutes = document.getElementById('interval-gps-minutes').value || 0;
    const seconds = document.getElementById('interval-gps-seconds').value || 0;
    const intervalGps = dhmsToSeconds(days, hours, minutes, seconds);
    
    const mode = document.getElementById('mode-select').value;
    let intervalSend = (mode === 'batch') ? (document.getElementById('interval-send').value || 1) : 1;

    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                deviceId: selectedDevice, 
                interval_gps: intervalGps,
                interval_send: parseInt(intervalSend, 10)
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update settings.');
        displayAlert(result.message || 'Settings updated successfully!', 'success');
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

async function handleRenameDevice(deviceId, currentName) {
    showInputModal({
        title: 'Rename Device',
        label: 'New device name',
        value: currentName,
        confirmText: 'Rename',
        onConfirm: async (newName) => {
            if (!newName || newName.trim() === '' || newName === currentName) {
                return; // Do nothing if the name is empty or unchanged
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/devices/name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: deviceId, newName: newName.trim() })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Failed to rename device.');
                
                displayAlert(result.message || 'Device renamed successfully!', 'success');
                
                // Update the name in the UI
                const el = document.querySelector(`.device-item[data-device-id='${deviceId}'] strong`);
                if (el) el.textContent = newName.trim();

            } catch (error) {
                displayAlert(`Error: ${error.message}`, 'danger');
            }
        }
    });
}

async function handleDeleteDevice(deviceId) {
    const el = document.querySelector(`.device-item[data-device-id='${deviceId}']`);
    const name = el ? (el.querySelector('strong').textContent) : deviceId;

    showConfirmationModal({
        title: 'Confirm Device Deletion',
        body: `Are you sure you want to permanently delete the device '<strong>${name}</strong>'? This action is irreversible.`,
        confirmText: 'Delete Device',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/devices/delete/${deviceId}`, { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to delete device.');
                displayAlert(result.message, 'success');
                if (selectedDevice === deviceId) {
                    selectedDevice = null;
                    clearMapAndData();
                    document.getElementById('device-settings-card').style.display = 'none';
                    window.history.pushState({path: window.location.pathname}, '', window.location.pathname);
                }
                if (el) el.remove();
                if (document.getElementById('devices-list').children.length === 0) {
                    document.getElementById('devices-list').innerHTML = '<p class="text-muted">No active devices found.</p>';
                }
            } catch (error) {
                displayAlert(`Error: ${error.message}`, 'danger');
            }
        }
    });
}

async function handleClearDeviceAlerts(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/alerts/read-all/${deviceId}`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed to clear alerts.');
        displayAlert(result.message, 'success');
        // Refresh the device list to remove the alert icon and button
        loadDevices();
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

async function sendGeofenceToBackend(geofenceData) {
    if (!selectedDevice) return displayAlert('Cannot save geofence. No device selected.', 'danger');

    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/geofence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: selectedDevice, geofence: geofenceData })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to save geofence.');
        displayAlert(result.message || 'Geofence saved successfully!', 'success');
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

async function checkForAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/alerts`);
        if (!response.ok) {
            console.error('Failed to fetch alerts:', response.status);
            return;
        }
        const alerts = await response.json();
        if (alerts && alerts.length > 0) {
            const alertIds = alerts.map(alert => alert.id);
            alerts.forEach(alert => {
                displayAlert(alert.message, 'danger');
            });
            await fetch(`${API_BASE_URL}/api/alerts/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertIds })
            });
        }
    } catch (error) {
        console.error('Error polling for alerts:', error);
    }
}

function displayAlert(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return console.error('Toast container not found!');
    const toastId = `toast-${Date.now()}`;
    const bgClass = { 'success': 'bg-success', 'danger': 'bg-danger', 'warning': 'bg-warning', 'info': 'bg-info' }[type] || 'bg-secondary';
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 5000 });
    toast.show();
    document.getElementById(toastId).addEventListener('hidden.bs.toast', (e) => e.target.remove());
}