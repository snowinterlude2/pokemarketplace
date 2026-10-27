import { Check, EyeOff, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListingRow } from '../components/ListingRow'
import { money } from '../lib/format'
import { deleteListing, listAll, listOrders, resetDemo, setStatus } from '../lib/store'
import { isLive } from '../lib/supabase'

const TABS = ['pending', 'active', 'sold', 'hidden', 'orders']

// Only reachable for admins in the UI, and every query/update here is also
// checked by RLS (is_admin()) in the database.
export default function Admin() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([listAll(), listOrders()])
      .then(([l, o]) => {
        setRows(l)
        setOrders(o)
      })
      .catch(() => setError('Could not load admin data. Are you signed in as an admin?'))
  }, [])

  useEffect(load, [load])

  const counts = useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t, 0]))
    rows.forEach((r) => c[r.status]++)
    c.orders = orders.length
    return c
  }, [rows, orders])

  const revenue = orders.reduce((s, o) => s + (o.amount_cents || 0), 0)
  const inventory = rows.filter((r) => r.status === 'active').reduce((s, r) => s + r.price_cents, 0)

  async function act(fn) {
    setError('')
    try {
      await fn()
      load()
    } catch (err) {
      setError(err.message || 'Action blocked.')
    }
  }

  const btn = 'btn btn-ghost !px-2 !py-1 !text-sm'

  return (
    <div className="pop-in mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="poke-title text-3xl sm:text-4xl">ADMIN DEX</h1>
        {!isLive && (
          <button type="button" className="text-xs text-neutral-500 underline" onClick={() => { resetDemo(); load() }}>
            Reset demo data
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Live cards', counts.active],
          ['Awaiting review', counts.pending],
          ['Inventory value', money(inventory)],
          ['Sales', money(revenue)],
        ].map(([label, value]) => (
          <div key={label} className="panel p-3 sm:p-4">
            <p className="font-comic text-sm tracking-wider text-neutral-500">{label}</p>
            <p className="font-display mt-1 text-2xl tracking-wide">{value}</p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-3 mt-5 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className="dex-pill capitalize">
            {t} ({counts[t]})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}

      <div className="panel mt-4 px-4 sm:px-5">
        {tab === 'orders' ? (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {orders.length === 0 && <li className="py-10 text-center text-neutral-500">No orders yet.</li>}
            {orders.map((o) => {
              const l = rows.find((r) => r.id === o.listing_id)
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="card-name truncate uppercase">{l?.card_name || 'Deleted listing'}</p>
                    <p className="text-xs text-neutral-500">
                      {o.buyer_name || 'Buyer'} {o.buyer_email ? `· ${o.buyer_email}` : ''} · PayPal {o.paypal_order_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg">{money(o.amount_cents)}</p>
                    <p className="text-xs text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {rows.filter((r) => r.status === tab).length === 0 && (
              <li className="py-10 text-center text-neutral-500">Nothing here.</li>
            )}
            {rows
              .filter((r) => r.status === tab)
              .map((l) => (
                <ListingRow key={l.id} listing={l}>
                  {(l.status === 'pending' || l.status === 'hidden') && (
                    <button type="button" className={`${btn} text-emerald-700`} onClick={() => act(() => setStatus(l.id, 'active'))}>
                      {l.status === 'pending' ? <Check size={14} /> : <RotateCcw size={14} />}
                      {l.status === 'pending' ? 'Approve' : 'Relist'}
                    </button>
                  )}
                  {l.status === 'active' && (
                    <button type="button" className={btn} onClick={() => act(() => setStatus(l.id, 'hidden'))}>
                      <EyeOff size={14} /> Hide
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${btn} text-red-600`}
                    onClick={() => window.confirm(`Delete ${l.card_name}? This cannot be undone.`) && act(() => deleteListing(l.id))}
                  >
                    <Trash2 size={14} />
                    <span className="sr-only sm:not-sr-only">Delete</span>
                  </button>
                </ListingRow>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
