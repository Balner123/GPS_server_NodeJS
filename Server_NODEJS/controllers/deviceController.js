const db = require('../database');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { sendGeofenceAlertEmail, sendGeofenceReturnEmail } = require('../utils/emailSender');

// --- Geofencing Helper Functions ---

/**
 * Checks if a GPS point is inside a polygon.
 * @param {object} point - The point to check, with 'latitude' and 'longitude'.
 * @param {Array<Array<number>>} polygon - An array of [longitude, latitude] pairs.
 * @returns {boolean} - True if the point is inside, false otherwise.
 */
function isPointInPolygon(point, polygon) {
    const x = point.longitude, y = point.latitude;
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Checks if a GPS point is inside a circle.
 * @param {object} point - The point to check, with 'latitude' and 'longitude'.
 * @param {object} circle - The circle object with 'center' ([lng, lat]) and 'radius' in meters.
 * @returns {boolean} - True if the point is inside, false otherwise.
 */
function isPointInCircle(point, circle) {
    const { center, radius } = circle;
    const R = 6371e3; // Earth's radius in meters
    const lat1 = point.latitude * Math.PI / 180;
    const lat2 = center[1] * Math.PI / 180;
    const deltaLat = (center[1] - point.latitude) * Math.PI / 180;
    const deltaLng = (center[0] - point.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters
    return distance <= radius;
}

/**
 * Creates a geofence alert record in the database.
 * @param {object} device - The Sequelize device object.
 * @param {object} location - The location object that triggered the alert.
 */
async function createGeofenceAlertRecord(device, location) {
    console.log(`Creating geofence alert record for device: ${device.name || device.device_id}`);
    try {
        await db.Alert.create({
            device_id: device.id,
            user_id: device.user_id,
            type: 'geofence',
            message: `Device '${device.name || device.device_id}' has left the defined geofence area.`
        });
    } catch (error) {
        console.error('Failed to create geofence alert record:', error);
    }
}

function generateGpx(deviceName, locations) {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS Server" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${deviceName} - GPS Track</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${deviceName}</name>
    <trkseg>`;

    locations.forEach(loc => {
        gpx += `
      <trkpt lat="${loc.latitude}" lon="${loc.longitude}">
        <ele>${loc.altitude || 0}</ele>
        <time>${new Date(loc.timestamp).toISOString()}</time>
        <speed>${loc.speed || 0}</speed>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;
    return gpx;
}

// --- End Geofencing Helpers ---



const getDeviceSettings = async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const device = await db.Device.findOne({ 
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      } 
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({
      interval_gps: device.interval_gps,
      interval_send: device.interval_send,
      satellites: device.satellites,
      geofence: device.geofence,
      created_at: device.created_at,
      device_type: device.device_type // ADDED THIS LINE
    });
  } catch (err) {
    console.error("Error getting device settings:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateDeviceSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { deviceId, interval_gps, interval_send, satellites } = req.body;

    const [affectedRows] = await db.Device.update(
      { interval_gps, interval_send, satellites },
      { where: {
          device_id: deviceId,
          user_id: req.session.user.id 
        } 
      }
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Device not found or no changes made' });
    }
    res.json({ success: true, message: 'Settings updated successfully' }); 
  } catch (err) {
    console.error("Error in updateDeviceSettings:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleDeviceInput = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let dataPoints = Array.isArray(req.body) ? req.body : [req.body];
    
    if (dataPoints.length === 0) {
        return res.status(400).json({ error: 'Request body cannot be empty.' });
    }

    const firstPoint = dataPoints[0];
    const { device: deviceId, name } = firstPoint;

    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is missing in the payload.' });
    }

    const device = await db.Device.findOne({ 
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      } 
    });

    if (!device) {
      // Check if the device exists at all to give a more specific error
      const deviceExists = await db.Device.findOne({ where: { device_id: deviceId } });
      if (deviceExists) {
        // Device exists but doesn't belong to this user
        return res.status(403).json({ 
          error: `Forbidden. You do not have permission to send data for device ID ${deviceId}.` 
        });
      }
      // Device is not registered at all
      return res.status(404).json({ 
        registered: false,
        message: `Device with ID ${deviceId} is not registered.` 
      });
    }

    const t = await db.sequelize.transaction();
    let lastLocation;
    try {
      const locationsToCreate = dataPoints.map(point => {
        if (point.latitude === undefined || point.longitude === undefined) {
            throw new Error('Each data point in the array must have latitude and longitude.');
        }
        return {
          device_id: device.id,
          user_id: device.user_id, // <-- FIX: Add user_id from the device
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed !== undefined ? point.speed : null,
          altitude: point.altitude !== undefined ? point.altitude : null,
          accuracy: point.accuracy !== undefined ? point.accuracy : null,
          satellites: point.satellites !== undefined ? point.satellites : null,
          timestamp: point.timestamp && new Date(point.timestamp).getTime() > 0 ? new Date(point.timestamp) : new Date() 
        };
      });

      if (locationsToCreate.length > 0) {
        await db.Location.bulkCreate(locationsToCreate, { transaction: t, validate: true });
        lastLocation = locationsToCreate[locationsToCreate.length - 1];
      }

      device.last_seen = new Date();
      await device.save({ transaction: t });
      
      await t.commit();
      
      // --- Geofence Check ---
      if (lastLocation && device.geofence) {
        const geofence = device.geofence;
        let isInside = false;

        if (geofence.type === 'circle') {
            const circle = { center: [geofence.lng, geofence.lat], radius: geofence.radius };
            isInside = isPointInCircle(lastLocation, circle);
        } else if (geofence.type === 'Feature') { // GeoJSON for polygon
            isInside = isPointInPolygon(lastLocation, geofence.geometry.coordinates[0]);
        }

        const user = await device.getUser();

        // Case 1: Device is OUTSIDE and alert is NOT active yet
        if (!isInside && !device.geofence_alert_active) {
            console.log(`Device ${device.device_id} left geofence. Triggering alert.`);
            device.geofence_alert_active = true;
            await device.save(); // Save the new alert state
            await createGeofenceAlertRecord(device, lastLocation); // Create DB record
            if (user && user.email) {
                await sendGeofenceAlertEmail(user.email, device, lastLocation);
            }
        }
        // Case 2: Device is INSIDE and alert IS active
        else if (isInside && device.geofence_alert_active) {
            console.log(`Device ${device.device_id} returned to geofence. Resolving alert.`);
            device.geofence_alert_active = false;
            await device.save(); // Save the new alert state
            if (user && user.email) {
                await sendGeofenceReturnEmail(user.email, device, lastLocation);
            }
        }
      }
      // --- End Geofence Check ---

      res.status(200).json({ 
        success: true,
        message: `${locationsToCreate.length} location(s) recorded.`,
        interval_gps: device.interval_gps,
        interval_send: device.interval_send,
        satellites: device.satellites
      });

    } catch (err) {
      await t.rollback();
      console.error("Error in handleDeviceInput transaction:", err);
      if (err.message.includes('latitude and longitude')) {
          return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'An error occurred during the database transaction.' });
    }
  } catch (err) {
      console.error("Error in handleDeviceInput:", err);
      res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

const getCurrentCoordinates = async (req, res) => {
  try {
    const devices = await db.Device.findAll({
      where: { 
        status: 'active',
        user_id: req.session.user.id
      },
      include: [
        {
          model: db.Location,
          where: {
            id: {
              [db.Sequelize.Op.in]: db.sequelize.literal(`(SELECT MAX(id) FROM locations GROUP BY device_id)`)
            }
          },
          required: true
        },
        {
          model: db.Alert,
          where: { is_read: false },
          required: false
        }
      ]
    });

    const coordinates = devices.map(d => {
      const latestLocation = d.Locations[0];
      return {
        device: d.device_id,
        name: d.name,
        longitude: latestLocation.longitude,
        latitude: latestLocation.latitude,
        timestamp: latestLocation.timestamp,
        has_unread_alerts: d.Alerts && d.Alerts.length > 0
      };
    });

    res.json(coordinates);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Vypočítá vzdálenost mezi dvěma GPS souřadnicemi v metrech.
 * @param {number} lat1 Zeměpisná šířka prvního bodu.
 * @param {number} lon1 Zeměpisná délka prvního bodu.
 * @param {number} lat2 Zeměpisná šířka druhého bodu.
 * @param {number} lon2 Zeměpisná délka druhého bodu.
 * @returns {number} Vzdálenost v metrech.
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Poloměr Země v metrech
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Vzdálenost v metrech
}

/**
 * Agreguje pole GPS lokací na základě jejich vzájemné vzdálenosti.
 * @param {Array<object>} locations - Pole objektů lokací, seřazené podle času.
 * @param {number} distanceThreshold - Práh vzdálenosti v metrech pro sloučení.
 * @returns {Array<object>} - Pole s agregovanými lokacemi.
 */
function clusterLocations(locations, distanceThreshold) {
  if (locations.length < 2) {
    return locations;
  }

  const clusteredLocations = [];
  let i = 0;

  while (i < locations.length) {
    const currentPoint = locations[i];
    const cluster = [currentPoint];
    let j = i + 1;

    while (j < locations.length) {
      const previousPointInCluster = cluster[cluster.length - 1];
      const nextPoint = locations[j];
      
      const distance = getHaversineDistance(
        previousPointInCluster.latitude,
        previousPointInCluster.longitude,
        nextPoint.latitude,
        nextPoint.longitude
      );

      if (distance < distanceThreshold) {
        cluster.push(nextPoint);
        j++;
      } else {
        break;
      }
    }

    if (cluster.length > 1) {
      const totalLat = cluster.reduce((sum, point) => sum + point.latitude, 0);
      const totalLon = cluster.reduce((sum, point) => sum + point.longitude, 0);
      
      const mergedPoint = {
        latitude: totalLat / cluster.length,
        longitude: totalLon / cluster.length,
        startTime: cluster[0].timestamp,
        endTime: cluster[cluster.length - 1].timestamp,
        type: 'cluster',
        device_id: currentPoint.device_id,
        clusterThreshold: distanceThreshold, // Pass threshold to frontend
        originalPoints: cluster 
      };
      clusteredLocations.push(mergedPoint);
    } else {
      clusteredLocations.push(currentPoint);
    }
    
    i = j; // Posuneme hlavní index za zpracovaný shluk
  }

  return clusteredLocations;
}


const getDeviceData = async (req, res) => {
  try {
    const deviceId = req.query.id;
    const device = await db.Device.findOne({
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    // Načteme lokace seřazené VZESTUPNĚ pro správnou funkci algoritmu
    const rawLocations = await db.Location.findAll({
      where: { device_id: device.id },
      order: [['timestamp', 'ASC']] 
    });

    const DISTANCE_THRESHOLD_METERS = 25; // Updated threshold
    const processedLocations = clusterLocations(rawLocations, DISTANCE_THRESHOLD_METERS);

    res.json(processedLocations);

  } catch (err) {
    console.error("Error in getDeviceData:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteDevice = async (req, res) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required.' });
  }

  const t = await db.sequelize.transaction(); // Start transaction

  try {
    // Find device to get its internal ID. Admin (root) can delete any device.
    const findOptions = { where: { device_id: deviceId } };
    if (!req.session.user.isRoot) {
        findOptions.where.user_id = req.session.user.id;
    }

    const device = await db.Device.findOne(findOptions);

    if (!device) {
      await t.rollback();
      return res.status(404).json({ error: 'Device not found or you do not have permission to delete it.' });
    }

    // 1. Manually delete associated locations
    await db.Location.destroy({ where: { device_id: device.id }, transaction: t });

    // 2. Manually delete associated alerts
    await db.Alert.destroy({ where: { device_id: device.id }, transaction: t });

    // 3. Finally, delete the device itself
    await device.destroy({ transaction: t });

    await t.commit(); // Commit the transaction

    res.status(200).json({ message: `Device '${deviceId}' and all its data have been deleted successfully.` });
  } catch (err) {
    await t.rollback(); // Rollback on any error
    console.error(`Error deleting device ${deviceId}:`, err);
    res.status(500).json({ error: 'Failed to delete device. An internal server error occurred.' });
  }
};

const removeDeviceFromUser = async (req, res) => {
  const { deviceId } = req.params;
  try {
    const device = await db.Device.findOne({ 
      where: { 
        device_id: deviceId, 
        user_id: req.session.user.id 
      } 
    });

    if (!device) {
      req.flash('error', 'Device not found or you do not have permission to remove it.');
      return res.redirect('/devices');
    }

    await device.destroy();

    req.flash('success', `Registration for device "${deviceId}" has been successfully canceled.`);
    res.redirect('/devices');

  } catch (err) {
    console.error("Error removing device from user:", err);
    req.flash('error', 'Error during device removal.');
    res.redirect('/devices');
  }
};

const getDevicesPage = async (req, res) => {
  try {
    const userDevices = await db.Device.findAll({
      where: { user_id: req.session.user.id },
      order: [['created_at', 'DESC']]
    });
    res.render('manage-devices', { 
      devices: userDevices,
      error: req.flash('error'),
      success: req.flash('success'),
      currentPage: 'devices'
    });
  } catch (err) {
    console.error("Error fetching devices for management page:", err);
    res.status(500).render('manage-devices', { 
      devices: [], 
      error: ['Error loading your devices.'],
      success: null,
      currentPage: 'devices'
    });
  }
};

const registerDeviceFromApk = async (req, res) => {
    const { installationId, deviceName } = req.body;
    
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).json({ success: false, error: 'User is not logged in.' });
    }

    if (!installationId || !deviceName) {
        return res.status(400).json({ success: false, error: 'Missing device ID or name.' });
    }

    try {
        const userId = req.session.user.id;

        const existingDevice = await db.Device.findOne({
            where: {
                user_id: userId,
                device_id: installationId
            }
        });

        if (existingDevice) {
            return res.status(200).json({ success: true, message: 'Device is already registered.' });
        }

        await db.Device.create({
            user_id: userId,
            device_id: installationId,
            name: deviceName,
            device_type: 'APK' // Set device type
        });

        res.status(201).json({ success: true, message: 'Device registered successfully.' });

    } catch (error) {
        console.error('Error during device registration from APK:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, error: 'This device ID already exists.' });
        }
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

const registerDeviceFromHardware = async (req, res) => {
  const { username, password, deviceId, name } = req.body;

  if (!username || !password || !deviceId) {
    return res.status(400).json({ success: false, error: 'Missing username, password, or deviceId.' });
  }

  try {
    // 1. Authenticate user
    const user = await db.User.findOne({ where: { username: username } });

    // Also check if the user has a password set, to prevent bcrypt from crashing
    if (!user || !user.password) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // 2. Check if device exists
    const existingDevice = await db.Device.findOne({ where: { device_id: deviceId } });

    if (existingDevice) {
      if (existingDevice.user_id === user.id) {
        return res.status(200).json({ success: true, message: 'Device already registered to your account.' });
      } else {
        return res.status(409).json({ success: false, error: 'Device already registered to another user.' });
      }
    }

    // 3. Register new device
    await db.Device.create({
      device_id: deviceId,
      user_id: user.id,
      name: name || `Device ${deviceId.slice(0, 6)}`, // Default name if not provided
      device_type: 'HW' // Set device type
    });

    res.status(201).json({ success: true, message: 'Device registered successfully.' });

  } catch (error) {
    console.error('Error during hardware device registration:', error);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};



const updateDeviceName = async (req, res) => {
  const { deviceId, newName } = req.body;
  const userId = req.session.user.id;

  if (!deviceId || !newName) {
    return res.status(400).json({ success: false, error: 'Device ID and new name are required.' });
  }

  if (typeof newName !== 'string' || newName.trim().length === 0 || newName.length > 255) {
      return res.status(400).json({ success: false, error: 'Invalid name provided.' });
  }

  try {
    const [affectedRows] = await db.Device.update(
      { name: newName.trim() },
      { 
        where: { 
          device_id: deviceId,
          user_id: userId 
        } 
      }
    );

    if (affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to edit it.' });
    }

    res.json({ success: true, message: 'Device name updated successfully.' });

  } catch (err) {
    console.error("Error updating device name:", err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const updateGeofence = async (req, res) => {
  const { deviceId, geofence } = req.body;
  const userId = req.session.user.id;

  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Device ID is required.' });
  }

  if (geofence) { // Only validate if a geofence object is present
    if (typeof geofence !== 'object' || !geofence.type) {
        return res.status(400).json({ success: false, error: 'Invalid geofence data: missing type property.' });
    }
    // Validation for GeoJSON polygons
    if (geofence.type === 'Feature' && !geofence.geometry) {
        return res.status(400).json({ success: false, error: 'Invalid GeoJSON Feature: missing geometry property.' });
    }
    // Validation for custom circles
    if (geofence.type === 'circle' && (geofence.lat === undefined || geofence.lng === undefined || geofence.radius === undefined)) {
        return res.status(400).json({ success: false, error: 'Invalid circle object: missing lat, lng, or radius.' });
    }
  }

  try {
    const [affectedRows] = await db.Device.update(
      { geofence: geofence },
      { 
        where: { 
          device_id: deviceId,
          user_id: userId
        } 
      }
    );

    if (affectedRows > 0) {
    res.json({ success: true, message: 'Geofence updated successfully.' });
    } else {
    // Pokud byla geofence null a snažíme se ji znovu nastavit na null, není to chyba.
    // Záznam se neaktualizoval, ale stav je správný.
    if (geofence === null) {
        res.json({ success: true, message: 'Geofence removed.' });
    } else {
        return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to edit it.' });
    }
}

    res.json({ success: true, message: 'Geofence updated successfully.' });

  } catch (err) {
    console.error("Error updating geofence:", err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const getUnreadAlerts = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const devices = await db.Device.findAll({ where: { user_id: userId }, attributes: ['id'] });
    const deviceIds = devices.map(d => d.id);

    const alerts = await db.Alert.findAll({
      where: {
        device_id: deviceIds,
        is_read: false
      },
      order: [['created_at', 'DESC']]
    });

    res.json(alerts);

  } catch (err) {
    console.error("Error fetching unread alerts:", err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const markAlertsAsRead = async (req, res) => {
  try {
    const { alertIds } = req.body;
    const userId = req.session.user.id;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Alert IDs must be a non-empty array.' });
    }

    const devices = await db.Device.findAll({ where: { user_id: userId }, attributes: ['id'] });
    const userDeviceIds = devices.map(d => d.id);

    await db.Alert.update(
      { is_read: true },
      {
        where: {
          id: alertIds,
          device_id: userDeviceIds
        }
      }
    );

    res.json({ success: true, message: 'Alerts marked as read.' });

  } catch (err) {
    console.error("Error marking alerts as read:", err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const markDeviceAlertsAsRead = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.session.user.id;

    const device = await db.Device.findOne({
      where: { device_id: deviceId, user_id: userId },
      attributes: ['id']
    });

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found.' });
    }

    const unreadAlerts = await db.Alert.findAll({
      where: {
        device_id: device.id,
        is_read: false
      }
    });

    for (const alert of unreadAlerts) {
      alert.is_read = true;
      await alert.save({ timestamps: false });
    }

    res.json({ success: true, message: `Alerts for device ${deviceId} marked as read.` });

  } catch (err) {
    console.error("Error marking device alerts as read:", err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const exportDeviceDataAsGpx = async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const device = await db.Device.findOne({
      where: {
        device_id: deviceId,
        user_id: req.session.user.id
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const locations = await db.Location.findAll({
      where: { device_id: device.id },
      order: [['timestamp', 'ASC']]
    });

    if (locations.length === 0) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_no_data.txt"`);
        return res.status(404).send('No location data found for this device.');
    }

    const gpxData = generateGpx(device.name || device.device_id, locations);

    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_export.gpx"`);
    res.send(gpxData);

  } catch (err) {
    console.error("Error in exportDeviceDataAsGpx:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDeviceSettings,
  updateDeviceSettings,
  updateDeviceName,
  updateGeofence,
  getUnreadAlerts,
  markAlertsAsRead,
  markDeviceAlertsAsRead,
  registerDeviceFromApk,
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  deleteDevice,
  getDevicesPage,
  removeDeviceFromUser,
  registerDeviceFromHardware,
  exportDeviceDataAsGpx
};