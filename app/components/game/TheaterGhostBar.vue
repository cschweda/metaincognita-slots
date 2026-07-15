<!-- app/components/game/TheaterGhostBar.vue -->
<!-- Theater is chrome-free by default; move the mouse or tap and this slim bar
     wakes for a few seconds so you can always leave — to the floor via the hub
     exit, or back to the normal cabinet via ✕. Reduced motion keeps it visible. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { reducedMotion } from '~/utils/audio'
import { useTheater } from '~/composables/useTheater'

const { exit } = useTheater()
const awake = ref(true)
const still = reducedMotion()
let timer: ReturnType<typeof setTimeout> | null = null

function wake(): void {
  awake.value = true
  if (still) return // reduced motion: never auto-hide
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    awake.value = false
  }, 3000)
}
const events = ['pointermove', 'pointerdown', 'keydown'] as const

onMounted(() => {
  wake()
  for (const e of events) window.addEventListener(e, wake)
})
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
  for (const e of events) window.removeEventListener(e, wake)
})
</script>

<template>
  <div
    class="theater-ghost"
    :class="{ 'is-awake': awake }"
    data-test="ghost-bar"
  >
    <AppHubLink />
    <button
      type="button"
      class="theater-ghost-exit"
      data-test="exit-theater"
      @click="exit"
    >
      <UIcon
        name="i-lucide-x"
        class="w-4 h-4"
        aria-hidden="true"
      />
      <span>Exit theater</span>
    </button>
  </div>
</template>

<style scoped>
.theater-ghost {
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; background: linear-gradient(180deg, rgba(6, 8, 15, 0.85), transparent);
  opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
}
.theater-ghost.is-awake { opacity: 1; pointer-events: auto; }
.theater-ghost-exit {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  font: 700 12px ui-monospace, monospace; color: #e7e2d4;
  background: rgba(30, 24, 12, 0.7); border: 1px solid rgba(212, 168, 71, 0.5);
}
.theater-ghost-exit:hover { color: #fff; border-color: rgba(212, 168, 71, 0.9); }
.theater-ghost-exit:focus-visible { outline: 2px solid rgba(212, 168, 71, 0.8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .theater-ghost { transition: none; opacity: 1; pointer-events: auto; }
}
</style>
