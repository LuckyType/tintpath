import { getLocaleFromNavigator, init, register } from 'svelte-i18n';
import type { Locale } from '../types';

register('en', () => import('./en.json'));
register('de', () => import('./de.json'));

const SUPPORTED_LOCALES: Locale[] = ['de', 'en'];

function resolveLocale(preferred?: string | null): Locale {
  const candidate = (preferred ?? getLocaleFromNavigator() ?? 'en').slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(candidate) ? (candidate as Locale) : 'en';
}

export function setupI18n(initialLocale?: string | null): void {
  init({
    fallbackLocale: 'en',
    initialLocale: resolveLocale(initialLocale),
  });
}
