<script lang="ts">
import { renderQuantizedPixels } from '$lib/render';
import { project } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';
import { onDestroy, onMount } from 'svelte';
import { _ } from 'svelte-i18n';

const DEBOUNCE_MS = 200;

let originalCanvas: HTMLCanvasElement;
let quantizedCanvas: HTMLCanvasElement;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

$: state = $project;
$: colorCount = state.palette.length;
$: regionCount = state.result?.regions.length ?? 0;

$: if (originalCanvas && state.croppedImage) drawOriginal();
$: if (quantizedCanvas && state.result) drawQuantized();

function drawOriginal() {
  const image = state.croppedImage;
  if (!image) return;
  originalCanvas.width = image.width;
  originalCanvas.height = image.height;
  originalCanvas.getContext('2d')?.putImageData(image, 0, 0);
}

function drawQuantized() {
  const result = state.result;
  if (!result) return;
  quantizedCanvas.width = result.width;
  quantizedCanvas.height = result.height;
  const pixels = renderQuantizedPixels(result.labelMap, state.palette, result.width, result.height);
  quantizedCanvas
    .getContext('2d')
    ?.putImageData(new ImageData(pixels, result.width, result.height), 0, 0);
}

function scheduleRecompute() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void project.recompute(), DEBOUNCE_MS);
}

function onDetailInput(event: Event) {
  project.setDetailLevel(Number((event.currentTarget as HTMLInputElement).value));
  scheduleRecompute();
}

function onMinRegionInput(event: Event) {
  project.setMinRegionSize(Number((event.currentTarget as HTMLInputElement).value));
  scheduleRecompute();
}

function onNoiseChange(event: Event) {
  project.setReduceNoise((event.currentTarget as HTMLInputElement).checked);
  scheduleRecompute();
}

onMount(() => {
  if (!state.croppedImage) project.applyCrop();
  if (!$project.result && $project.croppedImage) void project.recompute();
});

onDestroy(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<h2 class="mb-3 text-lg font-semibold">{$_('detail.title')}</h2>

<div class="grid gap-4 lg:grid-cols-[1fr_280px]">
  <div class="grid gap-3 sm:grid-cols-2">
    <figure class="card !p-2">
      <figcaption class="mb-1 text-center text-xs font-medium text-slate-500">
        {$_('detail.original')}
      </figcaption>
      <canvas bind:this={originalCanvas} class="w-full rounded" aria-label={$_('detail.original')}
      ></canvas>
    </figure>
    <figure class="card relative !p-2">
      <figcaption class="mb-1 text-center text-xs font-medium text-slate-500">
        {$_('detail.quantized')}
      </figcaption>
      <canvas bind:this={quantizedCanvas} class="w-full rounded" aria-label={$_('detail.quantized')}
      ></canvas>
      {#if state.processing}
        <div
          class="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-slate-900/60"
        >
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
            role="status"
            aria-label={$_('detail.processing')}
          ></div>
        </div>
      {/if}
    </figure>
  </div>

  <div class="card flex flex-col gap-4">
    <div>
      <label class="field-label" for="detail-slider">
        {$_('detail.colors')}: <strong>{state.detailLevel}</strong>
      </label>
      <input
        id="detail-slider"
        type="range"
        min="5"
        max="50"
        step="1"
        class="w-full accent-blue-600"
        value={state.detailLevel}
        on:input={onDetailInput}
        aria-valuetext={String(state.detailLevel)}
      />
    </div>

    <p class="text-sm font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
      {#if state.result}
        {$_('detail.stats', { values: { colors: colorCount, regions: regionCount } })}
      {:else}
        {$_('detail.processing')}
      {/if}
    </p>

    {#if state.palette.length > 0}
      <div class="flex flex-wrap gap-1" role="list">
        {#each state.palette as color (color.id)}
          <span
            role="listitem"
            class="h-6 w-6 rounded border border-slate-300 dark:border-slate-600"
            style="background: {color.hex}"
            title="{color.id + 1}: {color.hex}"
          ></span>
        {/each}
      </div>
    {/if}

    <details open={$settings.advancedMode}>
      <summary class="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
        {$_('detail.advanced')}
      </summary>
      <div class="mt-3 flex flex-col gap-4">
        <div>
          <label class="field-label" for="min-region">
            {$_('detail.minRegion')}: <strong>{state.minRegionSize}</strong>
          </label>
          <input
            id="min-region"
            type="range"
            min="10"
            max="1000"
            step="10"
            class="w-full accent-blue-600"
            value={state.minRegionSize}
            on:input={onMinRegionInput}
          />
          <p class="mt-1 text-xs text-slate-500">{$_('detail.minRegionHint')}</p>
        </div>
        <label class="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="h-5 w-5 accent-blue-600"
            checked={state.reduceNoise}
            on:change={onNoiseChange}
          />
          <span>
            {$_('detail.reduceNoise')}
            <span class="block text-xs text-slate-500">{$_('detail.reduceNoiseHint')}</span>
          </span>
        </label>
      </div>
    </details>

    {#if state.error}
      <p class="text-sm text-red-600" role="alert">{$_('errors.pipeline')}</p>
    {/if}
  </div>
</div>
