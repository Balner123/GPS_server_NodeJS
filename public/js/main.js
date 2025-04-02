// Inicializace mapy
let map;
let markers = {};

// Konfigurace
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 sekund

// Inicializace při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    // Inicializace mapy
    map = L.map('map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Načtení dat
    loadDevices();
    loadCurrentCoordinates();

    // Nastavení automatické aktualizace
    setInterval(loadCurrentCoordinates, UPDATE_INTERVAL);
});

// Načtení seznamu zařízení
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
        console.error('Chyba při načítání zařízení:', error);
    }
}

// Vytvoření elementu pro zařízení
function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'device-item';
    div.innerHTML = `
        <span class="device-status active"></span>
        <strong>${device.device}</strong>
        <div class="timestamp">Poslední aktualizace: ${formatTimestamp(device.timestamp)}</div>
    `;
    
    div.addEventListener('click', () => {
        window.location.href = `/device?name=${encodeURIComponent(device.device)}`;
    });
    
    return div;
}

// Načtení aktuálních souřadnic
async function loadCurrentCoordinates() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_coordinates`);
        const devices = await response.json();
        
        // Aktualizace markerů na mapě
        devices.forEach(device => {
            updateDeviceMarker(device);
        });
    } catch (error) {
        console.error('Chyba při načítání souřadnic:', error);
    }
}

// Aktualizace markeru zařízení
function updateDeviceMarker(device) {
    const position = [device.latitude, device.longitude];
    
    if (markers[device.device]) {
        markers[device.device].setLatLng(position);
    } else {
        const marker = L.marker(position).addTo(map);
        marker.bindPopup(createPopupContent(device));
        markers[device.device] = marker;
    }
}

// Vytvoření obsahu popup okna
function createPopupContent(device) {
    return `
        <div class="info-bubble">
            <strong>${device.device}</strong><br>
            <small class="timestamp">${formatTimestamp(device.timestamp)}</small>
        </div>
    `;
}

// Formátování časové značky
function formatTimestamp(timestamp) {
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