<!-- app/components/lab/LabProgress.vue -->
<script setup lang="ts">
defineProps<{ progress: number, completed: number, total: number }>()
defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-2">
    <div class="flex items-center justify-between text-xs text-neutral-400">
      <span>Running… {{ completed.toLocaleString() }} / {{ total.toLocaleString() }} sessions</span>
      <UButton
        size="xs"
        color="error"
        variant="soft"
        data-test="cancel"
        @click="$emit('cancel')"
      >
        Cancel
      </UButton>
    </div>
    <div
      class="h-2 rounded bg-neutral-800 overflow-hidden"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full bg-amber-500 transition-[width] duration-150"
        :style="{ width: `${progress * 100}%` }"
      />
    </div>
  </div>
</template>
