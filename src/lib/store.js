import { SEED_LISTINGS } from '../data/seed'
import { isLive, supabase } from './supabase'

// One data API for the whole app. With Supabase configured it talks to the
// database (RLS-enforced); otherwise it runs a local demo store in this browser.

const DEMO_KEY = 'reis-demo-listings-v1'
const PUBLIC_COLUMNS =
  'id,seller_id,seller_name,card_name,set_name,set_code,card_number,era,release_year,supertype,types,rarity,variant,edition,language,artist,tcg_id,graded,condition,grading_company,grade,cert_number,price_cents,shipping_cents,market_price_cents,currency,description,image_urls,status,created_at'

function demoRead() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null')
    if (Array.isArray(saved)) return saved
  } catch {
    /* fall through to seed */
  }
  return SEED_LISTINGS
}

function demoWrite(rows) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(rows))
  } catch {
    throw new Error('Demo storage is full. Try smaller photos.')
  }
}

export async function listMarket() {
  if (!isLive) return demoRead().filter((l) => l.status === 'active' || l.status === 'sold')
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_COLUMNS)
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return data
}

export async function getListing(id) {
  if (!isLive) return demoRead().find((l) => l.id === id) || null
  const { data, error } = await supabase.from('listings').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function listMine(userId) {
  if (!isLive) return demoRead().filter((l) => l.seller_id === userId)
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_COLUMNS)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listAll() {
  if (!isLive) return demoRead()
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return data
}

export async function listOrders() {
  if (!isLive) {
    try {
      return JSON.parse(localStorage.getItem(`${DEMO_KEY}-orders`) || '[]')
    } catch {
      return []
    }
  }
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return data
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Photos must be JPG, PNG or WebP.'
  if (file.size > MAX_BYTES) return 'Each photo must be 5 MB or smaller.'
  return null
}

// Shrinks a photo in the browser before upload (also strips EXIF/GPS metadata).
async function compress(file, maxSide = 1400, quality = 0.85) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
}

export async function createListing(user, fields, files, officialImage) {
  for (const f of files) {
    const err = validateImage(f)
    if (err) throw new Error(err)
  }

  if (!isLive) {
    const urls = []
    for (const f of files) {
      const blob = await compress(f, 700, 0.75)
      urls.push(await new Promise((r) => {
        const reader = new FileReader()
        reader.onload = () => r(reader.result)
        reader.readAsDataURL(blob)
      }))
    }
    if (officialImage) urls.push(officialImage)
    const row = {
      ...fields,
      id: `demo-${crypto.randomUUID()}`,
      seller_id: user.id,
      seller_name: user.name,
      image_urls: urls.slice(0, 4),
      status: user.role === 'admin' ? 'active' : 'pending',
      created_at: new Date().toISOString(),
    }
    demoWrite([row, ...demoRead()])
    return row
  }

  const urls = []
  for (const f of files) {
    const blob = await compress(f)
    const path = `${user.id}/${crypto.randomUUID()}.webp`
    const { error } = await supabase.storage
      .from('card-images')
      .upload(path, blob, { contentType: 'image/webp', upsert: false })
    if (error) throw error
    urls.push(supabase.storage.from('card-images').getPublicUrl(path).data.publicUrl)
  }
  if (officialImage) urls.push(officialImage)

  // seller_id must equal the signed-in user (RLS), and status is forced by a DB trigger.
  const { data, error } = await supabase
    .from('listings')
    .insert({ ...fields, seller_id: user.id, image_urls: urls.slice(0, 4) })
    .select(PUBLIC_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function setStatus(id, status) {
  if (!isLive) {
    demoWrite(demoRead().map((l) => (l.id === id ? { ...l, status } : l)))
    return
  }
  const { error } = await supabase.from('listings').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteListing(id) {
  if (!isLive) {
    demoWrite(demoRead().filter((l) => l.id !== id))
    return
  }
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw error
}

// Demo-only: records a sandbox purchase locally. In live mode the Worker does this.
export function demoMarkSold(listing, order) {
  demoWrite(demoRead().map((l) => (l.id === listing.id ? { ...l, status: 'sold' } : l)))
  try {
    const key = `${DEMO_KEY}-orders`
    const orders = JSON.parse(localStorage.getItem(key) || '[]')
    orders.unshift({
      id: order.id,
      listing_id: listing.id,
      paypal_order_id: order.id,
      amount_cents: listing.price_cents + (listing.shipping_cents || 0),
      buyer_name: [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(' '),
      buyer_email: order.payer?.email_address,
      status: 'paid',
      created_at: new Date().toISOString(),
    })
    localStorage.setItem(key, JSON.stringify(orders))
  } catch {
    /* ignore */
  }
}

export function resetDemo() {
  localStorage.removeItem(DEMO_KEY)
  localStorage.removeItem(`${DEMO_KEY}-orders`)
}
