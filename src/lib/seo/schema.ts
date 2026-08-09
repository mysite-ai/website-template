import type { TenantContext } from "@/lib/tenant/types";

export interface LocationSeoInput {
  tenant: TenantContext;
  path: string;
  title?: string;
  description?: string;
}

export interface LocationSeoResult {
  title: string;
  description: string;
  canonical: string;
  jsonLd: string;
}

function baseUrl(hostname: string): string {
  return `https://${hostname}`;
}

/**
 * Builds title, canonical, and JSON-LD (LocalBusiness/Restaurant) for a
 * given page under a tenant. Uses `primaryHostname` for canonical URLs
 * so alias domains (e.g. www.karat.pl) don't create dupes.
 */
export function buildLocationSeo(input: LocationSeoInput): LocationSeoResult {
  const { tenant, path } = input;
  const { org, brand, location, primaryHostname } = tenant;

  const displayName =
    brand.slug === location.slug
      ? brand.name
      : `${brand.name} · ${location.name}`;

  const title = input.title ?? `${displayName} — ${location.city ?? org.name}`;
  const description =
    input.description ??
    brand.tagline ??
    `${displayName}${location.city ? ` in ${location.city}` : ""}. Menu, hours, directions, and rewards.`;
  const canonical = `${baseUrl(primaryHostname)}${path.startsWith("/") ? path : `/${path}`}`;

  const jsonLd = JSON.stringify(buildJsonLd(tenant, canonical, displayName, description));

  return { title, description, canonical, jsonLd };
}

interface JsonLdRestaurant {
  "@context": "https://schema.org";
  "@type": "Restaurant";
  name: string;
  url: string;
  description: string;
  telephone?: string;
  email?: string;
  image?: string;
  address?: {
    "@type": "PostalAddress";
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: { "@type": "GeoCoordinates"; latitude: number; longitude: number };
  openingHours?: string[];
  sameAs?: string[];
  hasMenu?: string;
}

function buildJsonLd(
  tenant: TenantContext,
  canonical: string,
  displayName: string,
  description: string,
): JsonLdRestaurant {
  const { brand, location, primaryHostname } = tenant;

  const address = location.address_line
    ? {
        "@type": "PostalAddress" as const,
        streetAddress: location.address_line,
        addressLocality: location.city ?? undefined,
        addressRegion: location.region ?? undefined,
        postalCode: location.postal_code ?? undefined,
        addressCountry: location.country,
      }
    : undefined;

  const geo =
    location.latitude != null && location.longitude != null
      ? {
          "@type": "GeoCoordinates" as const,
          latitude: location.latitude,
          longitude: location.longitude,
        }
      : undefined;

  const sameAs = [location.instagram_url, location.facebook_url].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: displayName,
    url: canonical,
    description,
    telephone: location.phone ?? undefined,
    email: location.email ?? undefined,
    image: brand.logo_url ?? undefined,
    address,
    geo,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    hasMenu: `${baseUrl(primaryHostname)}/menu`,
  };
}
