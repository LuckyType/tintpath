<script lang="ts">
import AdvancedToggle from '$lib/components/AdvancedToggle.svelte';
import PreviewModal from '$lib/components/PreviewModal.svelte';
import { renderQuantizedPixels } from '$lib/render';
import { project } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';
import type { Smoothing } from '$lib/types';
import { Maximize2, Plus, X } from 'lucide-svelte';
import { onDestroy, onMount } from 'svelte';
import { _ } from 'svelte-i18n';

const DEBOUNCE_MS = 200;

let originalCanvas: HTMLCanvasElement;
let quantizedCanvas: HTMLCanvasElement;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let modal: PreviewModal;
let modalTitle = '';

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

function onSmoothingChange(event: Event) {
  project.setSmoothing((event.currentTarget as HTMLSelectElement).value as Smoothing);
  scheduleRecompute();
}

function toggleCustomPalette(event: Event) {
  if ((event.currentTarget as HTMLInputElement).checked) {
    // Start from the current result so users tweak instead of typing hexes
    const seed =
      state.palette.length >= 2 ? state.palette.map((c) => c.hex) : ['#1e293b', '#f8fafc'];
    project.setCustomPalette(seed);
  } else {
    project.setCustomPalette(null);
  }
  scheduleRecompute();
}

function updateCustomColor(index: number, event: Event) {
  const hexes = [...(state.customPalette ?? [])];
  hexes[index] = (event.currentTarget as HTMLInputElement).value;
  project.setCustomPalette(hexes);
  scheduleRecompute();
}

function removeCustomColor(index: number) {
  const hexes = (state.customPalette ?? []).filter((_, i) => i !== index);
  project.setCustomPalette(hexes.length > 0 ? hexes : null);
  scheduleRecompute();
}

function addCustomColor() {
  project.setCustomPalette([...(state.customPalette ?? []), '#808080']);
  scheduleRecompute();
}

function expandOriginal() {
  const image = state.croppedImage;
  if (!image || !modal) return;
  modalTitle = $_('detail.original');
  modal.show((canvas) => {
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')?.putImageData(image, 0, 0);
  });
}

function expandQuantized() {
  const result = state.result;
  if (!result || !modal) return;
  modalTitle = $_('detail.quantized');
  const palette = state.palette;
  modal.show((canvas) => {
    canvas.width = result.width;
    canvas.height = result.height;
    const pixels = renderQuantizedPixels(result.labelMap, palette, result.width, result.height);
    canvas.getContext('2d')?.putImageData(new ImageData(pixels, result.width, result.height), 0, 0);
  });
}

onMount(() => {
  if (!state.croppedImage) project.applyCrop();
  if (!$project.result && $project.croppedImage && !$project.processing) void project.recompute();
});

onDestroy(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<h2 class="mb-3 text-lg font-semibold">{$_('detail.title')}</h2>

<div class="grid gap-4 lg:grid-cols-[1fr_280px]">
  <div class="grid gap-3 sm:grid-cols-2">
    <figure class="card relative !p-2">
      <figcaption class="mb-1 text-center text-xs font-medium text-slate-500">
        {$_('detail.original')}
      </figcaption>
      <canvas bind:this={originalCanvas} class="w-full rounded" aria-label={$_('detail.original')}
      ></canvas>
      <button
        type="button"
        class="absolute right-3 top-3 rounded-lg bg-white/85 p-2 text-slate-600 shadow hover:bg-white dark:bg-slate-900/85 dark:text-slate-300 dark:hover:bg-slate-900"
        aria-label={$_('common.enlarge')}
        title={$_('common.enlarge')}
        on:click={expandOriginal}
      >
        <Maximize2 class="h-4 w-4" aria-hidden="true" />
      </button>
    </figure>
    <figure class="card relative !p-2">
      <figcaption class="mb-1 text-center text-xs font-medium text-slate-500">
        {$_('detail.quantized')}
      </figcaption>
      <canvas bind:this={quantizedCanvas} class="w-full rounded" aria-label={$_('detail.quantized')}
      ></canvas>
      <button
        type="button"
        class="absolute right-3 top-3 rounded-lg bg-white/85 p-2 text-slate-600 shadow hover:bg-white dark:bg-slate-900/85 dark:text-slate-300 dark:hover:bg-slate-900"
        aria-label={$_('common.enlarge')}
        title={$_('common.enlarge')}
        on:click={expandQuantized}
      >
        <Maximize2 class="h-4 w-4" aria-hidden="true" />
      </button>
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
        disabled={state.customPalette !== null}
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

    <AdvancedToggle />
    {#if $settings.advancedMode}
      <div class="flex flex-col gap-4">
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
        <div>
          <label class="field-label" for="smoothing-select">{$_('detail.smoothing')}</label>
          <select
            id="smoothing-select"
            class="select"
            value={state.smoothing}
            on:change={onSmoothingChange}
          >
            <option value="low">{$_('detail.smoothingLow')}</option>
            <option value="medium">{$_('detail.smoothingMedium')}</option>
            <option value="high">{$_('detail.smoothingHigh')}</option>
          </select>
          <p class="mt-1 text-xs text-slate-500">{$_('detail.smoothingHint')}</p>
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
        <div>
          <label class="flex min-h-[44px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              class="h-5 w-5 accent-blue-600"
              checked={state.customPalette !== null}
              on:change={toggleCustomPalette}
            />
            <span>
              {$_('detail.customPalette')}
              <span class="block text-xs text-slate-500">{$_('detail.customPaletteHint')}</span>
            </span>
          </label>
          {#if state.customPalette}
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              {#each state.customPalette as hex, i (i)}
                <span class="relative inline-flex">
                  <input
                    type="color"
                    class="h-9 w-11 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                    value={hex}
                    aria-label={$_('colors.colorNumber', { values: { number: i + 1 } })}
                    on:change={(e) => updateCustomColor(i, e)}
                  />
                  <button
                    type="button"
                    class="absolute -right-1.5 -top-1.5 rounded-full bg-slate-600 p-0.5 text-white hover:bg-red-600"
                    aria-label={$_('detail.removeColor')}
                    on:click={() => removeCustomColor(i)}
                  >
                    <X class="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </span>
              {/each}
              <button
                type="button"
                class="btn-secondary !min-h-[36px] !px-2.5"
                aria-label={$_('detail.addColor')}
                title={$_('detail.addColor')}
                on:click={addCustomColor}
              >
                <Plus class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if state.error}
      <p class="text-sm text-red-600" role="alert">{$_('errors.pipeline')}</p>
    {/if}
  </div>
</div>

<PreviewModal bind:this={modal} title={modalTitle} />
