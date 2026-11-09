import pino from 'pino';
import config from '../config/index.js';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: config.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    }
  } : undefined,
  base: {
    env: config.NODE_ENV,
    service: config.SERVICE_NAME,
  },
});

export default logger;
