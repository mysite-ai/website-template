# Product Requirements — MySite Restaurant Website Platform

**Audience**: Product owner / new implementers who need to understand *what* the platform does and *why*, without reading every line of code.

**Status**: This document mirrors the current live implementation. Every requirement links to the file(s) where it lives, so anyone can jump from "the product needs X" straight to "here's how X is built today." Use it as the single source of truth for scope discussions, roadmap conversations, and onboarding new engineers.

**Naming**: We call it "the platform" here for brevity. Everywhere else it's referred to as the *website template*.

---

## 1. The one-sentence pitch

> **Any restaurant that has an owner with a phone can go from "no website" to "live paid-ad landing page" in under 5 minutes** — because everything that makes a site unique (logo, colors, menu, address, hours, delivery links, loyalty program) is data in Supabase, not code, and one deploy serves every tenant.

Everything below is a requirement in service of that pitch.

---

## 2. Core operating principles

These are load-bearing constraints. If any of them is broken, the platform is no longer the platform.

### 2.1 One codebase, many tenants
- A single Astro app is deployed once to Vercel. It serves **every restaurant** we onboard.
- The rendered site is chosen at request time by looking up the incoming hostname in Supabase.
- **Implementation**: [src/middleware.ts](../src/middleware.ts), [src/lib/tenant/resolve.ts](../src/lib/tenant/resolve.ts), tables `template_domains` → `template_locations` → `template_brands` → `template_organizations` ([supabase/migrations/001_template_orgs_brands_locations.sql](../supabase/migrations/001_template_orgs_brands_locations.sql)).

### 2.2 No code deploys to onboard a client
- Adding a new restaurant is **two SQL inserts** (brand row + location row, plus one domain row per hostname) and **one Vercel dashboard click** (attach the custom domain).
- No branches, no PRs, no environment variables per client.
- **Docs**: [docs/02-adding-a-client.md](02-adding-a-client.md).

### 2.3 No hardcoded per-tenant behaviour in the codebase
- Every branded element (logo, colors, favicon, copy, prices, hours, gallery, delivery providers, loyalty rewards) reads from the database at request time.
- The template ships **defaults** in components; per-tenant values only exist as **optional overrides** in Supabase.
- **Rule of thumb**: if adding a client requires touching code, that's a bug.

### 2.4 Fast landing pages
- The template targets **Lighthouse mobile Performance ≥ 95** and **SEO 100** out of the box. Marketing landings paid-ad traffic hits must not feel slow.
- **How**: static rendering by default, interactive React "islands" only where needed (menu tabs, gallery lightbox, QR flow), server-side Markdown, all images pre-cropped and served through Supabase Storage CDN.
- **Implementation**: hydration strategy documented in [docs/01-architecture.md](01-architecture.md).

### 2.5 Meta-ad-safe by default
- The rewards page (`/rewards`) is a paid-traffic destination. Every element on it — chip, CTA, QR reveal, phone form, disabled button state — is designed to not look janky when a Meta ad drops a stranger onto it.
- Legacy `/promocja` URL keeps working via a permanent redirect so old ad creatives never break.
- **Implementation**: [src/pages/rewards.astro](../src/pages/rewards.astro), redirect in [vercel.json](../vercel.json).

---

## 3. What a tenant is

A **tenant** is a single restaurant location as far as the platform is concerned. Tenants have a three-tier structure:

```
Organization  →  Brand  →  Location  →  Domain(s)
"White Bear      "White      "Marszalkowska"     whitebear.mysite.social
 Coffee LLC"     Bear         (Warsaw)           thewhitebearcoffee.pl
                 Coffee"                          promocja.thewhitebearcoffee.pl
```

- **Organization** = the client account. Owns their default locale.
- **Brand** = the visual identity + copy that repeats across locations (logo, tagline, brand color, about story, favicon). One brand can have many locations that all look the same.
- **Location** = the physical venue. Owns address, phone, hours, menu, gallery, delivery links, loyalty program IDs, Google reviews chip, and Meta Pixel IDs.
- **Domain** = every hostname that resolves to this location. One location can have many domains (subdomain + custom domain + legacy redirects).

**Why this shape**: it maps 1:1 to how restaurant clients actually run — a brand with 8 locations shares one look and one about story, but each venue has its own address, phone, and hours.

- **Schema**: [supabase/migrations/001_template_orgs_brands_locations.sql](../supabase/migrations/001_template_orgs_brands_locations.sql), [supabase/migrations/002_template_domains.sql](../supabase/migrations/002_template_domains.sql).
- **Full ER diagram**: [docs/05-supabase-schema.md](05-supabase-schema.md).

---

## 4. What an operator can change without a code deploy

This is the exhaustive list of everything the operator (person running Supabase Studio) can change and have it reflect on the live site within ~60 seconds (tenant resolver cache TTL).

### 4.1 Brand identity

| Requirement | Where it lives |
| --- | --- |
| I want to upload two logo variants — a wide wordmark for the hero, and a compact mark for the sticky nav — because most brands have both. | Columns `template_brands.logo_url` + `template_brands.logo_url_nav`. Header prefers `logo_url_nav`, falls back to `logo_url`. Files live in Supabase Storage under `assets/logos/<slug>.png`. Code: [src/components/layout/Header.astro](../src/components/layout/Header.astro), [src/components/sections/Hero.astro](../src/components/sections/Hero.astro). |
| I want to override logo height per tenant when the default looks wrong for my particular mark. | Columns `template_brands.logo_header_height`, `template_brands.logo_hero_max_height` (both nullable — `NULL` means "use the template default of 56 px / 200 px"). See [docs/08-managing-tenants.md](08-managing-tenants.md) "Adjust logo size." |
| I want to change the primary brand color and its foreground with one SQL update — everything themed (CTA buttons, rewards banner, links) rebrands instantly. | Column `template_brands.theme` (JSONB with `primary` + `primary_foreground` OKLCH values). Injected as CSS custom properties via [src/components/layout/BrandStyleTag.astro](../src/components/layout/BrandStyleTag.astro). |
| I want a favicon that matches my brand, uploaded once. | Column `template_brands.favicon_url`. Automatically falls back to `logo_url_nav` → `logo_url` → generic MySite icon. Renders in `<link rel="icon">` and `<link rel="apple-touch-icon">`. Code: [src/layouts/BaseLayout.astro](../src/layouts/BaseLayout.astro). |
| I want a short tagline under my hero H1 that says what my place is about. | Column `template_brands.tagline` (plain text). |
| I want an "About" section with formatting — bold, italic, links, paragraph breaks — because my story is more than one sentence. | Column `template_brands.about_md` (Markdown). Rendered server-side by `marked` — no JS shipped to clients. Code: [src/components/sections/About.astro](../src/components/sections/About.astro). |

### 4.2 Location details

| Requirement | Where it lives |
| --- | --- |
| I want to change my street address, city, region, postal code, country. | Columns on `template_locations`: `address_line`, `city`, `region`, `postal_code`, `country`. Rendered in Contact section, Footer, and structured-data JSON-LD. |
| I want to update my phone and email in one place — they show in the header pill, the contact section, and the footer. | Columns `phone`, `email` on `template_locations`. Phone gets locale-aware formatting (`+48 500 100 200` vs `+1 555 123 4567`) via [src/lib/utils.ts](../src/lib/utils.ts). |
| I want to change my opening hours. Weekday + weekend, plain strings — no calendar picker required. | Columns `weekday_hours`, `weekend_hours` on `template_locations` (plain text like `"Mon–Fri 07:00 – 22:00"`). Rendered in Contact section. |
| I want to embed a map of my location without paying for a Google Maps API key. | Column `maps_embed_url` on `template_locations`. Template renders whatever iframe URL you give it — we default new tenants to OpenStreetMap (free, no key, no watermark). "Directions" button deep-links to Google Maps via `maps_search_query`. Code: [src/components/sections/Contact.astro](../src/components/sections/Contact.astro). |
| I want a Google-reviews chip under my H1 (`4.8 ★★★★★ · 512 reviews`) when I've got real numbers to show off — but only when I've actually got them. | Columns `google_rating`, `google_reviews_count`, `google_place_url` on `template_locations`. The chip only renders when both rating and count are non-null (fake ratings are a policy no-no — see [docs/08-managing-tenants.md](08-managing-tenants.md) "Add Google reviews rating"). Code: [src/components/sections/Hero.astro](../src/components/sections/Hero.astro). |
| I want to link my Instagram and Facebook. Icons show in the footer, nowhere else. | Columns `instagram_url`, `facebook_url` on `template_locations`. Missing links get their icon hidden individually; if both are missing the socials row disappears. Code: [src/components/layout/Footer.astro](../src/components/layout/Footer.astro). |

### 4.3 Menu

| Requirement | Where it lives |
| --- | --- |
| I want to publish a menu with categories, items, prices, descriptions, tags (vegan, vegetarian, gluten-free, spicy, new), and optional per-item images. | Column `menu` on `template_locations` (JSONB blob, schema validated by Zod). See [src/lib/menu/types.ts](../src/lib/menu/types.ts), [src/lib/menu/parse.ts](../src/lib/menu/parse.ts). |
| I want prices to render in my currency's local format automatically — `36 zł`, `€14.00`, `$14.00` — based on the currency I set on each item. | `formatMoney()` picks a locale from the currency code (PL → `pl-PL`, EUR → `de-DE`, USD → `en-US`). Callers can override. Code: [src/lib/menu/parse.ts](../src/lib/menu/parse.ts). |
| I want a menu preview on the home page (3 categories, item count, first two items per category, "View full menu" CTA) and a full menu at `/menu`. | Home preview: [src/components/sections/MenuPreview.astro](../src/components/sections/MenuPreview.astro). Full menu with sticky category tabs + scroll-spy: [src/components/menu/MenuBrowser.tsx](../src/components/menu/MenuBrowser.tsx), [src/pages/menu.astro](../src/pages/menu.astro). |

### 4.4 Gallery

| Requirement | Where it lives |
| --- | --- |
| I want to upload up to 8 photos of my restaurant and have them auto-lay out cleanly (2 cols mobile, 4 cols desktop) without orphaned rows. | Column `gallery` on `template_locations` (JSONB array of `{src, alt}`). Home page caps at 8 photos and picks a grid that always fills the last row cleanly. Code: [src/components/sections/Gallery.astro](../src/components/sections/Gallery.astro), [src/components/sections/GalleryBrowser.tsx](../src/components/sections/GalleryBrowser.tsx). |
| I want tapping a photo to open a fullscreen lightbox with keyboard nav (arrows, escape) and a proper photo counter. | GalleryBrowser lightbox is a purpose-built dialog (not shadcn) with body-scroll lock, `1/N` counter, and self-healing broken-image handling. |
| I want to serve smaller image variants to smaller screens so mobile users don't download the 1600-wide originals. | The lightbox auto-generates `srcset` from filenames matching the `-800w.webp` convention (see migration 022) so browsers pick the right size. |

### 4.5 Contact + delivery

| Requirement | Where it lives |
| --- | --- |
| I want a Contact section with two columns on desktop (address + hours + phone + email on the left, map on the right) — matches how Kinoko-style local sites do it. | [src/components/sections/Contact.astro](../src/components/sections/Contact.astro). |
| I want a list of delivery providers with their real brand logos (Wolt, Glovo, Pyszne.pl, Uber Eats, DoorDash, Grubhub, Bolt). Ordering matters — first entry drives the "Order online" quick action. | Column `delivery` on `template_locations` (JSONB array of `{name, url}`). Logos are pre-fetched from logo.dev and shipped statically in [public/logos/delivery](../public/logos/delivery). Unknown providers gracefully fall back to a colored monogram. Code: [src/components/sections/Delivery.astro](../src/components/sections/Delivery.astro). Refresh script: [scripts/download-delivery-logos.sh](../scripts/download-delivery-logos.sh). |
| I want quick-action tiles below the hero that adapt to what my restaurant needs — sushi bar wants "Book a table + Call", fast-casual wants "Order + Directions", coffee shop wants "Directions + Website". | Column `template_locations.action_tiles` (JSONB array of `{type, href, label?}`). Supported types: `call`, `directions`, `order`, `book`, `reserve`, `website`, `whatsapp`, `email` — each with a hardcoded icon and default label in [src/lib/action-tiles/registry.ts](../src/lib/action-tiles/registry.ts). When the column is null, the section auto-derives Directions + first Order provider from other fields. Code: [src/components/sections/QuickActions.astro](../src/components/sections/QuickActions.astro). |

### 4.6 Loyalty / rewards (paid-ad landing page) — optional

**Loyalty is opt-in per tenant.** A restaurant that doesn't run a loyalty program simply leaves `attribution_promotion_id` (and its two siblings) null. When that's the case:

- The **Rewards** nav item disappears from the sticky header ([src/components/layout/Header.astro](../src/components/layout/Header.astro)).
- The **promo banner** in the Hero doesn't render ([src/components/sections/Hero.astro](../src/components/sections/Hero.astro)).
- The `/rewards` page still exists but renders an empty state ("The loyalty program isn't configured for this location yet") instead of the QR flow ([src/pages/rewards.astro](../src/pages/rewards.astro)).

Everything else on the site works normally. The QuickActions tiles (Directions / Book / Order / Call / etc.) are the primary conversion mechanism for tenants without loyalty.

| Requirement | Where it lives |
| --- | --- |
| I want a `/rewards` page that runs a QR-code loyalty flow: teaser card → reveal → save-your-number → progress tracker. | [src/pages/rewards.astro](../src/pages/rewards.astro), [src/components/promo/PromoFlow.tsx](../src/components/promo/PromoFlow.tsx). |
| I want the phone-number form to default to my country (PL, US, or anywhere) with a country picker so US customers see `+1` and PL customers see `+48`. | Country picker + libphonenumber-js validation lives in [src/components/promo/PhoneField.tsx](../src/components/promo/PhoneField.tsx). Country list + validation helpers in [src/lib/phone/config.ts](../src/lib/phone/config.ts). Default country comes from `template_locations.country`. |
| I want a promo banner on the home page hero that says "get your reward" and pulls the reward description directly from the loyalty system. | Reward name + description live in `template_locations.promotion_name_cached` / `reward_description_cached` (denormalized copy of what the attribution-autopilot API returns — see below). Banner: [src/components/promo/PromoBanner.tsx](../src/components/promo/PromoBanner.tsx). |
| I want Meta Pixel tracking so I can retarget people who landed here from a Meta ad. Optional per location — some don't run ads. | Column `meta_pixel_ids` (array) on `template_locations`. Fires `PageView`, `QRGenerated`, `Lead` events. Code: [src/lib/attribution/metaPixel.ts](../src/lib/attribution/metaPixel.ts), [src/components/attribution/MetaPixel.tsx](../src/components/attribution/MetaPixel.tsx). |
| I want the whole loyalty backend (issuing codes, saving phones, tracking visits) to live in a separate service so this website is just a thin skin over it. | Backend = `attribution-autopilot` (a separate NestJS + Supabase project). Contract documented in [docs/04-attribution-integration.md](04-attribution-integration.md). Client code: [src/lib/attribution/*](../src/lib/attribution/). |

---

## 5. What the platform renders (page by page)

Four routes, no more, no less. Everything else is a redirect or 404.

### 5.1 `/` — Home (marketing landing)

The primary destination for organic traffic and social profile links. In section order:

1. **Header** — sticky, blurred-glass background. Logo (mark or wordmark), nav pills (Home / Menu / Rewards), phone-CTA button on the right. Height auto-fits the logo. [src/components/layout/Header.astro](../src/components/layout/Header.astro).
2. **Hero** — full-bleed pastel gradient band tinted with the brand color. Big logo, H1, region eyebrow, optional Google rating chip, tagline, and (if loyalty is configured) the promo banner. [src/components/sections/Hero.astro](../src/components/sections/Hero.astro).
3. **QuickActions** — up to 2 tiles: Directions + Order online. Auto-hides tiles that don't have config. [src/components/sections/QuickActions.astro](../src/components/sections/QuickActions.astro).
4. **Gallery** — full-width breakout to ~1120 px on desktop, 4 columns × 2 rows. [src/components/sections/Gallery.astro](../src/components/sections/Gallery.astro).
5. **Contact** — 2-column on desktop: address/hours/phone/email on the left, embedded map on the right. [src/components/sections/Contact.astro](../src/components/sections/Contact.astro).
6. **MenuPreview** — 3 categories + item counts + "View full menu". [src/components/sections/MenuPreview.astro](../src/components/sections/MenuPreview.astro).
7. **About** — Markdown-rendered brand story. [src/components/sections/About.astro](../src/components/sections/About.astro).
8. **Delivery** — vertical list of providers, each with its real brand logo + `↗` icon. [src/components/sections/Delivery.astro](../src/components/sections/Delivery.astro).
9. **Footer** — instagram/facebook icons, closing signature logo, address, © year, "powered by mysite.ai" microbrand. [src/components/layout/Footer.astro](../src/components/layout/Footer.astro).

Any section whose backing data is `NULL` or empty **hides itself entirely**. A brand without a gallery just doesn't render the Gallery section; a location without delivery doesn't render Delivery; etc.

### 5.2 `/menu` — Full menu

- Sticky category tabs at the top (pill style, dark fill on active).
- Auto-updating active tab as the user scrolls (IntersectionObserver).
- Category sections stacked below with items in a card.
- Each item: name, description, price (with currency-appropriate formatting), tags as small uppercase chips.
- Empty-state fallback "Menu coming soon" when the tenant has no menu yet.
- **Code**: [src/pages/menu.astro](../src/pages/menu.astro), [src/components/menu/MenuBrowser.tsx](../src/components/menu/MenuBrowser.tsx).

### 5.3 `/rewards` — Loyalty QR flow (formerly `/promocja`)

Three-step flow:

1. **Teaser** — big "Reveal your code" button on a mysterious blurred-QR card.
2. **Revealed** — real QR code with "Save to photos" + a phone-capture form with country picker.
3. **Done** — account chip (last two digits of phone), progress bar toward the next reward, and per-visit reward cards.

- Backed by the `attribution-autopilot` service which issues codes and stores phone numbers.
- Uses `localStorage` to persist state across visits (so returning users skip the reveal step).
- Legacy `/promocja` URL redirects here (permanent, 308). See [vercel.json](../vercel.json).
- **Code**: [src/pages/rewards.astro](../src/pages/rewards.astro), [src/components/promo/PromoFlow.tsx](../src/components/promo/PromoFlow.tsx), [src/components/promo/PhoneField.tsx](../src/components/promo/PhoneField.tsx).

### 5.4 `/404` — Not found

Minimal centered card. `noindex`. Same visual system, no per-tenant customization. [src/pages/404.astro](../src/pages/404.astro).

---

## 6. Non-functional requirements

### 6.1 Performance

- **Lighthouse mobile**: Performance ≥ 95, SEO 100 on the home page.
- **No client-side JavaScript on the marketing landing above the fold.** Everything above the promo banner is static HTML.
- **Hydration strategy** (defined in Astro):
  - `client:load` — only for the loyalty flow (PromoFlow), because it's the primary content of `/rewards`.
  - `client:visible` — for the menu browser (only hydrates when scrolled into view).
  - `client:idle` — for Meta Pixel + Umami analytics, so they never block first paint.
- **Images** — Supabase Storage-hosted, cropped tight before upload, gallery uses responsive WebP variants where available.

### 6.2 SEO

- Each page renders `<title>`, `<meta description>`, `<link rel="canonical">`, and Open Graph tags derived from the tenant.
- Structured data (`Restaurant` JSON-LD) on the home page — includes address, phone, hours, image, menu URL, geo coordinates, sameAs socials.
- Sitemap-friendly: canonical URLs always point at the primary hostname regardless of what mirror the request came in on.
- **Code**: [src/lib/seo/schema.ts](../src/lib/seo/schema.ts), rendered via [src/layouts/BaseLayout.astro](../src/layouts/BaseLayout.astro).

### 6.3 Analytics

- **Meta Pixel** — optional per location (via `meta_pixel_ids` array). Fires `PageView`, `QRGenerated`, `Lead`. See [src/lib/attribution/metaPixel.ts](../src/lib/attribution/metaPixel.ts).
- **Umami** — optional per location (via `umami_website_id`). Self-hosted, proxied through `/stats/*` (see [vercel.json](../vercel.json)). Data-attribute-driven event capture (`data-umami-event`, `data-umami-event-target`) on every CTA in the codebase.

### 6.4 Internationalization

- Site copy on the tenant side is authored in the tenant's language (Polish tenants ship Polish menu names, US tenants ship English). The template's chrome (nav labels, empty-state strings, phone format helpers) is **American English**.
- Currency formatting is auto-selected from the currency code — no per-tenant locale config needed.
- Phone country picker ships PL/US as pinned defaults and 23 more countries alphabetically. See [src/lib/phone/config.ts](../src/lib/phone/config.ts).
- Locale strings: [src/lib/tenant/types.ts](../src/lib/tenant/types.ts) `TenantOrganization.default_locale`.

### 6.5 Security + resilience

- No client-side database queries. All Supabase access is server-side using the service_role key (never exposed to browser).
- Tenant resolver caches results in an LRU with 60 s TTL — memory-safe under load.
- 404 for unknown hostnames returns clean generic template (no tenant leaks).
- Meta Pixel event IDs are deduplicated in `sessionStorage` to prevent double-counting on refresh.
- **Code**: [src/lib/supabase/server.ts](../src/lib/supabase/server.ts), [src/lib/tenant/resolve.ts](../src/lib/tenant/resolve.ts).

---

## 7. Onboarding a new client (end-to-end)

The whole workflow when a real client signs up. Everything is documented in more detail at [docs/02-adding-a-client.md](02-adding-a-client.md).

1. **Insert 3 rows in Supabase**: `template_brands`, `template_locations`, `template_domains`. The brand row carries logo + colors + about; the location row carries menu + hours + address + attribution IDs; the domain row maps a hostname to that location.
2. **Upload assets to Supabase Storage** (`assets/logos/<slug>.png`, `assets/favicons/<slug>.svg`, `assets/gallery/<slug>/*.webp`). See "Upload via curl" in [docs/08-managing-tenants.md](08-managing-tenants.md).
3. **Add the hostname in the Vercel dashboard** as a custom domain. Two wildcards (`*.mysite.social` + `*.*.mysite.social`) cover most cases without touching Vercel — see [docs/07-domain-model.md](07-domain-model.md).
4. **Insert a matching `location_origins` row** in the `attribution-autopilot` Supabase — grants CORS on the loyalty API for the new hostname. **60 s cache lag**, wait before smoke-testing `/rewards`.
5. **Point DNS** at Vercel from the registrar.
6. **Smoke test**: visit `https://<hostname>/`, `/menu`, `/rewards`. Should be live within 5 minutes end-to-end.

If any of these steps takes more than a click or an SQL insert, treat it as a platform bug.

---

## 8. What is deliberately out of scope

Things that look like they should be here but aren't — with the reasoning, so we don't accidentally add them under scope creep.

- **A CMS admin UI.** Operators change tenant data directly in Supabase Studio. No custom dashboard. Rationale: Studio is already a decent editor, and every client we onboard is manually vetted anyway. Building a CMS costs more than the value it adds.
- **Reservations / booking.** Restaurants that need reservations use a third-party (OpenTable, Resy, etc.) as one of the delivery-provider tiles. The platform is a landing page, not a booking system.
- **Multi-language rendering.** Each tenant picks one language for their copy at seed time. No per-request language switcher, no `hreflang` alternates. If a client needs bilingual, that's two brands with two hostnames.
- **User accounts on the customer side.** The loyalty flow uses phone number as an implicit account (no login). Rationale: friction kills conversion on paid ad traffic.
- **A shopping cart.** Ordering happens off-site via the delivery-provider tile links (Wolt, Uber Eats, etc.). We are not a POS.

---

## 9. If someone rebuilds this from scratch — the minimum viable stack

This is the shopping list Damian (or any future implementer) can use to know "have I got everything I need?"

### Runtime

- **Frontend framework** with server rendering + partial hydration ("islands"). We use [Astro](https://astro.build). Next.js would work; Nuxt would work; Rails+Turbo would work.
- **Hosting** with per-request server-side rendering + custom domain support + wildcard DNS. We use [Vercel](https://vercel.com). Cloudflare Pages / Netlify / Fly all fit.
- **Database + object storage + row-level auth** as one service. We use [Supabase](https://supabase.com). Firebase, Neon+S3, or a Postgres+MinIO combo all work.

### Backends the platform depends on

- The **loyalty backend** (`attribution-autopilot`) is a separate service you must run alongside. It owns: user records, QR code generation, phone linking, visit tracking, Meta CAPI, SMS. Documented in [docs/04-attribution-integration.md](04-attribution-integration.md). If you rebuild from scratch, budget for this as its own project.
- **Analytics**: a Meta Pixel account + a Umami (or Plausible, or Fathom) instance. Both optional per tenant.
- **Logo API** for pre-fetching delivery provider marks. We use [logo.dev](https://logo.dev). Manual PNG downloads would work too — just automate the fetch.

### Design system

- Tailwind CSS v4 + shadcn/ui primitives (Card, Button, Input, Dialog).
- OKLCH color tokens for consistent perceived brightness across brand colors.
- Geist Variable font (self-hosted via `@fontsource-variable/geist`).
- One design-token file + one composition layer — see [docs/03-design-system.md](03-design-system.md).

### Libraries worth calling out

- **`marked`** — Markdown for the About section.
- **`libphonenumber-js`** — country picker + E.164 validation for the loyalty phone form.
- **`qrcode.react`** — draws the loyalty QR codes on canvas.
- **`zod`** — runtime schema validation for the menu JSON blob (defensive against malformed operator input).
- **Base UI (`@base-ui/react`)** — Button primitive powering shadcn's Button.

---

## 10. Where to find things (developer index)

If you're a new engineer and you want to know "where does X live," start here.

| Concern | File / Folder |
| --- | --- |
| Request → tenant resolution | [src/middleware.ts](../src/middleware.ts), [src/lib/tenant/resolve.ts](../src/lib/tenant/resolve.ts) |
| Root layout, favicon logic, JSON-LD, pixel bootstrapping | [src/layouts/BaseLayout.astro](../src/layouts/BaseLayout.astro) |
| Design tokens | [src/styles/tokens.css](../src/styles/tokens.css) |
| Composition layer (`.section-well`, `.section-heading`, etc.) | [src/styles/components.css](../src/styles/components.css) |
| Global styles + Tailwind setup | [src/styles/globals.css](../src/styles/globals.css) |
| shadcn UI primitives (Card, Button, Input, Dialog, …) | [src/components/ui/](../src/components/ui/) |
| Page sections (Hero, Contact, Gallery, MenuPreview, About, Delivery, QuickActions) | [src/components/sections/](../src/components/sections/) |
| Full menu with sticky tabs | [src/components/menu/MenuBrowser.tsx](../src/components/menu/MenuBrowser.tsx) |
| Loyalty QR flow + country-aware phone form | [src/components/promo/](../src/components/promo/) |
| Attribution API client + Meta Pixel helpers | [src/lib/attribution/](../src/lib/attribution/) |
| Menu schema validation + currency formatting | [src/lib/menu/](../src/lib/menu/) |
| Phone country list + libphonenumber wrappers | [src/lib/phone/](../src/lib/phone/) |
| SEO builder (title, meta, JSON-LD) | [src/lib/seo/schema.ts](../src/lib/seo/schema.ts) |
| Delivery provider logos (Wolt / Glovo / etc.) | [public/logos/delivery/](../public/logos/delivery/) |
| Bulk-fetch logos from logo.dev | [scripts/download-delivery-logos.sh](../scripts/download-delivery-logos.sh) |
| Database migrations | [supabase/migrations/](../supabase/migrations/) |
| Redirects (e.g. legacy `/promocja` → `/rewards`) | [vercel.json](../vercel.json) |
| Onboarding a client (step-by-step SQL) | [docs/02-adding-a-client.md](02-adding-a-client.md) |
| Changing an existing tenant (colors, logo, menu, hours, etc.) | [docs/08-managing-tenants.md](08-managing-tenants.md) |
| Architecture deep dive | [docs/01-architecture.md](01-architecture.md) |
| Design system reference | [docs/03-design-system.md](03-design-system.md) |
| Attribution/loyalty API contract | [docs/04-attribution-integration.md](04-attribution-integration.md) |
| Full ER diagram + column comments | [docs/05-supabase-schema.md](05-supabase-schema.md) |
| Developer conventions (preview cookie, i18n roadmap, etc.) | [docs/06-developer-guide.md](06-developer-guide.md) |
| Domain model (wildcards, TLS, DNS) | [docs/07-domain-model.md](07-domain-model.md) |

---

## 11. Success criteria (one more time, in one place)

The platform is doing its job when all of these are true:

- **A new tenant is live within 5 minutes** of the operator running the SQL and clicking the domain in Vercel. No code deploy, no PR, no engineer.
- **Every branded element** (logo, colors, menu, hours, gallery, delivery, loyalty) **can be changed by SQL alone** and reflects on the live site within ~60 seconds.
- **A paid Meta-ad landing** on `/rewards` looks intentional and converts — no missing glyphs, no fake ratings, no cross-tenant polish leaks, no CORS errors, no Polish phone prefix for a US restaurant.
- **A developer can read `docs/` and ship a section change in under an hour** without asking anyone.
- **Lighthouse mobile ≥ 95 Performance, 100 SEO** on the home page for every tenant, out of the box.
- **`npm run build` is clean, TypeScript strict, no `any`**, no linter errors.

If any of those breaks, that's the bug to fix first.

