# 02 — Adding a client

Two patterns, both zero-code. Site is live in <5 minutes.

Before you start, verify:

1. **`mysite.so` is set up in Vercel** with wildcard entries `*.mysite.so` (and `*.*.mysite.so` if the multi-location TLS pre-req has been confirmed — see `01-architecture.md` note).
2. **CORS 60-second cache lag** — every hostname you add must ALSO be inserted into `attribution-autopilot`'s `location_origins`. `LocationsService.getAllOriginsCached()` caches the origin list for 60 seconds, so wait ~60s after the INSERT before smoke-testing `/promocja` or CORS will fail with a confusing error.

## Pattern A — Single-location (e.g. Karat)

For single-location clients `brand.slug === location.slug` so the two concepts collapse. The hostname is `<slug>.mysite.so`.

### Step 1 — `website-template` Supabase

```sql
-- 1. Org
insert into template_organizations (slug, name)
values ('karat', 'Karat Sp. z o.o.')
returning id;
-- ⇒ ORG_ID

-- 2. Brand (brand.slug === location.slug for single-location)
insert into template_brands (org_id, slug, name, tagline, about_md, theme)
values (
  'ORG_ID', 'karat', 'Karat',
  'Kawa, ciasto i śniadania w Białymstoku.',
  'O nas...\n\nDrugi paragraf.',
  '{}'::jsonb  -- keep MySite grayscale, or {"primary":"oklch(...)"}
)
returning id;
-- ⇒ BRAND_ID

-- 3. Location
insert into template_locations (
  brand_id, slug, name,
  address_line, city, region, postal_code, country,
  latitude, longitude,
  phone, email,
  weekday_hours, weekend_hours,
  maps_embed_url, maps_search_query,
  instagram_url, facebook_url,
  delivery,
  attribution_promotion_id, attribution_campaign_id,
  attribution_org_id, attribution_location_id,
  umami_website_id, meta_pixel_ids,
  gallery, menu
) values (
  'BRAND_ID', 'karat', 'Karat',
  'ul. Sienkiewicza 5', 'Białystok', 'podlaskie', '15-092', 'PL',
  53.1325, 23.1688,
  '+48500000000', 'kontakt@karat.pl',
  '08:00 – 20:00', '09:00 – 20:00',
  'https://www.google.com/maps/embed?pb=...',
  'Karat, Sienkiewicza 5, Białystok',
  'https://instagram.com/karatpl', null,
  '[{"name":"Wolt","url":"https://wolt.com/..."}]'::jsonb,
  '<promo_uuid_from_attribution>',
  '<campaign_uuid_from_attribution>',
  '<org_uuid_from_attribution>',
  '<location_uuid_from_attribution>',  -- ← used for CORS in step 2
  '01912345abcd', ARRAY['<pixel_id>']::text[],
  '[{"src":"https://.../hero.jpg","alt":"Karat"}]'::jsonb,
  '{"version":1,"currency_default":"PLN","categories":[]}'::jsonb  -- see 05-supabase-schema.md
)
returning id;
-- ⇒ LOCATION_ID

-- 4. Domain(s) — hostnames are exact-match, no www stripping.
insert into template_domains (hostname, location_id, is_primary, kind) values
  ('karat.mysite.so', 'LOCATION_ID', true,  'mysite_single'),
  ('karat.pl',        'LOCATION_ID', false, 'custom'),
  ('www.karat.pl',    'LOCATION_ID', false, 'custom');  -- separate row for www
```

### Step 2 — `attribution-autopilot` Supabase

For **each** hostname above, insert into `location_origins`:

```sql
insert into location_origins (location_id, origin) values
  ('<attribution_location_id from step 1>', 'https://karat.mysite.so'),
  ('<attribution_location_id from step 1>', 'https://karat.pl'),
  ('<attribution_location_id from step 1>', 'https://www.karat.pl');
```

**Do not** touch `DEFAULT_ALLOWED_ORIGIN_PATTERNS` in `src/common/origin-allowlist.ts` — that path requires a backend redeploy and defeats zero-code onboarding.

⚠️ Wait ~60 seconds before smoke-testing `/promocja` (CORS cache lag).

### Step 3 — DNS + Vercel

- `karat.mysite.so` — covered by the wildcard `*.mysite.so`. Nothing to do.
- `karat.pl` — in Vercel dashboard, add `karat.pl` (and `www.karat.pl`) to the `website-template` project. Ask the client to CNAME `www.karat.pl` → `cname.vercel-dns.com` and A-record `karat.pl` to Vercel's IPs (Vercel prints them in the UI).

## Pattern B — Multi-location (e.g. Doublz brand with Santa Fe)

Same three steps; the differences are (a) the domain shape uses two labels and (b) `brand.slug !== location.slug`.

### Step 1 — `website-template` Supabase

```sql
insert into template_organizations (slug, name) values ('doublz', 'Doublz Sp. z o.o.') returning id;
-- ⇒ ORG_ID

insert into template_brands (org_id, slug, name, tagline, about_md)
values ('ORG_ID', 'doublz', 'Doublz', 'Neapolitan pizza.', 'About...')
returning id;
-- ⇒ BRAND_ID

-- One row PER location
insert into template_locations (brand_id, slug, name, /* ... same fields ... */)
values ('BRAND_ID', 'santafe', 'Doublz Santa Fe', /* ... */)
returning id;
-- ⇒ SANTAFE_ID

insert into template_domains (hostname, location_id, is_primary, kind) values
  ('santafe.doublz.mysite.so', 'SANTAFE_ID', true,  'mysite_multi'),
  ('santafe.doublz.mysite.co', 'SANTAFE_ID', false, 'custom');
```

**Do NOT** insert a row for `doublz.mysite.so` (bare brand root). The schema blocks it — the `template_domains_validate` trigger rejects `<slug>.mysite.so` unless `kind='mysite_single'`. Users hitting `doublz.mysite.so` see a 404.

### Step 2 — `attribution-autopilot` Supabase

```sql
insert into location_origins (location_id, origin) values
  ('<santafe attribution_location_id>', 'https://santafe.doublz.mysite.so'),
  ('<santafe attribution_location_id>', 'https://santafe.doublz.mysite.co');
```

### Step 3 — DNS + Vercel

- `santafe.doublz.mysite.so` — covered by `*.*.mysite.so` IF Vercel-issued TLS supports a two-label wildcard on the same project. If not, restructure to flat `santafe-doublz.mysite.so` (single-level wildcard, no code change needed).
- `santafe.doublz.mysite.co` — add to Vercel project, client CNAMEs.

## Adding an alias domain later

One row insert. That's it.

```sql
insert into template_domains (hostname, location_id, is_primary, kind)
values ('kawiarnia-karat.pl', '<karat location_id>', false, 'custom');

insert into location_origins (location_id, origin)
values ('<attribution_location_id>', 'https://kawiarnia-karat.pl');
```

Then add `kawiarnia-karat.pl` to the Vercel project and give the client the DNS instructions. Wait 60s. Done.
