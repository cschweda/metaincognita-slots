<script setup lang="ts">
// Generic fallback chrome: a tasteful accent-framed surround using the wrapper's
// CSS vars. Decorative only (the wrapper sets aria-hidden + pointer-events:none).
</script>

<template>
  <div class="default-chrome">
    <div class="ring" />
  </div>
</template>

<style scoped>
.default-chrome { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; }
.ring {
  position: absolute;
  inset: 0;
  border-radius: 1.25rem;
  box-shadow: 0 0 0 2px var(--chrome-accent) inset, 0 0 18px color-mix(in srgb, var(--chrome-accent) 40%, transparent) inset;
  animation: dc-breathe 5s ease-in-out infinite;
}
@keyframes dc-breathe { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.08); } }
</style>
