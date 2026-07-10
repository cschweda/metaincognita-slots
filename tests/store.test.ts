// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { describeOutcome } from '../app/utils/outcomeText'
import { useSlotsStore, STORAGE_KEY } from '../app/stores/slots'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { mulberry32, simulateMachine } from '../app/engine'
import { setLiveRand } from '../app/utils/liveRand'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import { FLAMEOUT_21 } from '../app/machines/flameout-21'
import { STOP_AND_LOCK_777 } from '../app/machines/stop-and-lock-777'

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

  it('round-trips a hold-and-spin multiplier gem without dropping it', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('ruby-of-gargoyle')
    a.machineStates['ruby-of-gargoyle']!.videoFeature = {
      kind: 'holdAndSpin',
      locked: [{ mult: 2 }, { credits: 25, label: 'mini' }, ...new Array(13).fill(null)],
      respins: 3,
      coins: 25
    }
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    const f = b.machineStates['ruby-of-gargoyle']!.videoFeature!
    if (f.kind !== 'holdAndSpin') throw new Error('expected holdAndSpin')
    expect(f.locked[0]).toEqual({ mult: 2 })
    expect(f.locked[1]).toEqual({ credits: 25, label: 'mini' })
    expect(f.locked.slice(2).every(c => c === null)).toBe(true)
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

  it('whitelists gameKind — a bogus kind loads as "base"', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, bankrollCents: 1000, currentMachineId: null, machineStates: {},
      history: [
        { id: 1, machineId: 'canal-royale', gameKind: 'free-spin', coins: 25, coinsInCents: 25, payoutCents: 0, entryIds: [], t: 1 },
        { id: 2, machineId: 'canal-royale', gameKind: 'evil', coins: 25, coinsInCents: 25, payoutCents: 0, entryIds: [], t: 2 }
      ],
      stats: null, settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.history.map(r => r.gameKind)).toEqual(['free-spin', 'base'])
  })

  it('nextRecordId outruns every restored history id', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, bankrollCents: 1000, currentMachineId: null, machineStates: {},
      nextRecordId: 1, // corrupt: would collide with restored ids 5 and 6
      history: [
        { id: 5, machineId: 'canal-royale', gameKind: 'base', coins: 25, coinsInCents: 25, payoutCents: 0, entryIds: [], t: 1 },
        { id: 6, machineId: 'canal-royale', gameKind: 'base', coins: 25, coinsInCents: 25, payoutCents: 0, entryIds: [], t: 2 }
      ],
      stats: null, settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.nextRecordId).toBe(7)
  })

  it('clamps a negative netPeakCents to 0 on load', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1, bankrollCents: 1000, currentMachineId: null, machineStates: {},
      history: [], settings: null,
      stats: { spins: 0, totalInCents: 0, totalOutCents: 0, netPeakCents: -500, maxDrawdownCents: 0 }
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.stats.netPeakCents).toBe(0)
  })
})

describe('spin orchestration', () => {
  it('atomic spin: bankroll, state, history, persistence all move together', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(100_000) // $1,000 — sevens-ablaze denom is 100¢
    store.selectMachine('sevens-ablaze')
    store.setBet(2)
    store.spinOnce()
    expect(store.spinning).toBe(true)
    expect(store.history).toHaveLength(1)
    const rec = store.history[0]!
    expect(rec.coinsInCents).toBe(200)
    expect(store.bankrollCents).toBe(100_000 - 200 + rec.payoutCents)
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(persisted.bankrollCents).toBe(store.bankrollCents)
    store.revealDone()
    expect(store.spinning).toBe(false)
  })

  it('refuses to spin while spinning or broke', () => {
    setLiveRand(mulberry32(43))
    const store = freshStore()
    store.startSession(100) // $1 — one canal spin at 25 lines x 1¢ = 25¢
    store.selectMachine('canal-royale')
    store.spinOnce()
    expect(store.history).toHaveLength(1)
    store.spinOnce() // locked out — spinning
    expect(store.history).toHaveLength(1)
    store.revealDone()
    store.bankrollCents = 3 // < 25¢
    store.spinOnce()
    expect(store.history).toHaveLength(1)
    expect(store.liveAnnouncement).toMatch(/out of credits/i)
  })

  it('feeds progressives with simulateMachine v2 parity (live mode, same seed)', () => {
    const SEED = 777
    const SPINS = 3_000
    setLiveRand(mulberry32(SEED))
    const store = freshStore()
    store.startSession(100_000_000)
    store.selectMachine('sevens-ablaze')
    store.setBet(2)
    for (let i = 0; i < SPINS; i++) {
      store.spinOnce()
      store.revealDone()
    }
    const sim = simulateMachine(SEVENS_ABLAZE, {
      spins: SPINS, coins: 2, seed: SEED, progressiveMode: 'live'
    })
    const denom = SEVENS_ABLAZE.denominationCents
    expect(store.stats.totalInCents).toBe(sim.totalIn * denom)
    expect(store.stats.totalOutCents).toBe(sim.totalOut * denom)
    // meter parity: live feed = 1% of coin-in; a jackpot hit resets it mid-run
    const meter = (store.machineStates['sevens-ablaze']!.progressive as { value: number }).value
    if (sim.jackpotHits === 0) {
      expect(meter).toBeCloseTo(2000 + 0.01 * sim.totalIn, 6)
    } else {
      expect(meter).toBeGreaterThanOrEqual(2000)
    }
  })

  it('pachislo: presses flow through; bonus games cost their token; announcements narrate', () => {
    setLiveRand(mulberry32(99))
    const store = freshStore()
    store.startSession(10_000) // $100 in 25¢ tokens
    store.selectMachine('stock-rush')
    store.spinOnce([4, 9, 13])
    store.revealDone()
    expect(store.lastOutcome!.trace.presses!.map(p => p.press)).toEqual([4, 9, 13])
    expect(store.history[0]!.coinsInCents).toBe(3 * 25)
    expect(store.liveAnnouncement.length).toBeGreaterThan(0)
  })

  it('setOddsLevel only when idle', () => {
    setLiveRand(mulberry32(123))
    const store = freshStore()
    store.startSession(10_000)
    store.selectMachine('stock-rush')
    store.setOddsLevel(6)
    expect(store.machineStates['stock-rush']!.pachislo!.oddsLevel).toBe(6)
    store.machineStates['stock-rush']!.pachislo!.bonus = { type: 'reg', round: 1, jacLeft: 8, interlude: null }
    expect(() => store.setOddsLevel(1)).toThrow(/idle/i)
  })

  it('export produces a readable text log', () => {
    setLiveRand(mulberry32(7))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('diamond-doubler')
    store.spinOnce()
    store.revealDone()
    const text = store.exportHistory()
    expect(text).toContain('diamond-doubler')
    expect(text).toContain('Session totals')
  })

  it('rejects malformed presses BEFORE any state moves', () => {
    setLiveRand(mulberry32(55))
    const store = freshStore()
    store.startSession(10_000)
    store.selectMachine('stock-rush')
    store.spinOnce([4, 9, 99] as unknown as [number, number, number])
    expect(store.spinning).toBe(false)
    expect(store.history).toHaveLength(0)
    expect(store.machineStates['stock-rush']!.pachislo!.smallQueue).toHaveLength(0)
    expect(store.machineStates['stock-rush']!.pachislo!.bonusQueue).toHaveLength(0)
    expect(store.liveAnnouncement).toMatch(/timing glitch/i)
  })

  it('spinOnce survives a resume that lost perMachine totals', () => {
    setLiveRand(mulberry32(56))
    const a = freshStore()
    a.startSession(100_000)
    a.selectMachine('diamond-doubler')
    // simulate a save whose perMachine was dropped by sanitize
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    delete raw.perMachine
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
    const b = freshStore()
    expect(b.resume()).toBe(true)
    b.spinOnce()
    b.revealDone()
    expect(b.history).toHaveLength(1)
    expect(b.perMachine['diamond-doubler']!.cycles).toBe(1)
  })
})

describe('peekSavedSession', () => {
  it('detects valid saves without mutating the store', () => {
    const a = freshStore()
    expect(a.peekSavedSession()).toBe(false)
    a.startSession(5000)
    const b = freshStore()
    expect(b.peekSavedSession()).toBe(true)
    expect(b.phase).toBe('floor') // not loaded, only peeked
    localStorage.setItem(STORAGE_KEY, 'garbage')
    expect(b.peekSavedSession()).toBe(false)
  })
})

describe('mid-feature reload (spec: must restore exactly)', () => {
  it('canal-royale free spins survive a reload and play out', () => {
    setLiveRand(mulberry32(31337))
    const a = freshStore()
    a.startSession(10_000_000)
    a.selectMachine('canal-royale')
    let guard = 0
    while (a.machineStates['canal-royale']!.videoFeature === null) {
      a.spinOnce()
      a.revealDone()
      guard++
      expect(guard).toBeLessThan(3_000) // P(no trigger in 3k spins) ~ (1-1/141)^3000 ~ 6e-10
    }
    const before = JSON.parse(JSON.stringify(a.machineStates['canal-royale']!.videoFeature))
    // "reload": fresh pinia + resume from storage
    const b = freshStore()
    expect(b.resume()).toBe(true)
    expect(b.machineStates['canal-royale']!.videoFeature).toEqual(before)
    // the restored feature plays to completion at cost 0
    b.selectMachine('canal-royale')
    let freeGames = 0
    while (b.machineStates['canal-royale']!.videoFeature !== null) {
      b.spinOnce()
      b.revealDone()
      expect(b.history.at(-1)!.coinsInCents).toBe(0)
      freeGames++
      expect(freeGames).toBeLessThan(200)
    }
    expect(freeGames).toBeGreaterThan(0)
  })
})

describe('describeOutcome — spoken net parity', () => {
  it('a sub-bet win (LDW) is announced as a net loss', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 14, coinsIn: 25, featureEvents: [], progressiveEvents: [] }
    const text = describeOutcome(CANAL_ROYALE, out as never, store.bankrollCents)
    expect(text).toContain('Won 14 credits.')
    expect(text).toContain('Net down 11.')
  })

  it('a win that beats the bet is announced as a net gain', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 1030, coinsIn: 25, featureEvents: [], progressiveEvents: [] }
    expect(describeOutcome(CANAL_ROYALE, out as never, store.bankrollCents)).toContain('Net up 1,005.')
  })

  it('a no-win announces the forfeited bet as a net loss', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 0, coinsIn: 25, featureEvents: [], progressiveEvents: [] }
    const text = describeOutcome(CANAL_ROYALE, out as never, store.bankrollCents)
    expect(text).toContain('No win.')
    expect(text).toContain('Net down 25.')
  })

  it('a free spin that pays (coins-in 0) is announced as a net gain, not an LDW', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 14, coinsIn: 0, featureEvents: [], progressiveEvents: [] }
    expect(describeOutcome(CANAL_ROYALE, out as never, store.bankrollCents)).toContain('Net up 14.')
  })
})

// ---------------------------------------------------------------------------
// blackjack-reel store actions: deal / stop / cashOut (Flameout 21 crash)
// ---------------------------------------------------------------------------

describe('blackjack-reel interactive actions — Flameout 21', () => {
  // Flameout 21: denomination 100¢ ($1/coin), maxCoins 20.
  const DENOM = FLAMEOUT_21.denominationCents

  /** Deal, then force reels 0–1 to specific cards and stop them so a 2-card
   *  hand sets launch + velocity. Returns the live bj state at idx=2 (climb). */
  function dealHand(store: ReturnType<typeof useSlotsStore>, cards: [string, string]) {
    store.deal()
    const bj = store.machineStates['flameout-21']!.blackjackReel!
    bj.reelStrips[0] = [cards[0]]
    bj.reelStrips[1] = [cards[1]]
    store.revealDone()
    store.stop() // lock card 0 → reel 0
    store.revealDone()
    store.stop() // lock card 1 → reel 1 (sets launch + velocity)
    store.revealDone()
    return bj
  }

  it('deal charges the ante, sets phase to spinning, books deal record', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.setBet(2) // 2-coin ante
    const before = store.bankrollCents
    store.deal()

    expect(store.spinning).toBe(true) // gate raised

    // ante charged: 2 coins × 100¢ = 200¢; payout = 0
    expect(store.bankrollCents).toBe(before - 200)

    const bj = store.machineStates['flameout-21']!.blackjackReel!
    expect(bj.phase).toBe('spinning')
    expect(bj.ante).toBe(2)
    expect(bj.idx).toBe(0) // deal builds strips but stops no reels

    expect(store.history).toHaveLength(1)
    const rec = store.history[0]!
    expect(rec.machineId).toBe('flameout-21')
    expect(rec.coinsInCents).toBe(200)
    expect(rec.payoutCents).toBe(0)

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.bankrollCents).toBe(store.bankrollCents)
  })

  it('deal → stop → cashOut banks round(ante × multiplier × denom)', () => {
    setLiveRand(mulberry32(7))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.setBet(3) // ante = 3 coins = 300¢
    const start = store.bankrollCents
    const bj = dealHand(store, ['9S', '9D']) // total 18 → launch + velocity set

    expect(bj.phase).toBe('spinning')
    expect(bj.idx).toBe(2)
    const launchMult = bj.multiplier
    const velocity = bj.velocity
    expect(launchMult).toBeGreaterThan(0)
    expect(velocity).toBeGreaterThan(0)

    // Force reel 2 to CLIMB, stop it: multiplier ×= velocity, still spinning.
    bj.reelStrips[2] = ['CLIMB']
    store.stop()
    expect(bj.phase).toBe('spinning')
    expect(bj.idx).toBe(3)
    expect(bj.multiplier).toBeCloseTo(launchMult * velocity, 10)
    store.revealDone()

    // Cash out: bank round(ante × multiplier × denom).
    const expectedCents = Math.round(3 * bj.multiplier * DENOM)
    const bankBefore = store.bankrollCents
    const histBefore = store.history.length
    store.cashOut()
    expect(bj.phase).toBe('resolved')
    expect(store.history.length).toBe(histBefore + 1)
    const rec = store.history.at(-1)!
    expect(rec.coinsInCents).toBe(0) // cashOut is free
    expect(rec.payoutCents).toBe(expectedCents)
    expect(store.bankrollCents).toBe(bankBefore + expectedCents)
    // Net across the hand: -ante debit + the cashed credit.
    expect(store.bankrollCents).toBe(start - 300 + expectedCents)
  })

  it('a CRASH pays 0 and resolves the hand', () => {
    setLiveRand(mulberry32(99))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.setBet(2)
    const start = store.bankrollCents
    const bj = dealHand(store, ['KS', 'KD']) // total 20

    // Force reel 2 to CRASH and stop it.
    bj.reelStrips[2] = ['CRASH']
    const histBefore = store.history.length
    store.stop()
    expect(bj.crashed).toBe(true)
    expect(bj.phase).toBe('resolved')
    expect(store.history.length).toBe(histBefore + 1)
    const rec = store.history.at(-1)!
    expect(rec.payoutCents).toBe(0) // crash = total loss
    // Only the ante (2 × 100¢) is gone; the crash credits nothing.
    expect(store.bankrollCents).toBe(start - 200)
  })

  it('cashOut is a no-op before the first card lands (idx < 1)', () => {
    setLiveRand(mulberry32(123))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.setBet(1)
    store.deal()
    store.revealDone()
    const bj = store.machineStates['flameout-21']!.blackjackReel!
    expect(bj.idx).toBe(0) // no card stopped yet
    const histBefore = store.history.length
    store.cashOut() // idx < 1 → guarded no-op
    expect(bj.phase).toBe('spinning')
    expect(store.history.length).toBe(histBefore)
  })

  it('deal is a no-op while spinning or broke', () => {
    setLiveRand(mulberry32(1))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.deal()
    expect(store.spinning).toBe(true) // gate is up

    // calling again while spinning does nothing
    store.deal()
    expect(store.history).toHaveLength(1)

    // lower gate, stop a card so cashOut is legal, cash out, lower gate again
    store.revealDone()
    store.stop()
    store.revealDone()
    store.cashOut()
    store.revealDone()
    expect(store.history).toHaveLength(2) // deal + cashOut records

    // drain bankroll below 1 coin (100¢) and try to deal
    store.bankrollCents = 10 // 10¢ < 100¢
    store.deal()
    expect(store.history).toHaveLength(2) // no new deal record
    expect(store.liveAnnouncement).toMatch(/out of credits/i)
  })

  it('spinOnce is a no-op for blackjack-reel (uses its own actions)', () => {
    setLiveRand(mulberry32(2))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.spinOnce()
    expect(store.history).toHaveLength(0)
    expect(store.spinning).toBe(false)
  })

  it('a full deal → stop → cashOut hand round-trips through persistence', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    store.setBet(1)
    dealHand(store, ['9S', '9D'])
    store.cashOut()
    store.revealDone()

    const b = freshStore()
    expect(b.resume()).toBe(true)
    const bj = b.machineStates['flameout-21']!.blackjackReel!
    expect(bj.phase).toBe('resolved')
    expect(b.history.length).toBeGreaterThanOrEqual(1)
  })

  it('bet is selectable for blackjack-reel (1..maxCoins), not forced to max', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    expect(FLAMEOUT_21.maxCoins).toBeGreaterThanOrEqual(3)
    store.setBet(1)
    expect(store.currentBet).toBe(1)
    store.setBet(5)
    expect(store.currentBet).toBe(5)
    store.setBet(20)
    expect(store.currentBet).toBe(20)
    store.setBet(99) // over max → clamped
    expect(store.currentBet).toBe(FLAMEOUT_21.maxCoins)
  })

  it('one deal → stop → cashOut hand increments spins by exactly 1', () => {
    const store = freshStore()
    setLiveRand(mulberry32(999))
    store.startSession(1_000_000)
    store.selectMachine('flameout-21')
    const before = store.stats.spins
    dealHand(store, ['9S', '9D'])
    store.cashOut()
    store.revealDone()
    expect(store.stats.spins).toBe(before + 1)
  })

  it('defaults the crash machine bet to 1 coin', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('flameout-21')
    expect(store.currentBet).toBe(1) // demo-faithful $1 default
  })
})

describe('blackjack-reel sanitizeMachineState — Flameout 21', () => {
  it('round-trips a mid-climb spinning state exactly', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('flameout-21')
    // A state mid-climb (idx=3, one CLIMB landed). reelStrips hold only deck
    // card ids (deal reels) or CLIMB/CRASH (climb reels); 'CARD' tokens are
    // resolved to concrete deck cards at deal time and never persisted.
    const midClimbState = {
      phase: 'spinning' as const,
      reelStrips: [['KS'], ['7D'], ['CLIMB', 'CRASH'], ['CLIMB', 'CRASH'], ['CLIMB', 'CRASH']],
      landed: ['KS', '7D', 'CLIMB', null, null],
      idx: 3,
      hand: ['KS', '7D'],
      velocity: 1.33,
      multiplier: 1.2901,
      crashed: false,
      natural: false,
      ante: 2
    }
    a.machineStates['flameout-21']!.blackjackReel = midClimbState
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    expect(b.machineStates['flameout-21']!.blackjackReel).toEqual(midClimbState)
  })

  it('restores idle phase if blackjackReel blob is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'flameout-21',
      machineStates: {
        'flameout-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'INVALID',
            reelStrips: 'not-an-array',
            landed: ['not-a-symbol', 999],
            idx: 'lots',
            hand: ['evil'],
            velocity: 'fast',
            multiplier: null,
            crashed: null,
            natural: null,
            ante: 99
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    const bj = store.machineStates['flameout-21']!.blackjackReel!
    expect(bj.phase).toBe('idle')
    expect(bj.hand).toEqual([])
    expect(bj.ante).toBe(0)
    expect(bj.reelStrips).toEqual([])
  })

  it('rejects a state with invalid SymbolIds in landed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'flameout-21',
      machineStates: {
        'flameout-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'spinning',
            reelStrips: [['KS'], ['7D'], ['CLIMB'], ['CRASH'], ['CLIMB']],
            landed: ['KS', 'BADCARD', null, null, null], // BADCARD is not a valid id
            idx: 2,
            hand: ['KS', '7D'],
            velocity: 1.33,
            multiplier: 0.97,
            crashed: false,
            natural: false,
            ante: 1
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['flameout-21']!.blackjackReel!.phase).toBe('idle')
  })

  it('rejects a state with ante > maxCoins', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'flameout-21',
      machineStates: {
        'flameout-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'resolved',
            reelStrips: [],
            landed: [null, null, null, null, null],
            idx: 0,
            hand: [],
            velocity: 0,
            multiplier: 1,
            crashed: false,
            natural: false,
            ante: 999 // > maxCoins (20)
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['flameout-21']!.blackjackReel!.phase).toBe('idle')
    expect(store.machineStates['flameout-21']!.blackjackReel!.ante).toBe(0)
  })

  it('round-trips a resolved (crash) state exactly', () => {
    const crashState = {
      phase: 'resolved' as const,
      reelStrips: [['AS'], ['KS'], ['CRASH', 'CLIMB'], ['CLIMB'], ['CLIMB']],
      landed: ['AS', 'KS', 'CRASH', null, null],
      idx: 2,
      hand: ['AS', 'KS'],
      velocity: 2.0,
      multiplier: 2.0,
      crashed: true,
      natural: true,
      ante: 5
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'flameout-21',
      machineStates: {
        'flameout-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: crashState
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['flameout-21']!.blackjackReel).toEqual(crashState)
  })
})

// ---------------------------------------------------------------------------
// lock-reel store actions: lockDeal / lockStop / lockReset (Stop & Lock 777)
// ---------------------------------------------------------------------------

describe('lock-reel interactive actions — Stop & Lock 777', () => {
  // Stop & Lock 777: denomination 25¢, maxCoins 20.
  const DENOM = STOP_AND_LOCK_777.denominationCents

  it('lockDeal charges the ante once, sets phase spinning, books a deal record', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(2) // 2-coin ante
    const before = store.bankrollCents
    store.lockDeal()

    expect(store.spinning).toBe(true) // gate raised

    // ante charged: 2 coins × 25¢ = 50¢; payout = 0
    expect(store.bankrollCents).toBe(before - 50)

    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    expect(lr.phase).toBe('spinning')
    expect(lr.ante).toBe(2)
    expect(lr.idx).toBe(0) // deal stops no reels

    expect(store.history).toHaveLength(1)
    const rec = store.history[0]!
    expect(rec.machineId).toBe('stop-and-lock-777')
    expect(rec.coinsInCents).toBe(50)
    expect(rec.payoutCents).toBe(0)

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.bankrollCents).toBe(store.bankrollCents)
  })

  it('a full round (deal → 5 stops → collect) charges the ante once, books one collect, +1 spin, round-trips', () => {
    setLiveRand(mulberry32(7))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(1)
    const start = store.bankrollCents
    const spinsBefore = store.stats.spins

    store.lockDeal()
    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    expect(lr.phase).toBe('spinning')
    // Five stops, then drain any bonus the round happens to trigger — the round
    // invariants (one ante, one collect, +1 spin) hold whether or not the 777
    // bonus fires, so this stays robust to RNG drift.
    for (let i = 0; i < 5; i++) {
      store.revealDone()
      store.lockStop()
    }
    let guard = 0
    while (lr.phase === 'bonus') {
      store.revealDone()
      store.lockStop()
      if (++guard > 1000) throw new Error('bonus did not resolve')
    }
    expect(lr.phase).toBe('resolved')
    store.revealDone()

    // The whole-credit collect was booked once on the fifth stop (ante × credits).
    // ante = 1, so the booked credit payout equals collectCredits, in cents = ×denom.
    const collectRec = store.history.at(-1)!
    expect(collectRec.coinsInCents).toBe(0) // stops are free
    expect(collectRec.payoutCents).toBe(lr.collectCredits * DENOM)

    // exactly two history records: the deal (ante) + the collect
    expect(store.history).toHaveLength(2)
    expect(store.history[0]!.coinsInCents).toBe(DENOM) // 1-coin ante charged once
    // one round = one spin counted
    expect(store.stats.spins).toBe(spinsBefore + 1)
    // net = -ante + collect
    expect(store.bankrollCents).toBe(start - DENOM + lr.collectCredits * DENOM)

    // round-trips through loadFromLocalStorage exactly
    const b = freshStore()
    expect(b.loadFromLocalStorage()).toBe(true)
    expect(b.machineStates['stop-and-lock-777']!.lockReel).toEqual(lr)
    expect(b.history).toHaveLength(2)
    expect(b.stats.spins).toBe(store.stats.spins)
    expect(b.bankrollCents).toBe(store.bankrollCents)
  })

  it('a forced 3-seven round enters the bonus and the bonus action books the full collect', () => {
    setLiveRand(mulberry32(123))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(1)
    const start = store.bankrollCents

    store.lockDeal()
    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    // Force the first four reels stopped with three sticky 7s already locked, so
    // the fifth honest stop keeps sevenCount ≥ 3 → the 777 BONUS opens. (We force
    // state.lockReel directly, as the engine reads its reels from the def.)
    lr.grid[0] = ['SEVEN', 'BLANK', 'BLANK', 'BLANK']
    lr.grid[1] = ['SEVEN', 'BLANK', 'BLANK', 'BLANK']
    lr.grid[2] = ['SEVEN', 'C1', 'BLANK', 'BLANK']
    lr.grid[3] = ['C1', 'BLANK', 'BLANK', 'BLANK']
    lr.idx = 4
    lr.sevenCount = 3
    lr.collectCredits = 2

    const histBefore = store.history.length

    // Fifth stop: resolves into the bonus (no collect booked yet).
    store.revealDone()
    store.lockStop()
    expect(lr.phase).toBe('bonus')
    expect(lr.sevenCount).toBeGreaterThanOrEqual(3)
    expect(store.history.length).toBe(histBefore) // bonus trigger pays nothing yet

    // Step the bonus via the SAME action until it resolves.
    let guard = 0
    while (lr.phase === 'bonus') {
      store.revealDone()
      store.lockStop()
      if (++guard > 1000) throw new Error('bonus did not resolve')
    }
    expect(lr.phase).toBe('resolved')
    store.revealDone()

    // The full collect (base + bonus cash + sticky-7 upgrades [+ GRAND]) is booked
    // once, on the resolving bonus step. Sticky 7s upgrade, so the collect strictly
    // exceeds the pre-bonus cash.
    expect(lr.collectCredits).toBeGreaterThan(2)
    const collectRec = store.history.at(-1)!
    expect(store.history.length).toBe(histBefore + 1)
    expect(collectRec.coinsInCents).toBe(0) // the bonus step is free
    expect(collectRec.payoutCents).toBe(lr.collectCredits * DENOM) // ante 1 → credits × denom
    // net across the round = -ante(1) + collect
    expect(store.bankrollCents).toBe(start - DENOM + lr.collectCredits * DENOM)
  })

  it('lockStop is a no-op outside spinning/bonus; lockDeal is a no-op while spinning or broke', () => {
    setLiveRand(mulberry32(1))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(1)

    // lockStop before any deal (phase idle) → no-op
    store.lockStop()
    expect(store.history).toHaveLength(0)

    store.lockDeal()
    expect(store.spinning).toBe(true) // gate up
    // lockDeal again while spinning → no-op (no double-charge)
    store.lockDeal()
    expect(store.history).toHaveLength(1)
    store.revealDone()

    // drain bankroll below one coin and try to deal again (after resolving a round)
    for (let i = 0; i < 5; i++) {
      store.lockStop()
      store.revealDone()
    }
    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    if (lr.phase === 'bonus') {
      let guard = 0
      while (lr.phase === 'bonus') {
        store.lockStop()
        store.revealDone()
        if (++guard > 1000) throw new Error('bonus did not resolve')
      }
    }
    expect(lr.phase).toBe('resolved')
    const histAfterRound = store.history.length
    store.bankrollCents = 10 // 10¢ < 25¢ (one coin)
    store.lockDeal()
    expect(store.history).toHaveLength(histAfterRound) // no new deal record
    expect(store.liveAnnouncement).toMatch(/out of credits/i)
  })

  it('lockReset returns a resolved round to idle without charging', () => {
    setLiveRand(mulberry32(55))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(1)
    store.lockDeal()
    for (let i = 0; i < 5; i++) {
      store.revealDone()
      store.lockStop()
    }
    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    let guard = 0
    while (lr.phase === 'bonus') {
      store.revealDone()
      store.lockStop()
      if (++guard > 1000) throw new Error('bonus did not resolve')
    }
    expect(lr.phase).toBe('resolved')
    store.revealDone()
    const histBefore = store.history.length
    store.lockReset()
    const fresh = store.machineStates['stop-and-lock-777']!.lockReel!
    expect(fresh.phase).toBe('idle')
    expect(fresh.idx).toBe(0)
    expect(fresh.ante).toBe(0)
    expect(fresh.collectCredits).toBe(0)
    expect(fresh.grid.every(col => col.every(c => c === null))).toBe(true)
    expect(store.history).toHaveLength(histBefore) // reset is free
  })

  it('spinOnce is a no-op for lock-reel (uses its own actions)', () => {
    setLiveRand(mulberry32(2))
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.spinOnce()
    expect(store.history).toHaveLength(0)
    expect(store.spinning).toBe(false)
  })

  it('defaults the lock-reel bet to 1 coin (small-bet pull)', () => {
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    expect(store.currentBet).toBe(1)
  })

  it('bet is selectable for lock-reel (1..maxCoins), not forced to max', () => {
    const store = freshStore()
    store.startSession(1_000_000)
    store.selectMachine('stop-and-lock-777')
    store.setBet(1)
    expect(store.currentBet).toBe(1)
    store.setBet(10)
    expect(store.currentBet).toBe(10)
    store.setBet(99) // over max → clamped
    expect(store.currentBet).toBe(STOP_AND_LOCK_777.maxCoins)
  })
})

describe('lock-reel sanitizeMachineState — Stop & Lock 777', () => {
  it('round-trips a mid-stop spinning grid exactly', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('stop-and-lock-777')
    // Two reels stopped (idx=2): columns 0–1 locked, 2–4 still empty (all null).
    // rows = 4. sevenCount/collectCredits reflect the locked columns.
    const midState = {
      phase: 'spinning' as const,
      grid: [
        ['SEVEN', 'C1', 'BLANK', 'BLANK'],
        ['C2', 'BLANK', 'C1', 'BLANK'],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ],
      idx: 2,
      sevenCount: 1,
      collectCredits: 4, // C1 + C2 + C1
      respinsLeft: 0,
      ante: 3
    }
    a.machineStates['stop-and-lock-777']!.lockReel = midState
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    expect(b.machineStates['stop-and-lock-777']!.lockReel).toEqual(midState)
  })

  it('round-trips a resolved (bonus-fill GRAND) state exactly', () => {
    const grandState = {
      phase: 'resolved' as const,
      grid: [
        ['SEVEN', 'C1', 'C2', 'C5'],
        ['SEVEN', 'C1', 'C1', 'C2'],
        ['SEVEN', 'C2', 'C1', 'C1'],
        ['C5', 'C1', 'C2', 'C1'],
        ['C2', 'C1', 'C5', 'C1']
      ],
      idx: 5,
      sevenCount: 3,
      collectCredits: 500,
      respinsLeft: 0,
      ante: 1
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: grandState
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['stop-and-lock-777']!.lockReel).toEqual(grandState)
  })

  it('restores a fresh idle state when the lockReel blob is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: {
            phase: 'INVALID',
            grid: 'not-an-array',
            idx: 'lots',
            sevenCount: -3,
            collectCredits: 'free',
            respinsLeft: null,
            ante: 999
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    const lr = store.machineStates['stop-and-lock-777']!.lockReel!
    expect(lr.phase).toBe('idle')
    expect(lr.idx).toBe(0)
    expect(lr.ante).toBe(0)
    expect(lr.collectCredits).toBe(0)
    expect(lr.grid).toHaveLength(5)
    expect(lr.grid.every(col => col.length === STOP_AND_LOCK_777.rows && col.every(c => c === null))).toBe(true)
  })

  it('rejects wrong grid dimensions (4 columns instead of 5)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: {
            phase: 'spinning',
            grid: [ // only 4 columns
              ['SEVEN', 'BLANK', 'BLANK', 'BLANK'],
              ['C1', 'BLANK', 'BLANK', 'BLANK'],
              [null, null, null, null],
              [null, null, null, null]
            ],
            idx: 2,
            sevenCount: 1,
            collectCredits: 1,
            respinsLeft: 0,
            ante: 1
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['stop-and-lock-777']!.lockReel!.phase).toBe('idle')
  })

  it('rejects a bogus symbol id in the grid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: {
            phase: 'spinning',
            grid: [
              ['NOPE', 'BLANK', 'BLANK', 'BLANK'], // NOPE is not a known symbol id
              [null, null, null, null],
              [null, null, null, null],
              [null, null, null, null],
              [null, null, null, null]
            ],
            idx: 1,
            sevenCount: 0,
            collectCredits: 0,
            respinsLeft: 0,
            ante: 1
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['stop-and-lock-777']!.lockReel!.phase).toBe('idle')
  })

  it('rejects an incoherent phase/idx (spinning with a stopped reel left null)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: {
            phase: 'spinning',
            grid: [
              [null, null, null, null], // idx says 2 stopped, but column 0 is empty
              ['C1', 'BLANK', 'BLANK', 'BLANK'],
              [null, null, null, null],
              [null, null, null, null],
              [null, null, null, null]
            ],
            idx: 2,
            sevenCount: 0,
            collectCredits: 1,
            respinsLeft: 0,
            ante: 1
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['stop-and-lock-777']!.lockReel!.phase).toBe('idle')
  })

  it('rejects a bonus phase with fewer than three sevens (incoherent trigger)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'stop-and-lock-777',
      machineStates: {
        'stop-and-lock-777': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: null,
          lockReel: {
            phase: 'bonus',
            grid: [
              ['SEVEN', 'C1', 'BLANK', 'BLANK'],
              ['C1', 'BLANK', 'BLANK', 'BLANK'],
              ['C2', 'BLANK', 'BLANK', 'BLANK'],
              ['C1', 'BLANK', 'BLANK', 'BLANK'],
              ['C5', 'BLANK', 'BLANK', 'BLANK']
            ],
            idx: 5,
            sevenCount: 1, // a bonus needs ≥ 3 sevens
            collectCredits: 10,
            respinsLeft: 2,
            ante: 1
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['stop-and-lock-777']!.lockReel!.phase).toBe('idle')
  })
})

describe('storage version notice', () => {
  it('flags an incompatible save on peek AND on load, and can be dismissed', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, bankrollCents: 5000 }))
    const store = useSlotsStore()
    expect(store.storageNotice).toBe(false)

    expect(store.peekSavedSession()).toBe(false) // the boot-time gate
    expect(store.storageNotice).toBe(true)

    store.dismissStorageNotice()
    expect(store.storageNotice).toBe(false)

    expect(store.loadFromLocalStorage()).toBe(false) // the load path
    expect(store.storageNotice).toBe(true)
  })

  it('does not flag a valid save, an empty slot, or unparseable garbage', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()

    expect(store.peekSavedSession()).toBe(false) // empty slot
    expect(store.storageNotice).toBe(false)

    store.startSession(10_000) // writes a valid v1 save
    expect(store.peekSavedSession()).toBe(true)
    expect(store.storageNotice).toBe(false)

    localStorage.setItem(STORAGE_KEY, 'not json {{{')
    expect(store.peekSavedSession()).toBe(false)
    expect(store.storageNotice).toBe(false) // corrupt ≠ incompatible: stay silent
  })
})
