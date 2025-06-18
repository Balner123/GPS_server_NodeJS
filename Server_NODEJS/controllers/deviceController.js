const { Device, Location, sequelize, Sequelize } = require('../database');
const { validationResult } = require('express-validator');

const getDeviceSettings = async (req, res) => {
  try {
    const deviceName = req.params.device;
    const device = await Device.findOne({ where: { name: deviceName } });
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
    const { device: deviceName, sleep_interval } = req.body;
    
    const [affectedRows] = await Device.update(
      { sleep_interval, sleep_interval_updated_at: new Date() },
      { where: { name: deviceName } }
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
  const t = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await t.rollback();
      return res.status(400).json({ errors: errors.array() });
    }
    const { device: deviceName, longitude, latitude, speed, altitude, accuracy, satellites } = req.body;
    
    const [device] = await Device.findOrCreate({
      where: { name: deviceName },
      defaults: { name: deviceName },
      transaction: t
    });

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
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getCurrentCoordinates = async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { status: 'active' },
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
        device: d.name,
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
    const deviceName = req.query.name;
    const device = await Device.findOne({
      where: { name: deviceName },
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
  const deviceName = req.params.deviceName;
  if (!deviceName) {
    return res.status(400).json({ error: 'Device name is required.' });
  }

  try {
    const device = await Device.findOne({ where: { name: deviceName } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    
    await device.destroy(); // This will also delete associated locations due to ON DELETE CASCADE

    res.status(200).json({ message: `Device '${deviceName}' and all its data have been deleted successfully.` });
  } catch (err) {
    console.error(`Error deleting device ${deviceName}:`, err);
    res.status(500).json({ error: 'Failed to delete device. An internal server error occurred.' });
  }
};

module.exports = {
  getDeviceSettings,
  updateDeviceSettings,
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  deleteDevice,
}; 