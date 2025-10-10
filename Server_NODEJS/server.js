const express = require("express");
const rateLimit = require("express-rate-limit");
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerDef');

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
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'using_ssl', // Should be true if using HTTPS
    httpOnly: true, // Prevent client-side script access
    sameSite: 'lax', // Mitigate CSRF
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// Passport middleware (must be after session)
const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Flash middleware
app.use(flash());

const { checkPasswordPrompt } = require('./middleware/prompt');

// Middleware to make session status available in templates
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated || false;
  res.locals.user = req.session.user || null;
  next();
});

// Middleware to check if a password prompt should be shown
app.use(checkPasswordPrompt);

// Rate limiting (applies to all subsequent routes)
const limiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX || 300
});
app.use(limiter);

// --- Routes ---

// Web routes (rendering pages)
app.use('/', require('./routes/index'));
app.use('/', require('./routes/auth.web'));
app.use('/auth', require('./routes/auth.oauth.js')); // <--- ADDED THIS LINE
app.use('/', require('./routes/devices.web'));
app.use('/', require('./routes/settings.web'));
app.use('/', require('./routes/administration.web'));



// API routes (handling data)
const apiLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX_API || 100, // Stricter limit for API
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter); // Apply stricter rate limiting to all API routes
app.use('/api/auth', require('./routes/auth.api'));
app.use('/api/devices', require('./routes/devices.api'));
app.use('/api/settings', require('./routes/settings.api'));
app.use('/api/admin', require('./routes/administration.api'));
app.use('/api/apk', require('./routes/apk'));
app.use('/api/hw', require('./routes/hw.api.js'));

// --- Swagger UI Setup ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("--- UNHANDLED ERROR ---");
  console.error("Request URL:", req.originalUrl);
  console.error("Request Method:", req.method);
  
  if (err instanceof Error) {
    console.error("Error Stack:", err.stack);
  } else {
    console.error("Raw Error:", err);
  }
  console.error("--- END UNHANDLED ERROR ---");

  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'An unexpected server error occurred!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});