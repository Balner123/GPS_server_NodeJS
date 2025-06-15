const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const db = require("./database");
require('dotenv').config();
const path = require('path');
const session = require('express-session');

// Route imports
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const indexRoutes = require('./routes/index');
const settingsRoutes = require('./routes/settings');

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

// Middleware to make session status available in templates
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  next();
});

// Rate limiting (applies to all subsequent routes)
const limiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX || 300
});
app.use(limiter);

// Routes
app.use('/', indexRoutes);
app.use(authRoutes);
app.use(deviceRoutes);
app.use(settingsRoutes);

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