<script lang="ts">
import { settings } from '$lib/stores/settings';
import { _ } from 'svelte-i18n';

function toggle(event: Event) {
  const checked = (event.currentTarget as HTMLInputElement).checked;
  settings.update((s) => ({ ...s, advancedMode: checked }));
}
</script>

<label
  class="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
>
  <span>{$_('settings.advancedMode')}</span>
  <input
    type="checkbox"
    role="switch"
    class="peer sr-only"
    checked={$settings.advancedMode}
    on:change={toggle}
  />
  <span
    aria-hidden="true"
    class="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-slate-600"
  ></span>
</label>
