import { Camera, CheckCircle2, ImagePlus, Loader2, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CardImage } from '../components/CardImage'
import { useAuth } from '../lib/auth'
import { money } from '../lib/format'
import { createListing, validateImage } from '../lib/store'
import { searchCards, toListingFields } from '../lib/tcgApi'
import { CONDITIONS, EDITIONS, ERAS, GRADERS, LANGUAGES, RARITIES, TYPES, VARIANTS } from '../lib/types'

const EMPTY = {
  card_name: '',
  set_name: '',
  set_code: '',
  card_number: '',
  era: 'SV',
  release_year: '',
  supertype: 'Pokémon',
  types: [],
  rarity: '',
  variant: '',
  edition: 'Unlimited',
  language: 'English',
  artist: '',
  tcg_id: '',
  graded: false,
  condition: 'NM',
  grading_company: 'PSA',
  grade: '10',
  cert_number: '',
  price: '',
  shipping: '',
  market_price: '',
  description: '',
}

const toCents = (v) => Math.round(Number(v || 0) * 100)
const clean = (v, max) => String(v ?? '').trim().slice(0, max) || null

function Section({ n, title, children }) {
  return (
    <section className="panel p-4 sm:p-6">
      <h2 className="font-comic flex items-center gap-2.5 text-2xl tracking-wider">
        <span className="font-display grid h-8 w-8 place-items-center rounded-full bg-poke-red text-base text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, children, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}

function CardLookup({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setBusy(true)
      setError('')
      try {
        setResults(await searchCards(q, ctrl.signal))
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Lookup failed, fill the details in by hand.')
      } finally {
        setBusy(false)
      }
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  return (
    <div>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={40}
          placeholder="Type a card name, e.g. Charizard"
          className="field !pl-10"
          aria-label="Look up a card"
        />
        {busy && <Loader2 size={18} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-neutral-400" />}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Pick a match to auto-fill set, number, rarity, artist, the official image and the TCGplayer market price.
      </p>
      {error && <p className="mt-2 text-sm text-amber-700">{error}</p>}
      {results.length > 0 && (
        <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-2">
          {results.map((c) => (
            <li key={c.id} className="w-24 shrink-0 sm:w-28">
              <button
                type="button"
                onClick={() => {
                  onPick(toListingFields(c))
                  setResults([])
                  setQ('')
                }}
                className="group w-full text-left"
              >
                <CardImage
                  src={c.images?.small}
                  listing={{ card_name: c.name }}
                  className="w-full rounded-md shadow transition group-hover:-translate-y-1 group-hover:shadow-lg"
                />
                <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
                <p className="truncate text-[11px] text-neutral-500">
                  {c.set?.name} · {c.number}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Sell() {
  const { user, isAdmin } = useAuth()
  const [f, setF] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [official, setOfficial] = useState('')
  const [useOfficial, setUseOfficial] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const fileInput = useRef(null)

  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  function addFiles(list) {
    setError('')
    const next = [...files]
    for (const file of list) {
      const err = validateImage(file)
      if (err) {
        setError(err)
        continue
      }
      if (next.length < 4) next.push(file)
    }
    setFiles(next)
  }

  function onPick(fields) {
    const { market_price, official_image, ...rest } = fields
    setF((prev) => ({ ...prev, ...rest, market_price: market_price || prev.market_price }))
    setOfficial(official_image)
    setUseOfficial(true)
  }

  function toggleType(t) {
    setF((prev) => ({
      ...prev,
      types: prev.types.includes(t) ? prev.types.filter((x) => x !== t) : [...prev.types, t].slice(-2),
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const price = toCents(f.price)
    if (price < 100) return setError('Price must be at least $1.00.')
    if (price > 10000000) return setError('Price is too high.')
    if (files.length === 0 && !(useOfficial && official)) return setError('Add at least one photo of the card.')

    // Only whitelisted, length-limited fields are sent. Status and seller are set server-side.
    const fields = {
      card_name: clean(f.card_name, 80),
      set_name: clean(f.set_name, 80),
      set_code: clean(f.set_code, 20),
      card_number: clean(f.card_number, 20),
      era: ERAS.some((x) => x.id === f.era) ? f.era : 'SV',
      release_year: Number(f.release_year) || null,
      supertype: f.supertype,
      types: f.supertype === 'Pokémon' ? f.types.filter((t) => TYPES[t]) : [],
      rarity: clean(f.rarity, 40),
      variant: clean(f.variant, 40),
      edition: clean(f.edition, 40),
      language: clean(f.language, 20) || 'English',
      artist: clean(f.artist, 60),
      tcg_id: clean(f.tcg_id, 40),
      graded: Boolean(f.graded),
      condition: f.graded ? null : f.condition,
      grading_company: f.graded ? f.grading_company : null,
      grade: f.graded ? Number(f.grade) : null,
      cert_number: f.graded ? clean(f.cert_number, 30) : null,
      price_cents: price,
      shipping_cents: Math.min(toCents(f.shipping), 10000),
      market_price_cents: f.market_price ? toCents(f.market_price) : null,
      currency: 'USD',
      description: clean(f.description, 1000),
    }
    if (!fields.card_name || !fields.set_name) return setError('Card name and set are required.')

    setBusy(true)
    try {
      const row = await createListing(user, fields, files, useOfficial ? official : '')
      setDone(row)
      setF(EMPTY)
      setFiles([])
      setOfficial('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const priceCents = toCents(f.price)
  const marketCents = toCents(f.market_price)
  const delta = priceCents && marketCents ? Math.round((1 - priceCents / marketCents) * 100) : null

  return (
    <div className="pop-in mx-auto mt-6 max-w-3xl">
      <h1 className="poke-title text-3xl sm:text-5xl">SELL A CARD</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        List a single card or graded slab. {isAdmin ? 'As an admin, your cards go live right away.' : 'New listings are reviewed before they go live.'}
      </p>

      {done && (
        <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 shrink-0" />
          <div>
            <p className="font-comic text-xl tracking-wider">{done.card_name} listed!</p>
            <p className="text-sm">
              {done.status === 'active' ? (
                <>
                  It is live now. <Link className="underline" to={`/card/${done.id}`}>View listing</Link>
                </>
              ) : (
                'It will appear in the market once approved.'
              )}
            </p>
          </div>
          <button type="button" onClick={() => setDone(null)} className="ml-auto" aria-label="Dismiss">
            <X size={18} />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        <Section n="1" title="Find your card">
          <CardLookup onPick={onPick} />
        </Section>

        <Section n="2" title="Card details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Card name *" htmlFor="card_name">
              <input id="card_name" required maxLength={80} className="field" value={f.card_name} onChange={set('card_name')} />
            </Field>
            <Field label="Set *" htmlFor="set_name">
              <input id="set_name" required maxLength={80} className="field" value={f.set_name} onChange={set('set_name')} placeholder="e.g. Base Set" />
            </Field>
            <Field label="Card number" htmlFor="card_number">
              <input id="card_number" maxLength={20} className="field" value={f.card_number} onChange={set('card_number')} placeholder="4/102" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Era" htmlFor="era">
                <select id="era" className="field" value={f.era} onChange={set('era')}>
                  {ERAS.filter((x) => x.id !== 'ALL').map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Year" htmlFor="release_year">
                <input id="release_year" type="number" min="1996" max="2100" inputMode="numeric" className="field" value={f.release_year} onChange={set('release_year')} />
              </Field>
            </div>
            <Field label="Card type" htmlFor="supertype">
              <select id="supertype" className="field" value={f.supertype} onChange={set('supertype')}>
                <option>Pokémon</option>
                <option>Trainer</option>
                <option>Energy</option>
              </select>
            </Field>
            <Field label="Rarity" htmlFor="rarity">
              <input id="rarity" list="rarities" maxLength={40} className="field" value={f.rarity} onChange={set('rarity')} />
              <datalist id="rarities">
                {RARITIES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <Field label="Finish" htmlFor="variant">
              <select id="variant" className="field" value={f.variant} onChange={set('variant')}>
                <option value="">—</option>
                {VARIANTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Edition" htmlFor="edition">
                <select id="edition" className="field" value={f.edition} onChange={set('edition')}>
                  {EDITIONS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Language" htmlFor="language">
                <select id="language" className="field" value={f.language} onChange={set('language')}>
                  {LANGUAGES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Artist" htmlFor="artist" className="sm:col-span-2">
              <input id="artist" maxLength={60} className="field" value={f.artist} onChange={set('artist')} />
            </Field>
          </div>

          {f.supertype === 'Pokémon' && (
            <div className="mt-4">
              <span className="label">Energy type (up to 2)</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPES).map(([name, t]) => {
                  const on = f.types.includes(name)
                  const Icon = t.icon
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(name)}
                      className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition ${
                        on ? 'border-dex-ink text-white shadow-[0_2px_0_#141414]' : 'border-black/10 dark:border-white/15'
                      }`}
                      style={on ? { background: t.bg } : undefined}
                    >
                      <Icon size={14} strokeWidth={2.5} style={on ? undefined : { color: t.bg }} />
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </Section>

        <Section n="3" title="Condition">
          <div className="grid grid-cols-2 rounded-xl border-2 border-dex-ink/80 p-1 dark:border-neutral-600">
            {[
              [false, 'Raw card'],
              [true, 'Graded slab'],
            ].map(([val, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={f.graded === val}
                onClick={() => setF((p) => ({ ...p, graded: val }))}
                className={`font-comic rounded-lg py-2 text-lg tracking-wider ${f.graded === val ? 'bg-dex-ink text-white dark:bg-poke-yellow dark:text-dex-ink' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {f.graded ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Grader" htmlFor="grading_company">
                <select id="grading_company" className="field" value={f.grading_company} onChange={set('grading_company')}>
                  {GRADERS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Grade" htmlFor="grade">
                <select id="grade" className="field" value={f.grade} onChange={set('grade')}>
                  {['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5', '4', '3', '2', '1'].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cert number" htmlFor="cert_number" className="col-span-2 sm:col-span-1">
                <input id="cert_number" maxLength={30} className="field" value={f.cert_number} onChange={set('cert_number')} />
              </Field>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={f.condition === c.id}
                  onClick={() => setF((p) => ({ ...p, condition: c.id }))}
                  className="dex-pill !not-italic !text-base"
                >
                  {c.id} <span className="font-sans text-xs opacity-70">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        <Section n="4" title="Photos">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {official && (
              <div className="relative">
                <CardImage src={official} listing={{ card_name: f.card_name }} className={`w-full rounded-md ${useOfficial ? '' : 'opacity-30'}`} />
                <label className="mt-1 flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={useOfficial} onChange={(e) => setUseOfficial(e.target.checked)} />
                  Official image
                </label>
              </div>
            )}
            {previews.map((p, i) => (
              <div key={p.url} className="relative">
                <img src={p.url} alt={`Upload ${i + 1}`} className="aspect-[63/88] w-full rounded-md object-cover shadow" />
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-dex-ink text-white"
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {files.length < 4 && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  addFiles(e.dataTransfer.files)
                }}
                className="flex aspect-[63/88] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-dex-ink/40 text-neutral-500 transition hover:border-poke-red hover:text-poke-red dark:border-white/25"
              >
                <ImagePlus size={26} />
                <span className="font-comic text-sm tracking-wider">Add photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <Camera size={14} /> Front and back, up to 4 photos, 5 MB each. Photos are resized and location data is removed.
          </p>
        </Section>

        <Section n="5" title="Price & shipping">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Your price (USD) *" htmlFor="price">
              <input id="price" required type="number" min="1" max="100000" step="0.01" inputMode="decimal" className="field" value={f.price} onChange={set('price')} placeholder="0.00" />
            </Field>
            <Field label="Shipping (USD)" htmlFor="shipping" hint="0 = free shipping">
              <input id="shipping" type="number" min="0" max="100" step="0.01" inputMode="decimal" className="field" value={f.shipping} onChange={set('shipping')} placeholder="0.00" />
            </Field>
            <Field label="Market price (USD)" htmlFor="market_price" className="col-span-2 sm:col-span-1">
              <input id="market_price" type="number" min="0" max="100000" step="0.01" inputMode="decimal" className="field" value={f.market_price} onChange={set('market_price')} placeholder="auto from lookup" />
            </Field>
          </div>
          {delta !== null && (
            <p className={`font-comic mt-3 text-lg tracking-wider ${delta > 0 ? 'text-emerald-600' : 'text-neutral-500'}`}>
              <Sparkles size={16} className="mr-1 inline" />
              {money(priceCents)} is {delta > 0 ? `${delta}% below` : delta < 0 ? `${-delta}% above` : 'right at'} market
            </p>
          )}
          <Field label="Notes for buyers" htmlFor="description" className="mt-3">
            <textarea id="description" rows={3} maxLength={1000} className="field" value={f.description} onChange={set('description')} placeholder="Centering, surface, any flaws, how it ships…" />
          </Field>
        </Section>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary w-full !py-3 !text-2xl">
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? 'Uploading…' : 'List card'}
        </button>
      </form>
    </div>
  )
}
