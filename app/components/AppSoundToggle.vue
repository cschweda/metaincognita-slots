<!-- app/components/AppSoundToggle.vue -->
<!-- Global floor mute. Binds the same persisted reactive mute state as the
     Temple cabinet toggle, so the two can never disagree. aria-pressed=true
     means SOUND ON (the button asserts "sound"). -->
<script setup lang="ts">
import { computed } from 'vue'
import { isMuted, setMuted, unlockAudio } from '~/utils/audio'

const on = computed(() => !isMuted())
function toggle(): void {
  unlockAudio() // the toggle click doubles as the context-waking gesture
  setMuted(!isMuted())
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="on"
    class="flex items-center gap-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded"
    :class="on ? 'text-amber-400 hover:text-amber-300' : 'text-neutral-500 hover:text-neutral-400'"
    @click="toggle"
  >
    <UIcon
      :name="on ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
      class="w-3.5 h-3.5"
    />
    <span>{{ on ? 'Sound on' : 'Sound off' }}</span>
  </button>
</template>
