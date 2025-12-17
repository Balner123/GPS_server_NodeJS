const express = require('express');
const passport = require('passport');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: OAuth
 *   description: OAuth2 login via Google and GitHub
 */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth 2.0 login
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirects to Google for authentication.
 */

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirects to '/' on success, '/login' on failure.
 */
// GitHub OAuth callback route

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirects to '/' on success, '/login' on failure.
 */

/**
 * @swagger
 * /auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth 2.0 login
 *     tags: [OAuth]
 *     responses:
 *       302:
 *         description: Redirects to GitHub for authentication.
 */

// --- Google Routes ---

// Route to initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login', 
    failureFlash: true // Enable flash messages for failures
  }), 
  (req, res) => {
    // On successful authentication, Passport adds the user to req.user.
    req.session.isAuthenticated = true;
    req.session.user = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    };

    // Redirect to the home page after successful login
    res.redirect('/');
  }
);

// --- GitHub Routes ---

// Route to initiate GitHub OAuth flow
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));


router.get('/github/callback', 
  passport.authenticate('github', { 
    failureRedirect: '/login', 
    failureFlash: true 
  }), 
  (req, res) => {
    // Same logic as Google for session compatibility
    req.session.isAuthenticated = true;
    req.session.user = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    };
    res.redirect('/');
  }
);

module.exports = router;
