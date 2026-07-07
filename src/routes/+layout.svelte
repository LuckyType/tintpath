<script lang="ts">
import '../app.css';
import BackgroundArt from '$lib/components/BackgroundArt.svelte';
import GitHubLink from '$lib/components/GitHubLink.svelte';
import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
import { settings } from '$lib/stores/settings';
import { dismissToast, toast, toasts } from '$lib/stores/toast';
import { Moon, Sun } from 'lucide-svelte';
import { onMount } from 'svelte';
import { _, locale } from 'svelte-i18n';

$: if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', $settings.theme === 'dark');
}
$: locale.set($settings.locale);

function toggleTheme() {
  settings.update((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
}

onMount(() => {
  const onError = () => toast('error', $_('errors.generic'));
  window.addEventListener('error', onError);
  return () => window.removeEventListener('error', onError);
});
</script>

<BackgroundArt />

<div class="flex min-h-screen flex-col">
  <header
    class="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-800/80"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
      <a href="/" class="flex items-center gap-2 text-lg font-bold tracking-tight">
        <span
          class="inline-block h-6 w-6 rounded bg-gradient-to-br from-blue-500 via-violet-500 to-pink-500"
          aria-hidden="true"
        ></span>
        {$_('app.title')}
      </a>
      <p class="hidden text-sm text-slate-500 dark:text-slate-400 md:block">{$_('app.tagline')}</p>
      <div class="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <button
          type="button"
          class="btn-secondary !min-h-[36px] !px-3"
          on:click={toggleTheme}
          aria-label={$_('settings.theme')}
          title={$settings.theme === 'dark' ? $_('settings.themeLight') : $_('settings.themeDark')}
        >
          {#if $settings.theme === 'dark'}
            <Sun class="h-4 w-4" aria-hidden="true" />
          {:else}
            <Moon class="h-4 w-4" aria-hidden="true" />
          {/if}
        </button>
        <GitHubLink />
      </div>
    </div>
  </header>

  <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
    <slot />
  </main>

  <footer
    class="border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400"
  >
    <p>{$_('app.privacy')}</p>
    <p class="mt-1">
      {$_('footer.openSource')} · {$_('footer.noUploads')} ·
      <a
        class="underline hover:text-blue-600"
        href="https://github.com/LuckyType/tintpath"
        rel="noreferrer"
        target="_blank">GitHub</a
      >
      ·
      <a class="underline hover:text-blue-600" href="/imprint">{$_('imprint.title')}</a>
      ·
      <a class="underline hover:text-blue-600" href="/privacy">{$_('privacy.title')}</a>
    </p>
  </footer>
</div>

<div
  class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
  aria-live="polite"
>
  {#each $toasts as t (t.id)}
    <button
      type="button"
      class="pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm text-white shadow-lg
        {t.kind === 'error' ? 'bg-red-600' : t.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-700'}"
      on:click={() => dismissToast(t.id)}
    >
      {t.message}
    </button>
  {/each}
</div>
