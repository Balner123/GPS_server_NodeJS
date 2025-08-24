const db = require('../database'); // Správný způsob importu
const { validationResult } = require('express-validator');

// ... (všechny ostatní funkce v souboru zůstávají v původní, správné podobě)

const getDeviceSettings = async (req, res) => { /* ... */ };
const updateDeviceSettings = async (req, res) => { /* ... */ };
const handleDeviceInput = async (req, res) => { /* ... */ };
const getCurrentCoordinates = async (req, res) => { /* ... */ };
const getDeviceData = async (req, res) => { /* ... */ };
const deleteDevice = async (req, res) => { /* ... */ };
const getDevicesPage = async (req, res) => { /* ... */ };
const addDeviceToUser = async (req, res) => { /* ... */ };
const removeDeviceFromUser = async (req, res) => { /* ... */ };
const getRegisterDevicePage = async (req, res) => { /* ... */ };

// Jediná upravená funkce s opraveným přístupem k DB
const registerDeviceFromApk = async (req, res) => {
    const { installationId, deviceName } = req.body;
    
    if (!req.session.user || !req.session.user.id) {
        return res.status(401).json({ success: false, error: 'Uživatel není přihlášen.' });
    }

    if (!installationId || !deviceName) {
        return res.status(400).json({ success: false, error: 'Chybí ID zařízení nebo jeho název.' });
    }

    try {
        const userId = req.session.user.id;

        // OPRAVA: Použití správného tvaru db.Device
        const existingDevice = await db.Device.findOne({
            where: {
                user_id: userId,
                device_id: installationId
            }
        });

        if (existingDevice) {
            return res.status(200).json({ success: true, message: 'Zařízení již bylo registrováno.' });
        }

        // OPRAVA: Použití správného tvaru db.Device
        await db.Device.create({
            user_id: userId,
            device_id: installationId,
            device_name: deviceName
        });

        res.status(201).json({ success: true, message: 'Zařízení úspěšně registrováno.' });

    } catch (error) {
        console.error('Chyba při registraci zařízení z APK:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ success: false, error: 'Toto ID zařízení již existuje.' });
        }
        res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
    }
};


module.exports = {
  getDeviceSettings,
  updateDeviceSettings,
  registerDeviceFromApk,
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  deleteDevice,
  getDevicesPage,
  getRegisterDevicePage,
  addDeviceToUser,
  removeDeviceFromUser,
};