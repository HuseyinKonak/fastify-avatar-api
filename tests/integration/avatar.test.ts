import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Avatar Endpoints (Integration)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 OK and valid image for a valid GET /v1/avatar request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=John&format=svg',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/svg+xml');
    
    // In-depth integrity check: Content should be a valid SVG string
    expect(response.payload).toContain('<svg');
    expect(response.payload).toContain('viewBox');
    expect(response.payload.length).toBeGreaterThan(100);
  });

  it('should return cache metadata for repeated avatar requests', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=Cache%20Test&format=png&width=128&height=128',
    });
    expect(first.statusCode).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');

    const second = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=Cache%20Test&format=png&width=128&height=128',
    });
    expect(second.statusCode).toBe(200);
    expect(second.headers['x-cache']).toBe('HIT');
  });

  it('should expose health and metrics endpoints', async () => {
    const root = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(root.statusCode).toBe(200);
    expect(root.json()).toMatchObject({
      status: 'ok',
      routes: {
        avatar: '/v1/avatar',
      },
    });

    const health = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(health.statusCode).toBe(200);
    const healthJson = health.json();
    expect(healthJson.status).toBe('ok');
    expect(healthJson.checks).toHaveProperty('redis');
    expect(healthJson.checks).toHaveProperty('workers');

    const metrics = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers['content-type']).toContain('text/plain');
    expect(metrics.body).toContain('avatar_worker_pool_utilization');
  });

  it('should reject browser origins that are not explicitly allowed', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=Origin%20Test',
      headers: { origin: 'https://untrusted.example' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().detail).toBe('Origin is not allowed by CORS');
  });

  it('should escape malicious name inputs in SVG (XSS Test)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=<script>alert("xss")</script>&mode=long&format=svg&uppercase=false',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('<script>');
    expect(response.body).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should return 400 Bad Request if validation fails (e.g. invalid format)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=John&format=batman',
    });

    expect(response.statusCode).toBe(400);
    const json = JSON.parse(response.payload);
    
    // RFC 7807 Compliance Check
    expect(json.type).toContain('validation-failed');
    expect(json.status).toBe(400);
    expect(json.invalid_params).toBeDefined();
  });

  it('should reject names that are too long with a validation problem response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/avatar?name=${'a'.repeat(120)}&format=png`,
    });

    expect(response.statusCode).toBe(400);
    const json = response.json();
    expect(json.type).toContain('validation-failed');
    expect(json.detail).toBeTruthy();
  });

  it('should process emojis gracefully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar?name=👩‍💻&format=svg',
    });

    expect(response.statusCode).toBe(200);
    // Grapheme segmentation preserves the complete joined emoji.
    expect(response.body).toContain('👩‍💻'); 
  });
});
