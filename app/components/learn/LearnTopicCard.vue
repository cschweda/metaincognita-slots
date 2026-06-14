<!-- app/components/learn/LearnTopicCard.vue -->
<script setup lang="ts">
defineProps<{ to: string, title: string, blurb: string, icon: string }>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-2 hover:border-amber-500/40 transition-colors block"
  >
    <UIcon
      :name="icon"
      class="w-5 h-5 text-amber-400"
    />
    <div class="font-semibold text-neutral-100">
      {{ title }}
    </div>
    <p class="text-sm text-neutral-400 leading-relaxed">
      {{ blurb }}
    </p>
  </NuxtLink>
</template>
