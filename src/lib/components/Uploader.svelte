<script lang="ts">
import { loadBitmap, rotateBitmap } from '$lib/image';
import { type SavedSession, clearSession, loadSession } from '$lib/persist';
import { project } from '$lib/stores/project';
import { toast } from '$lib/stores/toast';
import { Sparkles } from 'lucide-svelte';
import { Upload } from 'lucide-svelte';
import { onMount } from 'svelte';
import { _, locale } from 'svelte-i18n';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 50 * 1024 * 1024;

let dragOver = false;
let loading = false;
let fileInput: HTMLInputElement;
let saved: SavedSession | null = null;

async function handleFile(file: File | undefined | null) {
  if (!file) return;
  if (!ACCEPTED.includes(file.type)) {
    toast('error', $_('upload.errorFormat'));
    return;
  }
  if (file.size > MAX_BYTES && !confirm($_('upload.confirmLarge'))) return;
  loading = true;
  try {
    const bitmap = await loadBitmap(file);
    project.setImage(bitmap, file.name, file);
  } catch {
    toast('error', $_('upload.errorLoad'));
  } finally {
    loading = false;
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  dragOver = false;
  void handleFile(event.dataTransfer?.files?.[0]);
}

function onChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  void handleFile(input.files?.[0]);
  input.value = '';
}

async function loadSample() {
  loading = true;
  try {
    const response = await fetch('/sample.png');
    const blob = await response.blob();
    const file = new File([blob], 'sample.png', { type: 'image/png' });
    await handleFile(file);
  } catch {
    toast('error', $_('upload.errorLoad'));
  } finally {
    loading = false;
  }
}

async function resumeSession() {
  if (!saved) return;
  loading = true;
  try {
    let bitmap = await loadBitmap(saved.imageBlob);
    if (saved.rotation) {
      bitmap = await rotateBitmap(bitmap, Math.round(saved.rotation / 90));
    }
    await project.restoreSession(saved, bitmap, saved.imageBlob);
  } catch {
    toast('error', $_('upload.errorLoad'));
    saved = null;
    void clearSession();
  } finally {
    loading = false;
  }
}

function discardSession() {
  saved = null;
  void clearSession();
}

onMount(async () => {
  saved = await loadSession();
});
</script>

{#if saved}
  <div
    class="card mb-4 flex flex-wrap items-center gap-3 !border-blue-300 bg-blue-50/60 dark:!border-blue-800 dark:bg-slate-800"
  >
    <div class="min-w-0 flex-1">
      <p class="font-medium">{$_('upload.resumeTitle')}</p>
      <p class="truncate text-sm text-slate-500 dark:text-slate-400">
        {saved.sourceName} · {$_('upload.resumeSavedAt', {
          values: { date: new Date(saved.savedAt).toLocaleString($locale ?? undefined) },
        })}
      </p>
    </div>
    <div class="flex gap-2">
      <button type="button" class="btn-primary" disabled={loading} on:click={resumeSession}>
        {$_('upload.resume')}
      </button>
      <button type="button" class="btn-secondary" disabled={loading} on:click={discardSession}>
        {$_('upload.discard')}
      </button>
    </div>
  </div>
{/if}

<div
  class="card flex min-h-[320px] flex-col items-center justify-center gap-4 border-2 border-dashed text-center
    {dragOver ? '!border-blue-500 bg-blue-50 dark:bg-slate-700' : ''}"
  role="button"
  tabindex="0"
  aria-describedby="upload-formats"
  on:dragover|preventDefault={() => (dragOver = true)}
  on:dragleave={() => (dragOver = false)}
  on:drop={onDrop}
  on:click={() => fileInput.click()}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click()}
>
  {#if loading}
    <div
      class="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
      role="status"
      aria-label={$_('detail.processing')}
    ></div>
  {:else}
    <Upload class="h-14 w-14 text-slate-400" strokeWidth={1.5} aria-hidden="true" />
    <p class="text-lg font-medium">{$_('upload.drop')}</p>
    <p class="text-sm text-slate-500">{$_('upload.or')}</p>
    <span class="btn-primary pointer-events-none">{$_('upload.browse')}</span>
    <p id="upload-formats" class="text-xs text-slate-400">{$_('upload.formats')}</p>
  {/if}
</div>

<button type="button" class="btn-secondary mx-auto mt-4 flex" disabled={loading} on:click={loadSample}>
  <Sparkles class="h-4 w-4" aria-hidden="true" />
  {$_('upload.sample')}
</button>

<input
  bind:this={fileInput}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/*"
  class="hidden"
  on:change={onChange}
/>
