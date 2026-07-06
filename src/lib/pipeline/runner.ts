import type { PipelineParams, PipelineResult } from '../types';
import { runPipelineSync } from './run';

export type PipelineRunner = (
  image: ImageData,
  params: PipelineParams,
) => Promise<PipelineResult | null>;

let activeWorker: Worker | null = null;
let activeResolve: ((value: PipelineResult | null) => void) | null = null;
let jobCounter = 0;

function settle(worker: Worker, value: PipelineResult | null) {
  if (activeWorker === worker) {
    const resolve = activeResolve;
    activeWorker = null;
    activeResolve = null;
    worker.terminate();
    resolve?.(value);
  }
}

/**
 * Run the pipeline in a Web Worker so the UI stays responsive. A newer call
 * supersedes a pending one (the old promise resolves with null). Falls back
 * to the main thread when Workers are unavailable or crash.
 */
export const runPipeline: PipelineRunner = (image, params) => {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runPipelineSync(image.data, image.width, image.height, params));
  }

  // Supersede any in-flight job
  if (activeWorker) {
    const old = activeWorker;
    const oldResolve = activeResolve;
    activeWorker = null;
    activeResolve = null;
    old.terminate();
    oldResolve?.(null);
  }

  const id = ++jobCounter;
  return new Promise<PipelineResult | null>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(runPipelineSync(image.data, image.width, image.height, params));
      return;
    }
    activeWorker = worker;
    activeResolve = resolve;

    worker.onmessage = (event) => {
      if (event.data?.id !== id) return;
      if (event.data.ok) {
        settle(worker, event.data.result as PipelineResult);
      } else {
        // Worker-side error: fall back to a main-thread run
        settle(worker, runPipelineSync(image.data, image.width, image.height, params));
      }
    };
    worker.onerror = () => {
      settle(worker, runPipelineSync(image.data, image.width, image.height, params));
    };

    const pixels = image.data.slice().buffer;
    worker.postMessage({ id, pixels, width: image.width, height: image.height, params }, [pixels]);
  });
};
