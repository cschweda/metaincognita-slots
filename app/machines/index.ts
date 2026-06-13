import type { MachineDef } from '../engine/types'
import { DIAMOND_DOUBLER } from './diamond-doubler'
import { SEVENS_ABLAZE } from './sevens-ablaze'
import { SERIES_E_3LINE } from './series-e-3line'
import { SERIES_E_MULTIPLIER } from './series-e-multiplier'

export const FLOOR: MachineDef[] = [
  DIAMOND_DOUBLER,
  SEVENS_ABLAZE,
  SERIES_E_3LINE,
  SERIES_E_MULTIPLIER
]
