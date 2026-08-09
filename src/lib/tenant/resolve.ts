import { getServerSupabase } from "@/lib/supabase/server";
import { parseMenu } from "@/lib/menu/parse";
import type {
  DeliveryLink,
  GalleryImage,
  TenantBrand,
  TenantContext,
  TenantDomain,
  TenantLocation,
  TenantOrganization,
} from "./types";

// ---------------------------------------------------------------------------
// Small LRU cache keyed by hostname. 60s TTL, natural-expiry only — no
// realtime invalidation in v1. Operators pick up domain changes on the
// next 60s tick or on redeploy.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 512;

type CacheEntry = {
  value: TenantContext | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Move-to-front for LRU behavior.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: TenantContext | null) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearTenantCache() {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Host normalization: lowercase + strip port ONLY. `www.` is preserved —
// `www.karat.pl` and `karat.pl` are separate rows in template_domains.
// ---------------------------------------------------------------------------

export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const host = rawHost.trim().toLowerCase();
  if (!host) return null;
  const noPort = host.replace(/:\d+$/, "");
  return noPort || null;
}

// ---------------------------------------------------------------------------
// Row -> typed model coercions. We only trust the columns we know about;
// unknown JSON shapes fall back to safe defaults.
// ---------------------------------------------------------------------------

function coerceDelivery(raw: unknown): DeliveryLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const name = (entry as Record<string, unknown>).name;
      const url = (entry as Record<string, unknown>).url;
      if (typeof name !== "string" || typeof url !== "string") return null;
      return { name, url } satisfies DeliveryLink;
    })
    .filter((v): v is DeliveryLink => v !== null);
}

function coerceGallery(raw: unknown): GalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const src = (entry as Record<string, unknown>).src;
      const alt = (entry as Record<string, unknown>).alt;
      if (typeof src !== "string") return null;
      return { src, alt: typeof alt === "string" ? alt : "" } satisfies GalleryImage;
    })
    .filter((v): v is GalleryImage => v !== null);
}

function coerceTheme(raw: unknown): TenantBrand["theme"] {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const theme: TenantBrand["theme"] = {};
  if (typeof record.primary === "string") theme.primary = record.primary;
  if (typeof record.primary_foreground === "string") {
    theme.primary_foreground = record.primary_foreground;
  }
  return theme;
}

// ---------------------------------------------------------------------------
// Resolver — one query joins domain -> location -> brand -> org, then a
// second query finds the primary hostname for canonical URLs.
// ---------------------------------------------------------------------------

interface DomainJoinRow {
  hostname: string;
  is_primary: boolean;
  kind: TenantDomain["kind"];
  location: LocationJoinRow | null;
}

interface LocationJoinRow {
  id: string;
  brand_id: string;
  slug: string;
  name: string;
  address_line: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  weekday_hours: string | null;
  weekend_hours: string | null;
  maps_embed_url: string | null;
  maps_search_query: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  delivery: unknown;
  attribution_promotion_id: string | null;
  attribution_campaign_id: string | null;
  attribution_org_id: string | null;
  attribution_location_id: string | null;
  promotion_name_cached: string | null;
  reward_description_cached: string | null;
  umami_website_id: string | null;
  meta_pixel_ids: string[] | null;
  gallery: unknown;
  menu: unknown;
  brand: BrandJoinRow | null;
}

interface BrandJoinRow {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  favicon_url: string | null;
  theme: unknown;
  tagline: string | null;
  about_md: string | null;
  organization: TenantOrganization | null;
}

export async function resolveTenant(rawHost: string): Promise<TenantContext | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const cached = cacheGet(host);
  if (cached) return cached.value;

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("template_domains")
    .select(
      `
        hostname, is_primary, kind,
        location:template_locations!inner (
          id, brand_id, slug, name,
          address_line, city, region, postal_code, country,
          latitude, longitude, phone, email,
          weekday_hours, weekend_hours,
          maps_embed_url, maps_search_query,
          instagram_url, facebook_url, delivery,
          attribution_promotion_id, attribution_campaign_id,
          attribution_org_id, attribution_location_id,
          promotion_name_cached, reward_description_cached,
          umami_website_id, meta_pixel_ids, gallery, menu,
          brand:template_brands!inner (
            id, org_id, slug, name, logo_url, favicon_url, theme, tagline, about_md,
            organization:template_organizations!inner (
              id, slug, name, default_locale
            )
          )
        )
      `,
    )
    .eq("hostname", host)
    .maybeSingle<DomainJoinRow>();

  if (error) {
    console.error("[tenant] resolve error", { host, error: error.message });
    // Do NOT cache errors — we want the next request to retry.
    return null;
  }
  if (!data || !data.location || !data.location.brand || !data.location.brand.organization) {
    cacheSet(host, null);
    return null;
  }

  const primary = await primaryHostnameFor(data.location.id, host, data.is_primary);

  const org: TenantOrganization = data.location.brand.organization;
  const brand: TenantBrand = {
    id: data.location.brand.id,
    org_id: data.location.brand.org_id,
    slug: data.location.brand.slug,
    name: data.location.brand.name,
    logo_url: data.location.brand.logo_url,
    favicon_url: data.location.brand.favicon_url,
    theme: coerceTheme(data.location.brand.theme),
    tagline: data.location.brand.tagline,
    about_md: data.location.brand.about_md,
  };
  const location: TenantLocation = {
    id: data.location.id,
    brand_id: data.location.brand_id,
    slug: data.location.slug,
    name: data.location.name,
    address_line: data.location.address_line,
    city: data.location.city,
    region: data.location.region,
    postal_code: data.location.postal_code,
    country: data.location.country,
    latitude: data.location.latitude,
    longitude: data.location.longitude,
    phone: data.location.phone,
    email: data.location.email,
    weekday_hours: data.location.weekday_hours,
    weekend_hours: data.location.weekend_hours,
    maps_embed_url: data.location.maps_embed_url,
    maps_search_query: data.location.maps_search_query,
    instagram_url: data.location.instagram_url,
    facebook_url: data.location.facebook_url,
    delivery: coerceDelivery(data.location.delivery),
    attribution_promotion_id: data.location.attribution_promotion_id,
    attribution_campaign_id: data.location.attribution_campaign_id,
    attribution_org_id: data.location.attribution_org_id,
    attribution_location_id: data.location.attribution_location_id,
    promotion_name_cached: data.location.promotion_name_cached,
    reward_description_cached: data.location.reward_description_cached,
    umami_website_id: data.location.umami_website_id,
    meta_pixel_ids: data.location.meta_pixel_ids ?? [],
    gallery: coerceGallery(data.location.gallery),
    menu: parseMenu(data.location.menu),
  };
  const domain: TenantDomain = {
    hostname: data.hostname,
    location_id: data.location.id,
    is_primary: data.is_primary,
    kind: data.kind,
  };

  const ctx: TenantContext = {
    org,
    brand,
    location,
    domain,
    primaryHostname: primary,
    isPrimaryDomain: data.is_primary,
  };

  cacheSet(host, ctx);
  return ctx;
}

async function primaryHostnameFor(
  locationId: string,
  currentHost: string,
  currentIsPrimary: boolean,
): Promise<string> {
  if (currentIsPrimary) return currentHost;

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("template_domains")
    .select("hostname")
    .eq("location_id", locationId)
    .eq("is_primary", true)
    .maybeSingle<{ hostname: string }>();

  return data?.hostname ?? currentHost;
}

/**
 * Preview-cookie override: `?tenant=<location-slug>` when `x-preview=1`
 * cookie is present. Returns null if any check fails.
 */
export async function resolvePreviewTenant(locationSlug: string): Promise<TenantContext | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("template_locations")
    .select("id")
    .eq("slug", locationSlug)
    .maybeSingle<{ id: string }>();

  if (error || !data) return null;

  // Reuse the resolver via the primary hostname for that location.
  const { data: dom } = await supabase
    .from("template_domains")
    .select("hostname")
    .eq("location_id", data.id)
    .eq("is_primary", true)
    .maybeSingle<{ hostname: string }>();

  if (!dom) return null;
  return resolveTenant(dom.hostname);
}
