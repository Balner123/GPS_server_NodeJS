const express = require('express');
const passport = require('passport');
const router = express.Router();

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
    // We now need to manually set our application's session variables for compatibility.
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

// GitHub OAuth callback route
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
