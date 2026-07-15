<!-- app/components/game/TheaterStage.vue -->
<!-- Wraps a cabinet block. In theater it becomes the fullscreen element, scales
     the block to fill the screen, and hosts everything that must be visible in
     fullscreen (ghost bar, peek drawer, side towers) INSIDE itself — the browser
     renders only the fullscreen subtree. -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTheater } from '~/composables/useTheater'
import { useTheaterScale } from '~/composables/useTheaterScale'

defineProps<{ narrow: boolean }>()

const { active, setTarget, peekPress, peekRelease } = useTheater()
const stageEl = ref<HTMLElement | null>(null)
const { host, scale } = useTheaterScale(active)

const blockStyle = computed(() => active.value ? { transform: `scale(${scale.value})` } : {})

onMounted(() => setTarget(stageEl.value))
onBeforeUnmount(() => setTarget(null))

// Pointer-hold on the bare glass = peek. But a tap on an in-cabinet control
// (Spin, bet +/-, the ghost bar's exit link…) also bubbles a pointerdown up to
// the stage — without this guard, every button press armed (and, if under the
// 250ms tap threshold, pinned) the peek drawer. pointerup is intentionally left
// unfiltered: peekRelease() already no-ops via its own pressArmed guard when the
// press was ignored here, and a genuine held-press that drifts onto a control
// before release must still be able to end cleanly.
function onStagePointerDown(e: PointerEvent): void {
  if (!active.value) return
  if ((e.target as HTMLElement).closest('button, a, input, select')) return
  peekPress()
}
</script>

<template>
  <div
    ref="stageEl"
    class="theater-stage"
    :class="{ 'is-theater': active }"
    @pointerdown="onStagePointerDown"
    @pointerup="active && peekRelease()"
  >
    <GameTheaterGhostBar v-if="active" />
    <GameTheaterSideTowers v-if="active && narrow" />
    <div
      ref="host"
      class="theater-block"
      :style="blockStyle"
    >
      <slot />
    </div>
    <GameTheaterPeekLayer v-if="active" />
  </div>
</template>

<style scoped>
.theater-stage.is-theater {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(212, 168, 71, 0.16), transparent 60%),
    radial-gradient(90% 70% at 50% 110%, rgba(0, 120, 140, 0.24), transparent 65%),
    #04060d;
}
.theater-stage.is-theater .theater-block { transform-origin: center center; }
/* pointer-hold on the glass = peek; but never hijack clicks on the controls */
.theater-stage.is-theater :where(button, a, input, select) { pointer-events: auto; }
</style>
