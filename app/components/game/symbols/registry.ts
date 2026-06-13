// app/components/game/symbols/registry.ts
//
// Icon house style: 24x24 viewBox, FILLED DUOTONE — one solid fill + one darker
// shade for depth, rounded forms, no thin outlines. Colours use literal hex close
// to Tailwind tokens. Pictorial ids return inline SVG *children* (no <svg> wrapper);
// SymbolIcon supplies the wrapper. Typographic ids (royals, sevens, bars) render
// as styled text instead of art.

export type SymbolArt
  = | { kind: 'svg', body: string }
    | { kind: 'text', text: string, variant: 'royal' | 'seven' | 'bar', color?: string }

export const SYMBOL_ART: Record<string, SymbolArt> = {
  // ---- typographic ----
  'ace': { kind: 'text', text: 'A', variant: 'royal' },
  'king': { kind: 'text', text: 'K', variant: 'royal' },
  'queen': { kind: 'text', text: 'Q', variant: 'royal' },
  'jack': { kind: 'text', text: 'J', variant: 'royal' },
  'ten': { kind: 'text', text: '10', variant: 'royal' },
  'seven': { kind: 'text', text: '7', variant: 'seven', color: '#f59e0b' },
  'seven-red': { kind: 'text', text: '7', variant: 'seven', color: '#ef4444' },
  'seven-flame': { kind: 'text', text: '7', variant: 'seven', color: '#fb923c' },
  'bar1': { kind: 'text', text: '1', variant: 'bar' },
  'bar2': { kind: 'text', text: '2', variant: 'bar' },
  'bar3': { kind: 'text', text: '3', variant: 'bar' },
  'bar-bonus': { kind: 'text', text: 'B', variant: 'bar', color: '#fcd34d' },
  // ---- core pictorial (vetted in the design demo) ----
  'bell': { kind: 'svg', body: '<path d="M12 2.4c.9 0 1.6.7 1.6 1.6v.5c2.9 1 4.8 3.8 4.8 7v3.1l1.6 2.1c.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1l1.6-2.1V12c0-3.2 1.9-6 4.8-7v-.5c0-.9.7-1.6 1.6-1.6z" fill="#fcd34d"/><path d="M12 5.6c-2.6 0-4.4 2.4-4.4 6.4v3.4h8.8V12c0-4-1.8-6.4-4.4-6.4z" fill="#b45309"/><circle cx="12" cy="20.4" r="1.9" fill="#fcd34d"/>' },
  'cherry': { kind: 'svg', body: '<path d="M10 8c-3-5-9-3-9 1 0 3 4 5 8 5" stroke="#15803d" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="8.5" cy="17" r="4.4" fill="#f43f5e"/><circle cx="16.5" cy="18" r="3.8" fill="#e11d48"/><circle cx="7" cy="15.6" r="1.2" fill="#fda4af"/>' },
  'diamond': { kind: 'svg', body: '<path d="M6 4h12l4 5-10 12L2 9z" fill="#38bdf8"/><path d="M6 4l-4 5h20l-4-5M12 21L8 9h8z" fill="#0ea5e9"/>' },
  'plum': { kind: 'svg', body: '<circle cx="11.5" cy="14" r="7" fill="#7c3aed"/><circle cx="9" cy="11.5" r="2.1" fill="#c4b5fd"/><path d="M12 7c1-3 4-4.5 6.5-4.3C18 5.7 15.6 7.4 12 7z" fill="#22c55e"/>' },
  'orange': { kind: 'svg', body: '<circle cx="12" cy="13.5" r="7.3" fill="#f97316"/><circle cx="9.4" cy="10.8" r="2.2" fill="#fdba74"/><path d="M12 6c1-2.2 3.2-2.7 4.8-2-.6 2.2-2.4 3.2-4.8 2z" fill="#16a34a"/>' },
  'watermelon': { kind: 'svg', body: '<path d="M3 8a9 9 0 0 0 18 0z" fill="#16a34a"/><path d="M5 8a7 7 0 0 0 14 0z" fill="#ef4444"/><circle cx="9" cy="11" r=".8" fill="#1c1917"/><circle cx="12" cy="12.2" r=".8" fill="#1c1917"/><circle cx="15" cy="11" r=".8" fill="#1c1917"/>' },
  'replay': { kind: 'svg', body: '<path d="M19 12a7 7 0 1 1-2-4.9" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round"/><path d="M17 3.5V8h-4.5z" fill="#34d399"/>' },
  'blank': { kind: 'svg', body: '<circle cx="12" cy="12" r="2" fill="#3f3f46"/>' }
}

export function symbolArt(iconId: string | undefined): SymbolArt | null {
  if (iconId === undefined) return null
  return SYMBOL_ART[iconId] ?? null
}
