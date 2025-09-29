import winston from 'winston';

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${stack || message} ${metaString}`;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'smartfridge-mcp-server' },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Add file transport in production
if (!isDevelopment) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Convenience methods for structured logging
export const logInfo = (message: string, meta?: Record<string, any>) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error, meta?: Record<string, any>) => {
  logger.error(message, { 
    error: error?.message,
    stack: error?.stack,
    ...meta 
  });
};

export const logWarn = (message: string, meta?: Record<string, any>) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, any>) => {
  logger.debug(message, meta);
};

// Request logging middleware helper
export const logRequest = (method: string, path: string, duration?: number, meta?: Record<string, any>) => {
  const logData = {
    method,
    path,
    duration: duration ? `${duration}ms` : undefined,
    ...meta
  };
  
  logger.info(`${method} ${path}${duration ? ` - ${duration}ms` : ''}`, logData);
};

export default logger;