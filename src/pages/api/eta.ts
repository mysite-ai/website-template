import type { APIRoute } from "astro";
import {
  estimateTravel,
  haversineKm,
  isDenseCoreCity,
  MAX_TRAVEL_KM,
  roundMinutes,
  snapForTelemetry,
  venueCoords,
  type LatLng,
  type TravelMode,
} from "@/lib/geo/travel-time";

/**
 * Traffic-aware travel time.
 *
 * ── Why this endpoint exists ────────────────────────────────────────────
 * The browser-side model (lib/geo/travel-time.ts) is a *free-flow* estimator
 * and cannot be anything else: a static function of distance has no way to
 * know that the same 20-mile run takes 28 minutes at 22:00 and 70 at 17:30.
 * Reported from real use — the site said ~40 min, Google Maps said 1 h 10 —
 * and a wrong number at the moment a guest decides whether to come is worse
 * than no number, because they check Maps next and catch us out.
 *
 * Traffic can only come from a routing provider, so this is the thin server
 * shim that talks to one. The estimate stays: it paints instantly while this
 * is in flight, and it is the fallback when the provider fails.
 *
 * ── Why Mapbox ──────────────────────────────────────────────────────────
 * `driving-traffic` includes live traffic in the base price, and the free
 * allowance is 100k requests/month against Google's 5k for the equivalent
 * traffic-aware SKU. At ~32k calls/month across the fleet that is the
 * difference between $0 and roughly $265/month. Google also forbids showing
 * its data alongside a non-Google map, and some tenants embed OpenStreetMap.
 *
 * ── Why the cost story changed from the original plan ───────────────────
 * The original design leaned on a persistent grid cache keyed on a snapped
 * origin, which turned per-click cost into per-neighbourhood cost. Traffic
 * breaks most of that: a duration is only valid for minutes, so the TTL
 * collapses from days to ~10 minutes and the dedup with it. Cost therefore
 * scales roughly with clicks, which is exactly why the provider's free tier
 * had to be the deciding factor rather than the cache design.
 *
 * What the grid still buys, and why it stays: identical requests inside one
 * cell and one TTL window collapse to a single provider call at the CDN, no
 * visitor's precise position is ever sent to a third party, and the cache
 * key is stable enough for Vercel's edge to actually hit.
 *
 * ── Why the CDN and not a database table ────────────────────────────────
 * A `eta_cache` table was the original plan. With a 10-minute TTL it would
 * add a read *and* a write to the critical path of every call to save a
 * fraction of them — paying Supabase latency and rows for very little. A
 * cacheable GET lets Vercel's edge do the same job with no state to own and
 * no migration to maintain.
 */

export const prerender = false;

/** Mirrors the browser's own cap so the two can never disagree. */
const PROVIDER_TIMEOUT_MS = 3500;

/**
 * Long enough that a burst of visitors from one neighbourhood shares one
 * provider call, short enough that a duration is still true when served.
 * Traffic moves on a scale of minutes; anything longer and we would be
 * caching the very staleness this endpoint exists to remove.
 */
const EDGE_TTL_S = 600;

function json(body: unknown, status: number, cacheable: boolean): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Errors must never be cached at the edge — a transient provider
      // outage would otherwise be pinned to a grid cell for ten minutes.
      "cache-control": cacheable
        ? `public, s-maxage=${EDGE_TTL_S}, stale-while-revalidate=${EDGE_TTL_S * 3}`
        : "no-store",
    },
  });
}

export const GET: APIRoute = async ({ url, locals, request }) => {
  const { location } = locals.tenant;

  /*
   * The destination comes from the resolved tenant, never from the query.
   *
   * Accepting a caller-supplied destination would turn this into an open,
   * unauthenticated routing proxy funded by our Mapbox account: anyone could
   * bill arbitrary origin/destination pairs to us. Reading it from the Host
   * -resolved tenant means the only thing a caller controls is *their own*
   * position, which is all the feature needs.
   */
  const venue = venueCoords(location);
  if (!venue) return json({ error: "venue_without_coords" }, 422, false);

  /*
   * Cheap deterrent, not a security boundary.
   *
   * `Sec-Fetch-Site` is set by the browser and can't be spoofed from page
   * JavaScript, so it stops the trivial case of someone embedding our
   * endpoint in their own page. It does nothing against curl — the real
   * protections are the tenant-pinned destination above and the distance cap
   * below, which together bound what any caller can extract to "one duration
   * to one restaurant".
   */
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return json({ error: "cross_origin" }, 403, false);
  }

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const mode: TravelMode = url.searchParams.get("mode") === "walk" ? "walk" : "drive";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "bad_origin" }, 400, false);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ error: "bad_origin" }, 400, false);
  }

  /*
   * Re-snap server-side rather than trusting the client's quantisation.
   *
   * Two reasons: a caller could otherwise defeat the cache (and multiply our
   * bill) by jittering the last decimal, and the grid must be identical on
   * both sides or the edge cache key drifts and never hits.
   */
  const origin = snapForTelemetry({ lat, lng }, venue);

  const denseCore = isDenseCoreCity(location.city);
  const fallback = estimateTravel(origin, venue, mode, { denseCore });

  // Beyond the cap a routed duration is pointless and the provider call is
  // pure cost. The browser gates this too; this is the authoritative check.
  if (!fallback) return json({ error: "too_far" }, 422, false);

  const token = import.meta.env.MAPBOX_TOKEN;
  if (!token) {
    // Unconfigured is not an error state for the guest: hand back the
    // free-flow estimate so the feature degrades instead of breaking.
    return json({ ...fallback, traffic: false, reason: "provider_unconfigured" }, 200, true);
  }

  const routed = await fetchMapbox(origin, venue, mode, token);
  if (!routed) {
    return json({ ...fallback, traffic: false, reason: "provider_failed" }, 200, true);
  }

  return json(routed, 200, true);
};

interface RoutedResult {
  mode: TravelMode;
  durationMin: number;
  distanceKm: number;
  straightKm: number;
  source: "routed";
  /** Whether the duration reflects live traffic (driving only). */
  traffic: boolean;
}

async function fetchMapbox(
  origin: LatLng,
  venue: LatLng,
  mode: TravelMode,
  token: string,
): Promise<RoutedResult | null> {
  // `driving-traffic` is the whole point for cars. Walking has no traffic
  // dimension, so the plain profile is both correct and cheaper to compute.
  const profile = mode === "walk" ? "walking" : "driving-traffic";

  const endpoint =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${origin.lng},${origin.lat};${venue.lng},${venue.lat}`;

  const params = new URLSearchParams({
    // No geometry, no alternatives, no steps: we render a single number, and
    // asking for a polyline would inflate the response for nothing.
    overview: "false",
    alternatives: "false",
    steps: "false",
    access_token: token,
  });

  try {
    const res = await fetch(`${endpoint}?${params}`, {
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      code?: string;
      routes?: Array<{ duration?: number; distance?: number }>;
    };
    // Mapbox answers 200 with `code: "NoRoute"` for unroutable pairs (an
    // island, a pedestrian-only address), so status alone isn't enough.
    if (body.code && body.code !== "Ok") return null;

    const route = body.routes?.[0];
    if (!route?.duration || !route?.distance) return null;

    const distanceKm = route.distance / 1000;
    // A routed path far longer than our own cap allows means the provider
    // sent us somewhere unexpected; the free-flow estimate is safer.
    if (distanceKm > MAX_TRAVEL_KM * 2) return null;

    return {
      mode,
      // Rounded the same way the local model rounds, so switching between
      // routed and estimated values doesn't change the number's texture.
      durationMin: roundMinutes(route.duration / 60),
      distanceKm,
      // Real road geometry has no straight-line component; recompute it so
      // analytics keeps bucketing the same exact quantity either way.
      straightKm: haversineKm(origin, venue),
      source: "routed",
      traffic: profile === "driving-traffic",
    };
  } catch {
    // Timeout, DNS, TLS, malformed JSON — all one outcome for the caller.
    return null;
  }
}
