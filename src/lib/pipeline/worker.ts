/// <reference lib="webworker" />
import { runPipelineSync } from './run';

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent) => {
  const { id, pixels, width, height, params } = event.data;
  try {
    const result = runPipelineSync(new Uint8ClampedArray(pixels), width, height, params);
    scope.postMessage({ id, ok: true, result }, [result.labelMap.buffer]);
  } catch (error) {
    scope.postMessage({ id, ok: false, error: String(error) });
  }
};
