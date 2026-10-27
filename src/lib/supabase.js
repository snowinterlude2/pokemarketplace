import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only the public anon key is ever shipped to the browser. Row Level Security
// policies in supabase/schema.sql decide what that key can read or write.
export const isLive = Boolean(url && anonKey)
export const supabase = isLive ? createClient(url, anonKey, { auth: { persistSession: true } }) : null
