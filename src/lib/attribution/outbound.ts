import type { TenantLocation } from "@/lib/tenant/types";

/**
 * Landing-page outbound tagging.
 *
 * Every link that sends a guest off this landing page to a destination the
 * tenant can measure (their own ordering platform, a marketplace, their POS
 * webshop) gets tagged so the traffic is attributable to us:
 *
 *   utm_source   = mysite
 *   utm_medium   = mysitelp
 *   utm_campaign = the visitor's own utm_campaign, else "mysite"
 *
 * ── Why this is separate from `withMysiteUtms` in lib/utils.ts ──────────
 * That helper claims `utm_source=mysite.ai` / `utm_medium=referral` and is
 * used for a different job (referring a guest to the tenant's own site as a
 * *referral*). This scheme deliberately marks the traffic as coming from a
 * MySite *landing page* so the two never blur together in the client's
 * analytics. Both are intentional; don't collapse them.
 *
 * ── Why this runs client-side ──────────────────────────────────────────
 * `index.astro` / `menu.astro` send `cache-control: public, s-maxage=60`.
 * Baking a visitor's `utm_campaign` into the SSR HTML would let the CDN
 * serve visitor A's campaign to visitor B for up to 60s (+300s stale) —
 * wrong attribution that looks correct in every report, which is worse than
 * no attribution at all. Same reasoning, and the same split, as
 * lib/opentable/tagging.ts: the *gate* (does this tenant have any outbound
 * link?) is computed server-side from tenant data and is cacheable; the
 * *value* is computed in the browser.
 */

/** Source we claim on every outbound landing-page link. */
export const LP_SOURCE = "mysite";

/** Medium marking this as landing-page traffic (vs. a plain referral). */
export const LP_MEDIUM = "mysitelp";

/** Campaign reported when the visitor didn't arrive on a campaign link. */
export const LP_CAMPAIGN_FALLBACK = "mysite";

/** Upper bound on a forwarded campaign value. */
const MAX_CAMPAIGN_LENGTH = 64;

/**
 * Sanitises an inbound `utm_campaign` before we forward it.
 *
 * `utm_campaign` arrives from the query string, so it is fully
 * attacker-controllable. Echoing it verbatim into an outbound URL would turn
 * the destination's campaign report into an injection sink and let a crafted
 * link smuggle arbitrary text (or a second `&`-delimited param) into the
 * tenant's analytics. lib/opentable/tagging.ts refuses to forward raw `?c=`
 * for exactly this reason; this mirrors that stance.
 *
 * Allows only what a real campaign name needs — letters, digits, and the
 * three separators every ads platform emits (`_`, `-`, `.`) — then caps the
 * length. Anything left empty falls back rather than propagating a blank.
 */
export function resolveLpCampaign(raw: string | null | undefined): string {
  if (!raw) return LP_CAMPAIGN_FALLBACK;
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, MAX_CAMPAIGN_LENGTH);
  return cleaned || LP_CAMPAIGN_FALLBACK;
}

/**
 * Hosts we never tag.
 *
 * - Our own hostnames: an internal link doesn't need attributing to us, and
 *   tagging it would make a guest moving between `/` and `/menu` look like a
 *   fresh campaign arrival.
 * - Google Maps: the `directions` tile. Maps ignores UTMs, and appending
 *   query params to a `?api=1&query=` deep link is pure noise.
 * - OpenTable: owned by lib/opentable/tagging.ts, which sets the params
 *   OpenTable actually surfaces (`ot_source`/`ot_campaign`). Double-tagging
 *   would add UTMs OpenTable silently drops.
 */
const SKIP_HOST_SUFFIXES = [
  "mysite.social",
  "mysite.cx",
  "google.com",
  "google.co.uk",
  "goo.gl",
  "opentable.com",
] as const;

function isSkippedHost(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return SKIP_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

/**
 * Returns `href` with our landing-page UTMs applied, or the input untouched
 * when it isn't a taggable outbound http(s) URL.
 *
 * `utm_source`/`utm_medium` are overwritten unconditionally — an operator who
 * pasted a link that already carries someone else's UTMs gets ours, otherwise
 * two tenants report the same traffic under different sources and the numbers
 * stop being comparable (same overwrite semantics as `withMysiteUtms` and
 * `tagOpenTableUrl`).
 *
 * `utm_campaign` is only set when the URL doesn't already specify one: a
 * destination-specific campaign the operator put on the link by hand is more
 * precise than our inherited value, so it wins.
 */
export function tagOutboundUrl(href: string, campaign: string): string {
  try {
    const url = new URL(href);
    // Skips tel:, mailto:, sms: and relative links in one check.
    if (url.protocol !== "http:" && url.protocol !== "https:") return href;
    if (isSkippedHost(url)) return href;

    url.searchParams.set("utm_source", LP_SOURCE);
    url.searchParams.set("utm_medium", LP_MEDIUM);
    if (!url.searchParams.get("utm_campaign")) {
      url.searchParams.set("utm_campaign", campaign);
    }
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Server-side gate: does this tenant have any taggable outbound link?
 *
 * Depends only on tenant DB data, so it stays cache-safe, and a tenant with no
 * outbound links ships zero extra JavaScript.
 *
 * ── Keep this list in sync with what actually renders an <a> ─────────────
 * The gate is only correct if it enumerates *every* tenant-configurable URL
 * that `tagOutboundUrl` would tag. It originally listed only the three
 * "commercial" surfaces (action tiles, delivery providers, `website_url`) and
 * silently missed the socials in `Footer.astro`, which broke every phone-only
 * tenant: action tiles of just Call (`tel:`) + Directions (Maps) are both
 * skip-listed, so a venue whose only http(s) links are its Instagram and
 * Facebook profiles scored `false`, `OutboundTagger` never shipped, and those
 * links went out completely untagged — even though `tagOutboundUrl` tags them
 * happily once the script is on the page. Socials are exactly as taggable as
 * an ordering link: real outbound traffic the tenant can see in their own
 * analytics, and the only measurable destination some venues have.
 *
 * Current coverage, matched against the components that render anchors:
 *   - `action_tiles[].href`  → QuickActions.astro
 *   - `delivery[].url`       → Delivery.astro (also the auto-derived Order
 *                              tile QuickActions falls back to when
 *                              `action_tiles` is NULL, hence no extra entry)
 *   - `website_url`          → Hero.astro ("Visit our website" button)
 *   - `instagram_url`        → Footer.astro
 *   - `facebook_url`         → Footer.astro
 *   - `google_place_url`     → Hero.astro (the rating link). Every tenant
 *                              today stores a `google.com/maps` URL, which
 *                              `isSkippedHost` rejects — but it's an operator-
 *                              pasted column, and a `g.page/…` short link
 *                              would be taggable, so the gate has to know
 *                              about it rather than assume the host.
 *
 * Deliberately absent: `phone` (`tel:`), `email` (`mailto:`) and
 * `maps_search_query` (Maps) can never be taggable, internal nav links are
 * skip-listed, and `MysiteBadge.astro`'s mysite.ai link is hardcoded rather
 * than tenant-configurable — counting it would make the gate true for every
 * tenant and defeat the point of having one.
 */
export function hasTaggableOutboundLink(location: TenantLocation): boolean {
  const candidates = [
    ...(location.action_tiles ?? []).map((tile) => tile.href),
    ...location.delivery.map((link) => link.url),
    location.website_url,
    location.instagram_url,
    location.facebook_url,
    location.google_place_url,
  ];

  return candidates.some((href) => {
    if (!href) return false;
    try {
      const url = new URL(href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      return !isSkippedHost(url);
    } catch {
      return false;
    }
  });
}
