import { LRUCache } from 'lru-cache';
import { Redis } from 'ioredis';
import { FastifyBaseLogger } from 'fastify';
import promClient from 'prom-client';
import crypto from 'crypto';
import config from '../config/index.js';
import { logger } from './logger.js';
import { AvatarParams } from '../types/avatar.js';

// 6. Cache Metrics
const cacheMetrics = new promClient.Counter({
  name: 'avatar_cache_ops_total',
  help: 'Total cache operations',
  labelNames: ['layer', 'result'] // layer: L1/L2, result: hit/miss
});

const cacheOpDurationSeconds = new promClient.Histogram({
  name: 'avatar_cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['layer', 'result'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
});

export interface CachedAvatar {
  buffer: Buffer;
  contentType: string;
}

const localCache = new LRUCache<string, CachedAvatar>({
  max: config.CACHE_MAX_ITEMS,
  maxSize: config.CACHE_MAX_SIZE_MB * 1024 * 1024,
  sizeCalculation: (value) => value.buffer.length,
  ttl: config.CACHE_TTL_MS,
});

let redisClient: Redis | null = null;

export async function initRedis(url: string | undefined) {
  if (!url) return;
  redisClient = new Redis(url, { 
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  
  try {
    await redisClient.connect();
    logger.info('✅ Redis L2 Cache connected');
  } catch (err) {
    logger.error({ err }, 'Redis connection failed during init');
  }

  redisClient.on('error', (err: unknown) => logger.error({ err }, 'Redis Runtime Error'));
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('💤 Redis connection closed');
  }
}

export function generateKey(params: AvatarParams): string {
  // O(1) Memory Keying mapping directly to a template string. Removed SHA256 overhead.
  return `avatar:${params.name}|${params.width}|${params.height}|${params.mode}|${params.shape}|${params.format}|${params.background ?? ''}|${params.color ?? ''}|${params.fontFamily}|${params.fontSize ?? ''}|${params.bold}|${params.gradient}|${params.rounded}|${params.uppercase}`;
}

export function isRedisReady(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

export async function get(key: string): Promise<CachedAvatar | null> {
  const start = process.hrtime();
  
  // L1 Check
  const l1 = localCache.get(key);
  if (l1) {
    const end = process.hrtime(start);
    cacheOpDurationSeconds.observe({ layer: 'L1', result: 'hit' }, end[0] + end[1] / 1e9);
    cacheMetrics.inc({ layer: 'L1', result: 'hit' });
    return l1;
  }
  cacheMetrics.inc({ layer: 'L1', result: 'miss' });

  // L2 Check
  if (redisClient && redisClient.status === 'ready') {
    try {
      const data = await redisClient.getBuffer(key);
      const meta = await redisClient.get(`${key}:meta`);
      const end = process.hrtime(start);
      
      if (data && meta) {
        cacheOpDurationSeconds.observe({ layer: 'L2', result: 'hit' }, end[0] + end[1] / 1e9);
        cacheMetrics.inc({ layer: 'L2', result: 'hit' });
        const parsedMeta = JSON.parse(meta);
        const result: CachedAvatar = { buffer: data, contentType: parsedMeta.contentType };
        localCache.set(key, result); // Promote to L1
        return result;
      }
      cacheOpDurationSeconds.observe({ layer: 'L2', result: 'miss' }, end[0] + end[1] / 1e9);
      cacheMetrics.inc({ layer: 'L2', result: 'miss' });
    } catch (err) {
      logger.warn({ err, key }, 'Redis get error');
    }
  }

  return null;
}

export async function set(key: string, data: CachedAvatar): Promise<void> {
  localCache.set(key, data);
  
  if (redisClient && redisClient.status === 'ready') {
    try {
      const ttlSeconds = Math.floor(config.CACHE_TTL_MS / 1000);
      // Atomic pipeline
      const multi = redisClient.multi();
      multi.setex(key, ttlSeconds, data.buffer);
      multi.setex(`${key}:meta`, ttlSeconds, JSON.stringify({ contentType: data.contentType }));
      await multi.exec();
    } catch (err) {
      logger.warn({ err, key }, 'Redis set error');
    }
  }
}

// Cache Stampede Protection (Promise Debouncing)
const pendingGenerations = new Map<string, Promise<CachedAvatar>>();

// Lua Script for Safe Unlock: Only delete if the value matches the token
const UNLOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export async function getOrGenerate(
  key: string, 
  generator: () => Promise<CachedAvatar>,
  reqLogger: FastifyBaseLogger
): Promise<{ data: CachedAvatar; hit: boolean }> {
  
  const cached = await get(key);
  if (cached) {
    reqLogger.debug({ key }, 'Cache L1/L2 Hit');
    return { data: cached, hit: true };
  }

  // Local Stampede Protection (Memory-level)
  const localPending = pendingGenerations.get(key);
  if (localPending) {
    reqLogger.info({ key }, 'Local Stampede Protection Triggered (Joining Promise)');
    const data = await localPending;
    return { data, hit: true };
  }

  // Distributed Stampede Protection (Cluster-level)
  const promise = (async () => {
    const lockKey = `${key}:lock`;
    const lockToken = crypto.randomUUID(); // Unique token for this specific lock attempt
    const lockTTL = 10000;
    let acquired = false;

    if (isRedisReady()) {
      // Atomic SET with NX, PX and a unique value
      const lock = await (redisClient as Redis).set(lockKey, lockToken, 'PX', lockTTL, 'NX');
      
      if (!lock) {
        reqLogger.info({ key, lockKey }, 'Distributed Stampede Protection: Waiting for peer pod...');
        
        let retries = 30; // 3 seconds max wait
        while (retries > 0) {
          const jitter = 50 + Math.floor(Math.random() * 50);
          await new Promise(resolve => setTimeout(resolve, jitter));
          
          const retryData = await get(key);
          if (retryData) {
            reqLogger.debug({ key }, 'Succesfully retrieved data after peer lock wait');
            return retryData;
          }
          retries--;
        }
        reqLogger.warn({ key }, 'Distributed lock wait timeout. Forcing local generation.');
      } else {
        acquired = true;
      }
    }

    try {
      const data = await generator();
      await set(key, data);
      return data;
    } finally {
      if (acquired && isRedisReady()) {
        // Safe Atomic Unlock via Lua Script
        await (redisClient as Redis).eval(UNLOCK_SCRIPT, 1, lockKey, lockToken)
          .catch(err => reqLogger.warn({ err, key: lockKey}, 'Failed to safely unlock Redis'));
      }
    }
  })();

  pendingGenerations.set(key, promise);
  
  try {
    const data = await promise;
    return { data, hit: false };
  } finally {
    // Ensure potential race condition clean up
    if (pendingGenerations.get(key) === promise) {
      pendingGenerations.delete(key);
    }
  }
}


