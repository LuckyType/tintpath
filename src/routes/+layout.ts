import { setupI18n } from '$lib/i18n';
import { loadSettings } from '$lib/stores/settings';
import { waitLocale } from 'svelte-i18n';

// Fully client-side app: prerender an empty shell, hydrate in the browser.
export const prerender = true;
export const ssr = false;

export async function load() {
  setupI18n(loadSettings().locale);
  await waitLocale();
}
