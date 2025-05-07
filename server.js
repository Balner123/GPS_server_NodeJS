const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const db = require("./database");
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 5000;

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware (order is important)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
app.use(express.static(path.join(__dirname, 'public'))); // Static files are public

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'b4b1dcd41017a113f49a8fecb9500572cf1b99a52cf0cbdf9d081948dfe0f677cf934fd90d258103db8ec31d68cb1544',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'using_ssl', // Should be true if using HTTPS
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// Middleware to make user information available in templates (depends on session)
app.use((req, res, next) => {
  if (req.session.userId && req.session.username) {
    res.locals.currentUser = { 
      id: req.session.userId,
      username: req.session.username 
    };
  } else {
    res.locals.currentUser = null;
  }
  next();
});

// Rate limiting (applies to all subsequent routes)
const limiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX || 300
});
app.use(limiter);

// Definition of validation middleware (remains as is)
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
  body('sleep_interval').isInt({ min: 1, max: 3600 * 24 * 30 }).withMessage('Sleep interval must be a valid integer of seconds (min 1s, max 30 days).') // Adjusted max limit
];

// --- Authentication and Authorization Middleware ---
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }

  res.redirect('/login');
}

function isRoot(req, res, next) {
  if (req.session.username === 'root') {
    return next();
  }

  res.status(403).send('Access denied. This action requires administrator privileges.');
}

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Please enter both username and password.', currentPage: 'login' });
  }
  try {
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.render('login', { error: 'Invalid username or password.', currentPage: 'login' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      req.session.userId = user.id;
      req.session.username = user.username;
      return res.redirect('/');
    } else {
      return res.render('login', { error: 'Invalid username or password.', currentPage: 'login' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render('login', { error: 'A server error occurred. Please try again later.', currentPage: 'login' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect('/'); 
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});


// Protected pages
app.get('/', isAuthenticated, (req, res) => {
  res.render('index', { currentPage: 'index' }); 
});

app.get('/device', isAuthenticated, (req, res) => {
  res.render('device', { currentPage: 'device' });
});

// Unprotected pages (for POST requests by devices)
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
    res.json({ message: 'Sleep interval updated successfully', new_sleep_interval_seconds: sleep_interval }); 
  } catch (err) {
    console.error("Error in /device_settings:", err);
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
    const [deviceResult] = await db.execute(
      'INSERT INTO devices (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      [device]
    );
    const deviceId = deviceResult.insertId;
    const [locationResult] = await db.execute(
      'INSERT INTO locations (device_id, longitude, latitude, speed, altitude, accuracy, satellites) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [deviceId, longitude, latitude, speed || null, altitude || null, accuracy || null, satellites || null]
    );
    await db.execute(
      'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [deviceId]
    );
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

app.get("/current_coordinates", isAuthenticated, async (req, res) => {
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

app.get("/device_data", isAuthenticated, async (req, res) => {
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

// --- User Account Settings Routes ---
app.get('/user_settings', isAuthenticated, (req, res) => {
  res.render('user_settings', {
    currentPage: 'user-settings',
    success_message: req.query.success_message, // For displaying success message after redirect
    error_message: req.query.error_message,   // For displaying error message after redirect
    errors_username: null, // Potential validation errors for username
    errors_password: null  // Potential validation errors for password
  });
});

app.post('/user_settings/username', isAuthenticated, [
  body('newUsername').trim().notEmpty().withMessage('New username cannot be empty.')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.')
    .custom(async (value, { req }) => {
      if (value === req.session.username) {
        throw new Error('New username is the same as the current one.');
      }
      const [users] = await db.execute('SELECT id FROM users WHERE username = ?', [value]);
      if (users.length > 0) {
        throw new Error('Username is already taken.');
      }
      return true;
    })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('user_settings', {
      currentPage: 'user-settings',
      errors_username: errors.array(),
      errors_password: null,
      error_message: 'Please correct the errors in the form.'
    });
  }

  try {
    const newUsername = req.body.newUsername;
    await db.execute('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.session.userId]);
    req.session.username = newUsername; // Update username in session
    res.locals.currentUser.username = newUsername; // Update username for current render
    res.redirect('/user_settings?success_message=Username successfully changed.');
  } catch (err) {
    console.error("Error updating username:", err);
    res.redirect('/user_settings?error_message=Error occurred while changing username.');
  }
});

app.post('/user_settings/password', isAuthenticated, [
  body('oldPassword').notEmpty().withMessage('Old password cannot be empty.'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match the new password.');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('user_settings', {
      currentPage: 'user-settings',
      errors_username: null,
      errors_password: errors.array(),
      error_message: 'Please correct the errors in the form.'
    });
  }

  try {
    const { oldPassword, newPassword } = req.body;
    const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0) {
      return res.redirect('/user_settings?error_message=User not found.');
    }
    const user = users[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.render('user_settings', {
        currentPage: 'user-settings',
        errors_username: null,
        errors_password: [{ path: 'oldPassword', msg: 'Old password is not correct.' }],
        error_message: 'Old password is not correct.'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.session.userId]);

    res.redirect('/user_settings?success_message=Password successfully changed.');
  } catch (err) {
    console.error("Error updating password:", err);
    res.redirect('/user_settings?error_message=Error occurred while changing password.');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'An unexpected server error occurred!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});