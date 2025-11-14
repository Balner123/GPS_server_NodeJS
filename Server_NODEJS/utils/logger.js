const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID, randomBytes } = require('crypto');

const LOG_FILE = path.join(__dirname, '..', 'log.txt');
const MAX_LOG_BODY_LENGTH = Number(process.env.LOGGER_MAX_BODY_LENGTH || 8192);
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'token',
  'secret',
  'authorization',
  'auth',
  'refresh_token',
  'access_token'
]);

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

function maskPrimitive(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return '***';
  }
  if (typeof value === 'number') {
    return 0;
  }
  if (typeof value === 'boolean') {
    return false;
  }
  return '***';
}

function sanitizePayload(payload, depth = 0) {
  if (payload === null || typeof payload !== 'object' || depth > 5) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizePayload(item, depth + 1));
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    const lowered = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowered)) {
      acc[key] = maskPrimitive(value);
    } else {
      acc[key] = sanitizePayload(value, depth + 1);
    }
    return acc;
  }, {});
}

function truncateBody(raw) {
  if (typeof raw !== 'string' || raw.length <= MAX_LOG_BODY_LENGTH) {
    return raw;
  }
  return `${raw.slice(0, MAX_LOG_BODY_LENGTH)}... [truncated ${raw.length - MAX_LOG_BODY_LENGTH} bytes]`;
}

function redactRawBody(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return raw;
  }

  const pattern = /("(?:password|pass|token|secret|authorization|auth|refresh_token|access_token)"\s*:\s*")([^"\\]*(?:\\.[^"\\]*)*)"/gi;
  return truncateBody(raw.replace(pattern, '$1***"'));
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `[unserializable:${error.message}]`;
  }
}

function extractRequestPayload(req) {
  if (!req) {
    return null;
  }

  const contentType = req.headers ? req.headers['content-type'] : undefined;
  const hasBodyObject = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
  const isJson = typeof contentType === 'string' && contentType.includes('application/json');

  if (isJson && typeof req.rawBody === 'string' && req.rawBody.length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(req.rawBody);
    } catch (err) {
      parsed = null;
    }

    return {
      contentType,
      raw: redactRawBody(req.rawBody),
      body: parsed ? sanitizePayload(parsed) : undefined
    };
  }

  if (hasBodyObject) {
    return {
      contentType,
      body: sanitizePayload(req.body)
    };
  }

  return null;
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
      const methodLabel = (req.method || 'REQUEST').toUpperCase();
      const requestContext = { requestId, method: methodLabel, url: req.originalUrl };
      const requestLogger = this.child(requestContext);
      const minimalLogging = methodLabel === 'GET';
      req.log = requestLogger;

      const start = process.hrtime.bigint();
      if (!minimalLogging) {
        requestLogger.log(methodLabel, 'Incoming request', { ip: req.ip });

        const payloadDetails = extractRequestPayload(req);
        if (payloadDetails) {
          requestLogger.log(methodLabel, 'Request payload captured', payloadDetails);
        }
      }

      const responseState = {
        logged: false,
        hasPreferredBody: false,
        preferredBody: undefined,
        hint: undefined,
        skipLogging: minimalLogging
      };

      const originalJson = res.json;
      const originalSend = res.send;

      function logResponseBody(body, hint) {
        if (responseState.skipLogging) {
          return;
        }
        if (responseState.logged) {
          return;
        }
        responseState.logged = true;
        try {
          const meta = {
            hint,
            statusCode: res.statusCode
          };

          if (body === undefined) {
            meta.rawBody = undefined;
          } else if (body === null) {
            meta.rawBody = null;
          } else if (Buffer.isBuffer(body)) {
            meta.rawBody = truncateBody(body.toString('utf8'));
          } else if (typeof body === 'string') {
            meta.rawBody = truncateBody(body);
          } else if (typeof body === 'object') {
            meta.rawBody = truncateBody(safeStringify(body));
            meta.snapshot = sanitizePayload(body);
          } else {
            meta.rawBody = truncateBody(String(body));
          }

          requestLogger.log(methodLabel, 'Response payload captured', meta);
        } catch (error) {
          requestLogger.log(methodLabel, 'Failed to capture response payload', { hint, error: error.message });
        }
      }

      res.json = function jsonWithLogging(body) {
        responseState.hasPreferredBody = true;
        responseState.preferredBody = body;
        responseState.hint = 'json';
        return originalJson.call(this, body);
      };

      res.send = function sendWithLogging(body) {
        const payload = responseState.hasPreferredBody ? responseState.preferredBody : body;
        const hint = responseState.hint || 'send';
        const shouldLog = responseState.hasPreferredBody || (typeof body === 'object' && body !== null && !Buffer.isBuffer(body));

        if (shouldLog) {
          logResponseBody(payload, hint);
        }

        responseState.hasPreferredBody = false;
        responseState.preferredBody = undefined;
        responseState.hint = undefined;

        return originalSend.call(this, body);
      };

      let finalized = false;

      function finalize(eventName) {
        if (finalized) {
          return;
        }
        finalized = true;
        const durationNs = process.hrtime.bigint() - start;
        const durationMs = Number(durationNs) / 1e6;
        const meta = {
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          contentLength: res.getHeader('content-length'),
          event: eventName,
          ip: req.ip
        };

        if (minimalLogging) {
          requestLogger.log(methodLabel, `${methodLabel} ${req.originalUrl}`, meta);
        } else {
          requestLogger.log(methodLabel, 'Request completed', meta);
        }
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
module.exports.sanitizePayload = sanitizePayload;