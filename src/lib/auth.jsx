import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isLive, supabase } from './supabase'

const AuthContext = createContext(null)
const DEMO_USER_KEY = 'reis-demo-user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLive) {
      try {
        setUser(JSON.parse(sessionStorage.getItem(DEMO_USER_KEY) || 'null'))
      } catch {
        setUser(null)
      }
      setLoading(false)
      return
    }

    // The role comes from the profiles table (RLS: you can only read your own row).
    // It only decides what the UI shows; the database enforces the real permissions.
    async function load(session) {
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', session.user.id)
        .maybeSingle()
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: data?.display_name || session.user.email.split('@')[0],
        role: data?.role || 'user',
      })
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
      },
      async magicLink(email) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/sell` },
        })
        if (error) throw error
      },
      demoSignIn() {
        const demo = { id: 'demo-reis', email: 'demo@reiscards.local', name: 'Reis Cards', role: 'admin' }
        sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(demo))
        setUser(demo)
      },
      async signOut() {
        if (isLive) await supabase.auth.signOut()
        sessionStorage.removeItem(DEMO_USER_KEY)
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
