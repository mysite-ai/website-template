# 07 — Domain model

How hostnames map to tenants, how DNS is set up, and how the various URL shapes fit together. Read this before adding a client — it's the mental model behind `docs/02-adding-a-client.md`.

## The two-domain distinction

| Domain | Purpose | Who owns it |
| --- | --- | --- |
| **`mysite.social`** | Customer-facing restaurant sites. Every URL under this domain resolves to a tenant row in `template_domains`. This is what visitors see. | MySite (bought/registered directly, pointed at Vercel) |
| **`mysite.cx`** | Internal ops/API surface. `attribution.mysite.cx`, `dispatch.mysite.cx`, admin panels, etc. Not touched by the template. | MySite (existing, separate) |

The two are **intentionally separate**. Marketing / SEO / privacy lives on `.social`; the loyalty & attribution API lives on `.cx`. The template's frontend calls out to `.cx` from the browser — that's the only cross-domain touchpoint.

## URL shapes

Every URL a visitor might type resolves through the same code path in `src/middleware.ts`:

```
Host header → normalize (lowercase, strip port) → SELECT * FROM template_domains WHERE hostname = $1
```

There is **no structural parsing** of the host. `karat.mysite.social` and `karat.pl` and `www.karat.pl` are all just row lookups. The DB is the source of truth; the URL shape is documentation.

Four legal shapes live in production:

### 1. Single-location, MySite subdomain

```
<location>.mysite.social
```

- Example: `karat.mysite.social`
- For clients with exactly one venue. `brand.slug === location.slug` — the two concepts collapse to the same URL segment.
- Covered by the wildcard **`*.mysite.social`** in Vercel — zero DNS action per client.
- Marked as `kind='mysite_single'` in `template_domains`.
- The DB CHECK on `template_domains.hostname` normally **rejects** `<slug>.mysite.social` shapes (they look like "bare brand roots"). A trigger reinstates this specific case when `kind='mysite_single'` **and** `brand.slug === location.slug`. If those conditions fail, the row insert errors out with a clear message.

### 2. Multi-location, MySite subdomain

```
<location>.<brand>.mysite.social
```

- Example: `santafe.doublz.mysite.social` — the "Santa Fe" location of the "Doublz" brand.
- For clients running one brand across multiple venues.
- Covered by the wildcard **`*.*.mysite.social`** in Vercel — again zero DNS action per client, **subject to TLS support** (see Prerequisites below).
- Marked as `kind='mysite_multi'`.
- The bare `doublz.mysite.social` (a "brand root") **returns 404**. Every valid URL must resolve to a specific location.

### 3. Custom apex domain

```
<custom-domain>
```

- Example: `karat.pl`, `sawasushi.com`, `doublz.co`, `whitebear.eu`.
- The client's own domain. Added to the Vercel project in the dashboard and inserted as a row in `template_domains`.
- Marked as `kind='custom'`.
- Client is responsible for DNS (CNAME or A-record to Vercel).

### 4. Custom subdomain

```
<subdomain>.<custom-domain>
```

- Example: `www.karat.pl`, `menu.sawasushi.com`, `order.doublz.co`.
- Hostnames are stored **exact-match**. `www.karat.pl` and `karat.pl` are **separate rows** — no automatic `www.` stripping in the resolver. This is deliberate: it keeps the DB authoritative and avoids canonicalization gotchas.

## What's **not** legal

- `mysite.social` (apex) — **404**. There is no marketing site under mysite.social; every URL must resolve to a tenant.
- `doublz.mysite.social` (bare brand root, no location) — **404**. Multi-location brands don't get a "brand home page" under mysite.social; every URL must resolve to a specific location.
- `www.mysite.social` — same as apex, 404. No marketing site.
- Any hostname matching `<slug>.mysite.social` where the tenant is **not** a `mysite_single` with `brand.slug === location.slug` — DB reject at INSERT time.

## Prerequisites

Two things need to be true before any tenant onboarding can happen. Verify these on day zero.

### P1. `mysite.social` is registered and pointed at Vercel

Buy `mysite.social` from a registrar (Cloudflare Registrar, Namecheap, Porkbun — any). In your Vercel team dashboard, add the domain to the `website-template` project as **two wildcard entries**:

- `*.mysite.social` — covers all single-location clients
- `*.*.mysite.social` — covers all multi-location clients

At the registrar, delegate to Vercel's nameservers (recommended, they'll handle TLS automatically) **or** create these DNS records manually:

```
*.mysite.social       CNAME  cname.vercel-dns.com
*.*.mysite.social     CNAME  cname.vercel-dns.com
mysite.social         A      76.76.21.21  (or whatever Vercel shows for apex)
```

### P2. Vercel automatic TLS for `*.*.mysite.social`

**This is the one non-trivial prerequisite.** Vercel's automated Let's Encrypt certificate issuance handles single-label wildcards (`*.mysite.social`) automatically. **Two-label wildcards (`*.*.mysite.social`) require special support** — depending on Vercel's plan and the current state of their cert automation, this may or may not "just work".

**Verify with Vercel before onboarding the first multi-location client.** If nested wildcards aren't supported on your plan:

- **Fallback:** collapse to a single wildcard by flattening the URL. Instead of `santafe.doublz.mysite.social`, use `santafe-doublz.mysite.social`. Same DB-driven resolution, no schema change needed — just an operator convention on how to name multi-location tenants. Vercel's cert automation handles this without issue.

The current smoke test lives at `website-template-iota-one.vercel.app` (Vercel's auto-generated preview domain) and does not exercise the wildcards yet. First real client onboarding is when you'll actually verify P2 in production.

## Vercel project setup (one-time)

In `mysiteai/website-template` on Vercel:

1. **Domains → Add**
   - `*.mysite.social` — bind to Production, do not redirect
   - `*.*.mysite.social` — bind to Production, do not redirect (subject to P2)
2. **Domains → Add** (later, per client)
   - `karat.pl` — bind to Production
   - `www.karat.pl` — redirect to `karat.pl` (Vercel handles this in the domain UI)
3. **Settings → General → Node.js version**: 22 (auto-detected)
4. **Settings → Environment Variables**: already set (PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_ATTRIBUTION_API_BASE)

There is **no** SPA fallback or catch-all rewrite in `vercel.json` — Astro SSR handles every route. The only rewrite is `/stats/` for the Umami analytics proxy. Domains at the project level are what routes traffic, not `vercel.json`.

## Runtime flow

```
                          Visitor types karat.mysite.social
                                       │
                                       ▼
                          Cloudflare / Vercel edge
                                       │
                                       ▼
              Serverless function boots (or reuses warm container)
                                       │
                                       ▼
                          src/middleware.ts reads Host header
                                       │
                                       ▼
                          normalizeHost() → 'karat.mysite.social'
                                       │
                                       ▼
             LRU cache hit?      ─────yes──── use cached TenantContext
                     │
                     no
                     ▼
        SELECT ... FROM template_domains WHERE hostname = 'karat.mysite.social'
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
       hit                      miss
        │                         │
        ▼                         ▼
  build TenantContext        rewrite → /404
  (org + brand + location
   + primary hostname)
        │
        ▼
   Astro.locals.tenant
        │
        ▼
   pages/*.astro renders
```

The LRU cache has a 60s TTL (see `src/lib/tenant/resolve.ts`). A new hostname insert becomes live within 60 seconds without a redeploy.

## Custom domain onboarding checklist

Every custom domain (apex or subdomain, not `mysite.social`) requires **three sync'd inserts** to work end-to-end:

1. **`template_domains` in `website-template` Supabase** — row that maps hostname → location_id. (Middleware routes traffic based on this.)
2. **`location_origins` in `attribution-autopilot` Supabase** — row that grants CORS + Origin allow for the loyalty API. (Otherwise `/rewards` breaks with a CORS error.)
3. **Vercel domain attachment + client DNS** — actual routing at the edge.

If any of the three is missing, the site is broken in a specific way:

- **1 missing** → 404 from the middleware
- **2 missing** → landing loads, `/rewards` reveals the QR but the phone-save POST fails with a CORS error (visible in devtools)
- **3 missing** → DNS resolution error, browser can't reach the site at all

See `docs/02-adding-a-client.md` for the exact SQL and Vercel steps.

## Failure modes and how to diagnose

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 404 on a hostname you just added | Middleware LRU cache still holds a negative hit | Wait 60s, or force a redeploy |
| 404 on `mysite.social` (apex) | This is correct behavior — apex is unused | (n/a) |
| 404 on `<brand>.mysite.social` bare | Bare brand roots are 404 by design | Use `<location>.<brand>.mysite.social` instead |
| Cert error on `*.*.mysite.social` | P2 not verified — Vercel doesn't have the nested wildcard cert | Collapse to flat `<location>-<brand>.mysite.social` |
| CORS error on `/rewards` after adding a domain | `location_origins` row missing in attribution-autopilot | Insert the row; wait ~60s for `getAllOriginsCached()` to refresh |
| Site loads on `karat.pl` but not `www.karat.pl` | Missing `www.karat.pl` row in `template_domains` (no auto www stripping) | Insert a separate row for the www variant, or use Vercel's built-in apex↔www redirect |
| Colors don't match the brand override | Old serverless instance holding cached tenant | Wait 60s TTL, or verify `template_brands.theme` row has the JSONB set correctly |

## Why this design?

- **DB is authoritative for routing.** No structural URL parsing → no ambiguous edge cases (does `www.` count as a subdomain? what about `foo.bar.baz.mysite.social`?). Every hostname is a row; every row points at exactly one location.
- **Two wildcards cover 90% of clients.** MySite gets to onboard a new tenant with two SQL inserts and a domain add. No code deploy.
- **The custom domain path is the same code path.** A `karat.pl` insert works exactly like a `karat.mysite.social` insert — same middleware, same query, same cache. There's no separate "custom domain" branch in the codebase, so there's no separate way for it to break.
- **The template is domain-agnostic at build time.** Nothing in the compiled JS/CSS references `mysite.social`. If MySite ever renames to `myrestaurant.club`, the code doesn't change — only DNS + the CHECK constraint in `002_template_domains.sql` (and its refresh migration 011).
