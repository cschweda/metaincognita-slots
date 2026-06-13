import { describe, expect, it } from 'vitest'
import { denominationLabel } from '../../app/utils/denomination'

describe('denominationLabel', () => {
  it.each([
    [1, /Penny machine · 1 credit = 1¢/],
    [5, /Nickel machine · 1 credit = 5¢/],
    [25, /Quarter machine · 1 credit = 25¢/],
    [100, /Dollar machine · 1 credit = \$1/]
  ])('%i -> %s', (cents, re) => expect(denominationLabel(cents)).toMatch(re))
})
