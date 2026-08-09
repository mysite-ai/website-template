/**
 * Meta Pixel helper. Adapted from wbc-v2/src/lib/metaPixel.ts. The
 * `location` argument is a subset shape drawn from the tenant context —
 * only the fields the pixel actually reads, so the hook stays framework-
 * agnostic (works from React islands OR plain scripts).
 */

import {
  getAttributionParam,
  getCookie,
  getMultiFbc,
  persistUtmParams,
} from "@/lib/attribution/tracking";

export interface PixelLocation {
  slug: string;
  city: string | null;
  region: string | null;
  attributionPromotionId: string | null;
  attributionCampaignId: string | null;
  attributionOrgId: string | null;
  metaPixelIds: string[];
}

type MetaParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* silent — private browsing */
  }
}

function getReferrerHost(): string | null {
  if (!canUseBrowser() || !document.referrer) return null;
  try {
    return new URL(document.referrer).host;
  } catch {
    return null;
  }
}

function getPageParams(): MetaParams {
  if (!canUseBrowser()) return {};
  return {
    page_path: window.location.pathname,
    page_url: `${window.location.origin}${window.location.pathname}`,
    referrer_host: getReferrerHost(),
  };
}

function getAttributionParams(): MetaParams {
  const keys = ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "r", "c"] as const;
  const acc: MetaParams = {};
  for (const key of keys) {
    const value = getAttributionParam(key);
    if (value) acc[key] = value;
  }
  return acc;
}

function getLocationParams(loc: PixelLocation): MetaParams {
  return {
    location_slug: loc.slug,
    location_city: loc.city,
    location_region: loc.region,
    promotion_id: loc.attributionPromotionId,
    campaign_id: loc.attributionCampaignId,
    org_id: loc.attributionOrgId,
  };
}

function cleanParams(params: MetaParams): MetaParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  );
}

export function getMetaEventId(eventName: string) {
  const random =
    canUseBrowser() && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `mysite.${eventName}.${Date.now()}.${random}`;
}

function getCommonParams(loc: PixelLocation, extra: MetaParams = {}): MetaParams {
  return cleanParams({
    pixel_ids: loc.metaPixelIds.join(","),
    content_category: "loyalty",
    fbc: getCookie("_fbc"),
    fbp: getCookie("_fbp"),
    multi_fbc: getMultiFbc(),
    ...getPageParams(),
    ...getAttributionParams(),
    ...getLocationParams(loc),
    ...extra,
  });
}

function sendPixelEvent(
  mode: "track" | "trackCustom",
  eventName: string,
  loc: PixelLocation,
  params: MetaParams = {},
  eventID = getMetaEventId(eventName),
) {
  if (!canUseBrowser() || typeof window.fbq !== "function") return null;
  persistUtmParams();
  const payload = getCommonParams(loc, { ...params, event_id: eventID });
  window.fbq(mode, eventName, payload, { eventID });
  return eventID;
}

export function trackMetaPageView(loc: PixelLocation) {
  return sendPixelEvent("track", "PageView", loc, {
    content_name: "MySite page view",
  });
}

export function trackQrGenerated(loc: PixelLocation, eventID?: string) {
  return sendPixelEvent(
    "trackCustom",
    "QRGenerated",
    loc,
    { content_name: "QR code generated", conversion_type: "micro_conversion" },
    eventID,
  );
}

export function trackLeadSubmitted(loc: PixelLocation, eventID?: string) {
  return sendPixelEvent(
    "track",
    "Lead",
    loc,
    { content_name: "Phone number submitted", conversion_type: "lead", lead_type: "phone_submission" },
    eventID,
  );
}

export function trackMetaEventOnce(storageKey: string, track: () => string | null) {
  if (!canUseBrowser()) return null;
  if (readStorage(localStorage, storageKey)) return null;
  const eventID = track();
  if (eventID) {
    writeStorage(
      localStorage,
      storageKey,
      JSON.stringify({ eventID, trackedAt: new Date().toISOString() }),
    );
  }
  return eventID;
}
