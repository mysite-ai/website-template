/**
 * Travel-time estimation — pure geometry, zero network, zero cost.
 *
 * Phase 1 of the "check your travel time" feature. Everything here runs in
 * the visitor's browser from two pieces of data we already have:
 *
 *   1. the venue's `latitude` / `longitude` (already in `TenantLocation`,
 *      shipped inside the SSR HTML), and
 *   2. the visitor's position from `navigator.geolocation`.
 *
 * No routing API is involved, so a visitor hammering the button costs us
 * exactly nothing. That is the whole point of shipping this shape first:
 * we get the *behavioural signal* (who is 3 minutes away vs. 25) at $0 and
 * with no Maps-Platform terms to satisfy, and only pay for real routed
 * durations later, once the click-through numbers justify it.
 *
 * ── Accuracy expectation ────────────────────────────────────────────────
 * Validated against 10 known off-peak Google Maps durations across Warsaw,
 * New York and Los Angeles: mean absolute error ~9%, worst case ~35% on the
 * hardest case, with a deliberate lean towards over- rather than
 * under-promising. See `DRIVE_SEGMENTS` for the fit and its caveats.
 *
 * That is why every rendered value is prefixed with "~" and labelled as an
 * estimate: it is good enough to answer "is this place close to me?" (the
 * only question a guest actually asks) and not good enough to pretend it is
 * a live, traffic-aware ETA.
 *
 * ── Forward compatibility with Phase 2 ──────────────────────────────────
 * `TravelEstimate.source` distinguishes `"estimate"` (this file) from
 * `"routed"` (a real Directions/Routes response). When a routing provider
 * is added behind `/api/eta`, the UI keeps its shape: the same object comes
 * back with `source: "routed"`, and the component drops the "~".
 */

import type { TenantLocation } from "@/lib/tenant/types";

export type TravelMode = "drive" | "walk";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TravelEstimate {
  mode: TravelMode;
  /** Minutes, already rounded for display. */
  durationMin: number;
  /** Road distance (straight line × detour factor), kilometres. */
  distanceKm: number;
  /** How the numbers were produced. See file header. */
  source: "estimate" | "routed";
}

/**
 * Beyond this, a straight-line estimate stops being useful — the detour
 * factor and average-speed model both fall apart once a trip is mostly
 * motorway, and nobody decides where to eat dinner based on a 90-minute
 * drive. We show a bare "≈ N km away" instead of a duration.
 *
 * It is also the gate that Phase 2's server endpoint will reuse to refuse
 * routing calls outright, so keeping the constant here means the two
 * phases can never disagree about what "too far" means.
 */
export const MAX_TRAVEL_KM = 60;

/**
 * Above this, offering a "walk" option is noise — and in Phase 2 it would
 * also be a wasted second API call, since practically nobody walks 40
 * minutes to a restaurant. The walking toggle only appears under it.
 */
export const WALK_MAX_KM = 2.5;

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight line → road distance.
 *
 * A street network never lets you travel the diagonal. For trips whose
 * bearing is uniformly distributed over a perfect grid the ratio works out
 * to 4/π ≈ 1.27, and real cities sit above that on short hops (one-ways,
 * dead ends, rivers) and below it on long ones (arterials and ring roads
 * straighten the path out).
 *
 * ── Why the curve is interpolated rather than stepped ───────────────────
 * Same trap as `driveMinutes`: a factor that *jumps* at a threshold makes
 * the reported road distance fall as the straight line grows (1.99 km at
 * ×1.35 = 2.69 km, but 2.01 km at ×1.28 = 2.57 km). Interpolating between
 * the anchors keeps `straightKm × factor` strictly increasing, so distance
 * and duration both stay monotonic.
 *
 * Walking beats driving here because pedestrians cut through squares,
 * passages and parks that a car has to drive around.
 */
const DRIVE_DETOUR_ANCHORS: Array<[km: number, factor: number]> = [
  [0, 1.4],
  [2, 1.35],
  [10, 1.28],
  [60, 1.2],
];

const WALK_DETOUR_ANCHORS: Array<[km: number, factor: number]> = [
  [0, 1.22],
  [1, 1.15],
];

/** Piecewise-linear lookup, clamped at both ends. */
function interpolate(anchors: Array<[number, number]>, x: number): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];

  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i]!;
    const [x0, y0] = anchors[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

function detourFactor(straightKm: number, mode: TravelMode): number {
  return interpolate(
    mode === "walk" ? WALK_DETOUR_ANCHORS : DRIVE_DETOUR_ANCHORS,
    straightKm,
  );
}

/**
 * Driving time for a road distance, in minutes.
 *
 * ── Why segments and not "distance → average speed" ─────────────────────
 * The obvious model is a lookup from trip length to an average speed. It is
 * also broken: because the speed *jumps* at each threshold, the total time
 * can go **down** as the trip gets longer. A first cut of this file did
 * exactly that — 6.2 km estimated 20 min while 6.4 km estimated 15 min —
 * which is indefensible on a multi-location brand, where a guest comparing
 * two venues would be told the further one is quicker to reach.
 *
 * So the trip is integrated over distance instead, like a progressive tax:
 * the first kilometre is always crawled at 16 km/h, the next two at
 * 18 km/h, and so on. Total time is a sum of positive terms that each grow
 * with distance, so it is monotonic by construction — no threshold can ever
 * produce a discontinuity — while the *effective* average speed still rises
 * naturally with trip length (≈15 km/h over 1.4 km, ≈27 km/h over 10 km,
 * ≈58 km/h over 40 km), which is the real-world behaviour we wanted.
 *
 * ── Where the numbers come from ─────────────────────────────────────────
 * Fitted against 10 known off-peak Google Maps durations spread across the
 * two markets we actually operate in — dense European centre (Warsaw:
 * Nowy Świat, Pl. Zbawiciela, Mokotów, Ursynów, Wilanów, Modlin airport)
 * and US grid/freeway cities (Manhattan → Chelsea and Brooklyn Heights,
 * DTLA → Pasadena and Santa Monica). Mean absolute error 9%, and the
 * residual bias is deliberately kept slightly *pessimistic* (+2%): a guest
 * who arrives sooner than promised is pleased, one who arrives later feels
 * misled, so the fit is scored with an explicit penalty on underestimates.
 *
 * That two-market spread matters: an earlier set of speeds tuned by eye on
 * Warsaw alone overestimated freeway-heavy LA trips by up to 59% (DTLA →
 * Pasadena read 35 min against a real 22). If these constants are ever
 * retuned, re-check both markets — a set that looks excellent on one is
 * routinely wrong on the other.
 */
const DRIVE_SEGMENTS: Array<{ upToKm: number; kmh: number }> = [
  { upToKm: 1, kmh: 16 }, //   junctions, lights, turns dominate
  { upToKm: 3, kmh: 18 }, //   still city streets
  { upToKm: 8, kmh: 30 }, //   arterials appear
  { upToKm: 20, kmh: 70 }, //  mostly arterials / ring roads / freeway
  { upToKm: Infinity, kmh: 90 }, // motorway share dominates
];

function driveMinutes(roadKm: number): number {
  let remaining = roadKm;
  let hours = 0;
  let consumed = 0;

  for (const seg of DRIVE_SEGMENTS) {
    if (remaining <= 0) break;
    const span = Math.min(remaining, seg.upToKm - consumed);
    hours += span / seg.kmh;
    remaining -= span;
    consumed += span;
  }

  return hours * 60;
}

/** Comfortable adult walking pace, km/h. Flat and constant on purpose. */
const WALK_SPEED_KMH = 4.8;

/**
 * Minutes added to every driving estimate for the parts of the trip that
 * aren't driving — walking to the car, and finding a spot at the other end.
 *
 * Kept at one minute because the reference durations this model is fitted
 * against (Google Maps) are pure drive times that exclude parking too;
 * a larger constant made the fit systematically pessimistic (+8% bias,
 * worst case +50%) without describing anything real.
 */
const DRIVE_OVERHEAD_MIN = 1;

/**
 * Rounds a raw duration to a value that reads as an estimate rather than a
 * measurement. "23 min" implies precision this model does not have, so
 * anything past 10 minutes snaps to 5-minute steps — the same convention
 * every navigation app uses for far-away destinations.
 */
function roundMinutes(raw: number): number {
  if (raw < 10) return Math.max(1, Math.round(raw));
  if (raw < 60) return Math.round(raw / 5) * 5;
  return Math.round(raw / 10) * 10;
}

/**
 * The estimator. Takes the *precise* visitor position (see the note on
 * `snapForTelemetry` for why precise is right here) and returns a display
 * ready estimate, or `null` when the venue is further away than
 * `MAX_TRAVEL_KM`.
 */
export function estimateTravel(
  origin: LatLng,
  venue: LatLng,
  mode: TravelMode,
): TravelEstimate | null {
  const straightKm = haversineKm(origin, venue);
  if (straightKm > MAX_TRAVEL_KM) return null;

  const distanceKm = straightKm * detourFactor(straightKm, mode);
  const raw =
    mode === "walk"
      ? (distanceKm / WALK_SPEED_KMH) * 60
      : driveMinutes(distanceKm) + DRIVE_OVERHEAD_MIN;

  return {
    mode,
    durationMin: roundMinutes(raw),
    distanceKm,
    source: "estimate",
  };
}

/* ────────────────────────────── Snapping ──────────────────────────────── */

/**
 * Grid resolution (in degrees) used when a position leaves the device.
 *
 * Two jobs, both of which want the same thing:
 *
 *   1. **Privacy.** A guest granted location access so we could tell them
 *      how far away lunch is — not so we could file their doorstep. Snapped
 *      coordinates answer every question we will realistically ask of this
 *      data ("which neighbourhoods do our guests come from?") while being
 *      useless for identifying a household.
 *
 *   2. **Cost, later.** Phase 2's routing cache is keyed on the snapped
 *      origin, so every visitor inside one cell shares one paid API call.
 *      A venue with a 5 km catchment has a few dozen live cells instead of
 *      thousands of distinct coordinates, which turns per-click cost into
 *      per-neighbourhood cost. Introducing the snap now — while it is free
 *      to change — means the telemetry we collect in Phase 1 is already in
 *      the coordinate space Phase 2 will bill against.
 *
 * The step widens with distance: near the venue we care about which street
 * you came from, 40 km out the town is the only meaningful unit.
 */
function snapStepDeg(straightKm: number): number {
  if (straightKm < 2) return 0.0025; // ≈ 280 m
  if (straightKm < 10) return 0.005; // ≈ 550 m
  return 0.01; //                        ≈ 1.1 km
}

const snap = (value: number, step: number) =>
  // Re-rounding to 4 decimals kills the float dust that `round(v/step)*step`
  // leaves behind (0.0075 * 3 = 0.022500000000000003), which would otherwise
  // produce two different cache keys for one grid cell in Phase 2.
  Number((Math.round(value / step) * step).toFixed(4));

/**
 * Quantises a position for anything that leaves the device — analytics
 * today, a routing request tomorrow.
 *
 * Note the asymmetry, which is intentional: the *displayed* estimate is
 * computed from the precise position (the visitor deserves the accurate
 * answer they granted permission for), while everything we *transmit* is
 * snapped. The two differ by at most a few hundred metres, well inside the
 * model's own error bar.
 *
 * ── Why the longitude step is stretched ─────────────────────────────────
 * A degree of longitude shrinks with latitude (at 52°N — Warsaw — it is
 * 342 m against 556 m for a degree of latitude). Using one step for both
 * axes would make cells 1.6× narrower than they are tall, which inflates
 * the cell count for no accuracy gain and skews Phase 2's cache the wrong
 * way. Dividing the longitude step by cos(latitude) squares the cells up.
 *
 * The correction keys off the **venue's** latitude, not the visitor's, so
 * it is a constant per location: the grid is a fixed property of the venue
 * that a server can reproduce exactly from tenant data, with no dependence
 * on whoever happens to be asking.
 */
export function snapForTelemetry(origin: LatLng, venue: LatLng): LatLng {
  const latStep = snapStepDeg(haversineKm(origin, venue));
  // Clamped so a venue near the poles can't blow the step up towards infinity.
  const lngStep = latStep / Math.max(0.2, Math.cos(toRad(venue.lat)));
  return { lat: snap(origin.lat, latStep), lng: snap(origin.lng, lngStep) };
}

/* ───────────────────────────── Presentation ───────────────────────────── */

const KM_PER_MILE = 1.609344;

/**
 * Countries whose road signage is in miles. Everywhere else gets
 * kilometres — including the tenants we run in Poland, where "3.1 mi"
 * would read as an error rather than a distance.
 *
 * Driven off `location.country` (the venue) rather than the browser's
 * locale on purpose: a US visitor loading a Warsaw restaurant is looking
 * at Polish roads, and a "2 mi" label they can't match to any local sign
 * helps nobody.
 */
const IMPERIAL_COUNTRIES = new Set(["US", "GB", "LR", "MM"]);

export function usesImperial(country: string | null | undefined): boolean {
  return IMPERIAL_COUNTRIES.has((country ?? "").toUpperCase());
}

/**
 * Distance for display. Sub-kilometre trips get a metres/feet figure —
 * "0.3 km" is how far away a spreadsheet is, "300 m" is how far away a
 * walk is.
 */
export function formatDistance(km: number, imperial: boolean): string {
  if (imperial) {
    const miles = km / KM_PER_MILE;
    if (miles < 0.2) return `${Math.round((miles * 5280) / 50) * 50} ft`;
    return `${miles.toFixed(1)} mi`;
  }
  if (km < 1) return `${Math.round((km * 1000) / 50) * 50} m`;
  return `${km.toFixed(1)} km`;
}

/** "8 min" / "1 h 5 min" — never a bare ">60 min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/* ─────────────────────────── Analytics buckets ────────────────────────── */

/**
 * Low-cardinality buckets for Umami.
 *
 * Raw minutes and kilometres are useless in an event-property report: a
 * hundred distinct values produce a hundred one-row groups. Buckets are
 * what actually get read — "of guests who checked, how many were inside
 * 10 minutes, and did *those* people go on to order?" — and they are the
 * shape that feeds a targeting radius back into ad campaigns.
 */
export function etaBucket(min: number): string {
  if (min < 5) return "0-5min";
  if (min < 10) return "5-10min";
  if (min < 20) return "10-20min";
  if (min < 30) return "20-30min";
  return "30min+";
}

export function distanceBucket(km: number, imperial: boolean): string {
  const v = imperial ? km / KM_PER_MILE : km;
  const unit = imperial ? "mi" : "km";
  if (v < 1) return `0-1${unit}`;
  if (v < 3) return `1-3${unit}`;
  if (v < 5) return `3-5${unit}`;
  if (v < 10) return `5-10${unit}`;
  if (v < 25) return `10-25${unit}`;
  return `25${unit}+`;
}

/**
 * Server-side render gate. A tenant without coordinates ships zero extra
 * JavaScript — same pattern as `hasTaggableOutboundLink` in
 * lib/attribution/outbound.ts. Two of the 65 locations in the DB have no
 * coordinates today, and this is what keeps the section from rendering a
 * button that could only ever fail for them.
 */
export function venueCoords(location: TenantLocation): LatLng | null {
  const { latitude, longitude } = location;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: latitude, lng: longitude };
}
