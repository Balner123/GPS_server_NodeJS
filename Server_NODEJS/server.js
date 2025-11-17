const express = require("express");
const rateLimit = require("express-rate-limit");
require('dotenv').config();
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerDef');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1); // Trust first proxy
const port = process.env.PORT || 5000;

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware (order is important)
app.use(express.json({
  verify: (req, res, buf) => {
    if (!req.rawBody && buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({
  extended: false,
  verify: (req, res, buf) => {
    if (!req.rawBody && buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(logger.requestLogger());
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

// Rate limiting (applies to all subsequent routes)
const limiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: process.env.RATE_LIMIT_MAX || 300
});
app.use(limiter);

// --- Routes ---

// Web routes (rendering pages)
const webRoutes = express.Router();
webRoutes.use(checkPasswordPrompt); // Apply password prompt check only to web routes
webRoutes.use('/', require('./routes/index'));
webRoutes.use('/', require('./routes/auth.web'));
webRoutes.use('/', require('./routes/devices.web'));
webRoutes.use('/', require('./routes/settings.web'));
webRoutes.use('/', require('./routes/administration.web'));
webRoutes.use('/', require('./routes/alerts.web'));
app.use('/', webRoutes);

app.use('/auth', require('./routes/auth.oauth.js')); // OAuth routes



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
app.use('/api/logs', require('./routes/logs.api'));

// --- Swagger UI Setup ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling middleware
app.use((err, req, res, next) => {
  const errLogger = req.log || logger;
  errLogger.error('Unhandled error in request', {
    url: req.originalUrl,
    method: req.method,
    stack: err instanceof Error ? err.stack : undefined,
    error: err instanceof Error ? err.message : err
  });

  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'An unexpected server error occurred!' });
});

// Start server
app.listen(port, () => {
  logger.info('Server started', { port, url: `http://localhost:${port}/` });
  console.log(`Server is running on http://localhost:${port}/`);
});