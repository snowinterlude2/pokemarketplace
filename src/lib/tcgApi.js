// Free Pokémon TCG API (no key needed for light use). Used to auto-fill card details.
const API = 'https://api.pokemontcg.io/v2/cards'

const ERA_BY_SERIES = {
  Base: 'WOTC',
  Gym: 'WOTC',
  Neo: 'WOTC',
  'E-Card': 'WOTC',
  EX: 'EX',
  'Diamond & Pearl': 'DP',
  Platinum: 'DP',
  'HeartGold & SoulSilver': 'HGSS',
  'Black & White': 'BW',
  XY: 'XY',
  'Sun & Moon': 'SM',
  'Sword & Shield': 'SWSH',
  'Scarlet & Violet': 'SV',
}

export async function searchCards(name, signal) {
  const clean = name.replace(/["\\*:]/g, '').trim()
  if (clean.length < 2) return []
  const q = encodeURIComponent(`name:"${clean}*"`)
  const res = await fetch(`${API}?q=${q}&pageSize=24&orderBy=-set.releaseDate&select=id,name,number,rarity,supertype,types,artist,set,images,tcgplayer`, { signal })
  if (!res.ok) throw new Error('Card lookup is busy, fill the details in by hand.')
  const { data } = await res.json()
  return data
}

// Maps an API card to our listing fields.
export function toListingFields(card) {
  const prices = card.tcgplayer?.prices || {}
  const market = Object.values(prices).map((p) => p.market).find(Boolean)
  const variantKey = Object.keys(prices)[0] || ''
  return {
    card_name: card.name,
    set_name: card.set?.name || '',
    set_code: card.set?.ptcgoCode || card.set?.id || '',
    card_number: card.set?.printedTotal ? `${card.number}/${card.set.printedTotal}` : card.number,
    era: ERA_BY_SERIES[card.set?.series] || 'SV',
    release_year: Number((card.set?.releaseDate || '').slice(0, 4)) || '',
    supertype: card.supertype === 'Pokémon' || card.supertype === 'Trainer' || card.supertype === 'Energy' ? card.supertype : 'Pokémon',
    types: card.types || [],
    rarity: card.rarity || '',
    variant: /reverse/i.test(variantKey) ? 'Reverse Holo' : /holo/i.test(variantKey) ? 'Holo' : '',
    edition: /1stEdition/i.test(variantKey) ? '1st Edition' : 'Unlimited',
    artist: card.artist || '',
    tcg_id: card.id,
    market_price: market ? market.toFixed(2) : '',
    official_image: card.images?.large || card.images?.small || '',
  }
}
