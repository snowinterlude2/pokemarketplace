# Reis Cards · POKECARD MARKETPLACE

A Pokédex-style marketplace for flipping Pokémon cards. Browse cards by era and energy type,
list raw cards or graded slabs with full card metadata, and take payment through PayPal.

Runs entirely on free tiers: **Vite + React + Tailwind + Lucide**, **Supabase** (database, auth,
photo storage) and **Cloudflare Workers** (hosting + checkout API).

## What's inside

| Page | What it does |
| --- | --- |
| `/` Market | Pokédex grid. Era pills (WOTC → SV), type filters, graded/raw toggle, sort by price or best deal vs market, live search. |
| `/card/:id` | Card showcase, price vs TCGplayer market, full specs (set, number, rarity, finish, edition, language, grade, cert #, artist) and PayPal checkout. Sticky buy bar on phones. |
| `/sell` | Sign-in required. Look a card up by name to auto-fill set, number, rarity, artist, official image and market price, then add condition or grading details, photos (up to 4) and price. |
| `/account` | Your listings: hide, relist, delete. |
| `/admin` | Admins only. Approve or hide listings, see inventory value, sales and orders. |

With no Supabase keys the site runs in **demo mode**: sample cards, data saved in your browser,
PayPal sandbox. Add the keys and it switches to the real database automatically.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add Supabase + PayPal client ID
npm run dev
```

## Go live (all free)

1. **Supabase**: create a project, open *SQL Editor*, paste and run `supabase/schema.sql`.
   Sign up once on the site, then make yourself admin (the query is at the top of the file).
2. **PayPal**: at developer.paypal.com create a REST app. Use its *sandbox* credentials first.
3. **Cloudflare**: *Workers & Pages → Create → Import a repository*, pick this repo.
   Build command `npm run build`, deploy command `npx wrangler deploy`.
   - Build variables (public): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYPAL_CLIENT_ID`
   - Worker secrets (*Settings → Variables and Secrets*, type **Secret**): `PAYPAL_CLIENT_ID`,
     `PAYPAL_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - When ready for real money, set `PAYPAL_ENV` to `live` in `wrangler.jsonc` and swap in live PayPal keys.

## Security

- **No secrets in the browser.** Only public values use the `VITE_` prefix. The PayPal secret and the
  Supabase service-role key exist only as Cloudflare Worker secrets. `.env*` files are gitignored.
- **Row Level Security on every table** (`supabase/schema.sql`). Anyone can read live cards; sellers
  manage only their own; only admins approve; buyer details are visible only to the seller and admins.
  Database triggers block self-promotion to admin, self-approval, marking your own card sold, and
  editing a sold card, even if someone calls the API directly.
- **Server-side checkout** (`worker/index.js`). The price is read from the database, never from the
  browser. A card is marked sold only after PayPal confirms the capture; if two people pay at once,
  the second payment is refunded automatically. Same-origin requests only, input validated.
- **Locked-down uploads.** Photos go to `<your user id>/…` in the `card-images` bucket only, JPG/PNG/WebP,
  5 MB max. Photos are resized in the browser, which also strips GPS/EXIF data.
- **Protected routes.** `/sell`, `/account` and `/admin` require sign-in (admin role for `/admin`);
  the database enforces the same rules behind the UI.
- **Security headers** (`public/_headers`): strict Content-Security-Policy, no framing, HSTS, nosniff.

Pokémon and card images are trademarks of Nintendo, Creatures and GAME FREAK. Card data and
images come from the free [Pokémon TCG API](https://pokemontcg.io).
