const { getRequestLogger } = require('../utils/requestLogger');
const authService = require('../services/authService');

const getSettingsPage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'getSettingsPage' });
        const user = await authService.getUserProfile(req.session.user.id);
        
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }
        
        log.info('Settings page rendered');
        res.render('settings', {
            currentPage: 'settings',
            user: user,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'getSettingsPage' });
        log.error('Error fetching user for settings', err);
        req.flash('error', 'An error occurred while loading settings.');
        res.redirect('/');
    }
};

const updateUsername = async (req, res) => {
    const { username } = req.body;
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updateUsername', userId });

    if (!username || username.trim().length === 0) {
        req.flash('error', 'Username cannot be empty.');
        return res.redirect('/settings');
    }

    if (username === req.session.user.username) {
        return res.redirect('/settings');
    }

    try {
        await authService.updateUsername(userId, username);
        req.session.user.username = username;
        req.flash('success', 'Username has been successfully changed.');
        log.info('Username updated');
    } catch (err) {
        if (err.message === 'USERNAME_TAKEN') {
            req.flash('error', 'This username is already taken.');
        } else {
            log.error('Error updating username', err);
            req.flash('error', 'An error occurred while changing the username.');
        }
    }
    res.redirect('/settings');
};

const updatePassword = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updatePassword', userId });

    try {
        const { oldPassword, newPassword, confirmPassword, use_weak_password } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            req.flash('error', 'To change your password, you must fill in all three fields.');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'New password and confirmation do not match.');
            return res.redirect('/settings');
        }

        const passwordError = authService.validatePassword(newPassword, use_weak_password);
        if (passwordError) {
            req.flash('error', passwordError);
            return res.redirect('/settings');
        }

        await authService.updatePassword(userId, oldPassword, newPassword);
        
        req.flash('success', 'Password has been successfully changed.');
        log.info('Password updated');

    } catch (err) {
        if (err.message === 'INVALID_PASSWORD') {
            req.flash('error', 'Old password is incorrect.');
        } else {
            log.error('Error changing password', err);
            req.flash('error', 'An error occurred while changing the password.');
        }
    }
    res.redirect('/settings');
};

const updateEmail = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updateEmail', userId });

    try {
        const { email } = req.body;
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        
        if (!email || !emailRegex.test(email)) {
            req.flash('error', 'Enter a valid email address.');
            return res.redirect('/settings');
        }

        await authService.initiateEmailChange(userId, email);

        req.session.pendingUserId = userId;
        req.session.pendingEmailChange = true;

        req.flash('success', 'A verification code has been sent to your new email address.');
        log.info('Email change initiated');
        return res.redirect('/verify-email');

    } catch (err) {
        if (err.message === 'PROVIDER_ACCOUNT') {
            req.flash('error', 'Email cannot be changed for accounts linked with a third-party provider.');
        } else if (err.message === 'SAME_EMAIL') {
            req.flash('info', 'The entered email is the same as your current one.');
        } else if (err.message === 'EMAIL_TAKEN') {
            req.flash('error', 'This email is already taken by another account.');
        } else {
            log.error('Error updating email', err);
            req.flash('error', 'An error occurred while changing the email.');
        }
        return res.redirect('/settings');
    }
};

const deleteAccount = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'deleteAccount', userId });
        
        await authService.initiateAccountDeletion(userId);

        req.session.pendingDeletionUserId = userId;
        req.flash('success', 'A verification code has been sent to your email to confirm account deletion.');
        log.info('Account deletion initiated');
        return res.redirect('/settings/confirm-delete');

    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'deleteAccount', userId });
        log.error('Error initiating account deletion', err);
        req.flash('error', 'An error occurred while initiating account deletion.');
        res.redirect('/settings');
    }
};

const setPassword = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'setPassword', userId });

    try {
        const { newPassword, confirmPassword, use_weak_password } = req.body;

        if (!newPassword || !confirmPassword) {
            req.flash('error', 'Both password fields are required.');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/settings');
        }

        const passwordError = authService.validatePassword(newPassword, use_weak_password);
        if (passwordError) {
            req.flash('error', passwordError);
            return res.redirect('/settings');
        }

        await authService.setPassword(userId, newPassword);

        req.flash('success', 'Your password has been set successfully. You can now use it for external devices.');
        log.info('Password set for federated user');

    } catch (err) {
        if (err.message === 'NOT_ELIGIBLE') {
            req.flash('error', 'This action is not applicable for your account.');
        } else {
            log.error('Error setting password', err);
            req.flash('error', 'An error occurred while setting your password.');
        }
    }
    res.redirect('/settings');
};

const getConfirmDeletePage = (req, res) => {
    if (!req.session.pendingDeletionUserId) {
        req.flash('error', 'No pending account deletion to confirm.');
        return res.redirect('/settings');
    }
    res.render('confirm-delete', {
        currentPage: 'confirm-delete',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

const confirmDeleteAccount = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    const { code } = req.body;
    const log = getRequestLogger(req, { controller: 'settings', action: 'confirmDeleteAccount', userId });

    if (!userId) {
        req.flash('error', 'Session expired or no pending deletion.');
        return res.redirect('/settings');
    }

    try {
        await authService.confirmAccountDeletion(userId, code);

        delete req.session.pendingDeletionUserId;

        req.session.destroy((err) => {
            if (err) {
                log.error('Error destroying session after account deletion', err);
                return res.redirect('/login');
            }
            res.clearCookie('connect.sid');
            log.info('Account deleted');
            res.redirect('/login?message=account_deleted');
        });

    } catch (err) {
        if (err.message === 'INVALID_CODE') {
            req.flash('error', 'Verification code has expired or is invalid.');
            return res.redirect('/settings/confirm-delete');
        }
        log.error('Error confirming account deletion', err);
        req.flash('error', 'An error occurred while confirming account deletion.');
        res.redirect('/settings/confirm-delete');
    }
};

const resendDeletionCode = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    if (!userId) {
        req.flash('error', 'Session expired. Please try deleting your account again.');
        return res.redirect('/settings');
    }

    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'resendDeletionCode', userId });
        await authService.initiateAccountDeletion(userId);

        log.info('Deletion code resent');
        req.flash('success', 'New verification code sent to your email.');
        res.redirect('/settings/confirm-delete');

    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'resendDeletionCode', userId });
        log.error('Error during resend deletion code', err);
        req.flash('error', 'Error during server.');
        res.redirect('/settings/confirm-delete');
    }
};

const cancelDeleteAccount = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    if (!userId) {
        return res.redirect('/settings');
    }

    const log = getRequestLogger(req, { controller: 'settings', action: 'cancelDeleteAccount', userId });

    try {
        await authService.clearActionTokens(userId);
        delete req.session.pendingDeletionUserId;

        log.info('Account deletion cancelled');
        req.flash('success', 'Account deletion has been successfully cancelled.');
        res.redirect('/settings');

    } catch (err) {
        log.error('Error cancelling account deletion', err);
        req.flash('error', 'An error occurred while cancelling the account deletion.');
        res.redirect('/settings');
    }
};

module.exports = {
    getSettingsPage,
    updateUsername,
    updatePassword,
    updateEmail,
    deleteAccount,
    setPassword,
    getConfirmDeletePage,
    confirmDeleteAccount,
    resendDeletionCode,
    cancelDeleteAccount
};