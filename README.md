# website-template

Astro-based, single-instance multi-tenant restaurant site template. One codebase, one Vercel deploy, hundreds of restaurant sites resolved from `template_domains` in a dedicated Supabase project. MySite's shadcn `base-nova` design system applied through Apple-Maps composition patterns, native integration with `attribution-autopilot` for QR/loyalty.

## Quickstart

```bash
cp .env.example .env    # PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_ATTRIBUTION_API_BASE
npm install
npm run dev             # http://localhost:4321
```

Set the `x-preview=1` cookie and visit `http://localhost:4321/?tenant=<location-slug>` to render any tenant locally without editing `/etc/hosts`. See `docs/06-developer-guide.md`.

## Live smoke test

- **Deploy**: [website-template-iota-one.vercel.app](https://website-template-iota-one.vercel.app)
- **Tenant**: The White Bear Coffee — Marszalkowska (seeded via migrations 005–010)
- **Loyalty**: wired to a dedicated smoke-test promotion in `attribution-autopilot` (real QR generation works)

## Domain model

Two wildcards in Vercel cover 90% of clients:

- `*.mysite.social` → single-location sites (`karat.mysite.social`)
- `*.*.mysite.social` → multi-location sites (`santafe.doublz.mysite.social`)

Custom domains (`karat.pl`, `sawasushi.com`) are added per-client in the Vercel dashboard and inserted as rows in `template_domains`. `mysite.social` apex + bare brand roots (`doublz.mysite.social`) return **404** by design. Full model + TLS prerequisites in `docs/07-domain-model.md`.

## Adding a new client

Two SQL inserts + one Vercel domain click. Site live in <5 minutes.

- **Single-location** (e.g. `karat.mysite.social`, `karat.pl`) — pattern A in `docs/02-adding-a-client.md`.
- **Multi-location** (e.g. `santafe.doublz.mysite.social`) — pattern B, same doc.

## Managing an existing client

Colors, logo, menu, hours, gallery, promo — all in Supabase, no code deploy needed. See `docs/08-managing-tenants.md` for copy-pasteable SQL.

## Where things live

| Concern | File |
| --- | --- |
| Tenant resolution | `src/middleware.ts`, `src/lib/tenant/resolve.ts` |
| Design tokens | `src/styles/tokens.css` (verbatim from admin) |
| Composition layer | `src/styles/components.css` |
| shadcn primitives | `src/components/ui/*` (base-nova style, `@base-ui/react`) |
| Sections | `src/components/sections/*.astro` |
| Menu | `src/components/menu/MenuBrowser.tsx` |
| Promo/QR flow | `src/components/promo/PromoFlow.tsx`, `PromoBanner.tsx` |
| Attribution client | `src/lib/attribution/*.ts` |
| Docs | `docs/` |
| Migrations | `supabase/migrations/` |

## Docs

- **[`docs/PRODUCT-REQUIREMENTS.md`](docs/PRODUCT-REQUIREMENTS.md) — start here.** Product-owner-friendly walkthrough of every feature this platform ships, with links back into the code. Read this if you want to know *what* it does before you dive into *how*.
- `docs/01-architecture.md` — request lifecycle, resolver, why service_role
- `docs/02-adding-a-client.md` — the onboarding runbook (both patterns)
- `docs/03-design-system.md` — base-nova tokens + composition layer
- `docs/04-attribution-integration.md` — endpoints, backend contract, CORS
- `docs/05-supabase-schema.md` — ER diagram, migrations, menu JSON template
- `docs/06-developer-guide.md` — conventions, preview cookie, i18n roadmap
- `docs/07-domain-model.md` — every URL shape, TLS prerequisites, DNS
- `docs/08-managing-tenants.md` — how to change colors/logo/menu/promo per tenant

## Success criteria

- New restaurant site live in <5 minutes from Supabase row + DNS.
- `npm run build` clean, TypeScript strict, no `any`.
- Lighthouse mobile ≥95 on Performance, ≥100 on SEO for the landing page.
- A new developer can read `docs/` and ship a section change in under an hour.
