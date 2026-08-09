# 04 — Attribution integration

The template talks to `attribution-autopilot` (`https://attribution.mysite.cx/api`) directly from the browser for the loyalty/QR flow. This document is the contract.

## The flow

Ported VERBATIM from wbc-v2's `useQrTracker` — same endpoints, same payload shape, same phone-append + duplicate-recovery flow.

```
Visitor lands on /promocja
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

Zero new endpoints. Zero CORS/origin changes. `GET /api/promotions/*` is admin-origin-gated and can't be called from a `karat.mysite.so` origin.

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

**60-second cache lag** — `LocationsService.getAllOriginsCached()` caches the origin list for 60 seconds. A newly onboarded hostname will fail CORS for up to ~60 seconds after the INSERT. Wait, then smoke-test `/promocja`.

## Google Ads click IDs

Not captured. Matches wbc-v2. The backend `CreateUserDto` already accepts `gclid`/`gbraid`/`wbraid` — add them one line at a time in `src/lib/attribution/tracking.ts` + `src/lib/attribution/useAttribution.ts` when a client needs Google Ads attribution.
