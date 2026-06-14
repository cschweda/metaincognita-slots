<!-- app/components/lab/ChartFrame.vue -->
<script setup lang="ts">
defineProps<{ title: string, summary: string }>()
</script>

<template>
  <figure class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-3 space-y-2">
    <figcaption class="text-xs uppercase tracking-widest text-neutral-400">
      {{ title }}
    </figcaption>
    <svg
      viewBox="0 0 320 170"
      class="w-full h-auto"
      role="img"
      :aria-label="`${title}. ${summary}`"
    >
      <slot />
    </svg>
    <p class="sr-only">
      {{ summary }}
    </p>
  </figure>
</template>
