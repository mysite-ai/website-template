# 02 — Adding a client

Two patterns, both zero-code. Site is live in <5 minutes.

Before you start, verify:

1. **`mysite.social` is set up in Vercel** with wildcard entries `*.mysite.social` and `*.*.mysite.social` — see `docs/07-domain-model.md` for the full setup and the TLS caveat for the nested wildcard.
2. **CORS 60-second cache lag** — every hostname you add must ALSO be inserted into `attribution-autopilot`'s `location_origins`. `LocationsService.getAllOriginsCached()` caches the origin list for 60 seconds, so wait ~60s after the INSERT before smoke-testing `/promocja` or CORS will fail with a confusing error.

> Need to *change* things on an existing tenant (colors, menu, images, promo)? That's `docs/08-managing-tenants.md`. This doc is only about **onboarding a new tenant**.

## Pattern A — Single-location (e.g. Sawa Sushi)

For single-location clients `brand.slug === location.slug` so the two concepts collapse. The hostname is `<slug>.mysite.social`.

### Step 1 — `website-template` Supabase

```sql
-- 1. Org
insert into template_organizations (slug, name)
values ('sawa', 'Sawa Sushi LLC')
returning id;
-- ⇒ ORG_ID

-- 2. Brand (brand.slug === location.slug for single-location)
insert into template_brands (org_id, slug, name, tagline, about_md, theme)
values (
  'ORG_ID', 'sawa', 'Sawa Sushi',
  'Neighborhood sushi bar — hand-cut rolls, seasonal specials.',
  'About us...\n\nSecond paragraph.',
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
  'BRAND_ID', 'sawa', 'Sawa Sushi',
  '888 W Foothill Blvd', 'Azusa', 'CA', '91702', 'US',
  34.1336, -117.9076,
  '+16265551234', 'hi@sawasushi.example',
  'Mon–Fri 11:00 – 22:00', 'Sat–Sun 12:00 – 23:00',
  'https://www.google.com/maps/embed?pb=...',
  'Sawa Sushi, 888 W Foothill Blvd, Azusa',
  'https://instagram.com/sawasushi', null,
  '[{"name":"DoorDash","url":"https://doordash.com/store/..."}]'::jsonb,
  '<promo_uuid_from_attribution>',
  '<campaign_uuid_from_attribution>',
  '<org_uuid_from_attribution>',
  '<location_uuid_from_attribution>',  -- ← used for CORS in step 2
  '01912345abcd', ARRAY['<pixel_id>']::text[],
  '[{"src":"https://.../hero.jpg","alt":"Sawa Sushi"}]'::jsonb,
  '{"version":1,"currency_default":"USD","categories":[]}'::jsonb  -- see 05-supabase-schema.md
)
returning id;
-- ⇒ LOCATION_ID

-- 4. Domain(s) — hostnames are exact-match, no www stripping.
insert into template_domains (hostname, location_id, is_primary, kind) values
  ('sawa.mysite.social',    'LOCATION_ID', true,  'mysite_single'),
  ('sawasushi.com',     'LOCATION_ID', false, 'custom'),
  ('www.sawasushi.com', 'LOCATION_ID', false, 'custom');  -- separate row for www
```

### Step 2 — `attribution-autopilot` Supabase

For **each** hostname above, insert into `location_origins`:

```sql
insert into location_origins (location_id, origin) values
  ('<attribution_location_id from step 1>', 'https://sawa.mysite.social'),
  ('<attribution_location_id from step 1>', 'https://sawasushi.com'),
  ('<attribution_location_id from step 1>', 'https://www.sawasushi.com');
```

**Do not** touch `DEFAULT_ALLOWED_ORIGIN_PATTERNS` in `src/common/origin-allowlist.ts` — that path requires a backend redeploy and defeats zero-code onboarding.

⚠️ Wait ~60 seconds before smoke-testing `/promocja` (CORS cache lag).

### Step 3 — DNS + Vercel

- `sawa.mysite.social` — covered by the wildcard `*.mysite.social`. Nothing to do.
- `sawasushi.com` — in Vercel dashboard, add `sawasushi.com` (and `www.sawasushi.com`) to the `website-template` project. Ask the client to CNAME `www.sawasushi.com` → `cname.vercel-dns.com` and A-record `sawasushi.com` to Vercel's IPs (Vercel prints them in the UI).

## Pattern B — Multi-location (e.g. Your Pie brand with Azusa location)

Same three steps; the differences are (a) the domain shape uses two labels and (b) `brand.slug !== location.slug`.

### Step 1 — `website-template` Supabase

```sql
insert into template_organizations (slug, name) values ('yourpie', 'Your Pie Inc.') returning id;
-- ⇒ ORG_ID

insert into template_brands (org_id, slug, name, tagline, about_md)
values ('ORG_ID', 'yourpie', 'Your Pie', 'Neapolitan-style pizza, your way.', 'About...')
returning id;
-- ⇒ BRAND_ID

-- One row PER location
insert into template_locations (brand_id, slug, name, /* ... same fields ... */)
values ('BRAND_ID', 'azusa', 'Your Pie Azusa', /* ... */)
returning id;
-- ⇒ AZUSA_ID

insert into template_domains (hostname, location_id, is_primary, kind) values
  ('azusa.yourpie.mysite.social', 'AZUSA_ID', true,  'mysite_multi'),
  ('azusa.yourpie.com',       'AZUSA_ID', false, 'custom');
```

**Do NOT** insert a row for `yourpie.mysite.social` (bare brand root). The schema blocks it — the `template_domains_validate` trigger rejects `<slug>.mysite.social` unless `kind='mysite_single'`. Users hitting `yourpie.mysite.social` see a 404.

### Step 2 — `attribution-autopilot` Supabase

```sql
insert into location_origins (location_id, origin) values
  ('<azusa attribution_location_id>', 'https://azusa.yourpie.mysite.social'),
  ('<azusa attribution_location_id>', 'https://azusa.yourpie.com');
```

### Step 3 — DNS + Vercel

- `azusa.yourpie.mysite.social` — covered by `*.*.mysite.social` IF Vercel-issued TLS supports a two-label wildcard on the same project. If not, restructure to flat `azusa-yourpie.mysite.social` (single-level wildcard, no code change needed).
- `azusa.yourpie.com` — add to Vercel project, client CNAMEs.

## Adding an alias domain later

One row insert. That's it.

```sql
insert into template_domains (hostname, location_id, is_primary, kind)
values ('order.sawasushi.com', '<sawa location_id>', false, 'custom');

insert into location_origins (location_id, origin)
values ('<attribution_location_id>', 'https://order.sawasushi.com');
```

Then add `order.sawasushi.com` to the Vercel project and give the client the DNS instructions. Wait 60s. Done.
