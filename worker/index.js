// Reis Cards checkout Worker.
//
// Cloudflare serves the static site from ./dist directly; only /api/* reaches this
// code (see run_worker_first in wrangler.jsonc). It exists so that secrets never
// reach the browser and the browser never decides the price:
//   * PAYPAL_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY are Worker secrets.
//   * The order amount is read from the database, not from the request.
//   * A card is only marked sold after PayPal confirms the capture, and only if
//     it is still active; if someone else bought it first, the payment is refunded.

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAYPAL_ID_RE = /^[A-Z0-9]{10,40}$/

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    try {
      return await handleApi(request, env, url)
    } catch (err) {
      // Log the detail server-side, return a generic message to the client.
      console.error(err)
      return json({ error: 'Checkout failed. Please try again.' }, 500)
    }
  },
}

async function handleApi(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Same-origin only: blocks other sites from driving checkout with a visitor's browser.
  const origin = request.headers.get('Origin')
  if (origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403)

  if (!isConfigured(env)) return json({ error: 'Checkout is not configured yet' }, 501)

  const body = await readJson(request)
  if (!body) return json({ error: 'Invalid request' }, 400)

  switch (url.pathname) {
    case '/api/checkout/create':
      return createOrder(env, body)
    case '/api/checkout/capture':
      return captureOrder(env, body)
    default:
      return json({ error: 'Not found' }, 404)
  }
}

function isConfigured(env) {
  return Boolean(
    env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

async function createOrder(env, { listingId }) {
  if (!UUID_RE.test(listingId || '')) return json({ error: 'Invalid listing' }, 400)

  const listing = await getListing(env, listingId)
  if (!listing || listing.status !== 'active') return json({ error: 'This card is no longer available' }, 409)

  const total = ((listing.price_cents + listing.shipping_cents) / 100).toFixed(2)
  const order = await paypal(env, '/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: listing.id,
          custom_id: listing.id,
          description: `${listing.card_name} · ${listing.set_name}`.slice(0, 127),
          amount: {
            currency_code: listing.currency,
            value: total,
            breakdown: {
              item_total: { currency_code: listing.currency, value: (listing.price_cents / 100).toFixed(2) },
              shipping: { currency_code: listing.currency, value: (listing.shipping_cents / 100).toFixed(2) },
            },
          },
          items: [
            {
              name: listing.card_name.slice(0, 127),
              quantity: '1',
              category: 'PHYSICAL_GOODS',
              unit_amount: { currency_code: listing.currency, value: (listing.price_cents / 100).toFixed(2) },
            },
          ],
        },
      ],
    },
  })

  return json({ id: order.id })
}

async function captureOrder(env, { orderId, listingId }) {
  if (!PAYPAL_ID_RE.test(orderId || '') || !UUID_RE.test(listingId || '')) {
    return json({ error: 'Invalid request' }, 400)
  }

  // The order must be one we created for this exact listing and price.
  const order = await paypal(env, `/v2/checkout/orders/${orderId}`)
  const unit = order.purchase_units?.[0]
  const listing = await getListing(env, listingId)
  if (!listing || unit?.reference_id !== listing.id) return json({ error: 'Order does not match this card' }, 400)

  const expected = ((listing.price_cents + listing.shipping_cents) / 100).toFixed(2)
  if (unit.amount?.value !== expected || unit.amount?.currency_code !== listing.currency) {
    return json({ error: 'Order amount does not match' }, 400)
  }
  if (listing.status !== 'active') return json({ error: 'This card was just sold to someone else' }, 409)

  const captured = await paypal(env, `/v2/checkout/orders/${orderId}/capture`, { method: 'POST', body: {} })
  const capture = captured.purchase_units?.[0]?.payments?.captures?.[0]
  if (captured.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED') {
    return json({ error: 'Payment was not completed' }, 402)
  }

  // Atomically flip active -> sold. Zero rows back means another buyer won the race.
  const sold = await supabase(env, `/rest/v1/listings?id=eq.${listing.id}&status=eq.active`, {
    method: 'PATCH',
    body: { status: 'sold' },
    prefer: 'return=representation',
  })
  if (!Array.isArray(sold) || sold.length === 0) {
    await paypal(env, `/v2/payments/captures/${capture.id}/refund`, { method: 'POST', body: {} })
    return json({ error: 'This card was just sold to someone else. Your payment has been refunded.' }, 409)
  }

  const payer = captured.payer || {}
  const shipping = captured.purchase_units?.[0]?.shipping
  await supabase(env, '/rest/v1/orders', {
    method: 'POST',
    body: {
      listing_id: listing.id,
      seller_id: listing.seller_id,
      paypal_order_id: captured.id,
      paypal_capture_id: capture.id,
      amount_cents: Math.round(Number(capture.amount.value) * 100),
      currency: capture.amount.currency_code,
      buyer_name: [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(' ') || null,
      buyer_email: payer.email_address || null,
      shipping_address: shipping ? { name: shipping.name?.full_name, ...shipping.address } : null,
    },
    prefer: 'return=minimal',
  })

  return json({ ok: true, orderId: captured.id })
}

// ---------- helpers ----------

async function getListing(env, id) {
  const rows = await supabase(
    env,
    `/rest/v1/listings?id=eq.${id}&select=id,seller_id,card_name,set_name,price_cents,shipping_cents,currency,status`,
  )
  return rows?.[0] || null
}

async function supabase(env, path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + path, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} -> ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function paypalBase(env) {
  return env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function paypalToken(env) {
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`PayPal auth -> ${res.status}`)
  return (await res.json()).access_token
}

async function paypal(env, path, { method = 'GET', body } = {}) {
  const res = await fetch(paypalBase(env) + path, {
    method,
    headers: {
      Authorization: `Bearer ${await paypalToken(env)}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`)
  return data
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0)
  if (len > 2048) return null
  try {
    const data = await request.json()
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}
