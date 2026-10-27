export function Pokeball({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#fff" stroke="#141414" strokeWidth="4.5" />
      <path d="M3 32a29 29 0 0 1 58 0z" fill="#e3350d" stroke="#141414" strokeWidth="4.5" />
      <path d="M3 32h58" stroke="#141414" strokeWidth="4.5" />
      <circle cx="32" cy="32" r="9.5" fill="#fff" stroke="#141414" strokeWidth="4.5" />
      <circle cx="32" cy="32" r="4" fill="#fff" stroke="#141414" strokeWidth="1.5" />
      <path d="M14 20a20 20 0 0 1 10-8" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

// The big faded pokéball ring behind each card, like the Pokédex tiles.
export function PokeballRing({ className = '' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="41" strokeWidth="15" />
        <path d="M50 3 L50 97" strokeWidth="11" transform="rotate(32 50 50)" />
      </g>
      <circle cx="50" cy="50" r="17" fill="currentColor" />
      <circle cx="50" cy="50" r="9" className="fill-[var(--tile)]" />
    </svg>
  )
}
