<!-- app/components/game/SymbolIcon.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { symbolArt } from '~/components/game/symbols/registry'

const props = withDefaults(defineProps<{
  icon?: string
  label: string
  size?: number
  wild?: boolean
}>(), { size: 58, wild: false })

const art = computed(() => symbolArt(props.icon))
const barCount = computed(() => art.value?.kind === 'text' && art.value.variant === 'bar'
  ? Number(art.value.text) || 1
  : 0)
</script>

<template>
  <div
    class="relative flex items-center justify-center select-none"
    :style="{ width: size + 'px', height: size + 'px' }"
    role="img"
    :aria-label="label"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <svg
      v-if="art && art.kind === 'svg'"
      viewBox="0 0 24 24"
      :width="size"
      :height="size"
      aria-hidden="true"
      v-html="art.body"
    />
    <span
      v-else-if="art && art.kind === 'text' && art.variant !== 'bar'"
      aria-hidden="true"
      :class="art.variant === 'seven' ? 'font-black italic' : 'font-bold'"
      :style="{
        fontSize: (art.variant === 'seven' ? size * 0.82 : size * 0.66) + 'px',
        lineHeight: 1,
        fontFamily: art.variant === 'seven' ? 'Arial Black, Impact, sans-serif' : 'Georgia, serif',
        color: art.color ?? (art.variant === 'seven' ? '#f59e0b' : '#e5e5e5'),
        textShadow: art.variant === 'seven' ? '0 2px 0 #7c2d12' : 'none'
      }"
    >{{ art.text }}</span>
    <span
      v-else-if="art && art.kind === 'text' && art.variant === 'bar'"
      aria-hidden="true"
      class="flex flex-col gap-[3px]"
    >
      <span
        v-for="n in barCount"
        :key="n"
        class="font-black tracking-wide rounded-[3px]"
        :style="{ fontSize: size * 0.16 + 'px', padding: '1px ' + size * 0.13 + 'px', background: art.color ?? '#f59e0b', color: '#1c1207' }"
      >BAR</span>
    </span>
    <span
      v-else
      aria-hidden="true"
      class="text-center font-bold text-neutral-200 px-1"
      :style="{ fontSize: size * 0.2 + 'px', lineHeight: 1.1 }"
    >{{ label }}</span>

    <span
      v-if="wild"
      class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-amber-500 text-[8px] font-black tracking-wider text-amber-950 px-1.5 py-px"
    >WILD</span>
  </div>
</template>
