const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    const emailObj = (profile.emails && profile.emails[0]) || null;

    // 1) Find user by provider + provider_id
    let user = await db.User.findOne({ where: { provider: 'google', provider_id: providerId } });

    // 2) If not found, try to find by email to link accounts
    if (!user && emailObj && emailObj.value) {
      user = await db.User.findOne({ where: { email: emailObj.value } });
      if (user) {
        // If email is verified by Google, we can auto-link the account
        const emailVerified = emailObj.verified || (profile._json && profile._json.email_verified);
        if (emailVerified) {
          await user.update({ 
            provider: 'google', 
            provider_id: providerId, 
            provider_data: JSON.stringify(profile),
            is_verified: true // Also mark as verified if not already
          });
        } else {
          // Optional: Handle non-verified emails, e.g., by flashing a message.
          // For now, we proceed as if the user was found, but the link is not created.
          // The user will be logged into their local account.
        }
      }
    }

    // 3) If still not found, create a new user
    if (!user) {
        const emailVerified = !!(emailObj && (emailObj.verified || (profile._json && profile._json.email_verified)));
        
        // We require a verified email to create a new account
        if (!emailVerified || !emailObj || !emailObj.value) {
            // Or handle this by redirecting with a flash message
            return done(null, false, { message: 'An email address, verified by Google, is required to sign up.' });
        }

        // Generate a random password and hash it
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const newUser = await db.User.create({
            username: profile.displayName || `google_${providerId}`,
            email: emailObj.value,
            password: hashedPassword, // Save the hashed password
            provider: 'google',
            provider_id: providerId,
            provider_data: JSON.stringify(profile),
            is_verified: true // Account is verified by Google
        });
        // Optional: Here you could email the user their randomPassword
        // or display it to them once. For now, it's just in the system.
        return done(null, newUser);
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
  scope: ['user:email'] // Important to get the email
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const providerId = profile.id;
    const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;

    // 1) Find user by provider + provider_id
    let user = await db.User.findOne({ where: { provider: 'github', provider_id: providerId } });

    // 2) If not found, try to find by email
    if (!user && email) {
      user = await db.User.findOne({ where: { email: email } });
      if (user) {
        // Email matches, link the account
        await user.update({ 
            provider: 'github', 
            provider_id: providerId, 
            provider_data: JSON.stringify(profile) 
        });
      }
    }

    // 3) If still not found, create a new user
    if (!user) {
      // Generate a random password and hash it
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const username = profile.username || `github_${providerId}`;
      user = await db.User.create({
        username: username,
        email: email,
        password: hashedPassword, // Save the hashed password
        provider: 'github',
        provider_id: providerId,
        provider_data: JSON.stringify(profile),
        is_verified: !!email // If we have an email, consider it verified for this purpose
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

module.exports = passport;
