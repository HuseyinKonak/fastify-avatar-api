import dotenv from 'dotenv';
import { ConfigSchema, type Config } from './schema.js';

dotenv.config();

// Create a minimal standalone logger instance just for boot,
// to avoid circular dependency before config finishes.
import pino from 'pino';
const bootLogger = pino();

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    bootLogger.fatal({ err: result.error.format() }, '❌ Invalid configuration during boot');
    process.exit(1);
  }


  return result.data;
}

export const config = loadConfig();
export default config;
