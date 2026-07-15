import { computed, ref } from 'vue'

export type PeekMode = 'off' | 'held' | 'pinned'
export const TAP_MS = 250

// Module-singleton state (same pattern as utils/audio.ts mute): every caller
// shares one instance so the toolbar, stage, ghost bar and peek drawer agree.
const active = ref(false)
const peek = ref<PeekMode>('off')
let target: HTMLElement | null = null
let pressStart = 0
let pressArmed = false
// Spec: "focus moves into the theater container on enter and returns to the
// theater button on exit." Centralized here (not in a component) so it holds
// no matter how theater is exited — toolbar button, Escape, the ghost bar.
let returnFocusEl: HTMLElement | null = null

function onFullscreenChange(): void {
  // Browser's own Esc / fullscreen-exit affordance fired — mirror it.
  if (active.value && document.fullscreenElement === null) exit()
}

function enter(): void {
  returnFocusEl = (document.activeElement as HTMLElement) ?? null
  if (active.value) return
  active.value = true
  document.body.classList.add('theater-active')
  document.addEventListener('fullscreenchange', onFullscreenChange)
  // CSS theater mode works even if the API is unavailable/denied.
  target?.requestFullscreen?.().catch(() => {})
}

function exit(): void {
  if (!active.value) return
  active.value = false
  peek.value = 'off'
  document.body.classList.remove('theater-active')
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement !== null) document.exitFullscreen?.().catch(() => {})
  returnFocusEl?.focus?.()
  returnFocusEl = null
}

function peekPress(): void {
  if (peek.value === 'pinned') {
    peek.value = 'off'
    pressArmed = false
    return
  }
  peek.value = 'held'
  pressStart = Date.now()
  pressArmed = true
}

function peekRelease(): void {
  if (!pressArmed) return
  pressArmed = false
  if (peek.value !== 'held') return
  peek.value = Date.now() - pressStart < TAP_MS ? 'pinned' : 'off'
}

export function useTheater() {
  return {
    active,
    peek,
    peeking: computed(() => peek.value !== 'off'),
    setTarget: (el: HTMLElement | null) => { target = el },
    enter,
    exit,
    toggle: () => (active.value ? exit() : enter()),
    peekPress,
    peekRelease
  }
}
