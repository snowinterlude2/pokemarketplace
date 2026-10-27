import { Link } from 'react-router-dom'
import { gradeLabel, money } from '../lib/format'
import { CardImage } from './CardImage'

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  sold: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100',
  hidden: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
}

export function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLES[status]}`}>{status}</span>
}

export function ListingRow({ listing, children }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <CardImage listing={listing} className="w-12 shrink-0 rounded-[4px] sm:w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {listing.status === 'active' || listing.status === 'sold' ? (
            <Link to={`/card/${listing.id}`} className="card-name truncate text-sm uppercase hover:underline sm:text-base">
              {listing.card_name}
            </Link>
          ) : (
            <span className="card-name truncate text-sm uppercase sm:text-base">{listing.card_name}</span>
          )}
          <StatusBadge status={listing.status} />
        </div>
        <p className="truncate text-xs text-neutral-500">
          {listing.set_name} · {listing.card_number} · {gradeLabel(listing)}
          {listing.seller_name ? ` · ${listing.seller_name}` : ''}
        </p>
        <p className="font-display mt-0.5 text-base tracking-wide">{money(listing.price_cents)}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">{children}</div>
    </li>
  )
}
