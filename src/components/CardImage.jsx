import { useState } from 'react'
import { Pokeball } from './Pokeball'

// Card photo with a graceful placeholder if the image cannot load.
export function CardImage({ listing, src, className = '', alt }) {
  const [failed, setFailed] = useState(false)
  const url = src || listing?.image_urls?.[0]

  if (!url || failed) {
    return (
      <div
        className={`${className} grid aspect-[63/88] place-items-center bg-gradient-to-br from-yellow-200 via-amber-100 to-sky-200 ring-4 ring-yellow-300`}
        role="img"
        aria-label={alt || listing?.card_name || 'Card image'}
      >
        <div className="flex flex-col items-center gap-1 px-1 text-center">
          <Pokeball className="h-1/3 w-1/3 min-h-6 min-w-6" />
          <span className="card-name text-[9px] leading-tight text-dex-ink uppercase">{listing?.card_name}</span>
        </div>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt || `${listing?.card_name} ${listing?.card_number || ''}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} aspect-[63/88] object-cover`}
    />
  )
}
