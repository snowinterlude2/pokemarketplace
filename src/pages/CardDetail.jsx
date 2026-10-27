import { ArrowLeft, BadgeCheck, Palette, Truck } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardImage } from '../components/CardImage'
import { Checkout } from '../components/Checkout'
import { PokeballRing } from '../components/Pokeball'
import { TypeChips } from '../components/TypeChip'
import { cardNumber, dealPercent, gradeLabel, money } from '../lib/format'
import { getListing } from '../lib/store'
import { CONDITIONS, themeFor } from '../lib/types'

function Spec({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-black/10 py-2 text-sm last:border-0 dark:border-white/10">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

const desktopQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      desktopQuery?.addEventListener('change', cb)
      return () => desktopQuery?.removeEventListener('change', cb)
    },
    () => Boolean(desktopQuery?.matches),
  )
}

export default function CardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState(undefined)
  const [photo, setPhoto] = useState(0)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    getListing(id)
      .then(setListing)
      .catch(() => setListing(null))
  }, [id])

  if (listing === undefined) {
    return <div className="font-comic grid min-h-[50vh] place-items-center text-2xl tracking-widest opacity-60">Loading…</div>
  }
  if (!listing || !['active', 'sold'].includes(listing.status)) {
    return (
      <div className="mt-20 text-center">
        <p className="font-comic text-3xl tracking-wider">This card got away!</p>
        <Link to="/" className="btn btn-ghost mt-4">
          Back to market
        </Link>
      </div>
    )
  }

  const theme = themeFor(listing)
  const deal = dealPercent(listing)
  const sold = listing.status === 'sold'
  const condition = CONDITIONS.find((c) => c.id === listing.condition)?.label

  return (
    <>
    <div className="pop-in mt-4 pb-36 md:pb-0">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="font-comic mb-3 inline-flex items-center gap-1 text-lg tracking-wider text-neutral-600 hover:text-dex-ink dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-8">
        {/* Showcase */}
        <div>
          <div
            className="relative overflow-hidden rounded-2xl px-6 py-7 shadow-[0_10px_24px_-8px_rgba(0,0,0,.45)] sm:py-10"
            style={{ background: theme.bg, '--tile': theme.bg }}
          >
            <PokeballRing className="absolute top-1/2 left-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 text-white opacity-25" />
            <CardImage
              listing={listing}
              src={listing.image_urls?.[photo]}
              className="relative mx-auto w-[52%] max-w-[300px] rounded-[10px] sm:w-[62%] shadow-[0_18px_30px_rgba(0,0,0,.45)]"
            />
            {sold && (
              <span className="font-display absolute top-5 right-5 -rotate-12 rounded-lg border-4 border-white px-3 py-0.5 text-2xl tracking-widest text-white">
                SOLD
              </span>
            )}
          </div>
          {listing.image_urls?.length > 1 && (
            <div className="mt-3 flex justify-center gap-2">
              {listing.image_urls.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Photo ${i + 1}`}
                  className={`w-14 overflow-hidden rounded-md border-2 ${photo === i ? 'border-dex-ink dark:border-poke-yellow' : 'border-transparent opacity-60'}`}
                >
                  <CardImage listing={listing} src={u} className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + buy */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="card-name rounded-md bg-black/10 px-2.5 py-1 text-sm dark:bg-white/10">{cardNumber(listing)}</span>
            {listing.rarity && (
              <span className="rounded-md bg-poke-yellow px-2 py-1 text-xs font-bold text-dex-ink">{listing.rarity}</span>
            )}
            <span className="rounded-md bg-dex-ink px-2 py-1 text-xs font-bold text-white dark:bg-white dark:text-dex-ink">
              {gradeLabel(listing)}
            </span>
          </div>
          <h1 className="card-name mt-3 text-3xl leading-tight uppercase sm:text-4xl">{listing.card_name}</h1>
          <p className="mt-1 text-neutral-500">
            {listing.set_name}
            {listing.release_year ? ` · ${listing.release_year}` : ''}
            {listing.edition && listing.edition !== 'Unlimited' ? ` · ${listing.edition}` : ''}
          </p>
          <div className="mt-3 flex justify-start">
            <TypeChips listing={listing} />
          </div>

          <div className="panel mt-5 p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-comic text-sm tracking-wider text-neutral-500">Price</p>
                <p className="font-display text-4xl tracking-wide">{money(listing.price_cents)}</p>
              </div>
              {listing.market_price_cents ? (
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Market {money(listing.market_price_cents)}</p>
                  {deal !== null && (
                    <p className={`font-comic text-xl tracking-wider ${deal > 0 ? 'text-emerald-600' : 'text-neutral-500'}`}>
                      {deal > 0 ? `${deal}% below market` : deal < 0 ? `${-deal}% above market` : 'At market'}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
              <Truck size={16} />
              {listing.shipping_cents ? `${money(listing.shipping_cents)} tracked & insured shipping` : 'Free tracked shipping'}
            </p>

            {isDesktop && (
              <div className="mt-4">
                {sold ? (
                  <p className="font-comic rounded-xl bg-black/5 py-3 text-center text-2xl tracking-widest dark:bg-white/5">Sold out</p>
                ) : (
                  <Checkout listing={listing} onSold={() => setListing({ ...listing, status: 'sold' })} />
                )}
              </div>
            )}
          </div>

          {listing.description && <p className="mt-5 leading-relaxed text-neutral-700 dark:text-neutral-300">{listing.description}</p>}

          <dl className="panel mt-5 px-4 py-2 sm:px-5">
            <Spec label="Set" value={[listing.set_name, listing.set_code && `(${listing.set_code})`].filter(Boolean).join(' ')} />
            <Spec label="Number" value={listing.card_number} />
            <Spec label="Rarity" value={listing.rarity} />
            <Spec label="Finish" value={listing.variant} />
            <Spec label="Edition" value={listing.edition} />
            <Spec label="Language" value={listing.language} />
            <Spec
              label="Condition"
              value={
                listing.graded ? (
                  <span className="inline-flex items-center gap-1">
                    <BadgeCheck size={15} className="text-poke-blue" /> {gradeLabel(listing)}
                  </span>
                ) : (
                  condition
                )
              }
            />
            <Spec label="Cert #" value={listing.cert_number} />
            <Spec
              label="Artist"
              value={
                listing.artist && (
                  <span className="inline-flex items-center gap-1">
                    <Palette size={14} /> {listing.artist}
                  </span>
                )
              }
            />
            <Spec label="Seller" value={listing.seller_name} />
          </dl>
        </div>
      </div>

    </div>

      {/* Phone: sticky buy bar above the tab bar (outside the animated wrapper so it stays fixed) */}
      {!isDesktop && (
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t-2 border-dex-ink/10 bg-dex-bg/95 px-3 pt-2.5 pb-8 backdrop-blur md:hidden dark:border-white/10 dark:bg-[#111317]/95">
        {sold ? (
          <p className="font-comic py-2 text-center text-xl tracking-widest">Sold out</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="shrink-0 leading-none">
              <p className="font-display text-2xl tracking-wide">{money(listing.price_cents)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {listing.shipping_cents ? `+ ${money(listing.shipping_cents)} ship` : 'Free shipping'}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <Checkout compact listing={listing} onSold={() => setListing({ ...listing, status: 'sold' })} />
            </div>
          </div>
        )}
      </div>
      )}
    </>
  )
}
