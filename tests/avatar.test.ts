import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';

describe('Avatar API Integration', () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a default PNG avatar', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar',
      query: { name: 'John Doe' }
    });

    if (response.statusCode !== 200) console.log(response.body);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['x-cache']).toBe('MISS');
  });

  it('should return error for invalid dimensions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar',
      query: { name: 'Test', width: '5' } // Min is 16
    });

    expect(response.statusCode).toBe(400);
  });

  it('should accept custom colors', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar',
      query: { name: 'John Doe', background: 'ff0000', color: 'ffffff' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-cache']).toBe('MISS');
  });

  it('should handle different shapes', async () => {
    const shapes = ['circle', 'square', 'rounded'] as const;
    for (const shape of shapes) {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/avatar',
        query: { name: 'Shape Test', shape }
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('should handle special characters in name', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/avatar',
      query: { name: 'O\'Connor & Sons' }
    });

    expect(response.statusCode).toBe(200);
  });
});

