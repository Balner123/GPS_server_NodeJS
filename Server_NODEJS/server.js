const express = require("express");
const rateLimit = require("express-rate-limit");
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();
app.set('trust proxy', 1); // Trust first proxy
const port = process.env.PORT || 5000;

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware (order is important)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public'))); // Static files are public

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'a_very_secret_key_that_should_be_in_env_file',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'using_ssl', // Should be true if using HTTPS
    httpOnly: true, // Prevent client-side script access
    sameSite: 'lax', // Mitigate CSRF
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// Flash middleware
app.use(flash());

// Middleware to make session status available in templates
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  res.locals.user = req.session.user || null;
  next();
});

// Rate limiting (applies to all subsequent routes)
const limiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX || 300
});
app.use(limiter);

// Routes
app.use('/', require('./routes/index'));
app.use(require('./routes/auth'));
app.use(require('./routes/verify-email-change'));
app.use(require('./routes/devices'));
app.use(require('./routes/register-device'));
app.use(require('./routes/settings'));
app.use(require('./routes/administration')); // Nová cesta pro administraci
app.use('/api/apk', require('./routes/apk')); // Nová routa pro APK

// Error handling middleware
app.use((err, res, next) => {
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