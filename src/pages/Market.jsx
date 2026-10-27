import { ArrowDownUp, SearchX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CardTile } from '../components/CardTile'
import { dealPercent } from '../lib/format'
import { listMarket } from '../lib/store'
import { ERAS, TYPES } from '../lib/types'

const SORTS = {
  new: { label: 'Newest', fn: (a, b) => b.created_at.localeCompare(a.created_at) },
  low: { label: 'Price: low → high', fn: (a, b) => a.price_cents - b.price_cents },
  high: { label: 'Price: high → low', fn: (a, b) => b.price_cents - a.price_cents },
  deal: { label: 'Best deal vs market', fn: (a, b) => (dealPercent(b) ?? -999) - (dealPercent(a) ?? -999) },
}

export default function Market() {
  const [params, setParams] = useSearchParams()
  const [listings, setListings] = useState(null)
  const [error, setError] = useState('')

  const era = params.get('era') || 'ALL'
  const type = params.get('type') || ''
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'new'
  const graded = params.get('graded') || ''
  const q = (params.get('q') || '').toLowerCase().trim()

  useEffect(() => {
    listMarket()
      .then(setListings)
      .catch(() => setError('Could not load cards. Please refresh.'))
  }, [])

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    if (!listings) return []
    return listings
      .filter((l) => era === 'ALL' || l.era === era)
      .filter((l) => !type || (type === 'Trainer' ? l.supertype === 'Trainer' : l.types?.includes(type)))
      .filter((l) => !graded || (graded === 'graded' ? l.graded : !l.graded))
      .filter(
        (l) =>
          !q ||
          [l.card_name, l.set_name, l.card_number, l.rarity, l.artist, l.grading_company]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
      )
      .sort((a, b) => (a.status === 'sold') - (b.status === 'sold') || SORTS[sort].fn(a, b))
  }, [listings, era, type, graded, q, sort])

  const activeCount = filtered.filter((l) => l.status === 'active').length

  return (
    <>
      {/* Era row, the Pokédex "region" pills */}
      <nav aria-label="Card era" className="-mx-3 mt-4 sm:mx-0">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-1 sm:flex-wrap sm:justify-center sm:px-0">
          {ERAS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={era === e.id}
              onClick={() => setParam('era', e.id === 'ALL' ? '' : e.id)}
              className="dex-pill"
              title={e.years}
            >
              {e.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Type + filter row */}
      <div className="mt-3 flex flex-col gap-3 sm:mt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {[...Object.entries(TYPES), ['Trainer', { bg: '#5d6b7d' }]].map(([name, t]) => {
            const on = type === name
            const Icon = t.icon
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => setParam('type', on ? '' : name)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? 'border-dex-ink text-white shadow-[0_2px_0_#141414]'
                    : 'border-transparent bg-black/5 text-neutral-700 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10'
                }`}
                style={on ? { background: t.bg } : undefined}
              >
                {Icon ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: t.bg }}>
                    <Icon size={10} strokeWidth={3} />
                  </span>
                ) : null}
                {name}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border-2 border-dex-ink/80 p-0.5 text-xs font-medium dark:border-neutral-600">
            {[
              ['', 'All'],
              ['graded', 'Graded'],
              ['raw', 'Raw'],
            ].map(([v, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={graded === v}
                onClick={() => setParam('graded', v)}
                className={`rounded-md px-2.5 py-1 ${graded === v ? 'bg-dex-ink text-white dark:bg-poke-yellow dark:text-dex-ink' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative ml-auto flex items-center lg:ml-0">
            <ArrowDownUp size={14} className="pointer-events-none absolute left-2.5 opacity-60" />
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value === 'new' ? '' : e.target.value)}
              className="appearance-none rounded-lg border-2 border-dex-ink/80 bg-white py-1.5 pr-3 pl-7 text-xs font-medium dark:border-neutral-600 dark:bg-neutral-900"
            >
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="font-comic mt-4 text-[15px] tracking-wider text-neutral-500">
        {listings ? `${activeCount} card${activeCount === 1 ? '' : 's'} for sale` : ' '}
        {q && listings ? ` · matching “${params.get('q')}”` : ''}
      </p>

      {error && <p className="mt-6 text-center text-red-600">{error}</p>}

      <section
        aria-label="Cards for sale"
        className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5"
      >
        {listings === null &&
          Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[3/4.4] animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
          ))}
        {filtered.map((l, i) => (
          <CardTile key={l.id} listing={l} index={i} />
        ))}
      </section>

      {listings && filtered.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-neutral-500">
          <SearchX size={44} />
          <p className="font-comic text-2xl tracking-wider">No cards found</p>
          <button type="button" className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        </div>
      )}
    </>
  )
}
