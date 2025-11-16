let map;
let selectedDevice = null;
let polyline = null;
let markers = {}; // Changed from array to object
let markersLayer = null;
let clusterRadiusLayer = null;
let lastTimestamp = null;
let completeDeviceHistory = [];
let isShowingAllHistory = false;
const HISTORY_ROW_LIMIT = 7;
let expandedClusters = new Set(); // State for expanded cluster rows

let drawnItems, drawControl;
let currentDeviceGeofence = null;
let geofenceDraftPending = false;

// --- New state for map view ---
let useClusters = true;
let permanentTooltips = false;

const DEFAULT_CLUSTER_THRESHOLD_METERS = 20;
const MIN_CLUSTER_THRESHOLD_METERS = 5;
const MAX_CLUSTER_THRESHOLD_METERS = 500;
let clusterDistanceThreshold = DEFAULT_CLUSTER_THRESHOLD_METERS;
let rawDeviceHistory = [];

// Custom Leaflet Icons
const defaultIcon = L.divIcon({
    className: 'custom-div-icon',
    html: '<div style="background-color:#007bff; width: 10px; height: 10px; border-radius: 50%; border: 1px solid #fff;"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds
const GEOFENCE_STYLE = {
    color: '#ff7800',
    weight: 2,
    fillColor: '#ff7800',
    fillOpacity: 0.15
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function formatDistance(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return `${clusterDistanceThreshold} m`;
    }
    if (numeric >= 1000) {
        const km = numeric / 1000;
        const precision = km >= 10 ? 0 : 1;
        return `${km.toFixed(precision)} km`;
    }
    return `${Math.round(numeric)} m`;
}

function updateClusterThresholdLabel(value) {
    const label = document.getElementById('cluster-threshold-value');
    if (!label) return;
    label.textContent = formatDistance(value);
}

function setClusterDistanceThreshold(value, { applyChanges = true } = {}) {
    if (!Number.isFinite(value)) {
        return;
    }
    const normalized = clamp(
        Math.round(value),
        MIN_CLUSTER_THRESHOLD_METERS,
        MAX_CLUSTER_THRESHOLD_METERS
    );
    clusterDistanceThreshold = normalized;

    const slider = document.getElementById('cluster-threshold-slider');
    if (slider && Number(slider.value) !== normalized) {
        slider.value = normalized;
    }
    updateClusterThresholdLabel(normalized);

    if (!applyChanges) {
        return;
    }

    recomputeClusteredHistory();
    updateMap(false);
    renderPositionTable();
}

function recomputeClusteredHistory() {
    if (!Array.isArray(rawDeviceHistory) || rawDeviceHistory.length === 0) {
        completeDeviceHistory = [];
        expandedClusters = new Set();
        return;
    }

    const previousExpanded = new Set(expandedClusters);
    const clustered = clusterLocations(rawDeviceHistory, clusterDistanceThreshold);
    completeDeviceHistory = clustered;

    const availableKeys = new Set(
        clustered
            .filter(point => point && point.type === 'cluster')
            .map(point => getClusterKey(point))
    );

    expandedClusters = new Set(
        Array.from(previousExpanded).filter(key => availableKeys.has(key))
    );
}

function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const phi1 = Number(lat1) * Math.PI / 180;
    const phi2 = Number(lat2) * Math.PI / 180;
    const deltaPhi = (Number(lat2) - Number(lat1)) * Math.PI / 180;
    const deltaLambda = (Number(lon2) - Number(lon1)) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return 6371000 * c; // Earth radius in meters
}

function clusterLocations(locations, distanceThreshold) {
    if (!Array.isArray(locations) || locations.length === 0) {
        return [];
    }

    const sorted = locations
        .filter(Boolean)
        .slice()
        .sort((a, b) => {
            const aTime = new Date(a.timestamp || a.startTime || a.endTime || 0).getTime();
            const bTime = new Date(b.timestamp || b.startTime || b.endTime || 0).getTime();
            return aTime - bTime;
        });

    const clusteredLocations = [];
    let index = 0;

    while (index < sorted.length) {
        const currentPoint = sorted[index];
        const cluster = [currentPoint];
        let cursor = index + 1;

        while (cursor < sorted.length) {
            const previousPoint = cluster[cluster.length - 1];
            const nextPoint = sorted[cursor];

            const distance = getHaversineDistanceMeters(
                previousPoint.latitude,
                previousPoint.longitude,
                nextPoint.latitude,
                nextPoint.longitude
            );

            if (Number.isFinite(distance) && distance < distanceThreshold) {
                cluster.push(nextPoint);
                cursor += 1;
            } else {
                break;
            }
        }

        if (cluster.length > 1) {
            const totalLat = cluster.reduce((sum, point) => sum + Number(point.latitude), 0);
            const totalLon = cluster.reduce((sum, point) => sum + Number(point.longitude), 0);
            clusteredLocations.push({
                latitude: totalLat / cluster.length,
                longitude: totalLon / cluster.length,
                startTime: cluster[0].timestamp,
                endTime: cluster[cluster.length - 1].timestamp,
                type: 'cluster',
                device_id: currentPoint.device_id,
                clusterThreshold: distanceThreshold,
                originalPoints: cluster.map(point => ({ ...point }))
            });
        } else {
            clusteredLocations.push({ ...currentPoint });
        }

        index = cursor;
    }

    return clusteredLocations;
}

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
    clusterRadiusLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    // --- Info Toggle Listener ---
    const infoToggle = document.getElementById('info-toggle-switch');
    if (infoToggle) {
         permanentTooltips = infoToggle.checked;
        infoToggle.addEventListener('change', (e) => {
            permanentTooltips = e.target.checked;
            updateMap(false); // Redraw map with new tooltip setting
        });
    }

    // --- Cluster Toggle Listener ---
    const clusterToggle = document.getElementById('cluster-toggle-switch');
    if (clusterToggle) {
        clusterToggle.addEventListener('change', (e) => {
            useClusters = e.target.checked;
            // Force a redraw of the map with the new setting
            updateMap(false);
        });
    }

    const clusterSlider = document.getElementById('cluster-threshold-slider');
    if (clusterSlider) {
        setClusterDistanceThreshold(clusterDistanceThreshold, { applyChanges: false });

        clusterSlider.addEventListener('input', (e) => {
            const nextValue = Number(e.target.value);
            if (Number.isFinite(nextValue)) {
                setClusterDistanceThreshold(nextValue);
            } else {
                updateClusterThresholdLabel(e.target.value);
            }
        });
    }

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
        applyGeofenceStyle(e.layer);
        drawnItems.addLayer(e.layer);
        geofenceDraftPending = true;
        updateGeofenceControls();
    });

    map.on(L.Draw.Event.EDITED, (e) => {
        if (e.layers && typeof e.layers.eachLayer === 'function') {
            e.layers.eachLayer(applyGeofenceStyle);
        }
        if (e.layers && e.layers.getLayers().length > 0) {
            geofenceDraftPending = true;
            updateGeofenceControls();
        }
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
        sendGeofenceToBackend(null);
    });
    // --- End Leaflet.draw ---

    updateGeofenceControls();

    const urlParams = new URLSearchParams(window.location.search);

    loadDevices();

    const deviceIdFromUrl = urlParams.get('id');
    if (deviceIdFromUrl) {
        selectDevice(decodeURIComponent(deviceIdFromUrl));
    }

    setInterval(() => {
        loadDevices();
        if (selectedDevice) {
            loadDeviceData();
        }
    }, UPDATE_INTERVAL);

    window.addEventListener('popstate', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const deviceIdFromUrl = urlParams.get('id');

        if (!deviceIdFromUrl) {
            selectedDevice = null;
            clearMapAndData();
            loadDevices();
            return;
        }

        if (deviceIdFromUrl !== selectedDevice) {
            selectDevice(decodeURIComponent(deviceIdFromUrl), { skipHistory: true });
        } else {
            loadDevices();
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

    const tableBody = document.getElementById('positions-table');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const row = e.target.closest('tr');
            if (!row) return;

            // If the clicked row is a cluster row, handle expansion/collapse
            if (row.classList.contains('cluster-row')) {
                const clusterKey = row.dataset.clusterKey;
                if (!clusterKey) {
                    return;
                }
                if (expandedClusters.has(clusterKey)) {
                    expandedClusters.delete(clusterKey);
                } else {
                    expandedClusters.add(clusterKey);
                }
                renderPositionTable(); // Re-render to show/hide children
                return; // Done
            }

            // If it's not a cluster row, it might be a focusable row (regular or child)
            const markerKey = row.dataset.markerKey || row.dataset.timestamp;
            if (markerKey && markers[markerKey]) {
                const marker = markers[markerKey];
                const latLng = marker.getLatLng();
                map.flyTo(latLng, 18); // Zoom in to a close-up level
                marker.openTooltip();
            }
        });
    }

    setInterval(checkForAlerts, 15000); // Check for new alerts every 15 seconds

    document.getElementById('export-gpx-btn')?.addEventListener('click', () => {
        if (selectedDevice) {
            window.open(`${API_BASE_URL}/api/devices/export/gpx/${selectedDevice}`, '_blank');
        }
    });

    const powerOffButton = document.getElementById('power-off-btn');
    if (powerOffButton) {
        powerOffButton.addEventListener('click', handlePowerOffClick);
    }

    const clearPowerInstructionBtn = document.getElementById('clear-power-instruction-btn');
    if (clearPowerInstructionBtn) {
        clearPowerInstructionBtn.addEventListener('click', handleClearInstructionClick);
    }
}

async function checkForAlerts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
        if (!response.ok) {
            console.error('Failed to fetch device coordinates for alert check');
            return;
        }
        const devices = await response.json();
        const devicesWithUnreadAlerts = new Set(
            devices.filter(d => d.has_unread_alerts).map(d => d.device)
        );

        document.querySelectorAll('.device-item').forEach(item => {
            const deviceId = item.dataset.deviceId;
            const hasAlerts = devicesWithUnreadAlerts.has(deviceId);
            const alertIcon = item.querySelector('.fa-exclamation-triangle');
            const clearAlertsButton = item.querySelector('.btn-warning');

            if (hasAlerts) {
                if (!alertIcon) {
                    // If the icon isn't there, reload the whole device list to be safe
                    loadDevices();
                }
            } else {
                if (alertIcon) {
                    // If the icon is there but shouldn't be, reload the list
                    loadDevices();
                }
            }
        });
    } catch (error) {
        console.error('Error checking for alerts:', error);
    }
}

function updateGeofenceControls() {
    const saveBtn = document.getElementById('save-geofence-btn');
    const deleteBtn = document.getElementById('delete-geofence-btn');

    if (saveBtn) {
        saveBtn.style.display = geofenceDraftPending ? 'block' : 'none';
    }

    if (deleteBtn) {
        deleteBtn.style.display = currentDeviceGeofence ? 'block' : 'none';
    }
}

function applyGeofenceStyle(layer) {
    if (!layer || typeof layer.setStyle !== 'function') {
        return;
    }
    layer.setStyle(GEOFENCE_STYLE);
}

function getLayerBounds(layer) {
    if (!layer) return null;
    if (typeof layer.getBounds === 'function') {
        const bounds = layer.getBounds();
        if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            return bounds;
        }
    }
    if (typeof layer.getLatLng === 'function' && typeof layer.getRadius === 'function') {
        return layer.getBounds();
    }
    return null;
}

function createLayerFromGeofence(geofence) {
    if (!geofence) return null;

    if (geofence.type === 'circle') {
        return L.circle([geofence.lat, geofence.lng], {
            radius: geofence.radius,
            ...GEOFENCE_STYLE
        });
    }

    if (geofence.type === 'Feature') {
        return L.geoJSON(geofence, {
            style: () => GEOFENCE_STYLE
        });
    }

    console.warn('Unsupported geofence format:', geofence);
    return null;
}

function loadGeofenceIntoDrawnItems(geofence, options = {}) {
    const { fitBounds = false } = options;

    if (!drawnItems) {
        return;
    }

    drawnItems.clearLayers();

    if (!geofence) {
        return;
    }

    const layer = createLayerFromGeofence(geofence);
    if (!layer) {
        return;
    }

    applyGeofenceStyle(layer);
    drawnItems.addLayer(layer);

    if (fitBounds && map && typeof map.fitBounds === 'function') {
        const bounds = getLayerBounds(layer);
        if (bounds) {
            map.fitBounds(bounds.pad(0.2));
        }
    }
}

function updateDeviceListLink() {
    const link = document.getElementById('device-list-link');
    if (!link) return;

    if (!selectedDevice) {
        link.style.display = 'none';
        return;
    }

    link.style.display = 'inline-block';
    link.textContent = 'Show All Devices';
    link.href = '/devices';
}

function normalizeTimeKey(value) {
    if (value === null || value === undefined || value === '') return 'na';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
    }
    return String(value);
}

function getClusterKey(point) {
    if (!point) return 'cluster-na';
    const startKey = normalizeTimeKey(point.startTime || point.timestamp || point.endTime || point.id);
    const endKey = point.endTime ? normalizeTimeKey(point.endTime) : 'end';
    const latValue = point.latitude;
    const lngValue = point.longitude;
    const latKey = (latValue !== null && latValue !== undefined && Number.isFinite(Number(latValue)))
        ? Number(latValue).toFixed(6)
        : 'lat';
    const lngKey = (lngValue !== null && lngValue !== undefined && Number.isFinite(Number(lngValue)))
        ? Number(lngValue).toFixed(6)
        : 'lng';
    return `cluster-${startKey}-${endKey}-${latKey}-${lngKey}`;
}

function getMarkerKey(point) {
    if (!point) return null;
    const baseKey = normalizeTimeKey(point.timestamp || point.endTime || point.startTime || point.id);
    const latValue = point.latitude;
    const lngValue = point.longitude;
    const latKey = (latValue !== null && latValue !== undefined && Number.isFinite(Number(latValue)))
        ? Number(latValue).toFixed(6)
        : 'lat';
    const lngKey = (lngValue !== null && lngValue !== undefined && Number.isFinite(Number(lngValue)))
        ? Number(lngValue).toFixed(6)
        : 'lng';
    return `${baseKey}-${latKey}-${lngKey}`;
}

async function loadDevices() {
    if (typeof showLoadingIndicator === 'function') {
        showLoadingIndicator();
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/coordinates`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const devices = await response.json();
        const devicesList = document.getElementById('devices-list');
        devicesList.innerHTML = '';

        const listToRender = selectedDevice
            ? devices.filter(device => device.device === selectedDevice)
            : devices;

        if (selectedDevice && listToRender.length === 0) {
            devicesList.innerHTML = '<p class="text-muted">Selected device is not currently active.</p>';
            updateDeviceListLink();
            return;
        }

        if (listToRender.length === 0) {
            devicesList.innerHTML = '<p class="text-muted">No active devices found.</p>';
            updateDeviceListLink();
            return;
        }

        listToRender.forEach(device => {
            const deviceElement = createDeviceElement(device);
            devicesList.appendChild(deviceElement);
        });

        const devicesLink = document.getElementById('device-list-link');
        if (devicesLink) {
            if (selectedDevice) {
                devicesLink.style.display = 'inline-block';
                devicesLink.textContent = 'Show All Devices';
                devicesLink.href = '/devices';
            } else {
                devicesLink.style.display = devices.length > 0 ? 'inline-block' : 'none';
                devicesLink.textContent = 'Manage Devices';
                devicesLink.href = '/devices';
            }
        }

    } catch (error) {
        const devicesList = document.getElementById('devices-list');
        if(devicesList) devicesList.innerHTML = '<p class="text-danger">Error loading device list.</p>';
        updateDeviceListLink();
    }
}

function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'list-group-item list-group-item-action device-item d-flex justify-content-between align-items-center';
    div.dataset.deviceId = device.device;

    const displayName = device.name || device.device;
    const powerMeta = getPowerStatusMeta(device.power_status, device.power_instruction);
    const statusIndicatorHtml = `
        <span class="status-chip-inline" title="Power status: ${powerMeta.label}">
            <span class="status-dot ${powerMeta.dotClass}"></span>
        </span>
    `;

    const deviceInfo = document.createElement('div');
    deviceInfo.style.flexGrow = '1';
    deviceInfo.style.cursor = 'pointer';
    deviceInfo.addEventListener('click', () => selectDevice(device.device));

    const alertIcon = device.has_unread_alerts ? '<i class="fas fa-exclamation-triangle text-danger ms-2"></i>' : '';

    deviceInfo.innerHTML = `
        <div class="d-flex w-100 justify-content-between align-items-start">
            <div class="d-flex flex-column">
                <div class="d-flex align-items-center gap-2">
                    ${statusIndicatorHtml}
                    <h6 class="mb-0"><strong>${displayName}</strong>${alertIcon}</h6>
                </div>
            </div>
            <small class="text-muted text-end">${formatTimestamp(device.timestamp)}</small>
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
        handleRenameDevice(device.device);
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

    if (selectedDevice && device.device === selectedDevice) {
        div.classList.add('active');
    }

    return div;
}

async function selectDevice(deviceId, options = {}) {
    if (!deviceId) {
        return;
    }

    const { skipHistory = false } = options;

    if (!skipHistory) {
        const url = new URL(window.location.href);
        url.searchParams.set('id', deviceId);
        const newUrl = `${url.origin}${url.pathname}${url.search}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    selectedDevice = deviceId;
    updateDeviceListLink();
    loadDevices();
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
        
        let deviceType = 'N/A';
        if (infoCard) {
            document.getElementById('info-registration-date').textContent = formatTimestamp(settings.created_at);
            deviceType = settings.device_type || 'N/A';
            document.getElementById('info-device-type').textContent = deviceType;

            const satellitesSetting = document.getElementById('satellites-setting');
            if (deviceType === 'HW') {
                satellitesSetting.style.display = 'block';
            } else {
                satellitesSetting.style.display = 'none';
            }
        }
        
        originalSettings = {
            interval_gps: settings.interval_gps || 0,
            interval_send: settings.interval_send || 1,
            satellites: settings.satellites || 7
        };

        const dhms = secondsToDhms(settings.interval_gps || 0);
        document.getElementById('interval-gps-days').value = dhms.d;
        document.getElementById('interval-gps-hours').value = dhms.h;
        document.getElementById('interval-gps-minutes').value = dhms.m;
        document.getElementById('interval-gps-seconds').value = dhms.s;
        document.getElementById('interval-send').value = settings.interval_send || 1;
        document.getElementById('satellites').value = settings.satellites || 7;

        const modeSelect = document.getElementById('mode-select');
        const batchSettings = document.getElementById('batch-settings');
        
        modeSelect.value = settings.mode || 'simple';

        if (modeSelect.value === 'batch') {
            batchSettings.style.display = 'block';
        } else {
            batchSettings.style.display = 'none';
        }
        currentDeviceGeofence = settings.geofence || null;
        geofenceDraftPending = false;
        loadGeofenceIntoDrawnItems(currentDeviceGeofence, { fitBounds: true });
        updateGeofenceControls();

        const powerCard = document.getElementById('power-control-card');
        if (powerCard) {
            powerCard.style.display = deviceType === 'HW' ? 'block' : 'block'; //vyrušeni podminky pro testovaci ucely
        }

        updatePowerSummary({
            power_instruction: settings.power_instruction,
            power_status: settings.power_status
        });
    } catch (error) {
        displayAlert(`Error loading settings for ${deviceId}.`, 'danger');
    }
    
    await loadDeviceData(true);
}

async function loadDeviceData(isInitialLoad = false) {
    if (!selectedDevice) return;
    if (typeof showLoadingIndicator === 'function') {
        showLoadingIndicator();
    }
    try {
        const rawResponse = await fetch(`${API_BASE_URL}/api/devices/raw-data?id=${selectedDevice}`);
        if (!rawResponse.ok) {
            throw new Error(`HTTP error! status: ${rawResponse.status}`);
        }

        const rawData = await rawResponse.json();
        rawDeviceHistory = Array.isArray(rawData) ? rawData : [];

        recomputeClusteredHistory();
        updateMap(isInitialLoad);
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
    if (drawnItems) {
        drawnItems.clearLayers();
    }
    if (markersLayer) {
        markersLayer.clearLayers();
    }
    if (clusterRadiusLayer) {
        clusterRadiusLayer.clearLayers();
    }
    markers = {}; // Reset to empty object
    lastTimestamp = null;
    completeDeviceHistory = [];
    rawDeviceHistory = [];
    expandedClusters = new Set();
    document.getElementById('positions-table').innerHTML = '';
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (toggleBtn) toggleBtn.style.display = 'none';
    const exportBtn = document.getElementById('export-gpx-btn');
    if (exportBtn) {
        exportBtn.style.display = 'none';
    }
    const powerCard = document.getElementById('power-control-card');
    if (powerCard) {
        powerCard.style.display = 'none';
    }
    resetPowerSummary();
    currentDeviceGeofence = null;
    geofenceDraftPending = false;
    updateGeofenceControls();
}


function updateMap(fitBounds) {
    // Always clear existing layers before drawing new ones
    if (polyline) {
        map.removeLayer(polyline);
        polyline = null;
    }
    if (markersLayer) {
        markersLayer.clearLayers();
    }
    if (clusterRadiusLayer) {
        clusterRadiusLayer.clearLayers();
    }
    markers = {};

    // 1. Determine the data source based on the cluster setting
    const pointsToDraw = useClusters ? completeDeviceHistory : rawDeviceHistory;

    // 2. Draw the polyline from the selected data source
    const coordinates = pointsToDraw.map(p => [Number(p.latitude), Number(p.longitude)]).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
    if (coordinates.length > 0) {
        polyline = L.polyline(coordinates, { color: '#007bff', weight: 2 }).addTo(map);
    }

    // 3. Find the latest point from the raw history to ensure it's always highlighted
    let latestPoint = null;
    if (rawDeviceHistory.length > 0) {
        latestPoint = rawDeviceHistory.reduce((latest, current) => {
            if (!latest) return current;
            if (!current) return latest;
            const latestTime = new Date(latest.timestamp || latest.endTime || latest.startTime || 0).getTime();
            const currentTime = new Date(current.timestamp || current.endTime || current.startTime || 0).getTime();
            return currentTime > latestTime ? current : latest;
        }, null);
    }
    const latestMarkerKey = latestPoint ? getMarkerKey(latestPoint) : null;

    // 4. Create markers from the selected data source
    pointsToDraw.forEach((point) => {
        const lat = Number(point.latitude);
        const lon = Number(point.longitude);

        if (isNaN(lat) || isNaN(lon)) return;

        const markerKey = getMarkerKey(point);
        if (!markerKey) {
            return;
        }

        // Check if the current point (or a point within a cluster) is the latest point
        let isLatest = false;
        if (point.type === 'cluster' && Array.isArray(point.originalPoints) && latestMarkerKey) {
            isLatest = point.originalPoints.some(p => getMarkerKey(p) === latestMarkerKey);
        } else {
            isLatest = latestMarkerKey && markerKey === latestMarkerKey;
        }

        const markerOptions = {};
        if (!isLatest) {
            markerOptions.icon = defaultIcon;
        }

        if (useClusters && point.type === 'cluster' && clusterRadiusLayer && isLatest) {
            const circle = L.circle([lat, lon], {
                radius: Number(point.clusterThreshold) || clusterDistanceThreshold,
                color: '#0d6efd',
                weight: 1,
                opacity: 0.35,
                fillColor: '#0d6efd',
                fillOpacity: 0.1,
                interactive: false
            });
            clusterRadiusLayer.addLayer(circle);
        }

        const marker = L.marker([lat, lon], markerOptions)
            .bindTooltip(createDevicePopup(point), {
                permanent: permanentTooltips,
                direction: 'auto',
                className: 'device-tooltip'
            });

        if (markersLayer) {
            markersLayer.addLayer(marker);
        } else {
            marker.addTo(map);
        }
        markers[markerKey] = marker;
    });

    // 5. Fit bounds on initial load
    if (fitBounds && rawDeviceHistory.length > 0) {
        const bounds = L.latLngBounds(rawDeviceHistory.map(p => [Number(p.latitude), Number(p.longitude)]));
        if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
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
    toggleBtn.textContent = isShowingAllHistory ? 'Show Less' : `Show All (${completeDeviceHistory.length})`;
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
        const pointTimestamp = point.startTime || point.timestamp;
        if (point.type === 'cluster') {
            const clusterKey = getClusterKey(point);
            const clusterRow = document.createElement('tr');
            clusterRow.className = 'cluster-row table-info';
            clusterRow.dataset.clusterKey = clusterKey;
            const clusterMarkerKey = getMarkerKey(point);
            if (clusterMarkerKey) {
                clusterRow.dataset.markerKey = clusterMarkerKey;
            }
            // Do not add data-timestamp here, cluster row only expands
            clusterRow.style.cursor = 'pointer';

            const isExpanded = expandedClusters.has(clusterKey);

            clusterRow.innerHTML = `
                <td><i class="fas ${isExpanded ? 'fa-minus-circle' : 'fa-plus-circle'} me-2"></i>${formatTimestamp(point.startTime)} - ${formatTimestamp(point.endTime)}</td>
                <td>${formatCoordinate(point.latitude)}</td>
                <td>${formatCoordinate(point.longitude)}</td>
                <td>N/A (Cluster)</td>
                <td>N/A</td>
                <td>Less ${formatDistance(point.clusterThreshold)}</td>
                <td>${point.originalPoints.length} points</td>
            `;
            tbody.appendChild(clusterRow);

            // Create and append hidden child rows for each original point in the cluster
            point.originalPoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(originalPoint => {
                const childRow = document.createElement('tr');
                childRow.className = `child-row${isExpanded ? '' : ' d-none'}`;
                childRow.style.backgroundColor = 'rgba(0,0,0,0.02)';
                childRow.dataset.clusterKey = clusterKey;
                childRow.dataset.timestamp = point.endTime || point.startTime || '';
                if (clusterMarkerKey) {
                    childRow.dataset.markerKey = clusterMarkerKey;
                }
                childRow.style.cursor = 'pointer'; // Make child rows clickable

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
            row.dataset.timestamp = pointTimestamp; // Add timestamp for map linking
            row.style.cursor = 'pointer';
            const rowMarkerKey = getMarkerKey(point);
            if (rowMarkerKey) {
                row.dataset.markerKey = rowMarkerKey;
            }
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
                interval_send: parseInt(intervalSend, 10),
                satellites: parseInt(document.getElementById('satellites').value, 10) || 7,
                mode: mode
            })
        });
        const result = await response.json();
        if (!response.ok) {
            // If the backend sends specific validation details, use them.
            let errorMessage = result.error || 'Failed to update settings.';
            if (result.details && Array.isArray(result.details)) {
                errorMessage = result.details.map(d => d.msg).join('; ');
            }
            throw new Error(errorMessage);
        }
        displayAlert(result.message || 'Settings updated successfully!', 'success');
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

async function handleRenameDevice(deviceId) {
    const nameElement = document.querySelector(`.device-item[data-device-id='${deviceId}'] strong`);
    const currentName = nameElement ? nameElement.textContent.trim() : deviceId;

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
                await loadDevices();

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
                    const url = new URL(window.location.href);
                    url.searchParams.delete('id');
                    const search = url.searchParams.toString();
                    const newUrl = `${url.origin}${url.pathname}${search ? `?${search}` : ''}`;
                    window.history.pushState({ path: newUrl }, '', newUrl);
                    updateDeviceListLink();
                }
                loadDevices();
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
        const fallbackMessage = geofenceData ? 'Geofence saved successfully!' : 'Geofence removed successfully!';
        displayAlert(result.message || fallbackMessage, 'success');
        currentDeviceGeofence = geofenceData || null;
        geofenceDraftPending = false;
        loadGeofenceIntoDrawnItems(currentDeviceGeofence);
        updateGeofenceControls();

    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

async function handlePowerOffClick(e) {
    e.preventDefault();
    if (!selectedDevice) {
        return displayAlert('Please select a device first.', 'warning');
    }

    const button = e.currentTarget;
    if (button.disabled) {
        return; // Nothing to do if instruction already pending
    }

    button.disabled = true;
    button.classList.remove('btn-danger');
    button.classList.add('btn-outline-danger');

    const success = await submitPowerInstruction('TURN_OFF');
    if (!success) {
        button.disabled = false;
        button.classList.remove('btn-outline-danger');
        button.classList.add('btn-danger');
    }
}

async function handleClearInstructionClick() {
    if (!selectedDevice) {
        return displayAlert('Please select a device first.', 'warning');
    }

    const button = document.getElementById('clear-power-instruction-btn');
    if (button && button.disabled) {
        return;
    }

    if (button) {
        button.disabled = true;
    }

    const success = await submitPowerInstruction('NONE');
    if (!success && button) {
        button.disabled = false;
    }
}

async function submitPowerInstruction(instruction) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/devices/power-instruction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: selectedDevice, power_instruction: instruction })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to update power instruction.');
        }

        displayAlert('Power instruction updated.', 'success');
        updatePowerSummary(result);
        await loadDevices();
        return true;
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
        return false;
    }
}

function updatePowerSummary(data) {
    const instruction = (data.power_instruction || 'NONE').toUpperCase();
    const status = (data.power_status || 'N/A').toUpperCase();

    const statusTextEl = document.getElementById('power-status-text');
    const statusDotEl = document.getElementById('power-status-dot');
    const powerOffButton = document.getElementById('power-off-btn');
    const clearButton = document.getElementById('clear-power-instruction-btn');

    const isPending = instruction !== 'NONE';
    let displayText = 'N/A';
    let dotClass = 'status-dot--neutral';

    if (isPending) {
        displayText = 'PENDING';
        dotClass = 'status-dot--pending';
    } else if (status === 'ON') {
        displayText = 'ON';
        dotClass = 'status-dot--on';
    } else if (status === 'OFF') {
        displayText = 'OFF';
        dotClass = 'status-dot--off';
    }

    if (statusTextEl) {
        statusTextEl.textContent = displayText;
    }
    if (statusDotEl) {
        statusDotEl.className = `status-dot ${dotClass}`;
    }

    const disablePowerOff = isPending || status === 'OFF' || status === 'N/A';
    if (powerOffButton) {
        powerOffButton.disabled = disablePowerOff;
        powerOffButton.classList.toggle('btn-danger', !powerOffButton.disabled);
        powerOffButton.classList.toggle('btn-outline-danger', powerOffButton.disabled);
        powerOffButton.title = powerOffButton.disabled ? 'Instruction unavailable' : 'Send Power OFF instruction';
    }

    const disableClear = instruction === 'NONE';
    if (clearButton) {
        clearButton.disabled = disableClear;
        clearButton.classList.toggle('disabled', disableClear);
        clearButton.title = disableClear ? 'Nothing to clear' : 'Clear pending instruction';
    }
}

function resetPowerSummary() {
    updatePowerSummary({ power_instruction: 'NONE', power_status: 'N/A' });
}

function logAlertToServer(message, type) {
    try {
        const payload = JSON.stringify({
            message,
            type,
            context: {
                deviceId: typeof selectedDevice !== 'undefined' ? selectedDevice : null,
                page: window.location.pathname
            }
        });

        const endpoint = `${API_BASE_URL}/api/logs/ui`;
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(endpoint, blob);
        } else {
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(() => {});
        }
    } catch (err) {
        console.warn('Failed to record UI alert log', err);
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
    logAlertToServer(message, type);
}