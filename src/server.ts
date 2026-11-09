import { createApp } from './app.js';
import config from './config/index.js';
import { logger } from './lib/logger.js';

async function start() {
  const app = await createApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    
    // Boot-time Font Validation
    const testSvg = `<svg><text font-family="DejaVu Sans">Check</text></svg>`;
    try {
      await (await import('sharp')).default(Buffer.from(testSvg)).toBuffer();
      logger.info('🎨 Typography subsystem verified.');
    } catch {
      logger.warn('⚠️ System fonts (DejaVu/Liberation) might be missing. Rendering might fall back to defaults.');
    }

    logger.info(`🚀 Server ready at http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  // Process Error Handling
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled Rejection');
    process.exit(1);
  });

  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      try {
        await app.close();
        logger.info('Fastify server closed gracefully.');
        
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  });
}

start();
