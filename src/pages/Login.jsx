import { Mail, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Pokeball } from '../components/Pokeball'
import { useAuth } from '../lib/auth'
import { isLive } from '../lib/supabase'

export default function Login() {
  const { user, signIn, signUp, magicLink, demoSignIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/sell'
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ kind: '', text: '' })

  if (user) return <Navigate to={from} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg({ kind: '', text: '' })
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        navigate(from, { replace: true })
      } else if (mode === 'signup') {
        await signUp(email, password)
        setMsg({ kind: 'ok', text: 'Check your email to confirm your account, then sign in.' })
      } else {
        await magicLink(email)
        setMsg({ kind: 'ok', text: 'Magic link sent! Open it on this device to sign in.' })
      }
    } catch (err) {
      // Generic message: do not reveal whether an email is registered.
      setMsg({ kind: 'err', text: err?.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'That did not work. Check your details and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pop-in mx-auto mt-8 max-w-md">
      <div className="panel overflow-hidden">
        <div className="relative bg-poke-red px-6 pt-6 pb-10 text-center">
          <Pokeball className="mx-auto h-14 w-14" />
          <h1 className="poke-title mt-3 text-3xl">TRAINER LOGIN</h1>
          <p className="mt-1 text-sm text-white/90">Sign in to list cards and manage your sales.</p>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-dex-ink" />
        </div>

        <div className="p-5 sm:p-6">
          {!isLive ? (
            <div className="text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Supabase is not connected yet, so accounts are disabled. You can explore selling and the admin
                dashboard in demo mode; nothing leaves this browser.
              </p>
              <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => { demoSignIn(); navigate(from, { replace: true }) }}>
                <Sparkles size={18} /> Continue in demo mode
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 rounded-lg border-2 border-dex-ink/80 p-0.5 text-sm font-medium dark:border-neutral-600">
                {[
                  ['signin', 'Sign in'],
                  ['signup', 'Create account'],
                  ['magic', 'Email link'],
                ].map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md py-1.5 ${mode === m ? 'bg-dex-ink text-white dark:bg-poke-yellow dark:text-dex-ink' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="label" htmlFor="email">Email</label>
                  <input id="email" type="email" required autoComplete="email" maxLength={120} className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode !== 'magic' && (
                  <div>
                    <label className="label" htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={mode === 'signup' ? 10 : 6}
                      maxLength={72}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="field"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {mode === 'signup' && <p className="mt-1 text-xs text-neutral-500">At least 10 characters.</p>}
                  </div>
                )}
                <button type="submit" disabled={busy} className="btn btn-primary w-full">
                  {mode === 'magic' && <Mail size={18} />}
                  {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
                </button>
              </form>
            </>
          )}
          {msg.text && (
            <p role="status" className={`mt-3 rounded-lg p-2.5 text-sm ${msg.kind === 'err' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
