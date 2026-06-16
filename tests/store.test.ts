// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSlotsStore, STORAGE_KEY } from '../app/stores/slots'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { mulberry32, simulateMachine } from '../app/engine'
import { setLiveRand } from '../app/utils/liveRand'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
// Lucky 21: imported for the skip-guarded blackjack-reel tests below (Tasks 8/9 rewrite them
// against the real Lucky 21 store actions; left skipped here — see describe.skip blocks).
import { LUCKY_21 } from '../app/machines/lucky-21'

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
    expect(f.kind).toBe('holdAndSpin')
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
    const text = store.describeOutcome(CANAL_ROYALE, out as never)
    expect(text).toContain('Won 14 credits.')
    expect(text).toContain('Net down 11.')
  })

  it('a win that beats the bet is announced as a net gain', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 1030, coinsIn: 25, featureEvents: [], progressiveEvents: [] }
    expect(store.describeOutcome(CANAL_ROYALE, out as never)).toContain('Net up 1,005.')
  })

  it('a no-win announces the forfeited bet as a net loss', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 0, coinsIn: 25, featureEvents: [], progressiveEvents: [] }
    const text = store.describeOutcome(CANAL_ROYALE, out as never)
    expect(text).toContain('No win.')
    expect(text).toContain('Net down 25.')
  })

  it('a free spin that pays (coins-in 0) is announced as a net gain, not an LDW', () => {
    const store = freshStore()
    store.startSession(100_000)
    const out = { totalPayout: 14, coinsIn: 0, featureEvents: [], progressiveEvents: [] }
    expect(store.describeOutcome(CANAL_ROYALE, out as never)).toContain('Net up 14.')
  })
})

// ---------------------------------------------------------------------------
// blackjack-reel store actions: deal / stop / cashOut (Lucky 21)
// ---------------------------------------------------------------------------

describe('blackjack-reel interactive actions — Lucky 21', () => {
  it('deal charges the ante, sets phase to spinning, books deal record', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(100_000) // 100_000 cents = 4000 credits at 25¢
    store.selectMachine('lucky-21')
    store.setBet(2) // 2-coin ante
    const before = store.bankrollCents
    store.deal()

    // spinning gate should be raised
    expect(store.spinning).toBe(true)

    // ante charged: 2 coins × 25¢ = 50¢; payout = 0
    expect(store.bankrollCents).toBe(before - 50)

    // session state must be in spinning phase (deal transitions to spinning)
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('spinning')
    expect(bj.ante).toBe(2)

    // history record for the deal: coinsIn = 50¢, payout = 0
    expect(store.history).toHaveLength(1)
    const rec = store.history[0]!
    expect(rec.machineId).toBe('lucky-21')
    expect(rec.coinsInCents).toBe(50)
    expect(rec.payoutCents).toBe(0)

    // persisted to localStorage
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.bankrollCents).toBe(store.bankrollCents)
  })

  it('stop stops the next reel; on non-resolve keeps gate high, no new history', () => {
    // dealReels builds strips and sets idx=0 (phase='spinning'); it does NOT stop
    // any reel — every reel stop requires an explicit hitCard call.
    setLiveRand(mulberry32(7))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    store.deal()
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('spinning')
    expect(bj.idx).toBe(0) // no reels stopped yet after deal
    store.revealDone()

    // Stop reel 0 (always a CARD on Lucky 21, can't bust)
    store.stop()
    expect(bj.idx).toBe(1)
    expect(bj.phase).toBe('spinning') // reel 0 = pure card, never resolves
    expect(store.spinning).toBe(true)
    const histAfterReel0 = store.history.length
    store.revealDone()

    // Stop reel 1 (also a CARD, can't bust)
    store.stop()
    expect(bj.idx).toBe(2)
    expect(bj.phase).toBe('spinning')
    expect(store.history).toHaveLength(histAfterReel0) // no new record yet
    store.revealDone()

    // Stop reel 2 (BUST-heavy: 8 BUST + MX2 + MX3 + MM3)
    const histBefore = store.history.length
    store.stop()
    // Either still spinning (non-bust) or resolved (bust): both are valid
    if (bj.phase === 'spinning') {
      expect(bj.idx).toBe(3)
      expect(store.history).toHaveLength(histBefore) // no extra record for non-resolve
    } else {
      expect(bj.phase).toBe('resolved')
      expect(store.history.length).toBeGreaterThan(histBefore)
    }
    expect(store.spinning).toBe(true)
  })

  it('cashOut books payout and sets phase to resolved', () => {
    setLiveRand(mulberry32(99))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(3)
    store.deal()
    store.revealDone()

    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('spinning')

    const bankBefore = store.bankrollCents
    const histBefore = store.history.length
    store.cashOut()

    expect(bj.phase).toBe('resolved')
    expect(store.spinning).toBe(true)
    // cashOut books a payout record
    expect(store.history.length).toBe(histBefore + 1)
    const lastRec = store.history.at(-1)!
    expect(lastRec.coinsInCents).toBe(0) // cashOut is free
    expect(lastRec.payoutCents).toBeGreaterThanOrEqual(0)
    expect(store.bankrollCents).toBe(bankBefore + lastRec.payoutCents)
  })

  it('deal is a no-op while spinning or broke', () => {
    setLiveRand(mulberry32(1))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.deal()
    expect(store.spinning).toBe(true) // gate is up

    // calling again while spinning does nothing
    store.deal()
    expect(store.history).toHaveLength(1)

    // lower gate, cash out, lower gate again
    store.revealDone()
    store.cashOut()
    store.revealDone()
    expect(store.history).toHaveLength(2) // deal + cashOut records

    // drain bankroll to below 1 coin (25¢) and try to deal
    store.bankrollCents = 10 // 10¢ < 25¢
    store.deal()
    expect(store.history).toHaveLength(2) // no new deal record
    expect(store.liveAnnouncement).toMatch(/out of credits/i)
  })

  it('spinOnce is a no-op for blackjack-reel (uses its own actions)', () => {
    setLiveRand(mulberry32(2))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.spinOnce()
    expect(store.history).toHaveLength(0)
    expect(store.spinning).toBe(false)
  })

  it('a full deal → cashOut hand round-trips through persistence', () => {
    setLiveRand(mulberry32(42))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    store.deal()
    store.revealDone()
    store.cashOut()
    store.revealDone()

    // save and reload
    const b = freshStore()
    expect(b.resume()).toBe(true)
    const bj = b.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('resolved')
    expect(b.history.length).toBeGreaterThanOrEqual(1)
  })

  it('wallet net across a full hand: only one debit (deal) and one credit (resolve)', () => {
    setLiveRand(mulberry32(500))
    const store = freshStore()
    store.startSession(10_000)
    store.selectMachine('lucky-21')
    store.setBet(1) // ante = 1 coin = 25¢
    const start = store.bankrollCents
    store.deal()
    store.revealDone()
    // Immediately cash out (stand after 2 cards)
    store.cashOut()
    store.revealDone()
    const dealRec = store.history[0]!
    const payRec = store.history[1]!
    expect(dealRec.coinsInCents).toBe(25) // debit
    expect(dealRec.payoutCents).toBe(0)
    expect(payRec.coinsInCents).toBe(0) // cashOut is free
    expect(payRec.payoutCents).toBeGreaterThanOrEqual(0)
    expect(store.bankrollCents).toBe(start - 25 + payRec.payoutCents)
  })

  it('bet is selectable for blackjack-reel (1..maxCoins), not forced to max', () => {
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    expect(LUCKY_21.maxCoins).toBeGreaterThanOrEqual(3)
    store.setBet(1)
    expect(store.currentBet).toBe(1)
    store.setBet(2)
    expect(store.currentBet).toBe(2)
    store.setBet(3)
    expect(store.currentBet).toBe(3)
    store.setBet(99) // over max → clamped
    expect(store.currentBet).toBe(LUCKY_21.maxCoins)
  })

  it('one deal+cashOut hand increments spins by exactly 1', () => {
    const store = freshStore()
    setLiveRand(mulberry32(999))
    store.startSession(1_000_000)
    store.selectMachine('lucky-21')
    const before = store.stats.spins
    store.deal()
    store.revealDone()
    store.cashOut()
    store.revealDone()
    expect(store.stats.spins).toBe(before + 1)
  })
})

// ---------------------------------------------------------------------------
// blackjack-reel gamble actions: gambleStop / gambleCashOut (Lucky 21)
// ---------------------------------------------------------------------------

describe('blackjack-reel gamble actions — Lucky 21', () => {
  /** Force a natural by rigging the reel strips after deal. */
  function dealToNatural(store: ReturnType<typeof useSlotsStore>) {
    store.deal()
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    bj.reelStrips[0] = ['AS']
    bj.reelStrips[1] = ['TH']
    store.revealDone()
    store.stop() // lock AS → reel 0
    store.revealDone()
    store.stop() // lock TH → reel 1, natural → phase 'gamble'
    store.revealDone()
  }

  it('gambleCashOut books the naturalPay × ante payout and resolves', () => {
    setLiveRand(mulberry32(1))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    dealToNatural(store)
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('gamble')
    const expectedAmount = bj.gambleAmount
    expect(expectedAmount).toBeGreaterThan(0)
    const bankBefore = store.bankrollCents
    const histBefore = store.history.length
    store.gambleCashOut()
    expect(bj.phase).toBe('resolved')
    expect(store.spinning).toBe(true)
    expect(store.history.length).toBe(histBefore + 1)
    const rec = store.history.at(-1)!
    expect(rec.payoutCents).toBe(expectedAmount * LUCKY_21.denominationCents)
    expect(store.bankrollCents).toBe(bankBefore + rec.payoutCents)
  })

  it('gambleStop resolves the hand (either doubled or bust)', () => {
    setLiveRand(mulberry32(7))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    dealToNatural(store)
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    const base = bj.gambleAmount
    expect(base).toBeGreaterThan(0)
    const histBefore = store.history.length
    store.gambleStop()
    // Either win (gamble) or bust (resolved): both are valid outcomes
    if (bj.phase === 'gamble') {
      expect(bj.gambleAmount).toBe(base * 2)
      expect(bj.gambleCount).toBe(1)
      expect(store.history.length).toBe(histBefore) // not resolved yet; no new record
    } else {
      expect(bj.phase).toBe('resolved')
      // bust → no record added yet (spinning gate still up); win at cap → record added
    }
    expect(store.spinning).toBe(true)
  })

  it('gambleCashOut is a no-op while spinning or not in gamble phase', () => {
    setLiveRand(mulberry32(2))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    store.deal()
    store.revealDone()
    // phase is 'spinning', not 'gamble' — gambleCashOut must no-op
    const histBefore = store.history.length
    store.gambleCashOut()
    expect(store.history.length).toBe(histBefore)
    expect(store.spinning).toBe(false)
  })

  it('gambleStop is a no-op when not in gamble phase', () => {
    setLiveRand(mulberry32(3))
    const store = freshStore()
    store.startSession(100_000)
    store.selectMachine('lucky-21')
    store.setBet(1)
    store.deal()
    store.revealDone()
    // phase is 'spinning' — gambleStop must no-op
    const histBefore = store.history.length
    store.gambleStop()
    expect(store.history.length).toBe(histBefore)
    expect(store.spinning).toBe(false)
  })
})

describe('blackjack-reel sanitizeMachineState — Lucky 21', () => {
  it('round-trips a mid-hand spinning state exactly', () => {
    const a = freshStore()
    a.startSession(50_000)
    a.selectMachine('lucky-21')
    // Simulate a state after 2 card reels stopped (idx=2, hand=[KS,7D])
    // reelStrips must contain only valid deck ids or special Lucky-21 symbol ids —
    // 'CARD' tokens are resolved to concrete deck cards at deal time and never persisted.
    const midHandState = {
      phase: 'spinning' as const,
      reelStrips: [['KS', 'QH'], ['7D', 'AS'], ['MX2', 'BUST'], ['BUST', 'MX3'], ['MX5', 'BUST']],
      landed: ['KS', '7D', null, null, null],
      idx: 2,
      hand: ['KS', '7D'],
      hard: 17,
      aces: 0,
      multSum: 0,
      bestTotal: 17,
      natural: false,
      busted: false,
      bustBySymbol: false,
      charlie: false,
      ante: 2,
      gambleAmount: 0,
      gambleCount: 0
    }
    a.machineStates['lucky-21']!.blackjackReel = midHandState
    a.saveToLocalStorage()
    const b = freshStore()
    expect(b.resume()).toBe(true)
    expect(b.machineStates['lucky-21']!.blackjackReel).toEqual(midHandState)
  })

  it('restores idle phase if blackjackReel blob is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'INVALID',
            reelStrips: 'not-an-array',
            landed: ['not-a-symbol', 999],
            idx: 'lots',
            hand: ['evil'],
            hard: -5,
            aces: 'yes',
            multSum: -5,
            bestTotal: null,
            natural: null,
            busted: null,
            bustBySymbol: undefined,
            charlie: undefined,
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
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    // corrupt data → falls back to fresh idle state
    expect(bj.phase).toBe('idle')
    expect(bj.hand).toEqual([])
    expect(bj.ante).toBe(0)
    expect(bj.reelStrips).toEqual([])
  })

  it('rejects a state with invalid SymbolIds in landed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'spinning',
            reelStrips: [['KS'], ['7D'], ['MX2'], ['MX3'], ['BUST']],
            landed: ['KS', 'BADCARD', null, null, null], // BADCARD is not a valid id
            idx: 2,
            hand: ['KS', '7D'],
            hard: 17,
            aces: 0,
            multSum: 0,
            bestTotal: 17,
            natural: false,
            busted: false,
            bustBySymbol: false,
            charlie: false,
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
    // should have fallen back to fresh idle
    expect(store.machineStates['lucky-21']!.blackjackReel!.phase).toBe('idle')
  })

  it('rejects a state with ante > maxCoins', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'resolved',
            reelStrips: [],
            landed: [null, null, null, null, null],
            idx: 0,
            hand: [],
            hard: 0,
            aces: 0,
            multSum: 0,
            bestTotal: 0,
            natural: false,
            busted: false,
            bustBySymbol: false,
            charlie: false,
            ante: 999 // > maxCoins (5)
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['lucky-21']!.blackjackReel!.phase).toBe('idle')
    expect(store.machineStates['lucky-21']!.blackjackReel!.ante).toBe(0)
  })

  it('round-trips a resolved (bust) state exactly', () => {
    const bustState = {
      phase: 'resolved' as const,
      reelStrips: [['AS'], ['KS'], ['MX2', 'BUST'], ['BUST'], ['MX5']],
      landed: ['AS', 'KS', 'BUST', null, null],
      idx: 3,
      hand: ['AS', 'KS'],
      hard: 11,
      aces: 1,
      multSum: 0,
      bestTotal: 21,
      natural: true,
      busted: true,
      bustBySymbol: true,
      charlie: false,
      ante: 5,
      gambleAmount: 0,
      gambleCount: 0
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: bustState
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    expect(store.machineStates['lucky-21']!.blackjackReel).toEqual(bustState)
  })

  it('round-trips a mid-gamble state with amount/count intact', () => {
    const gambleState = {
      phase: 'gamble' as const,
      reelStrips: [['AS'], ['TH'], ['MX2', 'BUST'], ['BUST', 'MX3'], ['MX5', 'BUST']],
      landed: ['AS', 'TH', null, null, null],
      idx: 2,
      hand: ['AS', 'TH'],
      hard: 11,
      aces: 1,
      multSum: 0,
      bestTotal: 21,
      natural: true,
      busted: false,
      bustBySymbol: false,
      charlie: false,
      ante: 3,
      gambleAmount: 15,
      gambleCount: 1
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: gambleState
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('gamble')
    expect(bj.gambleAmount).toBe(15)
    expect(bj.gambleCount).toBe(1)
    expect(bj.natural).toBe(true)
    expect(bj.ante).toBe(3)
  })

  it('clamps gambleCount to GAMBLE_CAP on restore', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      bankrollCents: 5000,
      currentMachineId: 'lucky-21',
      machineStates: {
        'lucky-21': {
          progressive: null,
          videoFeature: null,
          pachislo: null,
          blackjackReel: {
            phase: 'gamble',
            reelStrips: [['AS'], ['TH'], ['MX2'], ['BUST'], ['MX5']],
            landed: ['AS', 'TH', null, null, null],
            idx: 2,
            hand: ['AS', 'TH'],
            hard: 11,
            aces: 1,
            multSum: 0,
            bestTotal: 21,
            natural: true,
            busted: false,
            bustBySymbol: false,
            charlie: false,
            ante: 1,
            gambleAmount: 5,
            gambleCount: 99
          }
        }
      },
      history: [],
      stats: null,
      settings: null
    }))
    const store = freshStore()
    expect(store.resume()).toBe(true)
    const bj = store.machineStates['lucky-21']!.blackjackReel!
    expect(bj.phase).toBe('gamble')
    expect(bj.gambleCount).toBe(3) // clamped to GAMBLE_CAP
    expect(bj.gambleAmount).toBe(5)
  })
})
