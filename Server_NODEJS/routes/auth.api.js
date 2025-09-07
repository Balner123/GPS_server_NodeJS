const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth API
 *   description: User authentication and registration
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserLogin:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *       properties:
 *         identifier:
 *           type: string
 *           description: The user's username or email.
 *           example: "testuser"
 *         password:
 *           type: string
 *           description: The user's password.
 *           example: "Password123!"
 *     UserRegister:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - confirmPassword
 *       properties:
 *         username:
 *           type: string
 *           description: The desired username.
 *           example: "newuser"
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address.
 *           example: "newuser@example.com"
 *         password:
 *           type: string
 *           description: The user's password (must be at least 6 characters, with one uppercase letter, one number, and one special character).
 *           example: "NewPassword123!"
 *         confirmPassword:
 *           type: string
 *           description: The password confirmation.
 *           example: "NewPassword123!"
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       '302':
 *         description: Redirect to the home page ('/') or administration page ('/administration') on successful login. The session cookie is set.
 *       '400':
 *         description: Bad request (e.g., missing fields).
 *       '401':
 *         description: Unauthorized (invalid credentials).
 *       '500':
 *         description: Server error.
 */
router.post('/login', authController.loginUser);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegister'
 *     responses:
 *       '302':
 *         description: Redirect to the email verification page ('/verify-email') on successful registration.
 *       '400':
 *         description: Bad request (e.g., passwords don't match, invalid email).
 *       '409':
 *         description: Conflict (user with this username or email already exists).
 *       '500':
 *         description: Server error.
 */
router.post('/register', authController.registerUser);

/**
 * @swagger
 * /api/auth/logout:
 *   get:
 *     summary: Log out the current user
 *     tags: [Auth API]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '302':
 *         description: Redirect to the login page ('/login') after destroying the session.
 */
router.get('/logout', authController.logoutUser);

module.exports = router;
