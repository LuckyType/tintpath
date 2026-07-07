<script lang="ts">
import AdvancedToggle from '$lib/components/AdvancedToggle.svelte';
import { PAPER_SIZES, customPaperFormat, makePaperFormat, paperAspect } from '$lib/paper';
import { defaultCrop, project } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';
import type { CropRegion } from '$lib/types';
import { RectangleHorizontal, RectangleVertical } from 'lucide-svelte';
import { onMount } from 'svelte';
import { _ } from 'svelte-i18n';

const MIN_CROP = 24;
const HANDLE_HIT = 18;

let canvas: HTMLCanvasElement;
let container: HTMLDivElement;
let customWidth = 300;
let customHeight = 200;

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
let drag: { mode: DragMode; startX: number; startY: number; crop: CropRegion } | null = null;

$: state = $project;
$: aspect = paperAspect(state.paperFormat, state.orientation);
$: isCustom = state.paperFormat.name === 'Custom';
$: if (canvas && state.sourceImage && state.crop) redraw();

let dispScale = 1;

function redraw() {
  const image = state.sourceImage;
  const crop = state.crop;
  if (!image || !crop || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const maxW = container.clientWidth;
  const maxH = Math.min(window.innerHeight * 0.6, 560);
  dispScale = Math.min(maxW / image.width, maxH / image.height);
  const cssW = Math.max(1, Math.round(image.width * dispScale));
  const cssH = Math.max(1, Math.round(image.height * dispScale));
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const t = dispScale * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(t, 0, 0, t, 0, 0);
  ctx.drawImage(image, 0, 0);

  // Dim everything outside the crop
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.rect(0, 0, image.width, image.height);
  ctx.rect(crop.x, crop.y, crop.w, crop.h);
  ctx.fill('evenodd');

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 / t;
  ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

  // Rule-of-thirds guides
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1 / t;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(crop.x + (crop.w * i) / 3, crop.y);
    ctx.lineTo(crop.x + (crop.w * i) / 3, crop.y + crop.h);
    ctx.moveTo(crop.x, crop.y + (crop.h * i) / 3);
    ctx.lineTo(crop.x + crop.w, crop.y + (crop.h * i) / 3);
    ctx.stroke();
  }

  // Corner handles
  const r = 7 / t;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2 / t;
  for (const [hx, hy] of corners(crop)) {
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function corners(crop: CropRegion): [number, number][] {
  return [
    [crop.x, crop.y],
    [crop.x + crop.w, crop.y],
    [crop.x, crop.y + crop.h],
    [crop.x + crop.w, crop.y + crop.h],
  ];
}

function toImage(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / dispScale,
    y: (event.clientY - rect.top) / dispScale,
  };
}

function hitTest(x: number, y: number, crop: CropRegion): DragMode | null {
  const threshold = HANDLE_HIT / dispScale;
  const modes: DragMode[] = ['nw', 'ne', 'sw', 'se'];
  const pts = corners(crop);
  for (let i = 0; i < 4; i++) {
    if (Math.hypot(x - pts[i][0], y - pts[i][1]) <= threshold) return modes[i];
  }
  if (x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h) return 'move';
  return null;
}

function onPointerDown(event: PointerEvent) {
  if (!state.crop) return;
  const p = toImage(event);
  const mode = hitTest(p.x, p.y, state.crop);
  if (!mode) return;
  drag = { mode, startX: p.x, startY: p.y, crop: { ...state.crop } };
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent) {
  if (!drag || !state.sourceImage) return;
  const image = state.sourceImage;
  const p = toImage(event);

  if (drag.mode === 'move') {
    const x = Math.max(0, Math.min(image.width - drag.crop.w, drag.crop.x + p.x - drag.startX));
    const y = Math.max(0, Math.min(image.height - drag.crop.h, drag.crop.y + p.y - drag.startY));
    project.setCrop({ ...drag.crop, x, y });
    return;
  }

  // Corner resize around the fixed opposite corner, aspect locked
  const c = drag.crop;
  const ox = drag.mode.includes('w') ? c.x + c.w : c.x;
  const oy = drag.mode.includes('n') ? c.y + c.h : c.y;
  const dirX = drag.mode.includes('w') ? -1 : 1;
  const dirY = drag.mode.includes('n') ? -1 : 1;
  let w = Math.max(MIN_CROP, (p.x - ox) * dirX);
  let h = w / aspect;
  const maxW = dirX > 0 ? image.width - ox : ox;
  const maxH = dirY > 0 ? image.height - oy : oy;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  project.setCrop({
    x: dirX > 0 ? ox : ox - w,
    y: dirY > 0 ? oy : oy - h,
    w,
    h,
  });
}

function onPointerUp(event: PointerEvent) {
  if (drag) canvas.releasePointerCapture(event.pointerId);
  drag = null;
}

function onPaperChange(event: Event) {
  const value = (event.currentTarget as HTMLSelectElement).value;
  if (value === 'Custom') {
    project.setPaperFormat(customPaperFormat(customWidth, customHeight, state.paperFormat.dpi));
  } else {
    project.setPaperFormat(makePaperFormat(value, state.paperFormat.dpi));
  }
}

function onCustomSize() {
  project.setPaperFormat(customPaperFormat(customWidth, customHeight, state.paperFormat.dpi));
}

function onDpiChange(event: Event) {
  const dpi = Number((event.currentTarget as HTMLSelectElement).value);
  project.setPaperFormat({ ...state.paperFormat, dpi });
}

function resetCrop() {
  if (!state.sourceImage) return;
  project.setCrop(defaultCrop(state.sourceImage.width, state.sourceImage.height, aspect));
}

onMount(() => {
  const observer = new ResizeObserver(() => redraw());
  observer.observe(container);
  return () => observer.disconnect();
});
</script>

<h2 class="mb-3 text-lg font-semibold">{$_('crop.title')}</h2>

<div class="grid gap-4 lg:grid-cols-[1fr_280px]">
  <div bind:this={container} class="card flex items-center justify-center overflow-hidden !p-2">
    <canvas
      bind:this={canvas}
      class="max-w-full touch-none rounded"
      aria-label={$_('crop.hint')}
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
    ></canvas>
  </div>

  <div class="card flex flex-col gap-4">
    <div>
      <label class="field-label" for="paper-select">{$_('crop.paperSize')}</label>
      <select
        id="paper-select"
        class="select"
        value={state.paperFormat.name}
        on:change={onPaperChange}
      >
        {#each PAPER_SIZES as size}
          <option value={size.id}>{size.id} ({size.width}×{size.height} mm)</option>
        {/each}
        <option value="Custom">{$_('crop.custom')}</option>
      </select>
    </div>

    {#if isCustom}
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="field-label" for="custom-w">{$_('crop.widthMm')}</label>
          <input
            id="custom-w"
            class="select"
            type="number"
            min="10"
            max="2000"
            bind:value={customWidth}
            on:change={onCustomSize}
          />
        </div>
        <div>
          <label class="field-label" for="custom-h">{$_('crop.heightMm')}</label>
          <input
            id="custom-h"
            class="select"
            type="number"
            min="10"
            max="2000"
            bind:value={customHeight}
            on:change={onCustomSize}
          />
        </div>
      </div>
    {/if}

    <fieldset>
      <legend class="field-label">{$_('crop.orientation')}</legend>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="btn-secondary {state.orientation === 'portrait' ? '!border-blue-500 !text-blue-600 dark:!text-blue-400' : ''}"
          aria-pressed={state.orientation === 'portrait'}
          on:click={() => project.setOrientation('portrait')}
        >
          <RectangleVertical class="h-4 w-4" aria-hidden="true" />
          {$_('crop.portrait')}
        </button>
        <button
          type="button"
          class="btn-secondary {state.orientation === 'landscape' ? '!border-blue-500 !text-blue-600 dark:!text-blue-400' : ''}"
          aria-pressed={state.orientation === 'landscape'}
          on:click={() => project.setOrientation('landscape')}
        >
          <RectangleHorizontal class="h-4 w-4" aria-hidden="true" />
          {$_('crop.landscape')}
        </button>
      </div>
    </fieldset>

    <AdvancedToggle />
    {#if $settings.advancedMode}
      <div>
        <label class="field-label" for="dpi-select">{$_('export.resolution')}</label>
        <select id="dpi-select" class="select" value={String(state.paperFormat.dpi)} on:change={onDpiChange}>
          <option value="300">300 DPI</option>
          <option value="600">600 DPI</option>
        </select>
      </div>
    {/if}

    <button type="button" class="btn-secondary" on:click={resetCrop}>{$_('crop.reset')}</button>
    <p class="text-xs text-slate-500 dark:text-slate-400">{$_('crop.hint')}</p>
  </div>
</div>
