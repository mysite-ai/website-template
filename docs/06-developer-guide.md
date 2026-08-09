# 06 — Developer guide

Small conventions that keep this template maintainable when it's powering hundreds of sites.

## Getting started

```bash
cp .env.example .env       # fill in the three vars
npm install
npm run dev                # http://localhost:4321
```

For local development against a real tenant, use the preview cookie (see below) — you don't need to mess with `/etc/hosts`.

## Preview cookie

To view a tenant locally without hostname mapping:

1. Set the `x-preview=1` cookie in your dev browser (DevTools → Application → Cookies → add).
2. Visit `http://localhost:4321/?tenant=<location-slug>`.
3. `src/middleware.ts` sees the cookie + `?tenant=` param and calls `resolvePreviewTenant(slug)` instead of the hostname lookup.

Recommended: gate the cookie behind a basic-auth-protected `/preview/enable` endpoint before going to production. Left as an exercise — v1 does not ship it because the template deploys as SSR and doesn't need per-user preview state for anyone except the dev team.

## File conventions

- **Every module <200 LOC.** If it grows past that, split it.
- **No `any`.** TypeScript strict is on. Prefer `unknown` + narrow, or add a shape to `src/lib/tenant/types.ts` or `src/lib/menu/types.ts`.
- **Astro `.astro` files** for SSR-only sections. React `.tsx` islands only when the component needs interactivity or client-side lifecycle.
- **Tokens over hex.** Use `bg-card`, `text-foreground`, `border-border` etc. Never `bg-[#171717]`.
- **`cn()` from `@/lib/utils`** for class merging. Never string concatenation.
- **No inline styles** except in `BrandStyleTag.astro` (that's the whole point of that file).

## Adding a section

1. Create `src/components/sections/YourSection.astro`.
2. Accept `tenant: TenantContext` as a prop and read what you need.
3. Wrap content in `<section class="section-well mt-4">` for consistent spacing.
4. Use `.map-card` for the container.
5. Import in `src/pages/index.astro`.
6. If the section needs interactivity, extract the interactive piece into `src/components/<domain>/YourWidget.tsx` and mount it with the tightest possible `client:*` directive (`client:idle` > `client:visible` > `client:load`).

## Adding a page

1. Create `src/pages/<route>.astro`.
2. Read `Astro.locals.tenant` at the top.
3. Wrap in `<BaseLayout tenant={tenant} seo={seo} currentPath="/<route>">`.
4. Set a cache-control header:
   ```astro
   Astro.response.headers.set("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
   ```
5. Add a link in `src/components/layout/Header.astro`.

## Adding an attribution parameter

Two edits, three lines each:

1. `src/lib/attribution/tracking.ts` — add the key to `ATTRIBUTION_KEYS` (persists on load).
2. `src/lib/attribution/useAttribution.ts` — add the field to `buildBody()`.

Backend already accepts most keys; check `attribution-autopilot/src/users/dto/create-user.dto.ts` before adding to make sure the target field exists server-side.

## i18n (not in v1)

The template is Polish-only in v1. When adding `astro-i18n`:

- Keep the `default_locale` on `template_organizations` and use it in `<html lang>`.
- Add a per-brand or per-org locale override on `template_brands` if a specific brand needs a different language across all its locations.
- Add a small language switcher island under `src/components/layout/LangSwitcher.tsx`.

## Debugging tenant resolution

The resolver logs errors via `console.error` with the offending host. Common causes:

- **404 on a hostname you just added** — 60s cache TTL. Wait or restart dev.
- **404 on the bare brand root** (`doublz.mysite.so`) — this is correct behavior, not a bug. See `02-adding-a-client.md`.
- **500** — usually means Supabase env vars are missing. Check `.env`.

To clear the resolver cache manually in dev, import `clearTenantCache()` from `@/lib/tenant/resolve` and call it from a temporary endpoint. In production a redeploy or the 60s natural TTL is how operators pick up changes.

## Type generation

After changing migrations, regenerate typed schema definitions:

```bash
SUPABASE_PROJECT_ID=<ref> npm run supabase:types
```

`src/lib/supabase/types.ts` is a stub in the repo; running the script above replaces it with real types. Wire the resolver to those types as the schema grows.

## Deploying

`npm run build && vercel deploy`. Vercel auto-detects Astro's `output: server` + the `@astrojs/vercel` adapter. The only special config is `vercel.json`'s `/stats/` rewrite. Wildcard domains are configured in the Vercel dashboard, not in `vercel.json`.

## Known gaps to close later

Tracked in the plan's "Out of Scope for v1":

- No admin UI for editing content — operators use SQL / Supabase Studio.
- No cookie consent gating (current wbc-v2 gap; carry it forward and fix on both).
- No reservations, contact form, or blog.
- No per-brand `--radius` override (see `03-design-system.md` for why).
- No SPA-style multi-venue-under-one-host — the template's model is one hostname per location.
