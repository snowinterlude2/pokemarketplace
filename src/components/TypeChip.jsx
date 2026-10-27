import { TYPES, themeFor } from '../lib/types'

export function TypeChips({ listing, size = 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 15 : 18
  const themes = listing.supertype === 'Pokémon' && listing.types?.length
    ? listing.types.slice(0, 2).map((t) => [t, TYPES[t] || TYPES.Colorless])
    : [[listing.supertype, themeFor(listing)]]

  return (
    <div className="flex items-center justify-center gap-2.5">
      {themes.map(([name, t]) => {
        const Icon = t.icon
        return (
          <span
            key={name}
            title={name}
            className={`${dim} grid place-items-center rounded-full text-white`}
            style={{ background: t.chip, boxShadow: `0 0 14px 2px ${t.chip}aa` }}
          >
            <Icon size={icon} strokeWidth={2.5} />
            <span className="sr-only">{name}</span>
          </span>
        )
      })}
    </div>
  )
}
