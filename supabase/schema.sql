-- =====================================================================
-- Reis Cards · POKECARD MARKETPLACE · Supabase schema (free tier)
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.
--
-- Security model
--   * Row Level Security is ON for every table. The browser only ever
--     holds the public anon key, so these policies ARE the access control.
--   * Listings: anyone can read active/sold cards; sellers manage their own;
--     admins moderate everything. Sellers can never mark a card "sold" or
--     approve their own listing (enforced by trigger, not by the UI).
--   * Orders: written only by the checkout Worker with the service-role key
--     (no insert policy exists for normal users). Sellers see orders for their
--     cards, admins see all, nobody else sees buyer details.
--   * Roles: a user cannot promote themselves; only the "role" column guard
--     trigger and admins control it.
--   * Storage: card photos are public to view, but a user can only upload,
--     replace or delete files inside their own folder (<user id>/...), images
--     only, max 5 MB.
--
-- Make yourself admin after signing up once on the site:
--   update public.profiles set role = 'admin' where id =
--     (select id from auth.users where email = 'you@example.com');
-- =====================================================================

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper used by policies. SECURITY DEFINER so it can read profiles without
-- recursing into the profiles policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- True for admins, for the checkout Worker (service role), and for direct SQL
-- run by the project owner in the dashboard (no JWT at all). Never true for
-- a browser request, which always carries an anon or authenticated JWT.
create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or auth.role() = 'service_role' or auth.role() is null;
$$;

revoke all on function public.is_privileged() from public;
grant execute on function public.is_privileged() to anon, authenticated, service_role;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Users may only edit their display name; role changes need an admin.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_privileged() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(split_part(new.email, '@', 1), 40))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Listings ----------
create table if not exists public.listings (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references auth.users (id) on delete cascade,
  seller_name        text check (char_length(seller_name) <= 40),

  -- Card identity
  card_name          text not null check (char_length(card_name) between 1 and 80),
  set_name           text not null check (char_length(set_name) between 1 and 80),
  set_code           text check (char_length(set_code) <= 20),
  card_number        text check (char_length(card_number) <= 20),
  era                text not null default 'SV'
                     check (era in ('WOTC','EX','DP','HGSS','BW','XY','SM','SWSH','SV')),
  release_year       int check (release_year between 1996 and 2100),
  supertype          text not null default 'Pokémon'
                     check (supertype in ('Pokémon','Trainer','Energy')),
  types              text[] not null default '{}',
  rarity             text check (char_length(rarity) <= 40),
  variant            text check (char_length(variant) <= 40),   -- Holo, Reverse Holo, Alt Art...
  edition            text check (char_length(edition) <= 40),   -- 1st Edition, Shadowless, Unlimited
  language           text not null default 'English' check (char_length(language) <= 20),
  artist             text check (char_length(artist) <= 60),
  tcg_id             text check (char_length(tcg_id) <= 40),    -- pokemontcg.io id, e.g. base1-4

  -- Condition / grading
  graded             boolean not null default false,
  condition          text check (condition in ('NM','LP','MP','HP','DMG')),
  grading_company    text check (grading_company in ('PSA','BGS','CGC','SGC','TAG','ACE')),
  grade              numeric(3,1) check (grade between 1 and 10),
  cert_number        text check (char_length(cert_number) <= 30),

  -- Money (stored in cents to avoid float rounding)
  price_cents        int not null check (price_cents between 100 and 10000000),
  shipping_cents     int not null default 0 check (shipping_cents between 0 and 10000),
  market_price_cents int check (market_price_cents between 0 and 10000000),
  currency           text not null default 'USD' check (currency = 'USD'),

  description        text check (char_length(description) <= 1000),
  image_urls         text[] not null default '{}' check (cardinality(image_urls) <= 4),

  status             text not null default 'pending'
                     check (status in ('pending','active','sold','hidden')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint graded_fields check (
    (graded and grading_company is not null and grade is not null)
    or (not graded and condition is not null)
  )
);

create index if not exists listings_status_created_idx on public.listings (status, created_at desc);
create index if not exists listings_seller_idx on public.listings (seller_id);

alter table public.listings enable row level security;

drop policy if exists "listings: public read" on public.listings;
create policy "listings: public read" on public.listings
  for select using (
    status in ('active','sold') or seller_id = auth.uid() or public.is_admin()
  );

drop policy if exists "listings: seller insert" on public.listings;
create policy "listings: seller insert" on public.listings
  for insert to authenticated with check (seller_id = auth.uid());

drop policy if exists "listings: seller or admin update" on public.listings;
create policy "listings: seller or admin update" on public.listings
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

drop policy if exists "listings: seller or admin delete" on public.listings;
create policy "listings: seller or admin delete" on public.listings
  for delete to authenticated
  using ((seller_id = auth.uid() and status <> 'sold') or public.is_admin());

-- Status rules that the browser cannot bypass:
--   * New listings from regular users start as 'pending' (admin approves).
--     Admin listings go live immediately.
--   * Sellers may hide their own card (and un-hide it back to 'pending').
--     Only admins may approve to 'active'; only the checkout Worker
--     (service role) or an admin may set 'sold'.
--   * Sold listings are frozen for sellers.
--   * seller_id can never be reassigned.
create or replace function public.guard_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged boolean := public.is_privileged();
begin
  if tg_op = 'INSERT' then
    new.status := case
      when not privileged then 'pending'
      when new.status in ('active', 'hidden') then new.status
      else 'active'
    end;
    new.seller_name := (select display_name from public.profiles where id = new.seller_id);
    return new;
  end if;

  if new.seller_id <> old.seller_id then
    raise exception 'seller_id cannot change';
  end if;

  if not privileged then
    new.seller_name := old.seller_name;
    if old.status = 'sold' then
      raise exception 'Sold listings cannot be edited';
    end if;
    if new.status is distinct from old.status
       and not (new.status = 'hidden' and old.status in ('active','pending'))
       and not (new.status = 'pending' and old.status = 'hidden') then
      raise exception 'Only admins can change listing status';
    end if;
    -- Editing price or card details sends the listing back for review.
    if old.status = 'active' and (new.price_cents <> old.price_cents
        or new.card_name <> old.card_name or new.image_urls <> old.image_urls) then
      new.status := 'pending';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard
  before insert or update on public.listings
  for each row execute function public.guard_listing();

-- ---------- Orders ----------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references public.listings (id) on delete set null,
  seller_id        uuid references auth.users (id) on delete set null,
  paypal_order_id  text not null unique,
  paypal_capture_id text,
  amount_cents     int not null,
  currency         text not null default 'USD',
  buyer_name       text,
  buyer_email      text,
  shipping_address jsonb,
  status           text not null default 'paid' check (status in ('paid','shipped','refunded')),
  created_at       timestamptz not null default now()
);

alter table public.orders enable row level security;

-- No insert policy on purpose: only the Worker's service-role key can write orders.
drop policy if exists "orders: seller or admin read" on public.orders;
create policy "orders: seller or admin read" on public.orders
  for select to authenticated using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "orders: seller or admin mark shipped" on public.orders;
create policy "orders: seller or admin mark shipped" on public.orders
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());

-- ---------- Storage: card photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "card-images: upload own folder" on storage.objects;
create policy "card-images: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "card-images: update own folder" on storage.objects;
create policy "card-images: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "card-images: delete own folder or admin" on storage.objects;
create policy "card-images: delete own folder or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
-- Reads need no policy: the bucket is public, so photos load via their public URL.
