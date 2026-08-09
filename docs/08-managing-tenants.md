# 08 — Managing tenants

How to change what a specific restaurant site looks like — colors, logo, menu, hours, images, promo — without a code deploy. All state lives in the `website-template` Supabase project (`tkltfqshwwxykxhxthem`). Changes are visible within 60 seconds (tenant resolver LRU TTL).

## Where the data lives

| Concept | Table | Notes |
| --- | --- | --- |
| Client account | `template_organizations` | 1 row per client (e.g. "White Bear Coffee LLC"). Owns `default_locale`. |
| Brand | `template_brands` | 1 row per brand. Owns `logo_url`, `theme` (colors), `tagline`, `about_md`. |
| Physical location | `template_locations` | 1 row per venue. Owns `address_line`, `phone`, `hours`, `menu`, `gallery`, `attribution_*` FKs to loyalty API. |
| Hostname → tenant | `template_domains` | The routing table. One row per hostname. |

Rule of thumb: **if two locations share the same look-and-feel, they share a brand**. If they have separate look-and-feel and separate loyalty programs, they're separate brands (with separate rows in `template_brands`).

## How to make changes

Two supported ways:

### Option A — Supabase Studio (recommended for non-devs)

1. Open [Supabase Studio](https://supabase.com/dashboard/project/tkltfqshwwxykxhxthem/editor) for the `website-template` project.
2. Pick the table (`template_brands`, `template_locations`, etc.).
3. Filter to your tenant, click the row, edit the column, hit Save.
4. Wait ~60 seconds for the tenant resolver LRU cache to expire. The site picks up the change on the next request.

### Option B — SQL (for scripted or bulk changes)

Run against the same project via the Supabase SQL editor or `psql`. Every example in this doc is copy-pasteable SQL — modify the `slug = 'demo'` clause to target your tenant.

---

## Change the brand colors

Only two colors are per-tenant: **primary** and **primary-foreground**. Everything else (grays, borders, muted, card backgrounds) stays MySite grayscale to keep the whole product family visually consistent.

```sql
-- Burgundy brand
update template_brands
   set theme = '{
     "primary": "oklch(0.38 0.11 20)",
     "primary_foreground": "oklch(0.98 0.01 20)"
   }'::jsonb
 where slug = 'demo'
   and org_id in (select id from template_organizations where slug = 'mysite-demo');
```

Values are OKLCH (matches shadcn base-nova). Pick something with:

- **Primary**: any hue and chroma. Aim for `L` around `0.30–0.50` for a dark, premium banner or `0.65–0.85` for a bright, energetic banner.
- **Primary-foreground**: contrasts with primary. For dark primary (L < 0.5), use `oklch(0.98 0.01 <same-hue>)` (near-white). For light primary (L > 0.7), use `oklch(0.15 0.02 <same-hue>)` (near-black).

Where the color shows up:
- **`/` (landing)** — the big PromoBanner card (`bg-primary`, text-primary-foreground)
- **All routes** — primary CTA buttons (`Save to photos`, `Save number`, `Directions`)
- **All routes** — the phone-input focus ring
- **Loyalty QR flow** — active reward "Show this code at the counter" hint text

Where it explicitly **does NOT** show up (by design):
- Nav pill in header — uses `secondary` (muted gray) so it doesn't compete with the primary CTA
- Category tabs on `/menu` — same reasoning, `secondary`
- Cards, muted labels, hours, delivery links — all stay grayscale

**Reset to default:**

```sql
update template_brands set theme = '{}'::jsonb where slug = 'demo';
```

## Change the logo

Uploaded logos live in Supabase Storage under the public `assets` bucket. Path convention: `logos/<brand-slug>.png` (or `.svg`).

### Upload via Supabase Studio

1. Storage → `assets` → `logos/` → **Upload files**
2. Drop your PNG or SVG (max 10MB, allowed: png/jpeg/webp/svg)
3. Copy the public URL from the file's context menu
4. Paste into `template_brands.logo_url`:

```sql
update template_brands
   set logo_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/my-cafe.png'
 where slug = 'my-cafe';
```

### Upload via curl (for automation)

```bash
SUPABASE_URL="https://tkltfqshwwxykxhxthem.supabase.co"
SERVICE_KEY="<paste service_role key from Supabase dashboard>"

# Upload
curl -X POST "$SUPABASE_URL/storage/v1/object/assets/logos/my-cafe.png" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary @./my-cafe-logo.png

# The public URL is:
echo "$SUPABASE_URL/storage/v1/object/public/assets/logos/my-cafe.png"
```

Then set `template_brands.logo_url` to that URL.

Design constraints:
- Aim for a **square-ish crop** — the Hero renders it at 80–96px, the /promocja header row at 32px, the footer at 56px. All use `object-contain`, so transparency and aspect ratio are preserved.
- **Transparent background** looks best against the light card surface.
- **PNG or SVG** — SVG scales better on high-DPI, but PNG is fine at ~1500×1000.

If `logo_url` is `NULL`, the template falls back to a colored square with the brand's first letter — driven by `--primary` so it inherits the brand color.

## Change the favicon

Every page emits `<link rel="icon">` + `<link rel="apple-touch-icon">` pointing at the brand's favicon. Resolution order:

1. `template_brands.favicon_url` — the per-brand override
2. `template_brands.logo_url` — falls back to the main logo (browsers scale to 32px automatically)
3. `/favicon.svg` — the generic MySite default shipped in the template's `public/` folder

Convention for uploaded favicons: `assets/favicons/<brand-slug>.svg` in Supabase Storage.

### Upload via curl (SVG recommended — scales perfectly)

```bash
SUPABASE_URL="https://tkltfqshwwxykxhxthem.supabase.co"
SERVICE_KEY="<paste service_role key>"

# 64x64 SVG works everywhere — Chrome/Safari/Firefox/mobile
curl -X POST "$SUPABASE_URL/storage/v1/object/assets/favicons/my-cafe.svg" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: image/svg+xml" \
  -H "x-upsert: true" \
  --data-binary @./favicon.svg

# Then wire it up
update template_brands
   set favicon_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/my-cafe.svg'
 where slug = 'my-cafe';
```

### Quick-start template — colored square with brand initial

Copy-paste this SVG, swap the two OKLCH values to match the brand's primary + primary-foreground, and change the letter:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="oklch(0.68 0.17 40)"/>
  <text x="32" y="42" text-anchor="middle"
        font-family="Geist, -apple-system, sans-serif"
        font-weight="700" font-size="32" fill="#fff">W</text>
</svg>
```

This is exactly how the three seeded tenants (WBC, Stacks, Doublz) got their favicons — each is 64×64 SVG using their brand colors.

## Change the tagline and About text

```sql
update template_brands
   set tagline  = 'Specialty coffee and locally-baked pastries in Warsaw.',
       about_md = E'We opened in 2019 with a simple idea: coffee this good deserves a warm room to enjoy it in.\n\nOur beans are roasted weekly two blocks from the shop.'
 where slug = 'demo';
```

- `tagline` is shown on the landing hero right under the location caption. Aim for ~60–80 chars, one line.
- `about_md` is a **plain-text** field. Newlines survive (rendered with `whitespace-pre-line`). Markdown is NOT parsed — no bold, no links, no bullets. Keep it prose.

## Change hours

Free-form display strings — the template doesn't parse them, just renders. Convention: `HH:MM – HH:MM`.

```sql
update template_locations
   set weekday_hours = '07:00 – 22:00',
       weekend_hours = '08:00 – 23:00'
 where slug = 'demo'
   and brand_id in (select id from template_brands where slug = 'demo');
```

If either column is `NULL`, that row is hidden in the Hours card. If both are `NULL`, the entire card is hidden.

## Change address + map + phone + email

```sql
update template_locations
   set address_line      = 'Marszalkowska 87',
       city              = 'Warsaw',
       region            = 'Mazowieckie',
       postal_code       = '00-683',
       country           = 'PL',
       latitude          = 52.2214,
       longitude         = 21.0154,
       phone             = '+48533444555',
       email             = 'hello@example.com',
       maps_search_query = 'The White Bear Coffee, Marszalkowska 87, Warsaw',
       maps_embed_url    = 'https://www.google.com/maps/embed?pb=...'
 where slug = 'demo';
```

To get a `maps_embed_url`: open [Google Maps](https://maps.google.com/), find the place, click **Share → Embed a map → Copy HTML**, and paste the value of the `src=` attribute (not the whole `<iframe>` tag).

`maps_search_query` is what "Directions" button uses — it's URL-encoded into `https://www.google.com/maps/search/?api=1&query=<query>`.

## Change social links

```sql
update template_locations
   set instagram_url = 'https://instagram.com/mycafe',
       facebook_url  = 'https://facebook.com/mycafe'
 where slug = 'demo';
```

If either is `NULL`, that icon is hidden. If both are `NULL`, the socials row is hidden.

## Change delivery providers

```sql
update template_locations
   set delivery = '[
     {"name":"Wolt",      "url":"https://wolt.com/en/pol/warsaw/venue/mycafe"},
     {"name":"Glovo",     "url":"https://glovoapp.com/pl/en/warsaw/mycafe"},
     {"name":"Pyszne.pl", "url":"https://www.pyszne.pl/menu/mycafe"}
   ]'::jsonb
 where slug = 'demo';
```

Any 1–N entries render as a divide-y list card. Empty array `[]` hides the section.

## Change the gallery

```sql
update template_locations
   set gallery = '[
     {"src":"https://images.unsplash.com/photo-XXXX?w=1600&h=1000&fit=crop&auto=format&q=80", "alt":"Warm dining room"},
     {"src":"https://…", "alt":"Latte art close-up"},
     {"src":"https://…", "alt":"Avocado toast"},
     {"src":"https://…", "alt":"Pasta plating"},
     {"src":"https://…", "alt":"Salad overhead"},
     {"src":"https://…", "alt":"Craft cocktails"}
   ]'::jsonb
 where slug = 'demo';
```

**Layout** (see `src/components/sections/Gallery.astro`):
- Image 1 → 16:9 featured tile at top, full width
- Images 2–4 → 3-column square row
- Images 5–6 → 2-column landscape row

For custom uploads, put them in Supabase Storage under `assets/gallery/<tenant-slug>/` and use the public URL. Unsplash `?w=…&h=…&fit=crop&auto=format&q=80` URLs are fine for placeholders.

## Change the menu

The `menu` column is a JSONB blob validated by `src/lib/menu/parse.ts` (zod). If validation fails, `/menu` falls back to "Menu coming soon" — no crash, but no menu either. See `docs/05-supabase-schema.md` for the schema.

Minimal example:

```sql
update template_locations
   set menu = '{
     "version": 1,
     "currency_default": "USD",
     "categories": [
       {
         "id": "coffee",
         "name": "Coffee",
         "description": "Locally roasted, single-origin.",
         "items": [
           {"id":"flat-white","name":"Flat White","description":"Double ristretto, silky steamed milk.","price":{"amount":5,"currency":"USD"}},
           {"id":"cortado","name":"Cortado","price":{"amount":4.5,"currency":"USD"}}
         ]
       }
     ]
   }'::jsonb
 where slug = 'demo';
```

Constraints (validator will reject otherwise):
- `version` MUST be `1`.
- `currency_default` and every `price.currency` MUST be `"PLN" | "EUR" | "USD"`.
- Every category and item needs a stable `id` (URL-safe slug) and a `name`.
- `price` is optional — omit for market-price items (renders "Market").
- Allowed `tags`: `"vegan" | "vegetarian" | "gluten-free" | "spicy" | "new"`.

## Change the promo (loyalty program)

The promo displayed on `/` (banner) and `/promocja` (full flow) is driven by two things:

1. **The FK columns on `template_locations`**: `attribution_promotion_id`, `attribution_campaign_id`, `attribution_org_id`, `attribution_location_id`. These are UUIDs in the **separate** `attribution-autopilot` Supabase project (see `docs/04-attribution-integration.md`).
2. **Cached display strings on `template_locations`**: `promotion_name_cached`, `reward_description_cached`. Rendered pre-reveal, before the visitor clicks and we know the real promo name.

Swap to a different promo:

```sql
update template_locations
   set attribution_promotion_id  = '<new-promotion-uuid>',
       attribution_campaign_id   = '<new-campaign-uuid>',
       attribution_org_id        = '<new-org-uuid>',
       attribution_location_id   = '<new-location-uuid>',
       promotion_name_cached     = 'Summer 2026 Coffee Card',
       reward_description_cached = 'Free cortado on your 5th visit'
 where slug = 'demo';
```

The four attribution UUIDs must exist in the `attribution-autopilot` project **and** the hostname must be allow-listed in `attribution-autopilot.location_origins` (see `docs/04-attribution-integration.md`) or the CORS preflight fails.

**Unset the promo** (banner and /promocja become "not configured"):

```sql
update template_locations
   set attribution_promotion_id  = NULL,
       attribution_campaign_id   = NULL,
       attribution_org_id        = NULL,
       attribution_location_id   = NULL,
       promotion_name_cached     = NULL,
       reward_description_cached = NULL
 where slug = 'demo';
```

## Change the default locale

Right now the template is English-only in UI copy (see `src/lib/attribution/useAttribution.ts` error strings, `src/components/promo/PromoFlow.tsx`, etc.), but the `<html lang>` attribute is per-tenant:

```sql
update template_organizations
   set default_locale = 'pl'
 where slug = 'my-polish-cafe';
```

Impact today: sets `<html lang="pl">` (helps browsers with hyphenation, spellcheck, and screen readers). Full i18n (translating the UI copy) is a future feature — see `docs/06-developer-guide.md`.

## Add or remove a hostname

**Add** a custom domain to an existing tenant:

```sql
-- 1. website-template Supabase
insert into template_domains (hostname, location_id, is_primary, kind)
values ('menu.karat.pl', '<karat_location_id>', false, 'custom');

-- 2. attribution-autopilot Supabase — critical for CORS!
insert into location_origins (location_id, origin)
values ('<karat_attribution_location_id>', 'https://menu.karat.pl');
```

Then in Vercel: **Domains → Add** → `menu.karat.pl` → ask the client to CNAME to `cname.vercel-dns.com`. Wait ~60s after the SQL inserts for the LRU cache to refresh.

**Remove** a hostname:

```sql
delete from template_domains where hostname = 'menu.karat.pl';
-- attribution-autopilot origin can stay — it's a whitelist, not a hard binding
```

Detach from Vercel: **Domains → menu.karat.pl → Remove**.

**Change the primary domain** (which URL is canonical for SEO / JSON-LD):

```sql
update template_domains set is_primary = false
 where location_id = '<karat_location_id>' and is_primary;

update template_domains set is_primary = true
 where hostname = 'karat.pl';
```

The partial unique index `template_domains_one_primary_per_location` enforces one primary per location — the `update` above needs to run in two statements (unset old, set new) or wrap in a transaction.

## Delete a tenant

```sql
delete from template_organizations where slug = 'my-cafe';
-- cascades → template_brands → template_locations → template_domains
```

Removing a tenant from the DB is enough — no need to touch Vercel or attribution-autopilot right away. The hostname will start returning 404 within 60 seconds.

If the tenant had a custom domain attached to the Vercel project, detach it separately (Vercel → Domains → **Remove**) or the DNS keeps resolving to a 404.

## Verifying a change

After any DB update:

```bash
# Wait 60s for LRU cache to expire, then curl:
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://karat.mysite.social/
curl -s https://karat.mysite.social/ | grep -oE '(brand-name|tagline-substring|expected-color-token)'
```

For a **hard cache flush without waiting**, push any commit to `main` — Vercel redeploys, spawns new serverless instances with empty caches, and the change appears immediately.

## Common mistakes

- **Editing `template_brands.theme` and not seeing the color change** → likely you're testing within 60s of the update. Wait, or trigger a redeploy.
- **Attribution IDs updated but /promocja still shows old promo name** → check `promotion_name_cached` on the location row. The cache is denormalized and doesn't auto-refresh from attribution-autopilot; you have to update it manually.
- **Custom domain added but CORS error on /promocja** → forgot the `location_origins` insert in attribution-autopilot. `LocationsService.getAllOriginsCached()` in attribution has its own 60s cache, so wait after inserting.
- **Menu JSON edit rejected → "Menu coming soon"** → zod parse failed. Check the DB row against the schema in `src/lib/menu/types.ts`. Common causes: missing `id` or `name` on a category/item, unrecognized tag, wrong currency string.
- **Trying to make `doublz.mysite.social` load** (bare brand root) → this is 404 by design. The trigger in migration 011 rejects the insert. Use `<location>.doublz.mysite.social` instead.
