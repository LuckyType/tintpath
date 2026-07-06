<script lang="ts">
import { project } from '$lib/stores/project';
import { toast } from '$lib/stores/toast';
import { _ } from 'svelte-i18n';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 4000;
const MAX_BYTES = 50 * 1024 * 1024;

let dragOver = false;
let loading = false;
let fileInput: HTMLInputElement;

async function toBitmap(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file);
  const largest = Math.max(bitmap.width, bitmap.height);
  if (largest <= MAX_SIDE) return bitmap;
  // Downscale oversized images before they enter the pipeline
  const scale = MAX_SIDE / largest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return bitmap;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return createImageBitmap(canvas);
}

async function handleFile(file: File | undefined | null) {
  if (!file) return;
  if (!ACCEPTED.includes(file.type)) {
    toast('error', $_('upload.errorFormat'));
    return;
  }
  if (file.size > MAX_BYTES && !confirm($_('upload.confirmLarge'))) return;
  loading = true;
  try {
    const bitmap = await toBitmap(file);
    project.setImage(bitmap, file.name);
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
</script>

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
    <svg
      class="h-14 w-14 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
    <p class="text-lg font-medium">{$_('upload.drop')}</p>
    <p class="text-sm text-slate-500">{$_('upload.or')}</p>
    <span class="btn-primary pointer-events-none">{$_('upload.browse')}</span>
    <p id="upload-formats" class="text-xs text-slate-400">{$_('upload.formats')}</p>
  {/if}
</div>

<input
  bind:this={fileInput}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/*"
  class="hidden"
  on:change={onChange}
/>
