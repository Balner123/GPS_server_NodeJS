const db = require('../database');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { sendGeofenceAlertEmail } = require('../utils/emailSender');

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
 * Triggers a geofence alert.
 * @param {object} device - The Sequelize device object.
 * @param {object} location - The location object that triggered the alert.
 */
async function triggerGeofenceAlert(device, location) {
    console.log(`Geofence alert for device: ${device.name || device.device_id}`);
    try {
        // 1. Save alert to the database
        await db.Alert.create({
            device_id: device.id,
            type: 'geofence',
            message: `Device '${device.name || device.device_id}' has left the defined geofence area.`
        });

        // 2. Send email to the user
        const user = await device.getUser();
        if (user && user.email) {
            await sendGeofenceAlertEmail(user.email, device, location);
        }
    } catch (error) {
        console.error('Failed to trigger geofence alert:', error);
    }
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
      geofence: device.geofence
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
    const { deviceId, interval_gps, interval_send } = req.body;
    
    const [affectedRows] = await db.Device.update(
      { interval_gps, interval_send },
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

    const device = await db.Device.findOne({ where: { device_id: deviceId } });

    if (!device) {
      return res.status(403).json({ 
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

        if (!isInside) {
            triggerGeofenceAlert(device, lastLocation);
        }
      }
      // --- End Geofence Check ---

      res.status(200).json({ 
        success: true,
        message: `${locationsToCreate.length} location(s) recorded.`,
        interval_gps: device.interval_gps,
        interval_send: device.interval_send
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

const getDeviceData = async (req, res) => {
  try {
    const deviceId = req.query.id;
    const device = await db.Device.findOne({
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      },
      include: [{
        model: db.Location,
        order: [['timestamp', 'DESC']]
      }]
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device.Locations);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteDevice = async (req, res) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required.' });
  }

  try {
    const device = await db.Device.findOne({ where: { 
      device_id: deviceId,
      user_id: req.session.user.id 
    } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    
    await device.destroy();

    res.status(200).json({ message: `Device '${deviceId}' and all its data have been deleted successfully.` });
  } catch (err) {
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
            name: deviceName
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
      name: name || `Device ${deviceId.slice(0, 6)}` // Default name if not provided
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

    if (affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to edit it.' });
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
};