# 01 — Architecture

`website-template` is an Astro 5 SSR app that powers hundreds of restaurant sites from one deploy. The whole architecture is built around one idea:

> **Every request maps to exactly one row in `template_domains`. Everything else — brand, org, location, menu, promo — hangs off that row.**

> **Read this first** for the mental model. For URL shapes / DNS / TLS setup, see `docs/07-domain-model.md`. For adding a new tenant, see `docs/02-adding-a-client.md`. For editing an existing tenant's content, see `docs/08-managing-tenants.md`.

## Request lifecycle

```
Incoming request
      │
      ▼
Vercel Edge (SSR) ─► src/middleware.ts
                            │
                            ▼
                    normalizeHost(host)
                            │
                            ▼
        SELECT ... FROM template_domains WHERE hostname = $1
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
              hit                     miss
                │                       │
                ▼                       ▼
   build TenantContext            rewrite → /404
    (org, brand, location,
     domain, primaryHostname)
                │
                ▼
       Astro.locals.tenant
                │
                ▼
       pages/*.astro render
```

- **`src/middleware.ts`** — 40 LOC. Reads `Host`, calls `resolveTenant`, attaches `Astro.locals.tenant`. Nothing more.
- **`src/lib/tenant/resolve.ts`** — the resolver. One join across `template_domains` → `template_locations` → `template_brands` → `template_organizations`. An LRU cache (max 512 entries, 60 s TTL) sits in front of it.
- **`src/lib/supabase/server.ts`** — the ONE Supabase client the app has. It uses `SUPABASE_SERVICE_ROLE_KEY` and never gets imported into a `.tsx` island (client bundles) — grep for it and you'll see it's only touched by resolver code.

## Why service_role + `anon_deny_all`

Tenant reads happen server-side inside the Vercel serverless function. There is no client-side Supabase client shipped in any bundle. That means:

- RLS can be `anon_deny_all` on every `template_*` table. No column-level policies, no anon key.
- `template_locations.phone` and `.email` never touch the client Supabase surface — they only appear rendered into HTML, and only where a page explicitly renders them.
- Removing anon read access removes the entire class of "operator misconfigures a row, PII leaks" bugs.

If a future feature needs client-side Supabase (unlikely; almost every restaurant-site feature is content-heavy SSR), it must add a specific column-level anon policy AND exclude PII.

## Islands architecture

Astro pages are static-shaped HTML by default. Interactivity is opt-in per component via `client:*` directives:

- **`client:load`** — hydrates immediately. Used for `PromoFlow` because it's the primary content of `/promocja`.
- **`client:visible`** — hydrates when scrolled into view. Used for `MenuBrowser` on `/menu`.
- **`client:idle`** — hydrates on `requestIdleCallback`. Used for `MetaPixel` and `Umami` so they never block first paint.

This is a Lighthouse-mobile-95+ setup out of the box: three routes, one interactive island per route (except `/promocja` which needs the QR flow), zero JavaScript on the marketing landing above the fold.

## What lives where

| Concern                            | File                                             |
| ---------------------------------- | ------------------------------------------------ |
| Host → TenantContext               | `src/lib/tenant/resolve.ts`                      |
| Tenant TypeScript surface          | `src/lib/tenant/types.ts`                        |
| Server Supabase client             | `src/lib/supabase/server.ts`                     |
| Design tokens (MySite base-nova)   | `src/styles/tokens.css`                          |
| Apple-Maps composition             | `src/styles/components.css`                      |
| Per-brand CSS var injection        | `src/components/layout/BrandStyleTag.astro`      |
| Sections (Hero, Hours, Map, etc.)  | `src/components/sections/*.astro`                |
| Menu island                        | `src/components/menu/MenuBrowser.tsx`            |
| Promo/QR island                    | `src/components/promo/PromoFlow.tsx`             |
| Attribution client wrapper         | `src/lib/attribution/client.ts`                  |
| Attribution React hook             | `src/lib/attribution/useAttribution.ts`          |
| Meta Pixel helper                  | `src/lib/attribution/metaPixel.ts`               |
| SEO helper (JSON-LD, canonical)    | `src/lib/seo/schema.ts`                          |

## What's NOT here

- No client-side Supabase.
- No custom auth. There are no logged-in users on a restaurant site.
- No API routes (`src/pages/api/*`). Everything the site needs is either static content from the tenant row or a call to `attribution.mysite.cx`.
- No cookies except the optional `x-preview` cookie for the preview flow (see `06-developer-guide.md`).
