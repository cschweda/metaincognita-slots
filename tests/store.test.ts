// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSlotsStore, STORAGE_KEY } from '../app/stores/slots'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { STOCK_RUSH } from '../app/machines/stock-rush'

function freshStore() {
  setActivePinia(createPinia())
  return useSlotsStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('session lifecycle', () => {
  it('starts a session with a bankroll and persists it', () => {
    const store = freshStore()
    store.startSession(100_000)
    expect(store.phase).toBe('playing')
    expect(store.bankrollCents).toBe(100_000)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(raw.v).toBe(1)
    expect(raw.bankrollCents).toBe(100_000)
  })

  it('selectMachine initializes engine state once and keeps it across visits', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('sevens-ablaze')
    const meter = (store.machineStates['sevens-ablaze']!.progressive as { value: number }).value
    expect(meter).toBe(2000) // reset value from the def
    store.leaveMachine()
    store.selectMachine('sevens-ablaze')
    expect((store.machineStates['sevens-ablaze']!.progressive as { value: number }).value).toBe(2000)
    expect(store.currentMachineId).toBe('sevens-ablaze')
  })

  it('rejects unknown machines', () => {
    const store = freshStore()
    store.startSession(100_000)
    expect(() => store.selectMachine('not-a-machine')).toThrow(/unknown machine/i)
  })
})

describe('bet clamping', () => {
  it('defaults to max coins and clamps within 1..maxCoins', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('canal-royale')
    expect(store.currentBet).toBe(25)
    store.setBet(10)
    expect(store.currentBet).toBe(10)
    store.setBet(0)
    expect(store.currentBet).toBe(1)
    store.setBet(99)
    expect(store.currentBet).toBe(25)
  })

  it('fixed-bet machines refuse other bets', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('dragons-hoard')
    store.setBet(5)
    expect(store.currentBet).toBe(25) // fixedBet: setBet is a no-op clamp to maxCoins
    store.selectMachine('stock-rush')
    store.setBet(1)
    expect(store.currentBet).toBe(3)
  })
})

describe('persistence round-trip and sanitize-on-load', () => {
  it('round-trips a mid-feature video state EXACTLY', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('canal-royale')
    a.machineStates['canal-royale']!.videoFeature = {
      kind: 'freeSpins', remaining: 7, multiplier: 2, coins: 25
    }
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    expect(b.machineStates['canal-royale']!.videoFeature).toEqual({
      kind: 'freeSpins', remaining: 7, multiplier: 2, coins: 25
    })
    expect(b.phase).toBe('playing')
  })

  it('round-trips pachislo queues and bonus state exactly', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('stock-rush')
    const ps = a.machineStates['stock-rush']!.pachislo!
    ps.smallQueue.push('bell', 'watermelon')
    ps.bonusQueue.push('big')
    ps.bonus = { type: 'reg', round: 1, jacLeft: 5, interlude: null }
    ps.oddsLevel = 6
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    const loaded = b.machineStates['stock-rush']!.pachislo!
    expect(loaded.smallQueue).toEqual(['bell', 'watermelon'])
    expect(loaded.bonusQueue).toEqual(['big'])
    expect(loaded.bonus).toEqual({ type: 'reg', round: 1, jacLeft: 5, interlude: null })
    expect(loaded.oddsLevel).toBe(6)
  })

  it('survives garbage: corrupt JSON, wrong version, hostile shapes', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(freshStore().resume()).toBe(false)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, bankrollCents: 1 }))
    expect(freshStore().resume()).toBe(false)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 'a million',
      currentMachineId: 'not-real',
      machineStates: { 'canal-royale': { videoFeature: { kind: 'freeSpins', remaining: 'lots' } } },
      history: [{ machineId: 'x' }, 42],
      stats: null,
      settings: { betsByMachine: { 'canal-royale': 9000 } }
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true) // v matches: salvage what validates, default the rest
    expect(store.bankrollCents).toBe(0)
    expect(store.currentMachineId).toBeNull()
    // hostile feature state was reset via initMachineState
    expect(store.machineStates['canal-royale']!.videoFeature).toBeNull()
    expect(store.history).toEqual([])
    expect(store.settings.betsByMachine['canal-royale']).toBe(CANAL_ROYALE.maxCoins)
  })

  it('rejects engine-unreachable bonus states (the wedge shapes)', () => {
    const wedges = [
      { type: 'big', round: 3, jacLeft: 0, interlude: null },
      { type: 'big', round: 3, jacLeft: 0, interlude: { index: 2, bells: 0 } },
      { type: 'big', round: 2, jacLeft: 0, interlude: { index: 9, bells: -5 } },
      { type: 'reg', round: 2, jacLeft: 4, interlude: null }
    ]
    for (const wedge of wedges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 1, bankrollCents: 1000, currentMachineId: 'stock-rush',
        machineStates: { 'stock-rush': { progressive: null, videoFeature: null, pachislo: {
          oddsLevel: 4, smallQueue: [], bonusQueue: [], replayNext: false, bonus: wedge
        } } },
        history: [], stats: null, settings: null
      }))
      const store = freshStore()
      expect(store.resume()).toBe(true)
      expect(store.machineStates['stock-rush']!.pachislo!.bonus).toBeNull()
    }
  })

  it('keeps fixed-bet machines at full bet even when the save lies', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, bankrollCents: 1000, currentMachineId: null, machineStates: {},
      history: [], stats: null,
      settings: { betsByMachine: { 'stock-rush': 1, 'dragons-hoard': 7, 'canal-royale': 10 } }
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.settings.betsByMachine['stock-rush']).toBe(3)
    expect(store.settings.betsByMachine['dragons-hoard']).toBe(25)
    expect(store.settings.betsByMachine['canal-royale']).toBe(10) // selectable lines stay honored
  })

  it('sanitizes pachislo state whose shape lies', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 1000,
      currentMachineId: 'stock-rush',
      machineStates: {
        'stock-rush': {
          progressive: null,
          videoFeature: null,
          pachislo: {
            oddsLevel: 47, smallQueue: ['bell', 'nonsense'], bonusQueue: ['big', 'reg'],
            replayNext: 'yes', bonus: { type: 'mega', round: 9 }
          }
        }
      },
      history: [], stats: null, settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    const ps = store.machineStates['stock-rush']!.pachislo!
    expect(ps.oddsLevel).toBe(STOCK_RUSH.defaultOddsLevel) // invalid level → def default
    expect(ps.smallQueue).toEqual(['bell']) // unknown flags filtered
    expect(ps.bonusQueue).toEqual(['big', 'reg'])
    expect(ps.replayNext).toBe(false)
    expect(ps.bonus).toBeNull() // invalid bonus shape → reset
  })
})
