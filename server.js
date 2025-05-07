const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const db = require("./database");
require('dotenv').config();
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Nastavení view engine na EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX
});
app.use(limiter);

// Validation middleware
const validateCoordinates = [
  body('device').isString().trim().escape(),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('speed').optional().isFloat({ min: 0, max: 1000 }),
  body('altitude').optional().isFloat({ min: -1000, max: 10000 }),
  body('accuracy').optional().isFloat({ min: 0, max: 100 }),
  body('satellites').optional().isInt({ min: 0, max: 50 })
];

const validateSleepInterval = [
  body('device').isString().trim().escape(),
  body('sleep_interval').isInt({ min: 1, max: 3600 }) // 1 sekunda až 1 hodina
];

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Endpoint pro získání nastavení zařízení
app.get("/device_settings/:device", async (req, res) => {
  try {
    const deviceName = req.params.device;
    const [rows] = await db.execute(
      'SELECT sleep_interval FROM devices WHERE name = ?',
      [deviceName]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint pro aktualizaci odmlky zařízení (pouze pro administraci)
app.post("/device_settings", validateSleepInterval, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { device, sleep_interval } = req.body;

    const [result] = await db.execute(
      `UPDATE devices 
       SET sleep_interval = ?, 
           sleep_interval_updated_at = CURRENT_TIMESTAMP 
       WHERE name = ?`,
      [sleep_interval, device]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ message: 'Sleep interval updated successfully' });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/device_input", validateCoordinates, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { device, longitude, latitude, speed, altitude, accuracy, satellites } = req.body;

    // Získání nebo vytvoření zařízení
    const [deviceResult] = await db.execute(
      'INSERT INTO devices (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      [device]
    );
    const deviceId = deviceResult.insertId;

    // Vložení lokace s rozšířenými daty
    const [locationResult] = await db.execute(
      'INSERT INTO locations (device_id, longitude, latitude, speed, altitude, accuracy, satellites) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [deviceId, longitude, latitude, speed || null, altitude || null, accuracy || null, satellites || null]
    );

    // Aktualizace last_seen
    await db.execute(
      'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [deviceId]
    );

    // Získání aktuálního nastavení odmlky
    const [settings] = await db.execute(
      'SELECT sleep_interval FROM devices WHERE id = ?',
      [deviceId]
    );

    res.status(200).json({ 
      id: locationResult.insertId,
      sleep_interval: settings[0].sleep_interval
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/current_coordinates", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT d.name as device, l.longitude, l.latitude, l.timestamp
      FROM devices d
      LEFT JOIN locations l ON d.id = l.device_id
      WHERE d.status = 'active'
      AND l.id IN (
        SELECT MAX(id)
        FROM locations
        GROUP BY device_id
      )
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Routa pro hlavní stránku - renderuje index.ejs
app.get("/", (req, res) => {
  res.render('index', { currentPage: 'index' }); 
});

app.get("/device", (req, res) => {
  res.render('device', { currentPage: 'device' });
});

app.get("/device_data", async (req, res) => {
  try {
    const deviceName = req.query.name;
    const [rows] = await db.execute(`
      SELECT l.longitude, l.latitude, l.timestamp, l.speed, l.altitude, l.accuracy, l.satellites
      FROM locations l
      JOIN devices d ON l.device_id = d.id
      WHERE d.name = ?
      ORDER BY l.timestamp DESC
    `, [deviceName]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(rows);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});