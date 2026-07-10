// app/components/game/symbols/registry.ts
//
// Icon house style: 24x24 viewBox, FILLED DUOTONE — one solid fill + one darker
// shade for depth, rounded forms, no thin outlines. Colours use literal hex close
// to Tailwind tokens. Pictorial ids return inline SVG *children* (no <svg> wrapper);
// SymbolIcon supplies the wrapper. Typographic ids (royals, sevens, bars) render
// as styled text instead of art.

type SymbolArt
  = | { kind: 'svg', body: string }
    | { kind: 'text', text: string, variant: 'royal' | 'seven' | 'bar', color?: string }

const SYMBOL_ART: Record<string, SymbolArt> = {
  // ---- typographic ----
  'ace': { kind: 'text', text: 'A', variant: 'royal' },
  'king': { kind: 'text', text: 'K', variant: 'royal' },
  'queen': { kind: 'text', text: 'Q', variant: 'royal' },
  'jack': { kind: 'text', text: 'J', variant: 'royal' },
  'ten': { kind: 'text', text: '10', variant: 'royal' },
  // ---- blackjack card pip values ----
  'pip-2': { kind: 'text', text: '2', variant: 'royal' },
  'pip-3': { kind: 'text', text: '3', variant: 'royal' },
  'pip-4': { kind: 'text', text: '4', variant: 'royal' },
  'pip-5': { kind: 'text', text: '5', variant: 'royal' },
  'pip-6': { kind: 'text', text: '6', variant: 'royal' },
  'pip-7': { kind: 'text', text: '7', variant: 'royal' },
  'pip-8': { kind: 'text', text: '8', variant: 'royal' },
  'pip-9': { kind: 'text', text: '9', variant: 'royal' },
  // ---- blackjack-reel multiplier / minus / bust specials ----
  'mult-x2': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#7c3aed"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="10" fill="#e9d5ff">×2</text>' },
  'mult-x3': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#4f46e5"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="10" fill="#e0e7ff">×3</text>' },
  'mult-x5': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#c026d3"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="10" fill="#fae8ff">×5</text>' },
  'mult-x10': { kind: 'svg', body: '<rect x="2.5" y="3" width="19" height="18" rx="3" fill="#db2777"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#fce7f3">×10</text>' },
  'minus-2': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#0f766e"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="10" fill="#ccfbf1">−2</text>' },
  'minus-3': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#155e75"/><text x="12" y="16.5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="10" fill="#cffafe">−3</text>' },
  'bust': { kind: 'svg', body: '<circle cx="12" cy="12" r="9" fill="#b91c1c"/><circle cx="12" cy="12" r="9" fill="none" stroke="#7f1d1d" stroke-width="1.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fee2e2" stroke-width="2.4" stroke-linecap="round"/>' },
  // ---- Flameout 21 (crash) climb / crash ----
  'climb': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#0f8f48"/><path d="M12 6l6 9H6z" fill="#7bffb0"/><path d="M12 6l6 9h-3l-3-5z" fill="#34d399"/>' },
  'crash': { kind: 'svg', body: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#cf1c39"/><path d="M12 4l1.8 6.4 5-3.2-2.6 5.6 5.6.8-5.6 1.6 2.6 5.6-5-3.2L12 20l-1.8-6.4-5 3.2 2.6-5.6L2.2 13l5.6-1.6L5.2 5.8l5 3.2z" fill="#fff"/><circle cx="12" cy="12" r="2.6" fill="#7a0f20"/>' },
  'seven': { kind: 'text', text: '7', variant: 'seven', color: '#f59e0b' },
  'seven-red': { kind: 'text', text: '7', variant: 'seven', color: '#ef4444' },
  'seven-flame': { kind: 'text', text: '7', variant: 'seven', color: '#fb923c' },
  // ---- Wonder Wheel (wheel family) ----
  'seven-neon': { kind: 'text', text: '7', variant: 'seven', color: '#22d3ee' },
  'star-shoot': { kind: 'svg', body: '<path d="M14 3l1.6 4.6 4.9.2-3.9 3 1.4 4.7-4-2.8-4 2.8 1.4-4.7-3.9-3 4.9-.2z" fill="#facc15"/><path d="M14 3l1.6 4.6 3-.1z" fill="#fde047"/><path d="M4 20c2.5-1 4.5-2.5 6.5-5M2.5 16.5c2-.8 3.5-1.8 5-3.5" stroke="#a5f3fc" stroke-width="1.8" fill="none" stroke-linecap="round"/>' },
  'wheel': { kind: 'svg', body: '<circle cx="12" cy="12" r="9.5" fill="#fbbf24"/><circle cx="12" cy="12" r="8" fill="#7c3aed"/><g fill="#ec4899"><path d="M12 4a8 8 0 0 1 5.66 2.34L12 12z"/><path d="M20 12a8 8 0 0 1-2.34 5.66L12 12z"/><path d="M12 20a8 8 0 0 1-5.66-2.34L12 12z"/><path d="M4 12a8 8 0 0 1 2.34-5.66L12 12z"/></g><g fill="#06b6d4"><path d="M17.66 6.34A8 8 0 0 1 20 12h-8z"/><path d="M17.66 17.66A8 8 0 0 1 12 20v-8z"/><path d="M6.34 17.66A8 8 0 0 1 4 12h8z"/><path d="M6.34 6.34A8 8 0 0 1 12 4v8z"/></g><circle cx="12" cy="12" r="2.6" fill="#fbbf24"/><path d="M12 .8l1.4 2.4h-2.8z" fill="#f43f5e"/>' },
  // ---- Stop & Lock 777 (lock-reel) cash-collect symbols ----
  // The bespoke cabinet renders its grid with its own CSS cells; these entries
  // back the def's icon metadata so the floor-wide icon-coverage invariant holds.
  'cash': { kind: 'svg', body: '<circle cx="12" cy="12" r="9" fill="#0f8f48"/><circle cx="12" cy="12" r="9" fill="none" stroke="#0a5e30" stroke-width="1.5"/><path d="M12 6.5v11M9.6 9.2c0-1.2 1.1-1.9 2.4-1.9s2.4.7 2.4 1.7c0 2.4-4.8 1.4-4.8 3.9 0 1.1 1.1 1.8 2.4 1.8s2.4-.7 2.4-1.9" fill="none" stroke="#d1fadf" stroke-width="1.7" stroke-linecap="round"/>' },
  'prize': { kind: 'svg', body: '<path d="M5 8h14l-1.2 11H6.2z" fill="#fbbf24"/><path d="M6.2 19l-.7-6.5h13l-.7 6.5z" fill="#b45309"/><path d="M9 8c-2-1.5-2-4.5 0-4.5 1.4 0 2.4 1.7 3 4.5M15 8c2-1.5 2-4.5 0-4.5-1.4 0-2.4 1.7-3 4.5" fill="none" stroke="#fde68a" stroke-width="1.6"/>' },
  'grand': { kind: 'svg', body: '<path d="M3 8l4 3.5L12 4l5 7.5L21 8l-2 11H5z" fill="#fbbf24"/><path d="M5 19l-.6-3.6h15.2L19 19z" fill="#b45309"/><circle cx="3" cy="8" r="1.5" fill="#fde68a"/><circle cx="21" cy="8" r="1.5" fill="#fde68a"/><circle cx="12" cy="4" r="1.6" fill="#fff7ed"/>' },
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
  'blank': { kind: 'svg', body: '<circle cx="12" cy="12" r="2" fill="#3f3f46"/>' },
  // ---- Canal Royale ----
  'lion': { kind: 'svg', body: '<circle cx="12" cy="13" r="6.5" fill="#f59e0b"/><g fill="#b45309"><path d="M12 2l2.2 3.4-2.2 1.2-2.2-1.2z"/><path d="M3.5 9l3.8 1.1-1 2.3-3.2-1.4z"/><path d="M20.5 9l-3.8 1.1 1 2.3 3.2-1.4z"/><path d="M4 18l3.4-1.6 1 2.2-3.3 1.4z"/><path d="M20 18l-3.4-1.6-1 2.2 3.3 1.4z"/></g><circle cx="9.7" cy="12" r="1" fill="#1c1207"/><circle cx="14.3" cy="12" r="1" fill="#1c1207"/><path d="M9.5 15.5c1.4 1.2 3.6 1.2 5 0" stroke="#1c1207" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
  'mask': { kind: 'svg', body: '<path d="M12 4c9 0 14 4 14 11 0 1-7 5-14 5S-2 16-2 15C-2 8 3 4 12 4z" fill="#7c3aed"/><path d="M12 5c7 0 11 3 11 8.5 0 .9-5 3.5-11 3.5S1 14.4 1 13.5C1 8 5 5 12 5z" fill="#a78bfa"/><ellipse cx="8.5" cy="11" rx="2.4" ry="1.8" fill="#140f2e"/><ellipse cx="15.5" cy="11" rx="2.4" ry="1.8" fill="#140f2e"/><path d="M12 3c1-1.6 3-2 4.6-.8C15.7 3.8 14 4.6 12 4z" fill="#fbbf24"/>' },
  'fan': { kind: 'svg', body: '<path d="M12 20L3.5 8.5a10.5 10.5 0 0 1 17 0z" fill="#f59e0b"/><path d="M12 20L3.5 8.5a10.5 10.5 0 0 1 17 0z" fill="none" stroke="#b45309" stroke-width="1"/><path d="M12 20L8 9M12 20l4-11M12 20V8" stroke="#b45309" stroke-width="1"/><circle cx="12" cy="20" r="1.6" fill="#fcd34d"/>' },
  'doge': { kind: 'svg', body: '<path d="M5 9c0-3 3-5 7-5s7 2 7 5l-1 9H6z" fill="#fbbf24"/><path d="M7 18l1-7h8l1 7z" fill="#b45309"/><circle cx="12" cy="8.5" r="1.6" fill="#fff7ed"/>' },
  'gondola': { kind: 'svg', body: '<path d="M2 15c4 2 16 2 20 0l-2 3c-3 1.5-13 1.5-16 0z" fill="#0ea5e9"/><path d="M3 15C5 9 19 9 21 15z" fill="#38bdf8"/><path d="M21 15c1-4 1.5-7 1.5-9" stroke="#fcd34d" stroke-width="1.5" fill="none" stroke-linecap="round"/>' },
  // ---- Dragon's Hoard ----
  'dragon': { kind: 'svg', body: '<path d="M4 16c2-7 8-10 16-10-2 2-3 3-3 5 2 0 3 1 3 3-3 .5-5 2-6 4-3-1-7-1-10-2z" fill="#16a34a"/><path d="M4 16c2-7 8-10 16-10-3 3-9 4-12 7z" fill="#22c55e"/><circle cx="16" cy="8.5" r="1" fill="#1c1207"/>' },
  'phoenix': { kind: 'svg', body: '<path d="M12 21c-5-3-8-7-8-11 2 2 4 3 6 3-2-2-3-5-2-8 1 3 3 5 4 6 1-1 3-3 4-6 1 3 0 6-2 8 2 0 4-1 6-3 0 4-3 8-8 11z" fill="#fb923c"/><path d="M12 21c-3-2-5-5-6-8 2 1 4 1 6 1z" fill="#f59e0b"/>' },
  'koi': { kind: 'svg', body: '<path d="M3 12c4-5 11-5 15 0-4 5-11 5-15 0z" fill="#f97316"/><path d="M18 12c2-1.5 3-1.5 3.5-3-.2 1.8-.2 4.2 0 6-.5-1.5-1.5-1.5-3.5-3z" fill="#fb923c"/><circle cx="8" cy="11" r="1" fill="#1c1207"/><circle cx="12" cy="9.5" r="1.2" fill="#fde68a"/>' },
  'pearl': { kind: 'svg', body: '<circle cx="12" cy="12" r="7" fill="#e2e8f0"/><circle cx="9.6" cy="9.6" r="2.4" fill="#f8fafc"/><circle cx="12" cy="12" r="7" fill="none" stroke="#94a3b8" stroke-width="1"/>' },
  'ingot': { kind: 'svg', body: '<path d="M5 9h14l2 8H3z" fill="#fbbf24"/><path d="M7 9l-1.5 8M17 9l1.5 8M5 9h14l-1.5-1.6h-11z" fill="none" stroke="#b45309" stroke-width="1"/><path d="M5 9h14l-1.4-1.6H6.4z" fill="#fde68a"/>' },
  // ---- Thunder Vault ----
  'vault': { kind: 'svg', body: '<rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="#475569"/><circle cx="12" cy="12" r="4.5" fill="#94a3b8"/><circle cx="12" cy="12" r="1.6" fill="#1e293b"/><g stroke="#1e293b" stroke-width="1.2"><path d="M12 6v2M12 16v2M6 12h2M16 12h2"/></g>' },
  'lightning': { kind: 'svg', body: '<path d="M13 2L4 13h6l-2 9 10-13h-6z" fill="#facc15"/><path d="M13 2L4 13h6z" fill="#fde047"/>' },
  'goldbar': { kind: 'svg', body: '<path d="M4 10h16l1.5 7H2.5z" fill="#fbbf24"/><path d="M4 10h16l-1.3-1.6H5.3z" fill="#fde68a"/><path d="M4 10l-1.5 7M20 10l1.5 7" stroke="#b45309" stroke-width="1" fill="none"/>' },
  'orb': { kind: 'svg', body: '<circle cx="12" cy="12" r="7.5" fill="#7c3aed"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#c4b5fd" stroke-width="1"/><circle cx="9.5" cy="9.5" r="2.2" fill="#ddd6fe"/><path d="M5 13c3 2 11 2 14 0" stroke="#a78bfa" stroke-width="1" fill="none"/>' },
  // ---- Ruby of Gargoyle ----
  'gargoyle': { kind: 'svg', body: '<path d="M4 13c-1-5 3-9 8-9s9 4 8 9c-1 4-4 7-8 7s-7-3-8-7z" fill="#64748b"/><path d="M5 5l3 3-3 1zM19 5l-3 3 3 1z" fill="#475569"/><circle cx="9" cy="12" r="1.4" fill="#1e293b"/><circle cx="15" cy="12" r="1.4" fill="#1e293b"/><path d="M8 16c2 2 6 2 8 0l-2-1.4-2 1-2-1z" fill="#334155"/>' },
  'ruby': { kind: 'svg', body: '<path d="M6 4h12l4 6-10 10L2 10z" fill="#f43f5e"/><path d="M6 4l-4 6h20l-4-6M12 20 8 10h8z" fill="#be123c"/><path d="M9 6l-1.5 4h3z" fill="#fecdd3"/>' },
  'chalice': { kind: 'svg', body: '<path d="M6.5 4h11c0 5.5-2.2 8.5-5.5 8.5S6.5 9.5 6.5 4z" fill="#fcd34d"/><path d="M8 4h8c0 4-1.6 6.5-4 6.5S8 8 8 4z" fill="#b45309"/><path d="M11 12.5h2V18h-2z" fill="#b45309"/><path d="M7 18h10v2.2H7z" fill="#fbbf24"/>' },
  'crown': { kind: 'svg', body: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="#fbbf24"/><path d="M5 19h14l.5-3H4.5z" fill="#b45309"/><circle cx="3" cy="8" r="1.4" fill="#fde68a"/><circle cx="21" cy="8" r="1.4" fill="#fde68a"/><circle cx="12" cy="4.5" r="1.4" fill="#fde68a"/>' },
  'gargoyle-eye': { kind: 'svg', body: '<circle cx="12" cy="12" r="8.5" fill="#7f1d1d"/><ellipse cx="12" cy="12" rx="7.5" ry="4.6" fill="#ef4444"/><circle cx="12" cy="12" r="2.6" fill="#1c0a0a"/><circle cx="10.3" cy="10.3" r="1" fill="#fecaca"/>' }
}

export function symbolArt(iconId: string | undefined): SymbolArt | null {
  if (iconId === undefined) return null
  return Object.prototype.hasOwnProperty.call(SYMBOL_ART, iconId) ? SYMBOL_ART[iconId]! : null
}
