import { EyeOff, LogOut, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListingRow } from '../components/ListingRow'
import { useAuth } from '../lib/auth'
import { deleteListing, listMine, setStatus } from '../lib/store'

export default function Account() {
  const { user, isAdmin, signOut } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listMine(user.id)
      .then(setRows)
      .catch(() => setError('Could not load your listings.'))
  }, [user.id])

  useEffect(load, [load])

  async function act(fn) {
    setError('')
    try {
      await fn()
      load()
    } catch (err) {
      setError(err.message || 'That action was blocked.')
    }
  }

  return (
    <div className="pop-in mx-auto mt-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="poke-title text-3xl sm:text-4xl">MY CARDS</h1>
          <p className="mt-1 text-sm text-neutral-500">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/admin" className="btn btn-ghost !text-base">
              <ShieldCheck size={18} /> Admin
            </Link>
          )}
          <button type="button" onClick={signOut} className="btn btn-ghost !text-base">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}

      <div className="panel mt-5 px-4 sm:px-5">
        {rows?.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-comic text-2xl tracking-wider">No cards listed yet</p>
            <Link to="/sell" className="btn btn-primary mt-4">
              <Plus size={18} /> List your first card
            </Link>
          </div>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {rows?.map((l) => (
            <ListingRow key={l.id} listing={l}>
              {(l.status === 'active' || l.status === 'pending') && (
                <button type="button" className="btn btn-ghost !px-2 !py-1 !text-sm" onClick={() => act(() => setStatus(l.id, 'hidden'))}>
                  <EyeOff size={14} /> Hide
                </button>
              )}
              {l.status === 'hidden' && (
                <button type="button" className="btn btn-ghost !px-2 !py-1 !text-sm" onClick={() => act(() => setStatus(l.id, isAdmin ? 'active' : 'pending'))}>
                  <RotateCcw size={14} /> Relist
                </button>
              )}
              {l.status !== 'sold' && (
                <button
                  type="button"
                  className="btn btn-ghost !px-2 !py-1 !text-sm text-red-600"
                  onClick={() => window.confirm(`Delete ${l.card_name}?`) && act(() => deleteListing(l.id))}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </ListingRow>
          ))}
        </ul>
      </div>
      {!isAdmin && rows?.some((l) => l.status === 'pending') && (
        <p className="mt-3 text-center text-xs text-neutral-500">Pending cards go live once an admin approves them.</p>
      )}
    </div>
  )
}
