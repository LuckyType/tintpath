<script lang="ts">
import { settings } from '$lib/stores/settings';
import type { Locale } from '$lib/types';
import { _ } from 'svelte-i18n';

function setLocale(locale: Locale) {
  settings.update((s) => ({ ...s, locale }));
}

const baseClass =
  'flex min-h-[36px] items-center gap-1.5 px-2.5 text-xs font-semibold transition-colors';
const activeClass = 'bg-blue-600 text-white';
const inactiveClass =
  'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
</script>

<div
  class="mr-2 flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600"
  role="group"
  aria-label={$_('settings.language')}
>
  <button
    type="button"
    class="{baseClass} {$settings.locale === 'de' ? activeClass : inactiveClass}"
    aria-pressed={$settings.locale === 'de'}
    on:click={() => setLocale('de')}
  >
    <svg viewBox="0 0 5 3" class="h-3 w-5 rounded-[2px]" aria-hidden="true">
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#dd0000" />
      <rect width="5" height="1" y="2" fill="#ffce00" />
    </svg>
    DE
  </button>
  <button
    type="button"
    class="{baseClass} {$settings.locale === 'en' ? activeClass : inactiveClass}"
    aria-pressed={$settings.locale === 'en'}
    on:click={() => setLocale('en')}
  >
    <svg viewBox="0 0 60 30" class="h-3 w-5 rounded-[2px]" aria-hidden="true">
      <clipPath id="uk-clip"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" stroke-width="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        stroke="#c8102e"
        stroke-width="4"
        clip-path="url(#uk-clip)"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" stroke-width="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6" />
    </svg>
    EN
  </button>
</div>
