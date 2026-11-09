import fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import promClient from 'prom-client';
import etag from '@fastify/etag';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import config from './config/index.js';
import avatarRoutes from './routes/avatar.js';
import { isRedisReady, initRedis, closeRedis } from './lib/cache.js';
import { getWorkerPoolStatus, rendererPool } from './lib/workerPool.js';
import { logger } from './lib/logger.js';

export async function createApp() {
  const app = fastify({
    loggerInstance: logger,
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => uuidv4(),
    trustProxy: config.TRUST_PROXY,
  });

  // 1. Lifecycle: Redis Setup
  await initRedis(config.REDIS_URL);
  
  // 2. Lifecycle: Graceful Shutdown Hooks
  app.addHook('onClose', async () => {
    logger.info('Closing dependencies...');
    await Promise.all([
      closeRedis(),
      rendererPool.destroy()
    ]);
    logger.info('Dependencies closed.');
  });

  // Zod Integration
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // 2. RFC 7807 Global Error Handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;
    const isServerError = statusCode >= 500;
    
    // Problem Details for HTTP APIs (RFC 7807)
    const problem = {
      type: `urn:avatar-service:problem:${error.validation ? 'validation-failed' : 'internal-error'}`,
      title: error.validation ? 'Validation Failed' : (statusCode === 500 ? 'Internal Server Error' : error.name),
      status: statusCode,
      detail: isServerError && config.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : error.message,
      instance: request.url,
      ...(error.validation && { invalid_params: error.validation }),
      ...(config.NODE_ENV === 'development' && { stack: error.stack })
    };

    request.log.error({ err: error, problem }, 'Request failed');

    return reply
      .status(statusCode)
      .header('Content-Type', 'application/problem+json')
      .send(problem);
  });

  // Security
  await app.register(helmet, { 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false
  });
  // Browser access is opt-in. Requests without an Origin header (for example,
  // service-to-service calls) are allowed.
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.CORS_ORIGINS.includes(origin)) {
        cb(null, true);
        return;
      }
      const error = new Error('Origin is not allowed by CORS') as FastifyError;
      error.statusCode = 403;
      cb(error, false);
    },
    credentials: false,
  });

  // 7.1. ETag Support
  await app.register(etag);

  // Resource Protection - Disabled in test for stability
  if (config.NODE_ENV !== 'test') {
    // 7.2. "Under-Pressure" Hatalı Limitleri ve Kilitlenmeler
    await app.register(underPressure, {
      maxEventLoopDelay: 50, // Strict event loop monitoring (standard is <100ms)
      maxHeapUsedBytes: 1024 * 1024 * 512,
      maxRssBytes: 1024 * 1024 * 1024,
      exposeStatusRoute: false,
    });
  }

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Avatar Generation API',
        description: 'Generate avatars from names and text.',
        version: '1.1.0',
      },
      servers: [
        { 
          url: `http://localhost:${config.PORT}`,
          description: 'Localhost'
        }
      ],
    },
    transform: jsonSchemaTransform,
  });

  if (config.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  }

  // Prometheus Metrics Setup
  promClient.collectDefaultMetrics({ register: promClient.register });

  const httpRequestDurationMicroseconds = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10] // Defined buckets
  });

  // Request Lifecycle Logging
  app.addHook('onRequest', async (req) => {
    req.log.info({ url: req.url, method: req.method }, 'Incoming request');
  });

  app.addHook('onResponse', async (req, reply) => {
    httpRequestDurationMicroseconds
      .labels(req.method, req.routeOptions.url || 'unknown', reply.statusCode.toString())
      .observe(reply.elapsedTime / 1000);

    req.log.info({ 
      url: req.url, 
      method: req.method, 
      status: reply.statusCode,
      duration: reply.elapsedTime 
    }, 'Request completed');
  });

  // Routes
  await typedApp.register(avatarRoutes, { prefix: '/v1' });

  // Metrics are available in development/test. Production exposure is opt-in
  // and protected with a bearer token.
  if (config.NODE_ENV !== 'production' || config.ENABLE_METRICS) {
    typedApp.get('/metrics', async (request, reply) => {
      if (config.NODE_ENV === 'production') {
        const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
        const expected = config.METRICS_TOKEN ?? '';
        const valid = supplied.length === expected.length && supplied.length > 0 &&
          crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

        if (!valid) {
          return reply.status(401).send({
            type: 'urn:avatar-service:problem:unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'A valid metrics bearer token is required.',
            instance: request.url,
          });
        }
      }

      reply.header('Content-Type', promClient.register.contentType);
      return promClient.register.metrics();
    });
  }

  // Health
  typedApp.get('/', async () => ({
    service: config.SERVICE_NAME,
    status: 'ok',
    routes: {
      health: '/health',
      ...(config.NODE_ENV !== 'production' || config.ENABLE_METRICS ? { metrics: '/metrics' } : {}),
      ...(config.NODE_ENV !== 'production' ? { docs: '/docs' } : {}),
      avatar: '/v1/avatar',
    },
  }));

  typedApp.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      redis: isRedisReady() ? 'healthy' : 'degraded',
      workers: getWorkerPoolStatus()
    }
  }));

  return app;
}
