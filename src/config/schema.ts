import { z } from 'zod';

export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8083),
  HOST: z.string().default('0.0.0.0'),
  SERVICE_NAME: z.string().default('avatar'),
  TRUST_PROXY: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  CORS_ORIGINS: z.string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  
  // Cache
  CACHE_TTL_MS: z.coerce.number().default(3600000),
  CACHE_MAX_ITEMS: z.coerce.number().default(1000),
  CACHE_MAX_SIZE_MB: z.coerce.number().default(100),
  REDIS_URL: z.string().optional(),

  // Limits
  MAX_WIDTH: z.coerce.number().default(2048),
  MAX_HEIGHT: z.coerce.number().default(2048),
  SHARP_CONCURRENCY: z.coerce.number().default(1),
  
  // Security
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ENABLE_METRICS: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  METRICS_TOKEN: z.string().min(24).optional(),

  // Cache Hardening
  CACHE_L1_INVALIDATION: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(true),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV === 'production' && config.ENABLE_METRICS && !config.METRICS_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['METRICS_TOKEN'],
      message: 'METRICS_TOKEN is required when metrics are enabled in production',
    });
  }
});

export type Config = z.infer<typeof ConfigSchema>;
