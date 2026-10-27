import { Link } from 'react-router-dom'
import { cardNumber, dealPercent, gradeLabel, moneyShort } from '../lib/format'
import { themeFor } from '../lib/types'
import { CardImage } from './CardImage'
import { PokeballRing } from './Pokeball'
import { TypeChips } from './TypeChip'

export function CardTile({ listing, index = 0 }) {
  const theme = themeFor(listing)
  const deal = dealPercent(listing)
  const sold = listing.status === 'sold'
  const ink = theme.light ? 'text-white' : 'text-dex-ink'

  return (
    <Link
      to={`/card/${listing.id}`}
      className="group pop-in relative flex flex-col overflow-hidden rounded-xl shadow-[0_6px_14px_-4px_rgba(0,0,0,.35)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_24px_-8px_rgba(0,0,0,.45)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-poke-blue"
      style={{ background: theme.bg, '--tile': theme.bg, animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {deal > 0 && !sold && (
        <span className="font-comic absolute top-2 left-2 z-10 rounded-md bg-white/90 px-1.5 py-0.5 text-[13px] tracking-wider text-emerald-700 shadow sm:text-sm">
          -{deal}% MKT
        </span>
      )}
      <span className="font-comic absolute top-2 right-2 z-10 rounded-md bg-dex-ink/80 px-1.5 py-0.5 text-[13px] tracking-wider text-white sm:text-sm">
        {gradeLabel(listing)}
      </span>

      <div className="relative mx-auto mt-5 grid aspect-square w-[78%] place-items-center sm:mt-6">
        <PokeballRing className="absolute inset-0 h-full w-full text-white opacity-35" />
        <CardImage
          listing={listing}
          className="relative w-[58%] -rotate-6 rounded-[6px] shadow-[0_8px_16px_rgba(0,0,0,.35)] transition duration-300 group-hover:scale-110 group-hover:rotate-0"
        />
      </div>

      <div className="flex flex-1 flex-col items-center px-2 pt-3 pb-3 text-center sm:px-3 sm:pb-4">
        <span className={`card-name rounded-md bg-black/15 px-2.5 py-1 text-[12px] sm:text-sm ${ink} opacity-80`}>
          {cardNumber(listing)}
        </span>
        <h3 className={`card-name mt-2 line-clamp-2 text-[15px] leading-tight uppercase sm:text-lg ${ink}`}>
          {listing.card_name}
        </h3>
        <p className={`mt-0.5 line-clamp-1 text-[11px] font-medium sm:text-xs ${ink} opacity-70`}>
          {listing.set_name}
          {listing.edition && listing.edition !== 'Unlimited' ? ` · ${listing.edition}` : ''}
        </p>
        <div className="mt-2.5">
          <TypeChips listing={listing} size="sm" />
        </div>
        <div className="mt-auto pt-3">
          <span className="font-display rounded-lg bg-white px-3 py-1 text-base tracking-wider text-dex-ink shadow-[0_2px_0_rgba(0,0,0,.25)] sm:text-lg">
            {moneyShort(listing.price_cents)}
          </span>
        </div>
      </div>

      {sold && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/35">
          <span className="font-display -rotate-12 rounded-lg border-4 border-white px-4 py-1 text-3xl tracking-widest text-white">
            SOLD
          </span>
        </div>
      )}
    </Link>
  )
}
