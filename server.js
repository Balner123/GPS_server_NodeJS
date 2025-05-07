const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const db = require("./database");
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs'); // Budeme potřebovat pro porovnání hesel

const app = express();
const port = process.env.PORT || 5000;

// Nastavení view engine na EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware (pořadí je důležité)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
app.use(express.static(path.join(__dirname, 'public'))); // Statické soubory jsou veřejné

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'b4b1dcd41017a113f49a8fecb9500572cf1b99a52cf0cbdf9d081948dfe0f677cf934fd90d258103db8ec31d68cb1544',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'using_ssl', 
    maxAge: 1000 * 60 * 60 * 6 
  }
}));

// Middleware pro zpřístupnění informací o uživateli v šablonách (závisí na session)
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

// Rate limiting (aplikuje se na všechny následující routy)
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW * 60 * 1000 || 5 * 1000,
  max: process.env.RATE_LIMIT_MAX || 40
});
app.use(limiter);

// Definiice validačních middleware (zůstávají, jak jsou)
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
  body('sleep_interval').isInt({ min: 1, max: 3600 })
];

// --- Autentizační a Autorizační Middleware ---
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  // Volitelně: uložit původní URL pro přesměrování po přihlášení
  // req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function isRoot(req, res, next) {
  if (req.session.username === 'root') {
    return next();
  }
  // Můžete zde renderovat chybovou stránku nebo poslat jen status
  res.status(403).send('Přístup odepřen. Tato akce vyžaduje administrátorská oprávnění.');
}

// --- Veřejné Routy ---
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' }); // user: null je již řešeno přes res.locals.currentUser
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Prosím, zadejte uživatelské jméno i heslo.', currentPage: 'login' });
  }
  try {
    const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.render('login', { error: 'Neplatné uživatelské jméno nebo heslo.', currentPage: 'login' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      req.session.userId = user.id;
      req.session.username = user.username;
      // const returnTo = req.session.returnTo || '/'; // Pro přesměrování na původní URL
      // delete req.session.returnTo;
      // return res.redirect(returnTo);
      return res.redirect('/');
    } else {
      return res.render('login', { error: 'Neplatné uživatelské jméno nebo heslo.', currentPage: 'login' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render('login', { error: 'Došlo k chybě serveru. Zkuste to prosím později.', currentPage: 'login' });
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

// --- Chráněné Routy (vyžadují přihlášení) ---

// Chráněné stránky
app.get('/', isAuthenticated, (req, res) => {
  res.render('index', { currentPage: 'index' }); 
});

app.get('/device', isAuthenticated, (req, res) => {
  res.render('device', { currentPage: 'device' });
});

// Chráněné API endpointy
app.get("/device_settings/:device", isAuthenticated, async (req, res) => {
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

// API endpoint chráněný pro root uživatele
app.post("/device_settings", isAuthenticated, isRoot, validateSleepInterval, async (req, res) => {
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

app.post("/device_input", isAuthenticated, validateCoordinates, async (req, res) => {
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

// --- Routy pro nastavení uživatelského účtu ---
app.get('/user_settings', isAuthenticated, (req, res) => {
  res.render('user_settings', {
    currentPage: 'user-settings',
    success_message: req.query.success_message, // Pro zobrazení úspěšné hlášky po přesměrování
    error_message: req.query.error_message,   // Pro zobrazení chybové hlášky po přesměrování
    errors_username: null, // Případné validační chyby pro jméno
    errors_password: null  // Případné validační chyby pro heslo
  });
});

app.post('/user_settings/username', isAuthenticated, [
  body('newUsername').trim().notEmpty().withMessage('Nové uživatelské jméno nesmí být prázdné.')
    .isLength({ min: 3 }).withMessage('Uživatelské jméno musí mít alespoň 3 znaky.')
    .custom(async (value, { req }) => {
      if (value === req.session.username) {
        throw new Error('Nové uživatelské jméno je stejné jako aktuální.');
      }
      const [users] = await db.execute('SELECT id FROM users WHERE username = ?', [value]);
      if (users.length > 0) {
        throw new Error('Uživatelské jméno je již obsazeno.');
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
      error_message: 'Opravte prosím chyby ve formuláři.'
    });
  }

  try {
    const newUsername = req.body.newUsername;
    await db.execute('UPDATE users SET username = ? WHERE id = ?', [newUsername, req.session.userId]);
    req.session.username = newUsername; // Aktualizace jména v session
    res.locals.currentUser.username = newUsername; // Aktualizace jména pro aktuální render
    res.redirect('/user_settings?success_message=Uživatelské jméno bylo úspěšně změněno.');
  } catch (err) {
    console.error("Error updating username:", err);
    res.redirect('/user_settings?error_message=Došlo k chybě při změně uživatelského jména.');
  }
});

app.post('/user_settings/password', isAuthenticated, [
  body('oldPassword').notEmpty().withMessage('Staré heslo nesmí být prázdné.'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nové heslo musí mít alespoň 6 znaků.'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Potvrzení hesla se neshoduje s novým heslem.');
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
      error_message: 'Opravte prosím chyby ve formuláři.'
    });
  }

  try {
    const { oldPassword, newPassword } = req.body;
    const [users] = await db.execute('SELECT password FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0) {
      return res.redirect('/user_settings?error_message=Uživatel nenalezen.'); // Nemělo by nastat
    }
    const user = users[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.render('user_settings', {
        currentPage: 'user-settings',
        errors_username: null,
        errors_password: [{ path: 'oldPassword', msg: 'Staré heslo není správné.' }],
        error_message: 'Staré heslo není správné.'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.session.userId]);

    res.redirect('/user_settings?success_message=Heslo bylo úspěšně změněno.');
  } catch (err) {
    console.error("Error updating password:", err);
    res.redirect('/user_settings?error_message=Došlo k chybě při změně hesla.');
  }
});

// Error handling middleware (MUSÍ BÝT POSLEDNÍ, po všech routách)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  // Pokud jde o chybu validace, mohlo by se vrátit JSON, jinak obecná chyba
  if (res.headersSent) {
    return next(err);
  }
  // Zde byste mohli mít sofistikovanější error handling
  res.status(500).json({ error: 'Došlo k neočekávané chybě na serveru!' });
});

// Spuštění serveru (MUSÍ BÝT ÚPLNĚ NA KONCI)
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});