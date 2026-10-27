import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { DemoBanner } from './components/DemoBanner'
import { Header } from './components/Header'
import { RequireAuth } from './components/RequireAuth'
import Market from './pages/Market'

// Heavier screens load on demand so the marketplace grid paints fast on phones.
const CardDetail = lazy(() => import('./pages/CardDetail'))
const Sell = lazy(() => import('./pages/Sell'))
const Login = lazy(() => import('./pages/Login'))
const Account = lazy(() => import('./pages/Account'))
const Admin = lazy(() => import('./pages/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <DemoBanner />
      <Header />
      <main className="mx-auto max-w-7xl px-3 sm:px-6">
        <Suspense fallback={<div className="font-comic grid min-h-[50vh] place-items-center text-2xl tracking-widest opacity-60">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Market />} />
            <Route path="/card/:id" element={<CardDetail />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/sell"
              element={
                <RequireAuth>
                  <Sell />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="mx-auto mt-12 hidden max-w-7xl px-6 text-center text-xs text-neutral-500 md:block">
        © {new Date().getFullYear()} Reis Cards · POKECARD MARKETPLACE. Pokémon and card images are trademarks of
        Nintendo, Creatures and GAME FREAK; this is an independent reseller.
      </footer>
      <BottomNav />
    </div>
  )
}
