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
 *           description: The user's password. See endpoint description for validation rules.
 *           example: "NewPassword123!"
 *         confirmPassword:
 *           type: string
 *           description: The password confirmation.
 *           example: "NewPassword123!"
 *         use_weak_password:
 *           type: boolean
 *           description: If true, bypasses strict password requirements and only requires a minimum length of 3 characters.
 *           example: false
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     description: |
 *       Authenticates a user based on username/email and password.
 *       If the user's account is not yet verified, it sends a new verification code via email and redirects to the verification page.
 *     tags: [Auth API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       '302':
 *         description: |
 *           Redirects based on user status:
 *           - **Verified User:** Redirects to the home page ('/') or administration page ('/administration'). The session cookie is set.
 *           - **Unverified User:** Redirects to the email verification page ('/verify-email').
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
 *     description: |
 *       Registers a new user and sends a verification email.
 *       **Password Validation Rules:**
 *       - By default, a strict policy is enforced: minimum 6 characters, 1 uppercase letter, 1 number, 1 special character.
 *       - If `use_weak_password` is set to `true` in the request body, the strict policy is bypassed and a minimum length of 3 characters is required.
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
 *         description: Bad request (e.g., passwords don't match, invalid email, password policy violation).
 *       '409':
 *         description: Conflict (user with this username or email already exists).
 *       '500':
 *         description: Server error.
 */
router.post('/register', authController.registerUser);

module.exports = router;
