export interface ChromeTheme {
  accent: string
  secondary: string
  glow: string
  backdrop: string
}

const CHROME_THEME: Record<string, ChromeTheme> = {
  'ruby-of-gargoyle': { accent: '#e11d48', secondary: '#475569', glow: '#fb7185', backdrop: '#0c0810' },
  'canal-royale': { accent: '#f59e0b', secondary: '#0e7490', glow: '#fcd34d', backdrop: '#06181d' },
  'dragons-hoard': { accent: '#22c55e', secondary: '#f97316', glow: '#4ade80', backdrop: '#07120b' },
  'thunder-vault': { accent: '#a78bfa', secondary: '#38bdf8', glow: '#c4b5fd', backdrop: '#0b1020' },
  'diamond-doubler': { accent: '#38bdf8', secondary: '#e0f2fe', glow: '#7dd3fc', backdrop: '#0a1418' },
  'sevens-ablaze': { accent: '#ef4444', secondary: '#f59e0b', glow: '#fca5a5', backdrop: '#1a0a0a' },
  'series-e-3line': { accent: '#d4a017', secondary: '#f5e6c8', glow: '#e7c14a', backdrop: '#1a1208' },
  'series-e-multiplier': { accent: '#2dd4bf', secondary: '#94a3b8', glow: '#5eead4', backdrop: '#0a1a1a' },
  'stock-rush': { accent: '#fb923c', secondary: '#ec4899', glow: '#22d3ee', backdrop: '#0a0a12' },
  'hit-or-bust': { accent: '#d4a017', secondary: '#0e6b3d', glow: '#fbbf24', backdrop: '#06150d' }
}

const FALLBACK: ChromeTheme = { accent: '#94a3b8', secondary: '#64748b', glow: '#cbd5e1', backdrop: '#0a0a0a' }

export function chromeTheme(id: string): ChromeTheme {
  return CHROME_THEME[id] ?? FALLBACK
}
