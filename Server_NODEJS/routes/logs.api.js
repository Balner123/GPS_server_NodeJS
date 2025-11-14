const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { isUser } = require('../middleware/authorization');

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
