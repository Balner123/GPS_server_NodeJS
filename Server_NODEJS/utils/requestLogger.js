const logger = require('./logger');

function getRequestLogger(req, meta = {}) {
  if (req && req.log) {
    return Object.keys(meta).length ? req.log.child(meta) : req.log;
  }
  return Object.keys(meta).length ? logger.child(meta) : logger;
}

module.exports = { getRequestLogger };
