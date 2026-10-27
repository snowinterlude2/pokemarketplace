import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { CheckCircle2, Lock } from 'lucide-react'
import { useState } from 'react'
import { money } from '../lib/format'
import { demoMarkSold } from '../lib/store'
import { isLive } from '../lib/supabase'

const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test'

// Placeholder shown while the PayPal SDK loads (or if a blocker stops it).
function LoadingButtons({ compact }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer()
  if (isRejected) {
    return (
      <p className="rounded-lg bg-amber-50 p-2.5 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        PayPal could not load. Turn off ad blockers for this site and refresh.
      </p>
    )
  }
  if (!isPending) return null
  return (
    <div className={`grid animate-pulse gap-2 ${compact ? '' : 'grid-rows-2'}`} aria-label="Loading PayPal">
      <div className="h-[45px] rounded bg-[#ffc439]" />
      {!compact && <div className="h-12 rounded bg-neutral-800" />}
    </div>
  )
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Live: the Worker creates and captures the order, so the price comes from the
// database and the PayPal secret never touches the browser.
// Demo (no Supabase): falls back to a client-side PayPal *sandbox* order so the
// flow can be tried end to end. That fallback is disabled once the site is live.
export function Checkout({ listing, onSold, compact = false }) {
  const [state, setState] = useState({ step: 'idle', message: '' })
  const total = listing.price_cents + (listing.shipping_cents || 0)
  const demoFallback = !isLive

  if (state.step === 'done') {
    return (
      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <p className="font-comic flex items-center gap-2 text-2xl tracking-wider">
          <CheckCircle2 /> Payment received!
        </p>
        <p className="mt-1 text-sm">
          Order {state.message}. You will get a PayPal receipt by email, and the card ships within 2 business days.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture', components: 'buttons' }}>
        <LoadingButtons compact={compact} />
        <PayPalButtons
          style={compact ? { layout: 'horizontal', tagline: false, shape: 'rect', color: 'gold', label: 'buynow', height: 45 } : { layout: 'vertical', shape: 'rect', color: 'gold', label: 'pay', height: 48 }}
          forceReRender={[listing.id, total]}
          createOrder={async (_data, actions) => {
            setState({ step: 'idle', message: '' })
            const res = await post('/api/checkout/create', { listingId: listing.id })
            if (res.ok && res.data.id) return res.data.id
            if (demoFallback && [404, 405, 501].includes(res.status)) {
              return actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    reference_id: listing.id,
                    description: `${listing.card_name} · ${listing.set_name}`.slice(0, 127),
                    amount: { currency_code: 'USD', value: (total / 100).toFixed(2) },
                  },
                ],
              })
            }
            throw new Error(res.data.error || 'Could not start checkout')
          }}
          onApprove={async (data, actions) => {
            const res = await post('/api/checkout/capture', { orderId: data.orderID, listingId: listing.id })
            if (res.ok) {
              setState({ step: 'done', message: res.data.orderId })
              onSold?.()
              return
            }
            if (demoFallback && [404, 405, 501].includes(res.status)) {
              const order = await actions.order.capture()
              demoMarkSold(listing, order)
              setState({ step: 'done', message: order.id })
              onSold?.()
              return
            }
            setState({ step: 'error', message: res.data.error || 'Payment could not be completed.' })
          }}
          onError={(err) => setState({ step: 'error', message: err?.message || 'PayPal could not load. Please try again.' })}
        />
      </PayPalScriptProvider>

      {state.step === 'error' && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {state.message}
        </p>
      )}
      <p className={`items-center justify-center gap-1.5 text-xs text-neutral-500 ${compact ? 'hidden' : 'mt-2 flex'}`}>
        <Lock size={12} /> Secure checkout by PayPal · {money(total)} total
        {!isLive || clientId === 'test' ? ' · sandbox' : ''}
      </p>
    </div>
  )
}
