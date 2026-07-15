<!-- app/components/game/CabinetToolbar.vue -->
<!-- The X-ray toggle + PAR-sheet button + modal every cabinet page shows.
     One component so the four family shells can't drift apart. -->
<script setup lang="ts">
import { ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useTheater } from '~/composables/useTheater'

const store = useSlotsStore()
const parOpen = ref(false)
const theater = useTheater()
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2">
    <UButton
      :color="store.settings.xray ? 'primary' : 'neutral'"
      :variant="store.settings.xray ? 'solid' : 'outline'"
      :aria-pressed="store.settings.xray"
      size="xs"
      icon="i-lucide-scan-line"
      @click="store.setXray(!store.settings.xray)"
    >
      X-ray
    </UButton>
    <UButton
      color="neutral"
      variant="outline"
      size="xs"
      icon="i-lucide-file-spreadsheet"
      @click="parOpen = true"
    >
      PAR sheet
    </UButton>
    <UButton
      color="neutral"
      variant="outline"
      size="xs"
      icon="i-lucide-expand"
      :aria-pressed="theater.active.value"
      data-test="enter-theater"
      @click="theater.toggle()"
    >
      Theater
    </UButton>
    <GameParSheetModal v-model:open="parOpen" />
  </div>
</template>
