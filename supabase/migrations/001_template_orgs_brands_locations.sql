-- 001_template_orgs_brands_locations.sql
--
-- Provisions the three-tier hierarchy for the `website-template` Supabase project.
--
-- This project is DEDICATED to marketing / storefront content and is
-- completely separate from `attribution-autopilot`. FKs into attribution
-- (attribution_promotion_id, attribution_campaign_id, attribution_org_id,
-- attribution_location_id) are STORED AS UUIDs but NOT constrained via
-- foreign keys — they cross project boundaries.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- template_organizations — client account
-- ---------------------------------------------------------------------------
create table if not exists public.template_organizations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'),
  name           text not null,
  default_locale text not null default 'en',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- template_brands — design + copy live here
-- ---------------------------------------------------------------------------
create table if not exists public.template_brands (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.template_organizations(id) on delete cascade,
  slug       text not null
             check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'),
  name       text not null,
  logo_url   text,
  -- Narrow override: { primary?: oklch, primary_foreground?: oklch }.
  -- Defaults to MySite grayscale — --radius is intentionally NOT overridable.
  theme      jsonb not null default '{}'::jsonb,
  tagline    text,
  about_md   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index if not exists template_brands_org_id_idx
  on public.template_brands(org_id);

-- ---------------------------------------------------------------------------
-- template_locations — address, hours, promo linkage, menu JSON
-- ---------------------------------------------------------------------------
create table if not exists public.template_locations (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.template_brands(id) on delete cascade,
  slug           text not null
                 check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'),
  name           text not null,

  -- Address
  address_line   text,
  city           text,
  region         text,
  postal_code    text,
  country        text not null default 'PL',
  latitude       double precision,
  longitude      double precision,

  -- Contact (server-side only — RLS denies anon reads)
  phone          text,
  email          text,

  -- Hours (free-form display strings — kept simple for v1)
  weekday_hours  text,
  weekend_hours  text,

  -- Maps
  maps_embed_url  text,
  maps_search_query text,

  -- Social
  instagram_url  text,
  facebook_url   text,

  -- Delivery — [{name, url}, ...]
  delivery       jsonb not null default '[]'::jsonb,

  -- Attribution-autopilot linkage (UUIDs in ANOTHER Supabase project)
  attribution_promotion_id  uuid,
  attribution_campaign_id   uuid,
  attribution_org_id        uuid,
  attribution_location_id   uuid,

  -- Optional denormalized cache — refreshed on demand from attribution.
  -- See docs/04-attribution-integration.md.
  promotion_name_cached     text,
  reward_description_cached text,

  -- Analytics
  umami_website_id text,
  meta_pixel_ids   text[] not null default '{}',

  -- Content
  gallery        jsonb not null default '[]'::jsonb,
  menu           jsonb not null default '{"version":1,"currency_default":"PLN","categories":[]}'::jsonb,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (brand_id, slug)
);

create index if not exists template_locations_brand_id_idx
  on public.template_locations(brand_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists set_updated_at on public.template_organizations;
create trigger set_updated_at
  before update on public.template_organizations
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.template_brands;
create trigger set_updated_at
  before update on public.template_brands
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.template_locations;
create trigger set_updated_at
  before update on public.template_locations
  for each row execute function public.set_updated_at();
