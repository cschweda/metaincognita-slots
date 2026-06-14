<!-- app/components/learn/LearnDisclosure.vue -->
<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <details class="rounded-lg border border-neutral-800 bg-neutral-900/50 group">
    <summary class="cursor-pointer select-none px-4 py-2 text-sm text-amber-400 flex items-center gap-2 marker:content-['']">
      <UIcon
        name="i-lucide-chevron-right"
        class="w-4 h-4 transition-transform group-open:rotate-90"
      />
      {{ label }}
    </summary>
    <div class="px-4 py-3 border-t border-neutral-800 space-y-3 text-sm text-neutral-300">
      <slot />
    </div>
  </details>
</template>
