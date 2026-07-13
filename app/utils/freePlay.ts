import type { MachineDef } from '~/engine'

/**
 * FREE PLAY — the machine never debits the bankroll, so it needs no session: a
 * visitor can walk up to it off a cold floor and spin forever. Today that is the
 * cascade trainer (Temple of Gold), the one machine on the floor you cannot lose
 * money on.
 *
 * The predicate lives in one place so the floor (which machines can be entered
 * without a bankroll), the game-page guard (who gets bounced back to the floor),
 * and the copy can never drift apart on what "free" means.
 */
export function isFreePlay(def: MachineDef): boolean {
  return def.family === 'cascade'
}
