<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'

const store = useSlotsStore()
const route = useRoute()
const onFloor = computed(() => route.path === '/')

// Mirror the store's announcement into a local ref, clearing it first so the
// rendered text always changes — otherwise screen readers suppress a duplicate
// (e.g. a pachislo replay or a zero-pay free spin at an unchanged balance).
const announced = ref('')
watch(() => store.liveAnnouncement, (msg) => {
  announced.value = ''
  void nextTick(() => {
    announced.value = msg
  })
})

const navItems = [
  { to: '/sim-lab', icon: 'i-lucide-flask-conical', label: 'Sim Lab' },
  { to: '/learn', icon: 'i-lucide-book-open', label: 'Learn' },
  { to: '/learn/glossary', icon: 'i-lucide-book-a', label: 'Glossary' },
  { to: '/history', icon: 'i-lucide-scroll-text', label: 'History' }
]
</script>

<template>
  <div class="h-screen flex flex-col bg-neutral-950 text-neutral-300">
    <nav
      aria-label="App"
      class="h-9 flex items-center justify-between px-3 bg-neutral-900 border-b border-neutral-800 shrink-0 z-50"
    >
      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="!onFloor"
          to="/"
          class="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-3.5 h-3.5"
          />
          <span>Floor</span>
        </NuxtLink>
        <span
          v-else
          class="text-xs text-neutral-400"
        >
          <span class="text-amber-500/80">Slots</span> Simulator
        </span>
      </div>
      <div
        v-if="store.phase === 'playing'"
        class="flex items-center gap-1"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
        <span class="text-[10px] text-neutral-400">Session active</span>
      </div>
    </nav>

    <div
      aria-live="polite"
      class="sr-only"
    >
      {{ announced }}
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto">
      <slot />
    </main>

    <nav
      aria-label="Pages"
      class="h-9 flex items-center justify-between px-3 bg-neutral-900 border-t border-neutral-800 shrink-0"
    >
      <div class="flex items-center gap-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-1.5 text-xs transition-colors text-neutral-400 hover:text-neutral-300"
          active-class=""
          exact-active-class="text-amber-400 hover:text-amber-300"
        >
          <UIcon
            :name="item.icon"
            class="w-3.5 h-3.5"
          />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
      <a
        href="https://github.com/cschweda/metaincognita-slots"
        target="_blank"
        rel="noopener noreferrer"
        class="text-neutral-600 hover:text-neutral-400 transition-colors"
        aria-label="Source on GitHub"
      >
        <UIcon
          name="i-lucide-github"
          class="w-3.5 h-3.5"
        />
      </a>
    </nav>
  </div>
</template>
