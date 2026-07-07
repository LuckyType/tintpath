<script lang="ts">
import { Maximize, Minimize, X } from 'lucide-svelte';
import { onDestroy } from 'svelte';
import { _ } from 'svelte-i18n';

export let title = '';

let open = false;
let modalEl: HTMLDivElement;
let viewportEl: HTMLDivElement;
let canvas: HTMLCanvasElement;
let closeButton: HTMLButtonElement;
let isFullscreen = false;

// Fitted display size (CSS px) of the canvas at zoom = 1
let baseW = 0;
let baseH = 0;
let zoom = 1;
let tx = 0;
let ty = 0;

const pointers = new Map<number, { x: number; y: number }>();
let pinchStart: { dist: number; zoom: number } | null = null;
let panStart: { x: number; y: number; tx: number; ty: number } | null = null;

/** Open the modal; `render` draws the full-resolution content onto the canvas. */
export function show(render: (canvas: HTMLCanvasElement) => void): void {
  open = true;
  zoom = 1;
  tx = 0;
  ty = 0;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    if (!canvas) return;
    render(canvas);
    fit();
    closeButton?.focus();
  });
}

function fit() {
  if (!viewportEl || !canvas || canvas.width === 0) return;
  const vw = viewportEl.clientWidth - 16;
  const vh = viewportEl.clientHeight - 16;
  const s = Math.min(vw / canvas.width, vh / canvas.height, 1.5);
  baseW = Math.max(1, canvas.width * s);
  baseH = Math.max(1, canvas.height * s);
}

function close() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  open = false;
  pointers.clear();
  panStart = null;
  pinchStart = null;
  document.body.style.overflow = '';
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (modalEl?.requestFullscreen) {
      await modalEl.requestFullscreen();
    }
  } catch {
    // Fullscreen unsupported or denied — the large modal still works.
  }
}

function onFullscreenChange() {
  isFullscreen = document.fullscreenElement === modalEl;
  requestAnimationFrame(() => {
    fit();
    zoom = 1;
    tx = 0;
    ty = 0;
  });
}

function onKeydown(event: KeyboardEvent) {
  if (open && event.key === 'Escape' && !document.fullscreenElement) close();
}

/** Zoom keeping the viewport point (vx, vy) — relative to center — fixed. */
function zoomAt(vx: number, vy: number, factor: number) {
  const next = Math.max(1, Math.min(12, zoom * factor));
  const applied = next / zoom;
  tx = vx - (vx - tx) * applied;
  ty = vy - (vy - ty) * applied;
  zoom = next;
  if (zoom === 1) {
    tx = 0;
    ty = 0;
  }
}

function pointFromEvent(event: { clientX: number; clientY: number }) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: event.clientX - rect.left - rect.width / 2,
    y: event.clientY - rect.top - rect.height / 2,
  };
}

function onWheel(event: WheelEvent) {
  event.preventDefault();
  const p = pointFromEvent(event);
  zoomAt(p.x, p.y, event.deltaY < 0 ? 1.2 : 1 / 1.2);
}

function onDblClick(event: MouseEvent) {
  const p = pointFromEvent(event);
  zoomAt(p.x, p.y, zoom > 1.01 ? 1 / zoom : 2.5);
}

function onPointerDown(event: PointerEvent) {
  viewportEl.setPointerCapture(event.pointerId);
  const p = pointFromEvent(event);
  pointers.set(event.pointerId, p);
  if (pointers.size === 1) {
    panStart = { x: p.x, y: p.y, tx, ty };
    pinchStart = null;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    panStart = null;
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return;
  const p = pointFromEvent(event);
  pointers.set(event.pointerId, p);

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (dist > 0 && pinchStart.dist > 0) {
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const target = Math.max(1, Math.min(12, pinchStart.zoom * (dist / pinchStart.dist)));
      zoomAt(center.x, center.y, target / zoom);
    }
    return;
  }
  if (panStart && zoom > 1) {
    tx = panStart.tx + (p.x - panStart.x);
    ty = panStart.ty + (p.y - panStart.y);
  }
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) panStart = null;
}

onDestroy(() => {
  document.body.style.overflow = '';
});
</script>

<svelte:window on:keydown={onKeydown} on:resize={() => open && fit()} />
<svelte:document on:fullscreenchange={onFullscreenChange} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-sm sm:p-6"
    on:click={(e) => e.target === e.currentTarget && close()}
  >
    <div
      bind:this={modalEl}
      class="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        class="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700"
      >
        <h3 class="truncate text-sm font-semibold">{title}</h3>
        <div class="flex items-center gap-1">
          <span class="mr-2 hidden text-xs text-slate-400 md:inline">{$_('common.zoomHint')}</span>
          <button
            type="button"
            class="btn-secondary !min-h-[36px] !px-2.5"
            aria-label={isFullscreen ? $_('common.exitFullscreen') : $_('common.fullscreen')}
            title={isFullscreen ? $_('common.exitFullscreen') : $_('common.fullscreen')}
            on:click={toggleFullscreen}
          >
            {#if isFullscreen}
              <Minimize class="h-4 w-4" aria-hidden="true" />
            {:else}
              <Maximize class="h-4 w-4" aria-hidden="true" />
            {/if}
          </button>
          <button
            bind:this={closeButton}
            type="button"
            class="btn-secondary !min-h-[36px] !px-2.5"
            aria-label={$_('common.close')}
            on:click={close}
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        bind:this={viewportEl}
        class="relative flex-1 touch-none overflow-hidden bg-slate-100 dark:bg-slate-950"
        on:wheel={onWheel}
        on:dblclick={onDblClick}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={onPointerUp}
        on:pointercancel={onPointerUp}
      >
        <canvas
          bind:this={canvas}
          class="absolute left-1/2 top-1/2 max-w-none rounded shadow-lg
            {zoom > 1 ? 'cursor-grab' : 'cursor-zoom-in'}"
          style="width: {baseW}px; height: {baseH}px; transform: translate(-50%, -50%) translate({tx}px, {ty}px) scale({zoom});"
        ></canvas>
      </div>
    </div>
  </div>
{/if}
