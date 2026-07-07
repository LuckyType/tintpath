<script lang="ts">
import ColorEditor from '$lib/components/ColorEditor.svelte';
import Cropper from '$lib/components/Cropper.svelte';
import DetailSlider from '$lib/components/DetailSlider.svelte';
import ExportPanel from '$lib/components/ExportPanel.svelte';
import OutlineView from '$lib/components/OutlineView.svelte';
import Uploader from '$lib/components/Uploader.svelte';
import { clearSession, persistState } from '$lib/persist';
import { TOTAL_STEPS, project } from '$lib/stores/project';
import type { ProjectState } from '$lib/types';
import { onDestroy } from 'svelte';
import { _ } from 'svelte-i18n';

const stepKeys = ['upload', 'crop', 'detail', 'outline', 'colors', 'export'] as const;

const SAVE_DEBOUNCE_MS = 1000;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let latestState: ProjectState | null = null;

// Auto-save the session (locally, IndexedDB) so users can pick up later
const unsubscribeSave = project.subscribe((s) => {
  latestState = s;
  if (!s.sourceImage || !s.sourceBlob) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (latestState) void persistState(latestState);
  }, SAVE_DEBOUNCE_MS);
});

onDestroy(() => {
  unsubscribeSave();
  if (saveTimer) clearTimeout(saveTimer);
});

$: state = $project;

$: nextDisabled =
  (state.step === 1 && !state.sourceImage) ||
  (state.step === 2 && !state.crop) ||
  (state.step === 3 && (!state.result || state.processing)) ||
  (state.step === 4 && !state.result) ||
  state.step >= TOTAL_STEPS;

function handleNext() {
  if (state.step === 2) {
    project.applyCrop();
    project.nextStep();
    if (!$project.result) void project.recompute();
    return;
  }
  project.nextStep();
}

function handleStepClick(step: number) {
  if (step < state.step) project.goToStep(step);
}

function handleReset() {
  if (saveTimer) clearTimeout(saveTimer);
  project.reset();
  void clearSession();
}
</script>

<svelte:head>
  <title>Tintpath</title>
</svelte:head>

<nav aria-label={$_('nav.stepOf', { values: { current: state.step, total: TOTAL_STEPS } })}>
  <ol class="mb-6 flex flex-wrap items-center gap-1 text-sm sm:gap-2">
    {#each stepKeys as key, i}
      {@const stepNumber = i + 1}
      <li class="flex items-center gap-1 sm:gap-2">
        {#if i > 0}
          <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">→</span>
        {/if}
        <button
          type="button"
          class="flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1 sm:px-3
            {stepNumber === state.step
            ? 'bg-blue-600 text-white'
            : stepNumber < state.step
              ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800'
              : 'cursor-default text-slate-400 dark:text-slate-500'}"
          aria-current={stepNumber === state.step ? 'step' : undefined}
          disabled={stepNumber >= state.step}
          on:click={() => handleStepClick(stepNumber)}
        >
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full border text-xs
              {stepNumber === state.step ? 'border-white/60' : 'border-current'}"
          >
            {stepNumber}
          </span>
          <span class="hidden md:inline">{$_(`steps.${key}`)}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>

<p class="sr-only" aria-live="polite">
  {$_('nav.stepOf', { values: { current: state.step, total: TOTAL_STEPS } })}
</p>

{#if state.step === 1}
  <Uploader />
{:else if state.step === 2}
  <Cropper />
{:else if state.step === 3}
  <DetailSlider />
{:else if state.step === 4}
  <OutlineView />
{:else if state.step === 5}
  <ColorEditor />
{:else if state.step === 6}
  <ExportPanel />
{/if}

<div class="mt-6 flex items-center justify-between gap-3">
  <div class="flex gap-2">
    {#if state.step > 1}
      <button type="button" class="btn-secondary" on:click={() => project.prevStep()}>
        ← {$_('nav.back')}
      </button>
    {/if}
    {#if state.sourceImage}
      <button type="button" class="btn-secondary" on:click={handleReset}>
        {$_('nav.startOver')}
      </button>
    {/if}
  </div>
  {#if state.step < TOTAL_STEPS && state.step > 1}
    <button type="button" class="btn-primary" disabled={nextDisabled} on:click={handleNext}>
      {$_('nav.next')} →
    </button>
  {/if}
</div>
