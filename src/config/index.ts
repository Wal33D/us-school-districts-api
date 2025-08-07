import * as dotenv from 'dotenv';
import * as Joi from 'joi';

// Load environment variables silently
dotenv.config({ debug: false });

// Define validation schema
const envSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3712),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Security
  ENABLE_SECURITY_MIDDLEWARE: Joi.boolean().default(false),
  BYPASS_IPS: Joi.string().default('127.0.0.1,::1,localhost'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // CORS
  CORS_ALLOWED_ORIGINS: Joi.string().default('*'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // Geometry Processing
  GEOMETRY_SIMPLIFICATION_TOLERANCE: Joi.number().default(0.001),

  // API Limits
  MAX_BATCH_SIZE: Joi.number().min(1).max(100).default(50),

  // Caching
  GEOMETRY_CACHE_SIZE: Joi.number().min(0).max(100).default(10),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Export configuration
export const config = {
  port: envVars.PORT as number,
  nodeEnv: envVars.NODE_ENV as string,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',

  security: {
    enableMiddleware: envVars.ENABLE_SECURITY_MIDDLEWARE as boolean,
    bypassIPs: (envVars.BYPASS_IPS as string).split(',').map(ip => ip.trim()),
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },

  cors: {
    allowedOrigins: (envVars.CORS_ALLOWED_ORIGINS as string)
      .split(',')
      .map(origin => origin.trim()),
  },

  logging: {
    level: envVars.LOG_LEVEL as string,
  },

  geometry: {
    simplificationTolerance: envVars.GEOMETRY_SIMPLIFICATION_TOLERANCE as number,
  },

  api: {
    maxBatchSize: envVars.MAX_BATCH_SIZE as number,
  },

  cache: {
    geometryCacheSize: envVars.GEOMETRY_CACHE_SIZE as number,
  },
};
