<script lang="ts">
import { generateDxf } from '$lib/export/dxf';
import { exportPdf } from '$lib/export/pdf';
import { downloadBlob, exportGrayscalePng, exportRaster } from '$lib/export/png';
import { generateSvg } from '$lib/export/svg';
import { buildRegionColorMap, drawTemplate } from '$lib/render';
import { project } from '$lib/stores/project';
import { settings } from '$lib/stores/settings';
import { toast } from '$lib/stores/toast';
import type { LaserMode } from '$lib/types';
import { onMount } from 'svelte';
import { _ } from 'svelte-i18n';

let canvas: HTMLCanvasElement;
let container: HTMLDivElement;
let busy: string | null = null;
let withColors = false;
let withNumbers = true;

$: state = $project;
$: baseName = (state.sourceName.replace(/\.[^.]+$/, '') || 'tintpath').slice(0, 40);
$: if (canvas && state.result)
  redrawOn(state.palette, withColors, withNumbers, state.numberOpacity);

function redrawOn(..._deps: unknown[]) {
  draw();
}

function draw() {
  const result = state.result;
  if (!result || !canvas || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.min(container.clientWidth - 16, 520);
  const scale = cssW / result.width;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(result.height * scale * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${result.height * scale}px`;
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
    showFill: withColors,
    showNumbers: withNumbers,
    numberOpacity: state.numberOpacity,
    lineWidth: 1 * dpr,
  });
}

async function run(kind: string, action: () => Promise<void> | void) {
  if (busy || !state.result) return;
  busy = kind;
  try {
    await action();
    toast('success', $_('export.success'));
  } catch {
    toast('error', $_('export.error'));
  } finally {
    busy = null;
  }
}

const exportPng = () =>
  run('png', async () => {
    const result = state.result;
    if (!result) return;
    const blob = await exportRaster({
      kind: 'png',
      result,
      palette: state.palette,
      paperFormat: state.paperFormat,
      orientation: state.orientation,
      showFill: withColors,
      showNumbers: withNumbers,
      numberOpacity: state.numberOpacity,
    });
    downloadBlob(blob, `${baseName}-template.png`);
  });

const exportJpg = () =>
  run('jpg', async () => {
    const result = state.result;
    if (!result) return;
    const blob = await exportRaster({
      kind: 'jpeg',
      result,
      palette: state.palette,
      paperFormat: state.paperFormat,
      orientation: state.orientation,
      showFill: withColors,
      showNumbers: withNumbers,
      numberOpacity: state.numberOpacity,
    });
    downloadBlob(blob, `${baseName}-template.jpg`);
  });

const exportPdfFile = () =>
  run('pdf', async () => {
    const result = state.result;
    if (!result) return;
    const blob = await exportPdf({
      result,
      palette: state.palette,
      paperFormat: state.paperFormat,
      orientation: state.orientation,
      legendTitle: $_('export.legendTitle'),
      showFill: withColors,
      showNumbers: withNumbers,
      numberOpacity: state.numberOpacity,
    });
    downloadBlob(blob, `${baseName}-template.pdf`);
  });

const exportSvgFile = () =>
  run('svg', () => {
    const result = state.result;
    if (!result) return;
    const svg = generateSvg({
      outlines: result.outlines,
      regions: result.regions,
      palette: state.palette,
      width: result.width,
      height: result.height,
      mode: state.laserMode,
    });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${baseName}-laser.svg`);
  });

const exportDxfFile = () =>
  run('dxf', () => {
    const result = state.result;
    if (!result) return;
    const dxf = generateDxf(result.outlines, result.height);
    downloadBlob(new Blob([dxf], { type: 'application/dxf' }), `${baseName}-laser.dxf`);
  });

const exportGrayscale = () =>
  run('gray', async () => {
    const result = state.result;
    if (!result) return;
    const blob = await exportGrayscalePng(result, state.palette);
    downloadBlob(blob, `${baseName}-grayscale.png`);
  });

function onLaserMode(event: Event) {
  project.setLaserMode((event.currentTarget as HTMLSelectElement).value as LaserMode);
}

function onDpiChange(event: Event) {
  project.setPaperFormat({
    ...state.paperFormat,
    dpi: Number((event.currentTarget as HTMLSelectElement).value),
  });
}

onMount(() => {
  if (!state.result && state.croppedImage) void project.recompute();
  const observer = new ResizeObserver(() => draw());
  observer.observe(container);
  return () => observer.disconnect();
});
</script>

<h2 class="mb-3 text-lg font-semibold">{$_('export.title')}</h2>

<div class="grid gap-4 lg:grid-cols-[1fr_340px]">
  <div bind:this={container} class="card flex items-start justify-center !p-2">
    <canvas bind:this={canvas} class="rounded" aria-label={$_('export.title')}></canvas>
  </div>

  <div class="flex flex-col gap-4">
    <div class="card flex flex-col gap-3">
      <label class="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" class="h-5 w-5 accent-blue-600" bind:checked={withColors} />
        {$_('export.withColors')}
      </label>
      <label class="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" class="h-5 w-5 accent-blue-600" bind:checked={withNumbers} />
        {$_('export.withNumbers')}
      </label>
      <label class="flex min-h-[44px] items-center gap-2 text-sm">
        {$_('outline.numberOpacity')}
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          class="w-24 flex-1 accent-blue-600"
          value={Math.round(state.numberOpacity * 100)}
          disabled={!withNumbers}
          aria-valuetext="{Math.round(state.numberOpacity * 100)}%"
          on:input={(e) => project.setNumberOpacity(Number(e.currentTarget.value) / 100)}
        />
        <span class="w-10 text-right text-xs text-slate-500 dark:text-slate-400">
          {Math.round(state.numberOpacity * 100)}%
        </span>
      </label>
      {#if $settings.advancedMode}
        <div>
          <label class="field-label" for="export-dpi">{$_('export.resolution')}</label>
          <select
            id="export-dpi"
            class="select"
            value={String(state.paperFormat.dpi)}
            on:change={onDpiChange}
          >
            <option value="300">300 DPI</option>
            <option value="600">600 DPI</option>
          </select>
        </div>
      {/if}
    </div>

    <div class="card grid grid-cols-2 gap-2">
      <button type="button" class="btn-primary" disabled={busy !== null} on:click={exportPng}>
        {busy === 'png' ? $_('export.exporting') : $_('export.png')}
      </button>
      <button type="button" class="btn-primary" disabled={busy !== null} on:click={exportJpg}>
        {busy === 'jpg' ? $_('export.exporting') : $_('export.jpg')}
      </button>
      <button
        type="button"
        class="btn-primary col-span-2"
        disabled={busy !== null}
        on:click={exportPdfFile}
      >
        {busy === 'pdf' ? $_('export.exporting') : `${$_('export.pdf')} — ${$_('export.pdfHint')}`}
      </button>
    </div>

    <div class="card flex flex-col gap-3">
      <div>
        <label class="field-label" for="laser-mode">{$_('export.laserMode')}</label>
        <select id="laser-mode" class="select" value={state.laserMode} on:change={onLaserMode}>
          <option value="outline">{$_('export.laserOutline')}</option>
          <option value="layer-per-color">{$_('export.laserLayerPerColor')}</option>
          <option value="grayscale">{$_('export.laserGrayscale')}</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn-secondary" disabled={busy !== null} on:click={exportSvgFile}>
          {busy === 'svg' ? $_('export.exporting') : `${$_('export.svg')} ✦`}
        </button>
        <button type="button" class="btn-secondary" disabled={busy !== null} on:click={exportDxfFile}>
          {busy === 'dxf' ? $_('export.exporting') : $_('export.dxf')}
        </button>
        {#if state.laserMode === 'grayscale'}
          <button
            type="button"
            class="btn-secondary col-span-2"
            disabled={busy !== null}
            on:click={exportGrayscale}
          >
            {busy === 'gray' ? $_('export.exporting') : $_('export.grayscalePng')}
          </button>
        {/if}
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">{$_('export.svgHint')}</p>
    </div>
  </div>
</div>
