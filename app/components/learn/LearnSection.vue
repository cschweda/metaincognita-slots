<!-- app/components/learn/LearnSection.vue -->
<script setup lang="ts">
defineProps<{ title: string, headline?: string, headlineLabel?: string }>()
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-xl font-bold text-amber-400">
      {{ title }}
    </h2>
    <div
      v-if="headline"
      class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
    >
      <div class="text-[10px] uppercase tracking-widest text-amber-300/70">
        {{ headlineLabel }}
      </div>
      <div class="text-2xl font-mono text-amber-300">
        {{ headline }}
      </div>
    </div>
    <div class="text-neutral-300 leading-relaxed space-y-3">
      <slot name="intuition" />
    </div>
    <slot />
  </section>
</template>
