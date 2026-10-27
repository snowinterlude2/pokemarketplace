const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdRound = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const money = (cents) => usd.format((cents || 0) / 100)
export const moneyShort = (cents) => (cents >= 100000 ? usdRound.format(cents / 100) : money(cents))

// Percent below (+) or above (-) market. null when there is no market reference.
export function dealPercent(listing) {
  if (!listing.market_price_cents) return null
  return Math.round((1 - listing.price_cents / listing.market_price_cents) * 100)
}

export function gradeLabel(l) {
  if (l.graded) return `${l.grading_company} ${Number(l.grade) % 1 ? Number(l.grade).toFixed(1) : Number(l.grade)}`
  return l.condition || 'Raw'
}

export function cardNumber(l) {
  if (!l.card_number) return '#???'
  return `#${l.card_number}`
}
