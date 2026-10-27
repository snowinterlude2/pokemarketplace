import { CircleUser, LayoutGrid, Plus, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Phone-only tab bar, thumb-reachable, with a raised pokéball-red Sell button.
export function BottomNav() {
  const { user, isAdmin } = useAuth()
  const item = ({ isActive }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 font-comic text-[13px] tracking-wider ${
      isActive ? 'text-poke-red dark:text-poke-yellow' : 'text-neutral-600 dark:text-neutral-400'
    }`

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-dex-ink/10 bg-dex-bar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/10 dark:bg-[#1b1e24]/95"
    >
      <div className="mx-auto flex max-w-md items-end">
        <NavLink to="/" end className={item}>
          <LayoutGrid size={22} />
          Market
        </NavLink>
        <NavLink to="/sell" className="flex flex-1 flex-col items-center">
          {({ isActive }) => (
            <>
              <span
                className={`-mt-6 grid h-14 w-14 place-items-center rounded-full border-[3px] border-dex-ink text-white shadow-[0_4px_0_#141414] ${isActive ? 'bg-poke-red' : 'bg-poke-red/90'}`}
              >
                <Plus size={28} strokeWidth={3} />
              </span>
              <span className="font-comic pb-2 text-[13px] tracking-wider text-neutral-700 dark:text-neutral-300">Sell</span>
            </>
          )}
        </NavLink>
        {isAdmin ? (
          <NavLink to="/admin" className={item}>
            <ShieldCheck size={22} />
            Admin
          </NavLink>
        ) : (
          <NavLink to={user ? '/account' : '/login'} className={item}>
            <CircleUser size={22} />
            {user ? 'Account' : 'Sign in'}
          </NavLink>
        )}
      </div>
    </nav>
  )
}
