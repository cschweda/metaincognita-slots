// app/components/game/marquee/art.ts
interface MarqueeArt { accent: string, heroIcon: string, tagline: string }

const MACHINE_ART: Record<string, MarqueeArt> = {
  'canal-royale': { accent: '#f59e0b', heroIcon: 'mask', tagline: '25-Line Venetian Video Slot' },
  'dragons-hoard': { accent: '#22c55e', heroIcon: 'dragon', tagline: '243-Ways Fortune Slot' },
  'thunder-vault': { accent: '#a78bfa', heroIcon: 'vault', tagline: 'Hold & Spin · Grand Jackpot' },
  'diamond-doubler': { accent: '#38bdf8', heroIcon: 'diamond', tagline: 'Three-Reel Stepper' },
  'sevens-ablaze': { accent: '#ef4444', heroIcon: 'seven-flame', tagline: 'Flaming Sevens Stepper' },
  'series-e-3line': { accent: '#fbbf24', heroIcon: 'bell', tagline: 'Classic Bally Electro-Mechanical' },
  'series-e-multiplier': { accent: '#fbbf24', heroIcon: 'seven', tagline: 'Bally Multiplier · Dual Progressive' },
  'stock-rush': { accent: '#fb923c', heroIcon: 'seven-red', tagline: 'Pachislo · Skill-Stop Reels' },
  'ruby-of-gargoyle': { accent: '#e11d48', heroIcon: 'gargoyle', tagline: 'Hold & Spin · Gargoyle\'s Eye Multiplier' },
  'lucky-21': { accent: '#d4a017', heroIcon: 'ace', tagline: 'Stop-the-Reels · Press Your Luck to 21' }
}

export function marqueeArtFor(id: string, family: string, denomCents: number): MarqueeArt {
  return MACHINE_ART[id] ?? { accent: '#94a3b8', heroIcon: 'blank', tagline: `${family} · ${denomCents}¢` }
}
