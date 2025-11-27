const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { isUser } = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: Logs API
 *   description: Logging endpoints for frontend applications
 */

/**
 * @swagger
 * /api/logs/ui:
 *   post:
 *     summary: Log a UI event (e.g., toast notification) to the server
 *     tags: [Logs API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: The message to log.
 *                 example: "User clicked delete button"
 *               type:
 *                 type: string
 *                 description: The type of log (info, warning, error).
 *                 default: info
 *                 example: "info"
 *               context:
 *                 type: object
 *                 description: Additional context data.
 *     responses:
 *       '204':
 *         description: Log accepted successfully.
 *       '400':
 *         description: Bad request (missing message).
 *       '401':
 *         description: Unauthorized.
 */
router.post('/ui', isUser, (req, res) => {
    const log = req.log || logger;
    const { message, type = 'info', context = {} } = req.body || {};

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required.' });
    }

    log.info('UI alert displayed', {
        source: 'frontend-toast',
        type,
        message,
        context
    });

    return res.status(204).send();
});

module.exports = router;
