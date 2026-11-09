import { Piscina } from 'piscina';
import os from 'os';
import { fileURLToPath } from 'url';
import promClient from 'prom-client';
import renderAvatar from './renderer.js';
import type { AvatarParams } from '../types/avatar.js';

// 5. Worker Pool Metrics
export const poolMetrics = {
  utilization: new promClient.Gauge({
    name: 'avatar_worker_pool_utilization',
    help: 'Current utilization of the worker pool'
  }),
  queueSize: new promClient.Gauge({
    name: 'avatar_worker_pool_queue_size',
    help: 'Current number of tasks waiting in the worker pool queue'
  })
};

const physicalCores = os.cpus().length;
const maxThreads = Math.max(2, physicalCores);

type RendererResult = { buffer: Buffer; contentType: string };

class DirectRendererPool {
  threads: unknown[] = [];
  queueSize = 0;
  utilization = 0;

  async run(params: AvatarParams): Promise<RendererResult> {
    return renderAvatar(params);
  }

  async destroy() {
    return;
  }
}

export const rendererPool =
  process.env.NODE_ENV === 'test'
    ? new DirectRendererPool()
    : new Piscina({
        filename: fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? 'rendererWorker.ts' : 'rendererWorker.js', import.meta.url)),
        minThreads: 2,
        maxThreads: maxThreads,
        idleTimeout: 30000,
      });

export function getWorkerPoolStatus() {
  const status = {
    threads: Array.isArray(rendererPool.threads) ? rendererPool.threads.length : 0,
    queueSize: rendererPool.queueSize,
    utilization: rendererPool.utilization
  };
  
  // Update metrics
  poolMetrics.utilization.set(status.utilization);
  poolMetrics.queueSize.set(status.queueSize);
  
  return status;
}
