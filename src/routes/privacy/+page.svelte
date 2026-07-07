<script lang="ts">
import { ArrowLeft } from 'lucide-svelte';
import { _ } from 'svelte-i18n';

const sections = [
  'controller',
  'noCookies',
  'processing',
  'storage',
  'hosting',
  'github',
  'rights',
] as const;
</script>

<svelte:head>
  <title>Tintpath — {$_('privacy.title')}</title>
</svelte:head>

<article class="mx-auto flex max-w-2xl flex-col gap-6">
  <div>
    <h1 class="text-2xl font-bold">{$_('privacy.title')}</h1>
    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{$_('privacy.updated')}</p>
    <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">{$_('privacy.intro')}</p>
  </div>

  {#each sections as section (section)}
    <section class="card">
      <h2 class="mb-2 text-lg font-semibold">{$_(`privacy.${section}Heading`)}</h2>
      <p class="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
        {$_(`privacy.${section}Body`)}
      </p>
      {#if section === 'controller'}
        <a href="/imprint" class="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400">
          {$_('imprint.title')}
        </a>
      {/if}
      {#if section === 'github'}
        <a
          href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
          target="_blank"
          rel="noreferrer"
          class="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400"
        >
          GitHub Privacy Statement
        </a>
      {/if}
    </section>
  {/each}

  <a href="/" class="btn-secondary self-start">
    <ArrowLeft class="h-4 w-4" aria-hidden="true" />
    {$_('privacy.backToApp')}
  </a>
</article>
