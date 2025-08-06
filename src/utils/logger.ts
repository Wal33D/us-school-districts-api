import winston from 'winston';
import path from 'path';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Safe JSON stringify that handles circular references
function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }

    // Handle common problematic objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    // Skip certain keys that often cause issues
    if (
      key === 'socket' ||
      key === 'connection' ||
      key === 'agent' ||
      key === 'request' ||
      key === 'response'
    ) {
      return '[Omitted]';
    }

    return value;
  });
}

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    try {
      log += ` ${safeStringify(metadata)}`;
    } catch (error) {
      log += ` [Error stringifying metadata: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  // Add stack trace if present (for errors)
  if (stack) {
    log += `\n${stack}`;
  }

  return log;
});

// Create the logger
export const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
  ],
});

// Add file transport in production
if (config.isProduction) {
  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create a stream object for Morgan middleware
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
