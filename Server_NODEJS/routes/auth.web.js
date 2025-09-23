const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication routes
 */

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Render the login page
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Login page rendered successfully
 */

/**
 * @swagger
 * /register:
 *   get:
 *     summary: Render the register page
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Register page rendered successfully
 */

/**
 * @swagger
 * /verify-email:
 *   get:
 *     summary: Render the email verification page
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Email verification page rendered successfully
 *   post:
 *     summary: Verify the email code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid email or code
 */

/**
 * @swagger
 * /resend-verification-from-page:
 *   post:
 *     summary: Resend verification code from the verification page
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification code resent successfully
 *       400:
 *         description: Failed to resend verification code
 */

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: Log out the user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User logged out successfully
 */

router.get('/login', authController.getLoginPage);
router.get('/register', authController.getRegisterPage);
router.get('/verify-email', authController.getVerifyEmailPage);
router.post('/verify-email', authController.verifyEmailCode);
router.post('/resend-verification-from-page', authController.resendVerificationCodeFromPage);
router.get('/logout', authController.logoutUser);

module.exports = router;
