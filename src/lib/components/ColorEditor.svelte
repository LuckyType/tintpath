<script lang="ts">
import { buildRegionColorMap, drawTemplate } from '$lib/render';
import { project } from '$lib/stores/project';
import type { PaletteFilter } from '$lib/types';
import { onMount } from 'svelte';
import { _ } from 'svelte-i18n';

let canvas: HTMLCanvasElement;
let container: HTMLDivElement;

const filters: { id: PaletteFilter; labelKey: string }[] = [
  { id: 'none', labelKey: 'colors.filterNone' },
  { id: 'pastel', labelKey: 'colors.filterPastel' },
  { id: 'vintage', labelKey: 'colors.filterVintage' },
  { id: 'high-contrast', labelKey: 'colors.filterHighContrast' },
  { id: 'grayscale', labelKey: 'colors.filterGrayscale' },
];

$: state = $project;
$: if (canvas && state.result) redrawOn(state.palette, state.result);

function redrawOn(..._deps: unknown[]) {
  draw();
}

function draw() {
  const result = state.result;
  if (!result || !canvas || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = container.clientWidth - 16;
  const scale = cssW / result.width;
  const cssH = result.height * scale;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawTemplate(ctx, {
    outlines: result.outlines,
    placements: result.placements,
    palette: state.palette,
    regionColorIds: buildRegionColorMap(result.regions),
    width: result.width,
    height: result.height,
    scale: scale * dpr,
    showFill: true,
    showNumbers: false,
    lineWidth: 1 * dpr,
  });
}

function onSwap(colorId: number, event: Event) {
  project.swapPaletteColor(colorId, (event.currentTarget as HTMLInputElement).value);
}

onMount(() => {
  if (!state.result && state.croppedImage) void project.recompute();
  const observer = new ResizeObserver(() => draw());
  observer.observe(container);
  return () => observer.disconnect();
});
</script>

<h2 class="mb-1 text-lg font-semibold">{$_('colors.title')}</h2>
<p class="mb-3 text-sm text-slate-500 dark:text-slate-400">{$_('colors.hint')}</p>

<div class="grid gap-4 lg:grid-cols-[1fr_320px]">
  <div bind:this={container} class="card flex items-start justify-center !p-2">
    <canvas bind:this={canvas} class="rounded" aria-label={$_('colors.title')}></canvas>
  </div>

  <div class="flex flex-col gap-4">
    <div class="card">
      <p class="field-label">{$_('colors.filters')}</p>
      <div class="flex flex-wrap gap-2">
        {#each filters as filter (filter.id)}
          <button
            type="button"
            class="btn-secondary {state.activeFilter === filter.id
              ? '!border-blue-500 !text-blue-600 dark:!text-blue-400'
              : ''}"
            aria-pressed={state.activeFilter === filter.id}
            on:click={() => project.applyPaletteFilter(filter.id)}
          >
            {$_(filter.labelKey)}
          </button>
        {/each}
      </div>
    </div>

    <div class="card max-h-[420px] overflow-y-auto">
      <ul class="flex flex-col gap-1">
        {#each state.palette as color (color.id)}
          <li>
            <label
              class="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span
                class="w-7 text-right text-sm font-semibold text-slate-500 dark:text-slate-400"
              >
                {color.id + 1}
              </span>
              <input
                type="color"
                class="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                value={color.hex}
                aria-label={$_('colors.colorNumber', { values: { number: color.id + 1 } })}
                on:input={(e) => onSwap(color.id, e)}
              />
              <code class="text-xs text-slate-500 dark:text-slate-400">{color.hex}</code>
            </label>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
