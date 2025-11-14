const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID, randomBytes } = require('crypto');

const LOG_FILE = path.join(__dirname, '..', 'log.txt');

function ensureLogFile() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', { encoding: 'utf8' });
  }
}

ensureLogFile();

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
logStream.on('error', (err) => {
  console.error('Logger stream error:', err);
});

function serializeMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  try {
    return ' | ' + JSON.stringify(meta, (key, value) => {
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack };
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
  } catch (error) {
    return ' | meta_serialization_failed';
  }
}

function formatLine(level, message, meta) {
  const timestamp = new Date().toISOString();
  const baseMessage = typeof message === 'string' ? message : JSON.stringify(message);
  return `[${timestamp}] [${level}] ${baseMessage}${serializeMeta(meta)}${os.EOL}`;
}

function writeLine(line) {
  if (!logStream.writable) {
    fs.appendFile(LOG_FILE, line, (err) => {
      if (err) {
        console.error('Failed writing to log file:', err);
      }
    });
    return;
  }

  logStream.write(line, (err) => {
    if (err) {
      console.error('Failed streaming to log file:', err);
    }
  });
}

function generateId() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return randomBytes(16).toString('hex');
}

class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  child(extraContext = {}) {
    return new Logger({ ...this.context, ...extraContext });
  }

  log(level, message, meta = {}) {
    const mergedMeta = { ...this.context, ...meta };
    const line = formatLine(level, message, mergedMeta);
    writeLine(line);
  }

  info(message, meta) {
    this.log('INFO', message, meta);
  }

  warn(message, meta) {
    this.log('WARN', message, meta);
  }

  error(message, meta = {}) {
    if (message instanceof Error) {
      const err = message;
      return this.log('ERROR', err.message, { ...meta, stack: err.stack });
    }
    if (meta instanceof Error) {
      const err = meta;
      return this.log('ERROR', message, { message: err.message, stack: err.stack });
    }
    this.log('ERROR', message, meta);
  }

  debug(message, meta) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGS === 'true') {
      this.log('DEBUG', message, meta);
    }
  }

  sql(statement, meta) {
    this.log('SQL', statement, meta);
  }

  requestLogger() {
    return (req, res, next) => {
      const requestId = req.headers['x-request-id'] || generateId();
      req.requestId = requestId;
      const requestContext = { requestId, method: req.method, url: req.originalUrl };
      const requestLogger = this.child(requestContext);
      req.log = requestLogger;

      const start = process.hrtime.bigint();
      requestLogger.info('Incoming request', { ip: req.ip });

      function finalize(eventName) {
        const durationNs = process.hrtime.bigint() - start;
        const durationMs = Number(durationNs) / 1e6;
        const meta = {
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          contentLength: res.getHeader('content-length'),
          event: eventName
        };
        requestLogger.info('Request completed', meta);
      }

      res.on('finish', () => finalize('finish'));
      res.on('close', () => finalize('close'));

      next();
    };
  }
}

module.exports = new Logger();
module.exports.Logger = Logger;
module.exports.generateRequestId = generateId;
module.exports.LOG_FILE = LOG_FILE;