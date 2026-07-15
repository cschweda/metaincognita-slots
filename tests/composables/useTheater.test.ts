// tests/composables/useTheater.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheater } from '../../app/composables/useTheater'

describe('useTheater', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const t = useTheater()
    t.exit() // reset the singleton between tests
    t.peek.value = 'off'
  })
  afterEach(() => vi.useRealTimers())

  it('enter requests fullscreen on the registered target and flags active', () => {
    const t = useTheater()
    const el = document.createElement('div')
    const req = vi.fn().mockResolvedValue(undefined)
    // jsdom/happy-dom don't implement fullscreen — stub it
    ;(el as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = req
    t.setTarget(el)
    t.enter()
    expect(t.active.value).toBe(true)
    expect(req).toHaveBeenCalledOnce()
    expect(document.body.classList.contains('theater-active')).toBe(true)
  })

  it('exit clears active, peek, and the body class', () => {
    const t = useTheater()
    t.setTarget(document.createElement('div'))
    t.enter()
    t.peek.value = 'pinned'
    t.exit()
    expect(t.active.value).toBe(false)
    expect(t.peek.value).toBe('off')
    expect(document.body.classList.contains('theater-active')).toBe(false)
  })

  it('a quick press-release is a TAP → pins the peek layer', () => {
    const t = useTheater()
    t.peekPress()
    expect(t.peek.value).toBe('held') // shows immediately
    vi.advanceTimersByTime(100) // under TAP_MS
    t.peekRelease()
    expect(t.peek.value).toBe('pinned')
  })

  it('a long press-release is a HOLD → gone on release', () => {
    const t = useTheater()
    t.peekPress()
    vi.advanceTimersByTime(400) // over TAP_MS
    t.peekRelease()
    expect(t.peek.value).toBe('off')
  })

  it('pressing while pinned closes it (tap to dismiss)', () => {
    const t = useTheater()
    t.peek.value = 'pinned'
    t.peekPress()
    expect(t.peek.value).toBe('off')
    t.peekRelease() // no-op, must not reopen
    expect(t.peek.value).toBe('off')
  })

  it('restores focus to the triggering element on exit (spec: focus returns to the theater button)', () => {
    const t = useTheater()
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    expect(document.activeElement).toBe(button)
    t.setTarget(document.createElement('div'))
    t.enter()
    t.exit()
    expect(document.activeElement).toBe(button)
    button.remove()
  })
})
