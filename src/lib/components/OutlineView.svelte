<script lang="ts">
import { buildRegionColorMap, drawTemplate } from '$lib/render';
import { project } from '$lib/stores/project';
import { onMount } from 'svelte';
import { _ } from 'svelte-i18n';

let canvas: HTMLCanvasElement;
let container: HTMLDivElement;
let showFill = false;
let showNumbers = true;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let fitted = false;

const pointers = new Map<number, { x: number; y: number }>();
let pinchStart: { dist: number; zoom: number } | null = null;
let panStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;

$: state = $project;
$: regionColorIds = state.result
  ? buildRegionColorMap(state.result.regions)
  : new Map<number, number>();
// Redraw whenever the result, palette or view toggles change
$: if (canvas && state.result)
  redrawOn(
    showFill,
    showNumbers,
    state.numberOpacity,
    state.lineScale,
    state.palette,
    state.result,
  );

function redrawOn(..._deps: unknown[]) {
  draw();
}

function resizeCanvas(): boolean {
  if (!container) return false;
  const dpr = window.devicePixelRatio || 1;
  const cssW = container.clientWidth;
  const cssH = Math.min(window.innerHeight * 0.65, 620);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    return true;
  }
  return false;
}

function fit() {
  const result = state.result;
  if (!result || !canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;
  zoom = Math.min(cssW / result.width, cssH / result.height) * 0.95;
  offsetX = (cssW - result.width * zoom) / 2;
  offsetY = (cssH - result.height * zoom) / 2;
  fitted = true;
  draw();
}

function draw() {
  const result = state.result;
  if (!result || !canvas) return;
  const changed = resizeCanvas();
  if (!fitted || changed) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    zoom = Math.min(cssW / result.width, cssH / result.height) * 0.95;
    offsetX = (cssW - result.width * zoom) / 2;
    offsetY = (cssH - result.height * zoom) / 2;
    fitted = true;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  drawTemplate(ctx, {
    outlines: result.outlines,
    placements: result.placements,
    palette: state.palette,
    regionColorIds,
    width: result.width,
    height: result.height,
    scale: zoom * dpr,
    offsetX: offsetX * dpr,
    offsetY: offsetY * dpr,
    showFill,
    showNumbers,
    numberOpacity: state.numberOpacity,
    lineWidth: 1.4 * dpr * state.lineScale,
  });
}

function zoomAt(cssX: number, cssY: number, factor: number) {
  const newZoom = Math.max(0.05, Math.min(40, zoom * factor));
  const applied = newZoom / zoom;
  offsetX = cssX - (cssX - offsetX) * applied;
  offsetY = cssY - (cssY - offsetY) * applied;
  zoom = newZoom;
  draw();
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.15 : 1 / 1.15);
}

function onPointerDown(event: PointerEvent) {
  canvas.setPointerCapture(event.pointerId);
  const rect = canvas.getBoundingClientRect();
  pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  if (pointers.size === 1) {
    panStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
    pinchStart = null;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    panStart = null;
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return;
  const rect = canvas.getBoundingClientRect();
  pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (dist > 0 && pinchStart.dist > 0) {
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const target = Math.max(0.05, Math.min(40, pinchStart.zoom * (dist / pinchStart.dist)));
      zoomAt(center.x, center.y, target / zoom);
    }
    return;
  }
  if (panStart) {
    offsetX = panStart.offsetX + (event.clientX - panStart.x);
    offsetY = panStart.offsetY + (event.clientY - panStart.y);
    draw();
  }
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) panStart = null;
}

onMount(() => {
  if (!state.result && state.croppedImage && !state.processing) void project.recompute();
  const observer = new ResizeObserver(() => draw());
  observer.observe(container);
  return () => observer.disconnect();
});
</script>

<h2 class="mb-3 text-lg font-semibold">{$_('outline.title')}</h2>

<div class="mb-3 flex flex-wrap items-center gap-2">
  <label class="flex min-h-[44px] items-center gap-2 text-sm">
    <input type="checkbox" class="h-5 w-5 accent-blue-600" bind:checked={showFill} />
    {$_('outline.showColors')}
  </label>
  <label class="flex min-h-[44px] items-center gap-2 text-sm">
    <input type="checkbox" class="h-5 w-5 accent-blue-600" bind:checked={showNumbers} />
    {$_('outline.showNumbers')}
  </label>
  <label class="flex min-h-[44px] items-center gap-2 text-sm">
    {$_('outline.numberOpacity')}
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      class="w-24 accent-blue-600 sm:w-32"
      value={Math.round(state.numberOpacity * 100)}
      disabled={!showNumbers}
      aria-valuetext="{Math.round(state.numberOpacity * 100)}%"
      on:input={(e) => project.setNumberOpacity(Number(e.currentTarget.value) / 100)}
    />
    <span class="w-10 text-xs text-slate-500 dark:text-slate-400">
      {Math.round(state.numberOpacity * 100)}%
    </span>
  </label>
  <label class="flex min-h-[44px] items-center gap-2 text-sm">
    {$_('outline.lineWidth')}
    <input
      type="range"
      min="50"
      max="250"
      step="10"
      class="w-24 accent-blue-600 sm:w-32"
      value={Math.round(state.lineScale * 100)}
      aria-valuetext="{Math.round(state.lineScale * 100)}%"
      on:input={(e) => project.setLineScale(Number(e.currentTarget.value) / 100)}
    />
    <span class="w-10 text-xs text-slate-500 dark:text-slate-400">
      {Math.round(state.lineScale * 100)}%
    </span>
  </label>
  <div class="ml-auto flex gap-2">
    <button type="button" class="btn-secondary !px-3" aria-label={$_('outline.zoomOut')} on:click={() => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1 / 1.3)}>−</button>
    <button type="button" class="btn-secondary !px-3" aria-label={$_('outline.zoomIn')} on:click={() => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.3)}>+</button>
    <button type="button" class="btn-secondary" on:click={fit}>{$_('outline.fit')}</button>
  </div>
</div>

<div bind:this={container} class="card overflow-hidden !p-0">
  <canvas
    bind:this={canvas}
    class="w-full touch-none {state.processing ? 'opacity-50' : ''}"
    aria-label={$_('outline.canvasLabel')}
    on:wheel={onWheel}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
  ></canvas>
</div>
