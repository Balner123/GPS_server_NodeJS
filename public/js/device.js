let map;
let selectedDevice = null;
let polyline = null;

// Configuration
const API_BASE_URL = window.location.origin;
const UPDATE_INTERVAL = 5000; // 5 seconds

// --- Helper functions for time conversion (Client-side) ---

// Converts total seconds to an object {d, h, m, s}
function secondsToDhms(totalSeconds) {
    totalSeconds = Number(totalSeconds);
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        // Return default value or null/undefined for error
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

// Helper function to convert DHMS to seconds (should already exist above)
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

    // Set up automatic update (if needed)
    setInterval(() => {
        if (selectedDevice) {
           loadDeviceData(selectedDevice); // Consider if automatic history update is necessary
        }
    }, UPDATE_INTERVAL);

    // Set up sleep interval form
    const form = document.getElementById('device-settings-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            handleSleepIntervalUpdate(e);
        });
    }
});


async function loadDevices() {
    try {
        // Assume /current_coordinates returns a list of active devices
        const response = await fetch(`${API_BASE_URL}/current_coordinates`); 
        if (!response.ok) {
             throw new Error(`HTTP error! status: ${response.status}`);
        }
        const devices = await response.json();
        
        const devicesList = document.getElementById('devices-list');
        devicesList.innerHTML = ''; // Clear list before adding
        
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
    selectedDevice = deviceName;
    
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
            // Special handling for 404 Not Found
            if (response.status === 404) {
                 // Set default values (0 seconds)
                 document.getElementById('interval-days').value = 0;
                 document.getElementById('interval-hours').value = 0;
                 document.getElementById('interval-minutes').value = 0;
                 document.getElementById('interval-seconds').value = 0;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } else {
            const settings = await response.json();

            // Convert seconds to DD:HH:MM:SS and set values in the form
            // Use default 0 if sleep_interval is not defined or is null
            const dhms = secondsToDhms(settings.sleep_interval === null || settings.sleep_interval === undefined ? 0 : settings.sleep_interval);
            document.getElementById('interval-days').value = dhms.d;
            document.getElementById('interval-hours').value = dhms.h;
            document.getElementById('interval-minutes').value = dhms.m;
            document.getElementById('interval-seconds').value = dhms.s;
        }

    } catch (error) {
        // In case of error, set default values (e.g., 0 seconds)
        document.getElementById('interval-days').value = 0;
        document.getElementById('interval-hours').value = 0;
        document.getElementById('interval-minutes').value = 0;
        document.getElementById('interval-seconds').value = 0;
        // Inform the user?
         displayAlert(`Error loading settings for ${deviceName}.`, 'danger');
    }
    
    // Load device data (position history)
    await loadDeviceData(deviceName);
}

// Load device data (position history)
async function loadDeviceData(deviceName) {
    try {
        const response = await fetch(`${API_BASE_URL}/device_data?name=${deviceName}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Update map
        updateMap(data);
        
        // Update table
        updateTable(data);
    } catch (error) {
        // Clear map and table in case of error?
        if (polyline) map.removeLayer(polyline);
        document.getElementById('positions-table').innerHTML = '<tr><td colspan="7" class="text-danger">Error loading position history.</td></tr>';
    }
}

// Update map
function updateMap(data) {
    // Clear previous route and markers
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    polyline = null; // Reset polyline reference
    
    if (!data || data.length === 0) {
         return;
    }

    // Create new route
    const coordinates = data.map(point => [
        Number(point.latitude),
        Number(point.longitude)
    ]).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1])); // Filter out invalid coordinates
    
    if (coordinates.length === 0) {
        return;
    }

    polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);
    
    // Set map view to the route
    map.fitBounds(polyline.getBounds().pad(0.1)); // Added a small padding
    
    // Add markers for each point
    data.forEach((point, index) => {
         if (isNaN(Number(point.latitude)) || isNaN(Number(point.longitude))) return; // Skip invalid points

        const marker = L.marker([
            Number(point.latitude),
            Number(point.longitude)
        ])
            .bindPopup(createPopupContent(point))
            .addTo(map);
    });
}

// Update table
function updateTable(data) {
    const tbody = document.getElementById('positions-table');
    tbody.innerHTML = ''; // Clear table

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No position history for this device.</td></tr>';
        return;
    }
    
    data.forEach(point => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatTimestamp(point.timestamp)}</td>
            <td>${formatCoordinate(point.latitude)}</td>
            <td>${formatCoordinate(point.longitude)}</td>
            <td>${formatSpeed(point.speed)}</td>
            <td>${formatAltitude(point.altitude)}</td>
            <td>${formatAccuracy(point.accuracy)}</td>
            <td>${point.satellites === null || point.satellites === undefined ? '-' : point.satellites}</td>
        `;
        tbody.appendChild(row);
    });
}

// Create popup content
function createPopupContent(point) {
    return `
        <div class="info-bubble">
            <strong>Time:</strong> ${formatTimestamp(point.timestamp)}<br>
            <strong>Speed:</strong> ${formatSpeed(point.speed)}<br>
            <strong>Altitude:</strong> ${formatAltitude(point.altitude)}<br>
            <strong>Accuracy:</strong> ${formatAccuracy(point.accuracy)}<br>
            <strong>Satellites:</strong> ${point.satellites ?? '-'}
        </div>
    `;
}

// Helper functions for formatting values
function formatCoordinate(coord) {
    const num = Number(coord);
    return isNaN(num) ? '-' : num.toFixed(6);
}

function formatSpeed(speed) {
    const num = Number(speed);
    return isNaN(num) ? '-' : num.toFixed(1) + ' km/h';
}

function formatAltitude(altitude) {
    const num = Number(altitude);
    return isNaN(num) ? '-' : num.toFixed(1) + ' m';
}

function formatAccuracy(accuracy) {
    const num = Number(accuracy);
    return isNaN(num) ? '-' : num.toFixed(1) + ' m';
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    try {
        // Try to create date, handle invalid inputs
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid date'; 

        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return 'Date error';
    }
}


// Handle sleep interval update
async function handleSleepIntervalUpdate(e) {
    e.preventDefault(); 

    if (!selectedDevice) {
        alert('Please select a device first.');
        return;
    }

    // Load values from new fields, with default value 0
    const days = parseInt(document.getElementById('interval-days').value || '0', 10);
    const hours = parseInt(document.getElementById('interval-hours').value || '0', 10);
    const minutes = parseInt(document.getElementById('interval-minutes').value || '0', 10);
    const seconds = parseInt(document.getElementById('interval-seconds').value || '0', 10);

    if (isNaN(days) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        displayAlert('Please enter valid numbers for the interval.', 'danger');
        return;
    }
    
     if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 || days < 0) {
        displayAlert('Please enter valid values (H: 0-23, M/S: 0-59, D >= 0).', 'danger');
        return;
    }

    // Calculate total number of seconds
    const totalSleepIntervalSeconds = dhmsToSeconds(days, hours, minutes, seconds);

    if (totalSleepIntervalSeconds < 1) {
        displayAlert('Minimum sleep interval is 1 second.', 'danger');
        return; 
    }
     if (totalSleepIntervalSeconds > 30 * 24 * 60 * 60) {
        displayAlert('Maximum sleep interval is 30 days.', 'danger');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/device_settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device: selectedDevice,
                sleep_interval: totalSleepIntervalSeconds
            })
        });

        const responseData = await response.json(); 

        if (response.ok) {
            displayAlert('Sleep interval settings saved successfully.', 'success');
            
            const dhms = secondsToDhms(responseData.new_sleep_interval_seconds);
            document.getElementById('interval-days').value = dhms.d;
            document.getElementById('interval-hours').value = dhms.h;
            document.getElementById('interval-minutes').value = dhms.m;
            document.getElementById('interval-seconds').value = dhms.s;

        } else {
            let errorMessage = 'Error saving settings.';
            if (responseData.errors && responseData.errors.length > 0) {
                errorMessage = responseData.errors[0].msg;
            } else if (responseData.error) {
                errorMessage = responseData.error;
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        displayAlert(`Error: ${error.message}`, 'danger');
    }
}

function displayAlert(message, type = 'info') {
    const settingsForm = document.getElementById('device-settings-form'); 
    if (!settingsForm) return; // If form does not exist

    let alertContainer = settingsForm.querySelector('.alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.className = 'alert-container mt-3'; // Add margin
        settingsForm.appendChild(alertContainer); 
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    while (alertContainer.firstChild) {
        alertContainer.removeChild(alertContainer.firstChild);
    }

    alertContainer.appendChild(alert);

    const bsAlert = new bootstrap.Alert(alert);
    setTimeout(() => {
        bsAlert.close();
    }, 5000);
}

async function handleDeleteDevice(deviceName) {
    if (!confirm(`Are you sure you want to delete the device "${deviceName}" and all its associated data? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/device/${deviceName}`, {
            method: 'DELETE',
        });

        const responseData = await response.json();

        if (response.ok) {
            displayAlert(responseData.message || `Device "${deviceName}" deleted successfully.`, 'success');
            loadDevices(); // Refresh the device list
            // If the deleted device was the selected one, clear the selection and hide details
            if (selectedDevice === deviceName) {
                selectedDevice = null;
                document.getElementById('device-settings-card').style.display = 'none';
                // Clear map and table
                if (map) {
                    map.eachLayer(layer => {
                        if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                            map.removeLayer(layer);
                        }
                    });
                }
                 if (polyline) {
                    map.removeLayer(polyline);
                    polyline = null;
                }
                document.getElementById('positions-table').innerHTML = '<tr><td colspan="7" class="text-muted">Select a device to see its history.</td></tr>';
                 document.getElementById('history-map').style.visibility = 'hidden'; // Hide map initially
            }
        } else {
            displayAlert(responseData.error || `Failed to delete device "${deviceName}".`, 'danger');
        }
    } catch (error) {
        displayAlert(`An error occurred: ${error.message}`, 'danger');
    }
}