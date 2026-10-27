import { CircleUser, Moon, Plus, Search, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Pokeball } from './Pokeball'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1e24' : '#e3e3e3')
    try {
      localStorage.setItem('reis-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])
  return [dark, setDark]
}

function SearchBox({ className = '' }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [value, setValue] = useState(params.get('q') || '')

  useEffect(() => setValue(params.get('q') || ''), [params])

  function submit(next) {
    const q = next.trim()
    const search = new URLSearchParams(location.pathname === '/' ? params : undefined)
    if (q) search.set('q', q)
    else search.delete('q')
    navigate({ pathname: '/', search: search.toString() ? `?${search}` : '' }, { replace: location.pathname === '/' })
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className={`relative ${className}`}
    >
      <label htmlFor="search" className="sr-only">
        Search cards
      </label>
      <input
        id="search"
        type="search"
        value={value}
        maxLength={60}
        onChange={(e) => {
          setValue(e.target.value)
          if (location.pathname === '/') submit(e.target.value)
        }}
        placeholder="SEARCH"
        autoComplete="off"
        className="font-comic h-11 w-full rounded-xl border-2 border-dex-ink bg-[#cbcbcb] pr-4 pl-10 text-center text-xl tracking-[0.25em] text-dex-ink shadow-[inset_0_2px_0_rgba(255,255,255,.5)] outline-none placeholder:text-dex-ink/80 focus:bg-white dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-300 dark:focus:bg-neutral-900"
      />
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dex-ink/60 dark:text-neutral-400" />
    </form>
  )
}

export function Header() {
  const [dark, setDark] = useTheme()
  const { user } = useAuth()

  const toggle = (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-pressed={dark}
      className="card-name flex items-center gap-2 text-sm text-dex-ink dark:text-neutral-100"
    >
      <span className="hidden lg:inline">DARK MODE</span>
      <span className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-dex-ink bg-white transition dark:border-neutral-300 dark:bg-neutral-700">
        <span
          className={`absolute grid h-4 w-4 place-items-center rounded-full bg-dex-ink transition-all dark:bg-poke-yellow ${dark ? 'left-[22px]' : 'left-[3px]'}`}
        >
          {dark ? <Moon size={10} className="text-dex-ink" /> : <Sun size={10} className="text-white" />}
        </span>
      </span>
      <span className="sr-only lg:hidden">Dark mode</span>
    </button>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-dex-bar/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-white/10 dark:bg-[#1b1e24]/95">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-6 lg:gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="POKECARD MARKETPLACE home">
          <Pokeball className="h-10 w-10 shrink-0 transition hover:rotate-[20deg] sm:h-12 sm:w-12" />
          <span className="flex flex-col">
            <span className="poke-title poke-title-sm text-[19px] sm:text-[26px]">POKECARD</span>
            <span className="poke-title poke-title-sm -mt-0.5 text-[13px] sm:text-[17px]">MARKETPLACE</span>
          </span>
        </Link>

        <SearchBox className="mx-auto hidden w-full max-w-sm md:block" />

        <div className="ml-auto flex items-center gap-3 md:ml-0 sm:gap-4">
          {toggle}
          <Link to="/sell" className="btn btn-primary hidden !py-1.5 !text-base md:inline-flex">
            <Plus size={18} strokeWidth={3} /> Sell a card
          </Link>
          <Link
            to={user ? '/account' : '/login'}
            className="hidden h-10 w-10 place-items-center rounded-full border-2 border-dex-ink bg-white text-dex-ink transition hover:bg-poke-yellow md:grid dark:border-neutral-400 dark:bg-neutral-800 dark:text-neutral-100"
            aria-label={user ? 'Your account' : 'Sign in'}
            title={user ? user.name : 'Sign in'}
          >
            <CircleUser size={22} />
          </Link>
        </div>
      </div>
      <div className="px-3 pb-2.5 md:hidden">
        <SearchBox />
      </div>
    </header>
  )
}
