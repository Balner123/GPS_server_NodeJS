const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailSender');
const { Op } = require('sequelize');

class AuthService {
    constructor() {
        this.passwordRequirements = [
            { regex: /.{6,}/, message: 'Password must be at least 6 characters long.' },
            { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
            { regex: /[0-9]/, message: 'Password must contain at least one number.' },
            { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character.' }
        ];
    }

    validatePassword(password, useWeakPassword = false) {
        if (useWeakPassword) {
            if (password.length < 3) return 'Weak password must be at least 3 characters long.';
            return null;
        }
        for (const req of this.passwordRequirements) {
            if (!req.regex.test(password)) return req.message;
        }
        return null;
    }

    async validateLogin(identifier, password) {
        const user = await db.User.findOne({
            where: {
                [Op.or]: [{ username: identifier }, { email: identifier }]
            }
        });

        if (!user) throw new Error('INVALID_CREDENTIALS');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error('INVALID_CREDENTIALS');

        return user;
    }

    async registerUser({ username, email, password }) {
        const existingUser = await db.User.findOne({
            where: { [Op.or]: [{ username }, { email }] }
        });
        if (existingUser) throw new Error('USER_EXISTS');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const newUser = await db.User.create({
            username,
            email,
            password: hashedPassword,
            is_verified: false,
            action_token: code,
            action_token_expires: expires,
            action_type: 'VERIFY_EMAIL'
        });

        await sendVerificationEmail(email, code);
        return newUser;
    }

    async initiateEmailVerification(userId) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        // Only resend if not verified or if pending email change
        if (user.is_verified && !user.pending_email) {
             throw new Error('ALREADY_VERIFIED');
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        const targetEmail = user.pending_email || user.email;

        user.action_token = code;
        user.action_token_expires = expires;
        user.action_type = 'VERIFY_EMAIL';
        await user.save();

        await sendVerificationEmail(targetEmail, code);
    }

    async verifyEmailCode(userId, code) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        if (!user.action_token || !user.action_token_expires || new Date() > user.action_token_expires || user.action_type !== 'VERIFY_EMAIL') {
            throw new Error('INVALID_CODE');
        }

        if (user.action_token !== code) throw new Error('INVALID_CODE');

        // Success
        let emailChanged = false;
        if (user.pending_email) {
            user.email = user.pending_email;
            user.pending_email = null;
            emailChanged = true;
        }

        user.is_verified = true;
        user.action_token = null;
        user.action_token_expires = null;
        user.action_type = null;
        await user.save();

        return { user, emailChanged };
    }

    async initiatePasswordReset(email) {
        const user = await db.User.findOne({ where: { email } });
        if (!user) return false; // Silently fail for security

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        user.action_token = token;
        user.action_token_expires = expires;
        user.action_type = 'RESET_PASSWORD';
        await user.save();

        return { email: user.email, token };
    }

    async resetPassword(token, newPassword) {
        const user = await db.User.findOne({
            where: {
                action_token: token,
                action_type: 'RESET_PASSWORD',
                action_token_expires: { [Op.gt]: new Date() }
            }
        });

        if (!user) throw new Error('INVALID_TOKEN');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        user.action_token = null;
        user.action_token_expires = null;
        user.action_type = null;
        await user.save();
        
        return user;
    }

    async updateUsername(userId, newUsername) {
        const existing = await db.User.findOne({ where: { username: newUsername } });
        if (existing) throw new Error('USERNAME_TAKEN');

        await db.User.update({ username: newUsername }, { where: { id: userId } });
    }

    async updatePassword(userId, oldPassword, newPassword) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) throw new Error('INVALID_PASSWORD');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await user.update({ password: hashedPassword });
    }

    async setPassword(userId, newPassword) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');
        
        // Ensure user is eligible (provider account without password)
        if (user.provider === 'local' || (user.password && user.password.trim() !== '')) {
             throw new Error('NOT_ELIGIBLE');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await user.update({ password: hashedPassword });
    }

    async initiateEmailChange(userId, newEmail) {
        const user = await db.User.findByPk(userId);
        if (user.provider !== 'local') throw new Error('PROVIDER_ACCOUNT');
        if (user.email === newEmail) throw new Error('SAME_EMAIL');

        const existing = await db.User.findOne({ where: { email: newEmail } });
        if (existing) throw new Error('EMAIL_TAKEN');

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            pending_email: newEmail,
            action_token: code,
            action_token_expires: expires,
            action_type: 'VERIFY_EMAIL'
        });

        await sendVerificationEmail(newEmail, code);
    }

    async initiateAccountDeletion(userId) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            action_token: code,
            action_token_expires: expires,
            action_type: 'DELETE_ACCOUNT'
        });

        await sendVerificationEmail(user.email, code, 'account_deletion');
    }

    async confirmAccountDeletion(userId, code) {
        const user = await db.User.findByPk(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        if (!user.action_token || !user.action_token_expires || new Date() > user.action_token_expires || user.action_type !== 'DELETE_ACCOUNT') {
            throw new Error('INVALID_CODE');
        }

        if (user.action_token !== code) throw new Error('INVALID_CODE');

        // Cleanup
        await db.Device.destroy({ where: { user_id: userId } });
        await db.User.destroy({ where: { id: userId } });
    }

    async disconnectProvider(userId, password) {
        const user = await db.User.findByPk(userId);
        if (user.provider === 'local') throw new Error('NOT_PROVIDER_ACCOUNT');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await user.update({
            password: hashedPassword,
            provider: 'local',
            provider_id: null,
            provider_data: null
        });
    }

    async getUserProfile(userId) {
        return await db.User.findByPk(userId);
    }

    async clearActionTokens(userId) {
        const user = await db.User.findByPk(userId);
        if (user) {
            await user.update({
                action_token: null,
                action_token_expires: null,
                action_type: null,
                pending_email: null // Clear pending email too
            });
        }
    }
}

module.exports = new AuthService();
