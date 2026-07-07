<script lang="ts">
import { ArrowLeft } from 'lucide-svelte';
import { _ } from 'svelte-i18n';
</script>

<svelte:head>
  <title>Tintpath — {$_('imprint.title')}</title>
</svelte:head>

<article class="mx-auto flex max-w-2xl flex-col gap-6">
  <h1 class="text-2xl font-bold">{$_('imprint.title')}</h1>

  <section class="card">
    <h2 class="mb-2 text-lg font-semibold">{$_('imprint.contactHeading')}</h2>
    <p class="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
      {$_('imprint.contactBody')}
    </p>
  </section>

  <section class="card">
    <h2 class="mb-2 text-lg font-semibold">{$_('imprint.privacyHeading')}</h2>
    <p class="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
      {$_('imprint.privacyBody')}
    </p>
    <a href="/privacy" class="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400">
      {$_('privacy.title')}
    </a>
  </section>

  <section class="card">
    <h2 class="mb-2 text-lg font-semibold">{$_('imprint.disclaimerHeading')}</h2>
    <p class="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
      {$_('imprint.disclaimerBody')}
    </p>
  </section>

  <a href="/" class="btn-secondary self-start">
    <ArrowLeft class="h-4 w-4" aria-hidden="true" />
    {$_('imprint.backToApp')}
  </a>
</article>
