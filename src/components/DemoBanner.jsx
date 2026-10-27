import { isLive } from '../lib/supabase'

export function DemoBanner() {
  if (isLive) return null
  return (
    <div className="bg-poke-yellow px-3 py-1.5 text-center text-[12px] font-medium text-dex-ink sm:text-[13px]">
      Demo mode: sample cards stored in your browser and PayPal sandbox. Connect Supabase to go live.
    </div>
  )
}
