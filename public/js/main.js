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

    // Načtení dat (mapy i seznamu zařízení)
    loadCurrentCoordinates(); // This will now populate both map and device list

    // Nastavení automatické aktualizace (mapy i seznamu zařízení)
    setInterval(loadCurrentCoordinates, UPDATE_INTERVAL);
});

// Načtení seznamu zařízení (tato funkce může zůstat pro případné jiné použití,
// ale pro hlavní aktualizaci seznamu se nyní spoléháme na loadCurrentCoordinates)
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
        console.error('Chyba při načítání zařízení (loadDevices):', error);
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

// Načtení aktuálních souřadnic a aktualizace seznamu zařízení
async function loadCurrentCoordinates() {
    try {
        const response = await fetch(`${API_BASE_URL}/current_coordinates`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const devices = await response.json();
        
        // --- Aktualizace seznamu zařízení (sidebar) ---
        const devicesList = document.getElementById('devices-list');
        if (devicesList) {
            devicesList.innerHTML = ''; // Vyčistit stávající seznam
            devices.forEach(device => {
                const deviceElement = createDeviceElement(device); // Použít existující funkci
                devicesList.appendChild(deviceElement);
            });
        } else {
            console.error('Element #devices-list nebyl nalezen.');
        }
        // --- Konec aktualizace seznamu zařízení ---

        // Aktualizace markerů na mapě (stávající logika)
        devices.forEach(device => {
            updateDeviceMarker(device);
        });
    } catch (error) {
        console.error('Chyba při načítání souřadnic a aktualizaci UI:', error);
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
    if (!timestamp) return 'Neznámý čas'; // Pojistka pro případ, že timestamp je null/undefined
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