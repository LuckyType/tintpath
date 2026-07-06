import { writable } from 'svelte/store';
import type { Settings } from '../types';

const STORAGE_KEY = 'tintpath:settings';

const defaults: Settings = {
  locale: 'en',
  theme: 'light',
  advancedMode: false,
};

function detectDefaults(): Settings {
  if (typeof window === 'undefined') return defaults;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const lang = (navigator.language ?? 'en').slice(0, 2).toLowerCase();
  return {
    ...defaults,
    theme: prefersDark ? 'dark' : 'light',
    locale: lang === 'de' ? 'de' : 'en',
  };
}

export function loadSettings(): Settings {
  const base = detectDefaults();
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: parsed.locale === 'de' || parsed.locale === 'en' ? parsed.locale : base.locale,
      theme: parsed.theme === 'dark' || parsed.theme === 'light' ? parsed.theme : base.theme,
      advancedMode: typeof parsed.advancedMode === 'boolean' ? parsed.advancedMode : false,
    };
  } catch {
    return base;
  }
}

export const settings = writable<Settings>(loadSettings());

settings.subscribe((value) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked — settings simply won't persist.
  }
});
