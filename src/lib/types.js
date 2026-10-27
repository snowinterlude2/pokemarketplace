import { Brain, Circle, Cog, Droplet, Flame, Gem, Hand, Leaf, Moon, Sparkles, Star, Wrench, Zap } from 'lucide-react'

// Energy types used by the Pokémon TCG, with Pokédex-style tile colours.
export const TYPES = {
  Grass: { bg: '#4fc779', chip: '#3fa863', icon: Leaf },
  Fire: { bg: '#e23d3b', chip: '#e98a2d', icon: Flame },
  Water: { bg: '#2190f6', chip: '#1a6fd0', icon: Droplet },
  Lightning: { bg: '#f1be1f', chip: '#d69a00', icon: Zap, dark: true },
  Psychic: { bg: '#a35fd5', chip: '#d052b6', icon: Brain },
  Fighting: { bg: '#c86a2f', chip: '#9c4b1c', icon: Hand },
  Darkness: { bg: '#38475a', chip: '#222c3a', icon: Moon, light: true },
  Metal: { bg: '#8b9aaa', chip: '#66778a', icon: Cog },
  Fairy: { bg: '#ea7cc2', chip: '#d454a5', icon: Sparkles },
  Dragon: { bg: '#bf9f2f', chip: '#8f7618', icon: Gem },
  Colorless: { bg: '#b3ad9e', chip: '#8d8778', icon: Star },
}

export const TRAINER = { bg: '#5d6b7d', chip: '#3f4a59', icon: Wrench, light: true }
export const ENERGY = { bg: '#7b8794', chip: '#56606b', icon: Circle }

export function themeFor(listing) {
  if (listing.supertype === 'Trainer') return TRAINER
  if (listing.supertype === 'Energy') return ENERGY
  return TYPES[listing.types?.[0]] || TYPES.Colorless
}

// Eras play the role of the Pokédex "regions" row.
export const ERAS = [
  { id: 'ALL', label: 'All' },
  { id: 'WOTC', label: 'WOTC', years: '1999–2003' },
  { id: 'EX', label: 'EX', years: '2003–2007' },
  { id: 'DP', label: 'DP', years: '2007–2010' },
  { id: 'HGSS', label: 'HGSS', years: '2010–2011' },
  { id: 'BW', label: 'BW', years: '2011–2013' },
  { id: 'XY', label: 'XY', years: '2014–2016' },
  { id: 'SM', label: 'SM', years: '2017–2019' },
  { id: 'SWSH', label: 'SWSH', years: '2020–2023' },
  { id: 'SV', label: 'SV', years: '2023–' },
]

export const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Holo Rare',
  'Reverse Holo',
  'Double Rare',
  'Ultra Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Hyper Rare',
  'Secret Rare',
  'Shiny Rare',
  'Promo',
]

export const VARIANTS = ['Holo', 'Reverse Holo', 'Non-Holo', 'Full Art', 'Alt Art', 'Gold', 'Rainbow', 'Shadowless']
export const EDITIONS = ['Unlimited', '1st Edition', 'Shadowless', 'Limited']
export const LANGUAGES = ['English', 'Japanese', 'Korean', 'Chinese', 'French', 'German', 'Spanish', 'Italian', 'Portuguese']
export const CONDITIONS = [
  { id: 'NM', label: 'Near Mint' },
  { id: 'LP', label: 'Lightly Played' },
  { id: 'MP', label: 'Moderately Played' },
  { id: 'HP', label: 'Heavily Played' },
  { id: 'DMG', label: 'Damaged' },
]
export const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'TAG', 'ACE']
