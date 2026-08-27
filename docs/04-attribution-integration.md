# 04 — Attribution integration

The template talks to `attribution-autopilot` (`https://attribution.mysite.cx/api`) directly from the browser for the loyalty/QR flow. This document is the contract.

## The flow

Ported VERBATIM from wbc-v2's `useQrTracker` — same endpoints, same payload shape, same phone-append + duplicate-recovery flow.

```
Visitor lands on /rewards
        │
        ▼
  useAttribution(location)  ── reads _fbc/_fbp/_ga/utms/etc. from cookies + localStorage
        │
        ▼
  User clicks "Odkryj kod"
        │
        ▼
  POST /api/users  { promotion_id, campaign_id, org_id, fbc, fbp, ga, utms, r, c, qr_event_id }
        │
        ▼
  { id, full_code, first_reward_code, promotion_name, first_reward_description }
        │
        ▼
  localStorage.qr_user = { ... }   ← trackQrGenerated() fires Meta Pixel
        │
        ▼
  QR shown; user enters phone
        │
        ▼
  GET /api/users/phone/:phone   ← probe-then-swap for duplicates
        │
    ┌───┴────────┐
    ▼            ▼
 not found    found w/ other id
    │            │
    ▼            ▼
PATCH .../phone   swap localStorage.qr_user, mark phoneSaved
    │
    ▼
  trackLeadSubmitted() fires Meta Pixel Lead event
    │
    ▼
  done  → progress/rewards page
```

## Endpoints used

Wrapped in `src/lib/attribution/client.ts`. All calls are browser-initiated.

| Method | Path                              | Purpose                                                                    |
| ------ | --------------------------------- | -------------------------------------------------------------------------- |
| POST   | `/api/users`                      | Create user + issue QR code                                                |
| GET    | `/api/users/:id`                  | Fetch user + progress (used when returning visitor has no phone yet)       |
| GET    | `/api/users/phone/:phone`         | Duplicate probe + progress fetch by phone                                  |
| PATCH  | `/api/users/:id/phone`            | Attach phone to a user                                                     |

`POST /api/users/recover/{request,verify}` is NOT wired in v1 — the template doesn't include the SMS recovery UI. Add it when a client needs it.

## Backend contract change (implemented)

`POST /api/users` now returns two extra fields on the `created` branch:

```ts
export type CreateUserResult =
  | {
      status: 'created';
      id: string;
      full_code: string;
      first_reward_code: string | null;
      promotion_name: string;              // ← NEW
      first_reward_description: string | null;  // ← NEW
    }
  | { status: 'exists'; requires_recovery: true; message: string };
```

This is `attribution-autopilot`'s only required backend change to unblock the template. `PromotionsService.findOne(dto.promotion_id)` already runs inside `create()` and the first reward is already fetched to compute `first_reward_code` — the change is:

- Rename `getFirstRewardCode(campaignId)` → `getFirstReward(campaignId)` returning `{ pos_code, description }`, keeping a thin `getFirstRewardCode` wrapper for other callers.
- Return `promotion_name: promotion.name` and `first_reward_description: firstReward.description` on the `created` branch.

Zero new endpoints. Zero CORS/origin changes. `GET /api/promotions/*` is admin-origin-gated and can't be called from a `karat.mysite.social` origin.

## Pre-reveal display strings

Before the visitor clicks "Odkryj kod", the page needs to show the promo name in the hero without having made a POST yet. To avoid a per-page admin API call, we **denormalize** into `template_locations`:

- `promotion_name_cached: text`
- `reward_description_cached: text`

`PromoFlow.tsx` reads these first, falls back to the values returned by `POST /api/users`, and finally to a generic label. Refresh procedure:

```sql
-- Run this when a promotion is renamed in attribution-autopilot.
update template_locations
   set promotion_name_cached = 'New name',
       reward_description_cached = 'New reward description'
 where attribution_promotion_id = '<promotion_uuid>';
```

A cron-triggered sync job is out of scope for v1. The cache is stale-tolerant: after the first `POST /users`, the fresh values from the backend override the cached ones for that session.

## Server-side event IDs

The template passes both `qr_event_id` (on POST) and `lead_event_id` (on PATCH). `CreateUserDto` accepts both. `attribution-autopilot` fans out to CAPI / Rudderstack / Customer.io server-side using those IDs, so server-side pixel dedup works from day one.

## CORS onboarding — one path

Every new hostname MUST be inserted into `attribution-autopilot.location_origins`:

```sql
insert into location_origins (location_id, origin)
values ('<template_locations.attribution_location_id>', 'https://<hostname>');
```

Do NOT edit `DEFAULT_ALLOWED_ORIGIN_PATTERNS` in `src/common/origin-allowlist.ts` — that path requires a backend redeploy and is not compatible with zero-code onboarding.

**60-second cache lag** — `LocationsService.getAllOriginsCached()` caches the origin list for 60 seconds. A newly onboarded hostname will fail CORS for up to ~60 seconds after the INSERT. Wait, then smoke-test `/rewards`.

## Google Ads click IDs

Not captured. Matches wbc-v2. The backend `CreateUserDto` already accepts `gclid`/`gbraid`/`wbraid` — add them one line at a time in `src/lib/attribution/tracking.ts` + `src/lib/attribution/useAttribution.ts` when a client needs Google Ads attribution.

## OpenTable outbound tagging

Closes the attribution loop on reservations. We don't own OpenTable's booking flow (it runs on their domain, so no pixel of ours fires inside it), but OpenTable reads two params off the inbound link and surfaces them in the restaurant's own reservation reports:

| Param | Shows up in OpenTable as | Value we send |
| ------------- | ------------------------ | ------------------------------------------ |
| `ot_source` | `RestRef` | always `mysite_ai` |
| `ot_campaign` | `Rest Campaign Name` | `pk<N>` from `?c=`, else `mysite` |

The `pk` is the **opportunity key** minted by `mysite-ads-autopilot`'s `TrackingLinkService`, so a seated cover in OpenTable's export can be traced back to the exact paid opportunity that produced it — the same `pk` that appears in `utm_campaign=pk{PK}-{slug}` and in our own `tracking_links` table.

### Campaign resolution

`?c=` is the tracking composite, canonically `.pi{PI}.pk{PK}.ps{PS}` (e.g. `.pi1.pk85.ps1234`). We extract only the `pk` digits:

| Inbound `c` | `ot_campaign` |
| --------------------------- | ------------- |
| `.pi1.pk85.ps1234` | `pk85` |
| `pi1.pk1_xyz` | `pk1` |
| `pk7` | `pk7` |
| absent / no `pk` / garbage | `mysite` |

The separator before `pk` is matched loosely (`/(?:^|[.\-_])pk(\d+)/i`) so hand-built and legacy links resolve too; upstream uses the stricter `/\.pk(\d+)/`.

**We never forward the raw `c` value.** Only `pk<digits>` or the literal fallback is emitted. `c` is attacker-controllable via the query string, so echoing it into an outbound URL would make OpenTable's campaign report an injection sink.

### Why the value is computed client-side

Two independent reasons, both worth knowing before anyone "optimizes" this into the SSR pass:

1. **CDN cache.** `index.astro` and `menu.astro` set `cache-control: public, s-maxage=60, stale-while-revalidate=300`. A `?c=`-derived value baked into the HTML would be served to *every* visitor hitting that cache entry — visitor A's `pk85` reported for visitor B's `pk12`. That's wrong attribution that looks perfectly valid in every report, which is worse than no attribution at all.
2. **Cross-page navigation.** `c` only survives page-to-page in `sessionStorage` (see `persistUtmParams` / `getAttributionParam` in `lib/attribution/tracking.ts`). A visitor landing on `/?c=…` and clicking Book from `/menu` has no `c` in the URL — the server would read `null` and report `mysite` for real campaign traffic. Only the browser can resolve this correctly.

The **gate** (does this tenant use OpenTable at all?) *is* server-side — it depends only on tenant DB rows, so it's identical for every visitor and cache-safe.

### Where it lives

| Concern | File |
| ----------------------------------- | ---------------------------------------------------- |
| Pure logic (parse, match, tag, gate) | `src/lib/opentable/tagging.ts` |
| DOM pass that rewrites `href`s | `src/components/attribution/OpenTableTagger.astro` |
| Gate + mount | `src/layouts/BaseLayout.astro` (`hasOpenTableLink`) |
| Verification | `npm run verify:opentable` |

Detection is **by hostname**, not by tile type — so `QuickActions`, `Delivery`, `Hero` and any future component are covered with zero changes to their code, and no new `ActionTileType` is needed. Matching uses an allowlist of registrable OpenTable domains rather than a `/opentable\./` regex, which would also match `opentable.attacker.com` and leak campaign identifiers to a third party.

Two deliberate implementation choices:

- **A plain `<script>`, not a `client:idle` React island** like its `Umami.tsx` / `MetaPixel.tsx` neighbours. There's no UI and no props, so a React runtime would be pure overhead for tenants with no other island (~180 kB of `client.js`), and a module script runs earlier, shrinking the window where a fast clicker hits an untagged link. Ships at **628 B gzipped**, and only for tenants that actually have an OpenTable link.
- **We rewrite the real `href`** rather than intercepting clicks. That also covers cmd/ctrl+click, middle-click (which fires no `click` event at all), "Copy link address", and the status-bar URL preview. A `MutationObserver` re-runs the pass because React islands hydrate later and can replace anchors; an `otTagged` dataset flag keeps it idempotent.

Params already on the link (`rid`, `p`, …) are preserved. `ot_source`/`ot_campaign` pasted by an operator from the OpenTable dashboard are **overwritten** — otherwise two tenants would report the same traffic under different sources and the numbers stop being comparable.

### Umami cross-check

The same pass adds `data-umami-event-ot-campaign="pk85"` to each tagged anchor. Umami turns any `data-umami-event-<key>` into a field on the event payload, so the existing `click-book` / `click-reserve` events carry the campaign with **zero event plumbing** — purely declarative, same mechanism as every other CTA in the repo.

This gives us a first-party click count to reconcile against OpenTable's own report. If the two diverge, the params are being dropped somewhere in OpenTable's redirect chain and we'll see it instead of trusting a single source.

### Open validation item

OpenTable's dashboard UI offers `Source` as a closed dropdown (Email, Google, Facebook, Instagram, Other). The URL param has historically accepted arbitrary strings and echoes them as `RestRef`, but there is a real chance OpenTable normalizes an unknown `mysite_ai` to "Other". **Validate on one tenant before rolling out widely** — the Umami cross-check above is what makes that verifiable.

