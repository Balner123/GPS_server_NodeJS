let map;
let selectedDevice = null;
let polyline = null;

// Konfigurace
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 sekund

// Inicializace při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    console.log('Stránka načtena, inicializace...');
    
    // Inicializace mapy
    map = L.map('history-map').setView([50.0755, 14.4378], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Načtení seznamu zařízení
    loadDevices();

    // Nastavení automatické aktualizace
    setInterval(() => {
        if (selectedDevice) {
            loadDeviceData(selectedDevice);
        }
    }, UPDATE_INTERVAL);

    // Nastavení formuláře pro odmlku
    const form = document.getElementById('device-settings-form');
    if (form) {
        console.log('Formulář nalezen, přidávám event listener');
        form.addEventListener('submit', (e) => {
            console.log('Formulář odeslán');
            handleSleepIntervalUpdate(e);
        });
    } else {
        console.error('Formulář nenalezen!');
    }
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
    
    div.addEventListener('click', () => selectDevice(device.device));
    return div;
}

// Výběr zařízení
async function selectDevice(deviceName) {
    selectedDevice = deviceName;
    
    // Aktualizace aktivního stavu v seznamu
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('active');
        if (item.querySelector('strong').textContent === deviceName) {
            item.classList.add('active');
        }
    });
    
    // Zobrazení nastavení odmlky
    const settingsCard = document.getElementById('device-settings-card');
    settingsCard.style.display = 'block';
    
    // Načtení aktuálního nastavení odmlky
    try {
        const response = await fetch(`${API_BASE_URL}/device_settings/${deviceName}`);
        const settings = await response.json();
        document.getElementById('device-sleep-interval').value = settings.sleep_interval;
    } catch (error) {
        console.error('Chyba při načítání nastavení odmlky:', error);
    }
    
    // Načtení dat zařízení
    await loadDeviceData(deviceName);
}

// Načtení dat zařízení
async function loadDeviceData(deviceName) {
    try {
        const response = await fetch(`${API_BASE_URL}/device_data?name=${deviceName}`);
        const data = await response.json();
        
        // Aktualizace mapy
        updateMap(data);
        
        // Aktualizace tabulky
        updateTable(data);
    } catch (error) {
        console.error('Chyba při načítání dat zařízení:', error);
    }
}

// Aktualizace mapy
function updateMap(data) {
    // Vyčištění předchozí trasy
    if (polyline) {
        map.removeLayer(polyline);
    }
    
    // Vytvoření nové trasy
    const coordinates = data.map(point => [
        Number(point.latitude),
        Number(point.longitude)
    ]);
    polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);
    
    // Nastavení zobrazení mapy na trasu
    if (coordinates.length > 0) {
        map.fitBounds(polyline.getBounds());
    }
    
    // Přidání markerů pro každý bod
    data.forEach((point, index) => {
        const marker = L.marker([
            Number(point.latitude),
            Number(point.longitude)
        ])
            .bindPopup(createPopupContent(point))
            .addTo(map);
            
        // Přidání čísla pořadí do markeru
        marker.bindTooltip((index + 1).toString(), {
            permanent: true,
            direction: 'top',
            className: 'marker-number'
        });
    });
}

// Aktualizace tabulky
function updateTable(data) {
    const tbody = document.getElementById('positions-table');
    tbody.innerHTML = '';
    
    data.forEach(point => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatTimestamp(point.timestamp)}</td>
            <td>${formatCoordinate(point.latitude)}</td>
            <td>${formatCoordinate(point.longitude)}</td>
            <td>${formatSpeed(point.speed)}</td>
            <td>${formatAltitude(point.altitude)}</td>
            <td>${formatAccuracy(point.accuracy)}</td>
            <td>${point.satellites || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Vytvoření obsahu popup okna
function createPopupContent(point) {
    return `
        <div class="info-bubble">
            <strong>Čas:</strong> ${formatTimestamp(point.timestamp)}<br>
            <strong>Rychlost:</strong> ${formatSpeed(point.speed)}<br>
            <strong>Výška:</strong> ${formatAltitude(point.altitude)}<br>
            <strong>Přesnost:</strong> ${formatAccuracy(point.accuracy)}<br>
            <strong>Satelity:</strong> ${point.satellites || '-'}
        </div>
    `;
}

// Pomocné funkce pro formátování hodnot
function formatCoordinate(coord) {
    if (coord === null || coord === undefined) return '-';
    return Number(coord).toFixed(6);
}

function formatSpeed(speed) {
    if (speed === null || speed === undefined) return '-';
    return Number(speed).toFixed(1) + ' km/h';
}

function formatAltitude(altitude) {
    if (altitude === null || altitude === undefined) return '-';
    return Number(altitude).toFixed(1) + ' m';
}

function formatAccuracy(accuracy) {
    if (accuracy === null || accuracy === undefined) return '-';
    return Number(accuracy).toFixed(1) + ' m';
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

// Zpracování aktualizace odmlky
async function handleSleepIntervalUpdate(e) {
    e.preventDefault();
    console.log('Zpracování aktualizace odmlky...');
    
    if (!selectedDevice) {
        console.error('Není vybráno zařízení!');
        return;
    }
    
    const sleepInterval = document.getElementById('device-sleep-interval').value;
    console.log('Nový interval odmlky:', sleepInterval);
    
    try {
        console.log('Odesílám požadavek na server...');
        const response = await fetch(`${API_BASE_URL}/device_settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device: selectedDevice,
                sleep_interval: parseInt(sleepInterval)
            })
        });
        
        console.log('Odpověď serveru:', response.status);
        
        if (response.ok) {
            console.log('Nastavení úspěšně uloženo');
            // Zobrazení úspěšné zprávy
            const alert = document.createElement('div');
            alert.className = 'alert alert-success mt-3';
            alert.textContent = 'Nastavení odmlky bylo úspěšně uloženo';
            document.getElementById('device-settings-form').appendChild(alert);
            
            // Skrytí zprávy po 3 sekundách
            setTimeout(() => alert.remove(), 3000);
        } else {
            const errorData = await response.json();
            console.error('Chyba serveru:', errorData);
            throw new Error(errorData.error || 'Chyba při ukládání nastavení');
        }
    } catch (error) {
        console.error('Chyba při odesílání nového intervalu:', error);
        
        // Zobrazení chybové zprávy
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger mt-3';
        alert.textContent = 'Chyba při ukládání nastavení odmlky: ' + error.message;
        document.getElementById('device-settings-form').appendChild(alert);
        
        // Skrytí zprávy po 3 sekundách
        setTimeout(() => alert.remove(), 3000);
    }
}