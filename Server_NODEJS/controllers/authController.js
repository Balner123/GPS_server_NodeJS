const { getRequestLogger } = require('../utils/requestLogger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailSender');
const authService = require('../services/authService');
const deviceService = require('../services/deviceService');

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  
  let successMessage = req.flash('success');
  if (req.query.message === 'account_deleted') {
      if (successMessage.length === 0) {
          successMessage = ['Your account has been successfully deleted.'];
      } else {
          successMessage.push('Your account has been successfully deleted.');
      }
  }

  res.render('login', { error: req.flash('error'), success: successMessage, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { identifier, password } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'loginUser', identifier });
  log.info('Login attempt received');

  if (!identifier || !password) {
    return res.status(400).render('login', { error: 'Please enter your username or email and password.', currentPage: 'login' });
  }

  try {
    const user = await authService.validateLogin(identifier, password);

    if (!user.is_verified) {
        await authService.initiateEmailVerification(user.id);
        req.session.pendingUserId = user.id;
        req.flash('error', 'Your account is not verified. A new verification code has been sent to your email.');
        return res.redirect('/verify-email');
    }

    req.session.isAuthenticated = true;
    req.session.user = { id: user.id, username: user.username, email: user.email };
    log.info('User logged in successfully', { userId: user.id });

    if (user.username === 'root') {
      return res.redirect('/administration');
    }
    res.redirect('/');

  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
        log.warn('Login failed: invalid credentials');
        return res.status(401).render('login', { error: 'Invalid login credentials.', currentPage: 'login' });
    }
    log.error('Error during login', err);
    res.status(500).render('login', { error: 'Server error occurred. Please try again later.', currentPage: 'login' });
  }
};

const logoutUser = (req, res) => {
  const log = getRequestLogger(req, { controller: 'auth', action: 'logoutUser' });
  req.session.destroy(err => {
    if (err) {
      log.error('Logout error', err);
      return res.redirect('/');
    }
    log.info('User logged out');
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

const getRegisterPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('register', { error: null, currentPage: 'register', input: {} });
};

const registerUser = async (req, res) => {
  const { username, email, password, confirmPassword, use_weak_password } = req.body;
  const input = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'registerUser', username, email });
  log.info('Registration attempt received');

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).render('register', { error: 'All fields are required.', currentPage: 'register', input });
  }

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('register', { error: 'Please enter a valid email.', currentPage: 'register', input });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Passwords do not match.', currentPage: 'register', input });
  }

  const passwordError = authService.validatePassword(password, use_weak_password);
  if (passwordError) {
      return res.status(400).render('register', { error: passwordError, currentPage: 'register', input });
  }

  try {
    const newUser = await authService.registerUser({ username, email, password });
    req.session.pendingUserId = newUser.id;
    return res.redirect('/verify-email');

  } catch (err) {
    if (err.message === 'USER_EXISTS') {
        return res.status(409).render('register', { error: 'User with this username or email already exists.', currentPage: 'register', input });
    }
    log.error('Registration error', err);
    res.status(500).render('register', { error: 'Server error occurred during registration.', currentPage: 'register', input });
  }
};

const getVerifyEmailPage = (req, res) => {
  res.render('verify-email', { 
    error: req.flash('error'),
    success: req.flash('success'),
    pendingEmailChange: req.session.pendingEmailChange || false
  });
};

const verifyEmailCode = async (req, res) => {
  const { code } = req.body;
  const userId = req.session.pendingUserId;
  const log = getRequestLogger(req, { controller: 'auth', action: 'verifyEmailCode', userId });
  log.info('Verifying email code');

  if (!userId) {
    req.flash('error', 'Session expired. Please try again.');
    return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
  }

  try {
    const { user, emailChanged } = await authService.verifyEmailCode(userId, code);

    // Case 1: Email Change Verification
    if (emailChanged) {
      // Refresh user info in session
      req.session.isAuthenticated = true;
      req.session.user = { id: user.id, username: user.username, email: user.email }; 
      
      delete req.session.pendingUserId;
      delete req.session.pendingEmailChange;

      req.flash('success', 'Email has been successfully changed.');
      return res.redirect('/settings');
    }

    // Case 2: Initial Account Verification
    req.session.isAuthenticated = true;
    req.session.user = { id: user.id, username: user.username, email: user.email };
    delete req.session.pendingUserId;

    return res.redirect('/');

  } catch (err) {
    if (err.message === 'INVALID_CODE') {
        req.flash('error', 'Verification code has expired or is invalid.');
        return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
    }
    if (err.message === 'USER_NOT_FOUND') {
        return res.redirect('/login');
    }
    log.error('Error verifying email', err);
    return res.render('verify-email', { error: 'Server error occurred.', currentPage: 'verify-email' });
  }
};

const loginApk = async (req, res) => {
    const { identifier, password, installationId } = req.body;
    const log = getRequestLogger(req, { controller: 'auth', action: 'loginApk', identifier, installationId });
    log.info('APK login attempt');

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: 'Missing username or password.' });
    }
    if (!installationId) {
        return res.status(400).json({ success: false, error: 'Missing installation ID (installationId).' });
    }

    try {
        const user = await authService.validateLogin(identifier, password);

        if (!user.is_verified) {
          return res.status(403).json({ success: false, error: 'Account not verified. Please verify your email before using the APK client.' });
        }

        req.session.isAuthenticated = true;
        req.session.user = { id: user.id, username: user.username, email: user.email };

        const deviceIsRegistered = await deviceService.isDeviceRegistered(user.id, installationId);

        log.info('APK login successful', { userId: user.id, deviceIsRegistered });
        res.status(200).json({ success: true, device_is_registered: deviceIsRegistered });

    } catch (error) {
        if (error.message === 'INVALID_CREDENTIALS') {
             return res.status(401).json({ success: false, error: 'Invalid credentials.' });
        }
        log.error('Error during APK login', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

const logoutApk = (req, res) => {
      const log = getRequestLogger(req, { controller: 'auth', action: 'logoutApk' });
      req.session.destroy(err => {
        if (err) {
          log.error('API logout error', err);
          return res.status(500).json({ success: false, error: 'Error during logout.' });
        }
        log.info('APK logout successful');
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Logout successful.' });
      });
};

const resendVerificationCodeFromPage = async (req, res) => {
  const userId = req.session.pendingUserId;
  if (!userId) {
    req.flash('error', 'Relation expired. Please log in again.');
    return res.redirect('/login');
  }

  try {
    const log = getRequestLogger(req, { controller: 'auth', action: 'resendVerificationCodeFromPage', userId });
    
    await authService.initiateEmailVerification(userId);

    log.info('Verification code resent');
    req.flash('success', 'New verification code sent to your email.');
    res.redirect('/verify-email');
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'auth', action: 'resendVerificationCodeFromPage', userId });
    if (err.message === 'ALREADY_VERIFIED') {
        req.flash('error', 'This account is already verified.');
        return res.redirect('/login');
    }
    log.error('Error during resend from page', err);
    req.flash('error', 'Error during server.');
    res.redirect('/verify-email');
  }
};

const setInitialPassword = async (req, res) => {
    const { newPassword, confirmPassword, use_weak_password } = req.body;
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'auth', action: 'setInitialPassword', userId });

    try {
        if (!newPassword || !confirmPassword) {
            req.flash('error', 'Both password fields are required.');
            return res.redirect('/set-password');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/set-password');
        }

        const passwordError = authService.validatePassword(newPassword, use_weak_password);
        if (passwordError) {
            req.flash('error', passwordError);
            return res.redirect('/set-password');
        }

        await authService.setPassword(userId, newPassword);

        log.info('Initial password set');
        req.flash('success', 'Your password has been set successfully! You can now use it for external devices.');
        res.redirect('/');

    } catch (err) {
        if (err.message === 'NOT_ELIGIBLE') {
             req.flash('error', 'This action is not applicable for your account.');
             return res.redirect('/');
        }
        log.error('Error setting initial password', err);
        req.flash('error', 'An error occurred while setting your password.');
        res.redirect('/set-password');
    }
};

const cancelEmailChange = async (req, res) => {
  const userId = req.session.pendingUserId;

  if (!userId) {
    req.flash('error', 'Session expired or no pending email change to cancel.');
    return res.redirect('/settings');
  }

  try {
    const log = getRequestLogger(req, { controller: 'auth', action: 'cancelEmailChange', userId });
    
    await authService.clearActionTokens(userId);

    delete req.session.pendingUserId;
    delete req.session.pendingEmailChange;

    log.info('Pending email change canceled');
    req.flash('success', 'Email change has been successfully canceled.');
    res.redirect('/settings');
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'auth', action: 'cancelEmailChange', userId });
    log.error('Error canceling email change', err);
    req.flash('error', 'An error occurred while canceling the email change.');
    res.redirect('/settings');
  }
};

const getForgotPasswordPage = (req, res) => {
  res.render('forgot-password', { error: req.flash('error'), success: req.flash('success') });
};

const sendPasswordResetLink = async (req, res) => {
  const { email } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'sendPasswordResetLink', email });

  if (!email) {
    req.flash('error', 'Please enter your email address.');
    return res.redirect('/forgot-password');
  }

  try {
    const result = await authService.initiatePasswordReset(email);
    
    if (result) {
        // Only verify sending if user existed
        const { token } = result;
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
        await sendPasswordResetEmail(email, resetLink);
        log.info('Password reset link sent');
    } else {
        log.info('Password reset requested for non-existent email');
    }

    req.flash('success', 'If an account with that email exists, a reset link has been sent.');
    res.redirect('/forgot-password');

  } catch (err) {
    log.error('Error sending reset link', err);
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
};

const getResetPasswordPage = async (req, res) => {
  const { token } = req.params;
  res.render('reset-password', { token, error: req.flash('error') });
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword, use_weak_password } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'resetPassword' });

  if (!password || !confirmPassword) {
    req.flash('error', 'Both password fields are required.');
    return res.redirect(`/reset-password/${token}`);
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect(`/reset-password/${token}`);
  }

  const passwordError = authService.validatePassword(password, use_weak_password);
  if (passwordError) {
      req.flash('error', passwordError);
      return res.redirect(`/reset-password/${token}`);
  }

  try {
    const user = await authService.resetPassword(token, password);
    log.info('Password reset successful', { userId: user.id });
    req.flash('success', 'Your password has been changed. You can now login.');
    res.redirect('/login');

  } catch (err) {
    if (err.message === 'INVALID_TOKEN') {
        req.flash('error', 'Password reset token is invalid or has expired.');
        return res.redirect('/forgot-password');
    }
    log.error('Error resetting password', err);
    req.flash('error', 'An error occurred while resetting your password.');
    res.redirect(`/reset-password/${token}`);
  }
};

module.exports = {
  getLoginPage,
  loginUser,
  logoutUser,
  getRegisterPage,
  registerUser,
  getVerifyEmailPage,
  verifyEmailCode,
  loginApk,
  logoutApk,
  resendVerificationCodeFromPage,
  setInitialPassword,
  cancelEmailChange,
  getForgotPasswordPage,
  sendPasswordResetLink,
  getResetPasswordPage,
  resetPassword
};