const { Device, Location, sequelize, Sequelize } = require('../database');
const { validationResult } = require('express-validator');

const getDeviceSettings = async (req, res) => {
  try {
    const deviceId = req.params.device;
    const device = await Device.findOne({ 
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      } 
    });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ sleep_interval: device.sleep_interval });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const updateDeviceSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { device: deviceId, sleep_interval } = req.body;
    
    const [affectedRows] = await Device.update(
      { sleep_interval, sleep_interval_updated_at: new Date() },
      { where: { 
          device_id: deviceId,
          user_id: req.session.user.id 
        } 
      }
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ success: true, message: 'Sleep interval updated successfully', new_sleep_interval_seconds: sleep_interval }); 
  } catch (err) {
    console.error("Error in /device_settings:", err);
    res.status(500).json({ error: err.message });
  }
};

const handleDeviceInput = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { device: deviceId, name, longitude, latitude, speed, altitude, accuracy, satellites } = req.body;
    
    const device = await Device.findOne({ where: { device_id: deviceId } });

    // If device is not registered in our system, silently ignore the request.
    if (!device) {
      // We send a 200 OK to not give away information about which devices are registered.
      return res.status(200).send(); 
    }

    const t = await sequelize.transaction();
    try {
      // Update device name if provided
      if (name && device.name !== name) {
        device.name = name;
      }

      const location = await Location.create({
        device_id: device.id,
        longitude,
        latitude,
        speed,
        altitude,
        accuracy,
        satellites
      }, { transaction: t });

      device.last_seen = new Date();
      await device.save({ transaction: t });
      
      await t.commit();
      
      res.status(200).json({ 
        id: location.id,
        sleep_interval: device.sleep_interval
      });
    } catch (err) {
      await t.rollback();
      console.error("Error in handleDeviceInput transaction:", err);
      res.status(500).json({ error: err.message });
    }
  } catch (err) {
      console.error("Error in handleDeviceInput:", err);
      res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

const getCurrentCoordinates = async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { 
        status: 'active',
        user_id: req.session.user.id
      },
      include: {
        model: Location,
        where: {
          id: {
            [Sequelize.Op.in]: sequelize.literal(`(SELECT MAX(id) FROM locations GROUP BY device_id)`)
          }
        },
        required: true
      }
    });

    const coordinates = devices.map(d => {
      const latestLocation = d.Locations[0];
      return {
        device: d.device_id,
        name: d.name,
        longitude: latestLocation.longitude,
        latitude: latestLocation.latitude,
        timestamp: latestLocation.timestamp,
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
    const deviceId = req.query.id; // ZMĚNA ZDE: Používáme 'id' z URL
    const device = await Device.findOne({
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      },
      include: [{
        model: Location,
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
    const device = await Device.findOne({ where: { 
      device_id: deviceId,
      user_id: req.session.user.id 
    } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    
    await device.destroy(); // This will also delete associated locations due to ON DELETE CASCADE

    res.status(200).json({ message: `Device '${deviceId}' and all its data have been deleted successfully.` });
  } catch (err) {
    console.error(`Error deleting device ${deviceId}:`, err);
    res.status(500).json({ error: 'Failed to delete device. An internal server error occurred.' });
  }
};

const getDevicesPage = async (req, res) => {
  try {
    const userDevices = await Device.findAll({
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
      error: ['Došlo k chybě při načítání vašich zařízení.'],
      success: null,
      currentPage: 'devices'
    });
  }
};

const addDeviceToUser = async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId || deviceId.length !== 10) {
    req.flash('error', 'Je vyžadováno platné 10místné ID zařízení.');
    return res.redirect('/register-device');
  }

  try {
    const existingDevice = await Device.findOne({ where: { device_id: deviceId } });

    if (existingDevice) {
      req.flash('error', `Zařízení s ID "${deviceId}" je již registrováno v systému.`);
      return res.redirect('/register-device');
    }

    await Device.create({
      device_id: deviceId,
      user_id: req.session.user.id
    });

    req.flash('success', `Zařízení "${deviceId}" bylo úspěšně registrováno.`);
    res.redirect('/devices');

  } catch (err) {
    console.error("Error adding device to user:", err);
    if (err.name === 'SequelizeUniqueConstraintError') {
       req.flash('error', `Zařízení s ID "${deviceId}" je již registrováno v systému.`);
    } else {
       req.flash('error', 'Došlo k chybě při registraci zařízení.');
    }
    res.redirect('/register-device');
  }
};

const removeDeviceFromUser = async (req, res) => {
  const { deviceId } = req.params;
  try {
    const device = await Device.findOne({ 
      where: { 
        device_id: deviceId, 
        user_id: req.session.user.id 
      } 
    });

    if (!device) {
      req.flash('error', 'Zařízení nebylo nalezeno nebo k němu nemáte oprávnění.');
      return res.redirect('/devices');
    }

    await device.destroy();

    req.flash('success', `Registrace pro zařízení "${deviceId}" byla úspěšně zrušena.`);
    res.redirect('/devices');

  } catch (err) {
    console.error("Error removing device from user:", err);
    req.flash('error', 'Došlo k chybě při odebírání zařízení.');
    res.redirect('/devices');
  }
};

const getRegisterDevicePage = async (req, res) => {
  try {
    const userDevices = await Device.findAll({
      where: { user_id: req.session.user.id },
      order: [['created_at', 'DESC']]
    });
    res.render('register-device', { 
      devices: userDevices,
      error: req.flash('error'),
      success: req.flash('success'),
      currentPage: 'register-device'
    });
  } catch (err) {
    console.error("Error fetching devices for register page:", err);
    res.render('register-device', { 
      devices: [], 
      error: ['Došlo k chybě při načítání vašich zařízení.'],
      success: null,
      currentPage: 'register-device'
    });
  }
};

const registerDeviceApk = async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId || !/^[a-zA-Z0-9]{10}$/.test(deviceId)) {
    return res.status(400).json({ success: false, error: 'Valid 10-character device ID is required.' });
  }

  try {
    const existingDevice = await Device.findOne({ where: { device_id: deviceId } });

    if (existingDevice) {
      return res.status(409).json({ success: false, error: `Device with ID "${deviceId}" is already registered.` });
    }

    const newDevice = await Device.create({
      device_id: deviceId,
      user_id: req.session.user.id
    });

    return res.status(201).json({ success: true, message: `Device "${deviceId}" was successfully registered.`, device: newDevice });

  } catch (err) {
    console.error("Error registering device via APK:", err);
    if (err.name === 'SequelizeUniqueConstraintError') {
       return res.status(409).json({ success: false, error: `Device with ID "${deviceId}" is already registered.` });
    } else {
       return res.status(500).json({ success: false, error: 'An internal server error occurred during device registration.' });
    }
  }
};


module.exports = {
  getDeviceSettings,
  updateDeviceSettings,
  registerDeviceApk,
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  deleteDevice,
  getDevicesPage,
  getRegisterDevicePage,
  addDeviceToUser,
  removeDeviceFromUser,
}; 