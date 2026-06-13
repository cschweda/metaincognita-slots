<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents } from '~/utils/format'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef, label?: string }>()
const store = useSlotsStore()

const cents = computed<number | null>(() => {
  const prog = store.machineStates[props.def.id]?.progressive
  if (prog === undefined || prog === null || prog.kind !== 'percent') return null
  return Math.floor(prog.value) * props.def.denominationCents
})
</script>

<template>
  <div
    v-if="cents !== null"
    class="flex items-baseline gap-2"
    data-test="percent-meter"
  >
    <span class="text-[10px] uppercase tracking-widest text-neutral-500">{{ label ?? 'Progressive' }}</span>
    <span class="text-amber-300 font-mono">{{ formatCents(cents) }}</span>
  </div>
</template>
