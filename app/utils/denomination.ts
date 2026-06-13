// app/utils/denomination.ts
// Words only — the 🪙 is rendered separately (aria-hidden) so screen readers
// announce just the text, not the emoji.
export function denominationLabel(cents: number): string {
  if (cents === 1) return 'Penny machine · 1 credit = 1¢'
  if (cents === 5) return 'Nickel machine · 1 credit = 5¢'
  if (cents === 25) return 'Quarter machine · 1 credit = 25¢'
  if (cents === 100) return 'Dollar machine · 1 credit = $1'
  if (cents % 100 === 0) return `$${cents / 100} machine · 1 credit = $${cents / 100}`
  return `${cents}¢ machine · 1 credit = ${cents}¢`
}
