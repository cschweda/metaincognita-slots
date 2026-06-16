/**
 * Lucky 21 calibration (one-off): make reel 3 friendlier (fewer BUST, more
 * bonuses) and shift the danger to reels 4-5 while holding RTP ~90% under the
 * exact optimal-stopping DP.  pnpm tsx scripts/calibrate-lucky21.ts
 */
import { LUCKY_21 } from '../app/machines/lucky-21'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import type { BlackjackReelMachineDef, SymbolId } from '../app/engine/types'

const arr = (n: number, s: SymbolId): SymbolId[] => Array<SymbolId>(n).fill(s)

// Reel 3 (no cards): a richer bonus set + b3 BUST. "Increase the bonuses."
function reel3(b3: number): SymbolId[] {
  return [...arr(b3, 'BUST'), 'MX2', 'MX3', 'MX2', 'MX3', 'MM3']
}
function reel4(b4: number): SymbolId[] {
  return ['CARD', 'CARD', ...arr(b4, 'BUST'), 'MX3', 'MM3']
}
function reel5(b5: number): SymbolId[] {
  return ['CARD', 'CARD', ...arr(b5, 'BUST'), 'MX5', 'MX10', 'MX5']
}

function build(b3: number, b4: number, b5: number): BlackjackReelMachineDef {
  return { ...LUCKY_21, reels: [LUCKY_21.reels[0]!, LUCKY_21.reels[1]!, reel3(b3), reel4(b4), reel5(b5)] }
}
function stats(def: BlackjackReelMachineDef) {
  const r = blackjackReelExactRtp(def)
  const ch = r.breakdown.find(e => e.entryId === 'charlie')?.probability ?? 0
  const bu = r.breakdown.find(e => e.entryId === 'bust')?.probability ?? 0
  return { rtp: r.rtpPerCoin, charlie: ch, bust: bu }
}

// Reference: current def.
{
  const s = stats(LUCKY_21)
  console.log(`CURRENT reel3=8BUST+3bonus  RTP=${(s.rtp * 100).toFixed(3)}%  charlie=${(s.charlie * 100).toFixed(3)}%  bust=${(s.bust * 100).toFixed(2)}%`)
}

// Search: friendlier reel 3 (b3 small), offset on reels 4/5.
const hits: { b3: number, b4: number, b5: number, rtp: number, charlie: number, bust: number }[] = []
for (const b3 of [2, 3, 4]) {
  for (let b4 = 9; b4 <= 22; b4++) {
    for (let b5 = 11; b5 <= 24; b5++) {
      const s = stats(build(b3, b4, b5))
      if (Math.abs(s.rtp - 0.90) <= 0.004) hits.push({ b3, b4, b5, ...s })
    }
  }
}
hits.sort((a, b) => b.charlie - a.charlie || Math.abs(a.rtp - 0.9) - Math.abs(b.rtp - 0.9))
console.log(`\n~90% RTP candidates (friendlier reel 3 = bBUST + MX2,MX3,MX2,MX3,MM3), best Charlie first:`)
for (const h of hits.slice(0, 14)) {
  console.log(
    `  reel3=${h.b3}BUST+5bonus  reel4=${String(h.b4).padStart(2)}BUST  reel5=${String(h.b5).padStart(2)}BUST  ->  `
    + `RTP=${(h.rtp * 100).toFixed(3)}%  charlie=${(h.charlie * 100).toFixed(3)}%  bust=${(h.bust * 100).toFixed(2)}%`
  )
}
