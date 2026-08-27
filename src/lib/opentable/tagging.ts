import type { TenantLocation } from "@/lib/tenant/types";

/**
 * OpenTable marketing-tracking tagging.
 *
 * OpenTable exposes two URL params on reservation links that surface in
 * the restaurant's own reservation reports:
 *
 *   ot_source   -> shown as "RestRef"            (booking source)
 *   ot_campaign -> shown as "Rest Campaign Name" (campaign)
 *
 * We always claim the source (`mysite_ai`) and derive the campaign from
 * our own `?c=` tracking composite so a seated cover in OpenTable's
 * report can be traced back to the paid opportunity that produced it.
 *
 * ── Why this runs client-side ──────────────────────────────────────────
 * `index.astro` / `menu.astro` send `cache-control: public, s-maxage=60`.
 * Baking a `?c=`-derived value into the SSR HTML would let the CDN serve
 * visitor A's campaign to visitor B for up to 60s (+300s stale) — wrong
 * attribution that looks correct in every report, which is worse than no
 * attribution. On top of that, `c` survives cross-page navigation only in
 * sessionStorage (see lib/attribution/tracking.ts), which the server can't
 * read at all.
 *
 * So: the *gate* (does this tenant use OpenTable?) is computed server-side
 * from tenant data — cacheable, identical for every visitor. The *value*
 * is computed in the browser. See components/attribution/OpenTableTagger.astro.
 */

/** RestRef we claim on every outbound OpenTable link. */
export const OT_SOURCE = "mysite_ai";

/** Campaign reported when the visitor didn't arrive from a tracked link. */
export const OT_CAMPAIGN_FALLBACK = "mysite";

/**
 * Registrable OpenTable domains, matched exactly or as a parent of the
 * link's hostname (so `reserve.opentable.com` resolves via `opentable.com`).
 *
 * Deliberately an allowlist rather than a `/opentable\./` regex: a regex
 * also matches `opentable.attacker.com`, which would ship our campaign
 * identifiers to a third party. A domain missing from this list degrades
 * gracefully (the link works, it just isn't tagged), so extending it is a
 * one-line change with no risk.
 */
const OT_DOMAINS = [
  "opentable.com",
  "opentable.co.uk",
  "opentable.ca",
  "opentable.de",
  "opentable.es",
  "opentable.fr",
  "opentable.it",
  "opentable.nl",
  "opentable.ie",
  "opentable.jp",
  "opentable.sg",
  "opentable.hk",
  "opentable.ae",
  "opentable.com.au",
  "opentable.com.mx",
] as const;

/**
 * Extracts the opportunity key (`pk`) from our `?c=` tracking composite.
 *
 * The canonical shape emitted by mysite-ads-autopilot's
 * `TrackingLinkService` is `.pi{PI}.pk{PK}.ps{PS}` — e.g. `.pi1.pk85.ps1234`
 * (leading dot, `ps` carrying the Meta `{{ad.id}}` macro). The separator is
 * kept loose here so hand-built and legacy variants (`pi1.pk1_xyz`, bare
 * `pk7`) resolve too; the upstream parser uses the stricter `/\.pk(\d+)/`.
 *
 * Only ever returns `pk<digits>` or the fallback — the raw `c` value is
 * never forwarded. That matters: `c` is attacker-controllable via the query
 * string, so echoing it into an outbound URL would turn OpenTable's campaign
 * report into an injection sink.
 */
export function resolveOtCampaign(c: string | null | undefined): string {
  if (!c) return OT_CAMPAIGN_FALLBACK;
  const match = /(?:^|[.\-_])pk(\d+)/i.exec(c);
  return match ? `pk${match[1]}` : OT_CAMPAIGN_FALLBACK;
}

/** Whether a parsed URL points at an OpenTable property. */
export function isOpenTableUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return OT_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Returns `href` with our marketing-tracking params applied, or the input
 * untouched when it isn't an OpenTable link / isn't a parseable URL.
 *
 * Both params are overwritten unconditionally. An operator who pastes a
 * link generated in the OpenTable dashboard has its `ot_source`/`ot_campaign`
 * replaced on purpose — otherwise two tenants would report the same traffic
 * under different sources and the numbers stop being comparable. Every other
 * param on the link (`rid`, `restref`, `p`, …) is preserved. Mirrors the
 * overwrite semantics of `withMysiteUtms` in lib/utils.ts.
 */
export function tagOpenTableUrl(href: string, campaign: string): string {
  try {
    const url = new URL(href);
    if (!isOpenTableUrl(url)) return href;
    url.searchParams.set("ot_source", OT_SOURCE);
    url.searchParams.set("ot_campaign", campaign);
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Server-side gate: does this tenant have an OpenTable link anywhere?
 *
 * Checks all three places a reservation link can be configured — the
 * `book`/`reserve` action tiles, the delivery-provider list (which
 * PRODUCT-REQUIREMENTS explicitly allows for reservations), and the
 * tenant's own `website_url`. Depends only on tenant DB data, so it stays
 * cache-safe and tenants without OpenTable ship zero extra JavaScript.
 */
export function hasOpenTableLink(location: TenantLocation): boolean {
  const candidates = [
    ...(location.action_tiles ?? []).map((tile) => tile.href),
    ...location.delivery.map((link) => link.url),
    location.website_url,
  ];

  return candidates.some((href) => {
    if (!href) return false;
    try {
      return isOpenTableUrl(new URL(href));
    } catch {
      return false;
    }
  });
}
