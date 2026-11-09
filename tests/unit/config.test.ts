import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../../src/config/schema.js';

describe('configuration security defaults', () => {
  it('does not trust proxies or expose production metrics by default', () => {
    const config = ConfigSchema.parse({ NODE_ENV: 'production' });

    expect(config.TRUST_PROXY).toBe(false);
    expect(config.ENABLE_METRICS).toBe(false);
    expect(config.CORS_ORIGINS).toEqual([]);
  });

  it('parses an exact CORS origin allowlist', () => {
    const config = ConfigSchema.parse({
      CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
    });

    expect(config.CORS_ORIGINS).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('requires a strong token when production metrics are enabled', () => {
    const result = ConfigSchema.safeParse({
      NODE_ENV: 'production',
      ENABLE_METRICS: 'true',
    });

    expect(result.success).toBe(false);
  });
});
