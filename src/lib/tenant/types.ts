import type { Menu } from "@/lib/menu/types";

export interface TenantOrganization {
  id: string;
  slug: string;
  name: string;
  default_locale: string;
}

export interface TenantBrandTheme {
  primary?: string;
  primary_foreground?: string;
}

export interface TenantBrand {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  /** The canonical "hero" logo — full wordmark, rendered above the H1. */
  logo_url: string | null;
  /** Optional compact/mark variant for the sticky Header. Falls back to logo_url when null. */
  logo_url_nav: string | null;
  favicon_url: string | null;
  theme: TenantBrandTheme;
  tagline: string | null;
  about_md: string | null;

  /** Per-tenant override for header logo height (px). Null = component default. */
  logo_header_height: number | null;
  /** Per-tenant override for hero logo max-height (px). Null = component default. */
  logo_hero_max_height: number | null;
}

export interface DeliveryLink {
  name: string;
  url: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface TenantLocation {
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

  delivery: DeliveryLink[];

  attribution_promotion_id: string | null;
  attribution_campaign_id: string | null;
  attribution_org_id: string | null;
  attribution_location_id: string | null;

  promotion_name_cached: string | null;
  reward_description_cached: string | null;

  umami_website_id: string | null;
  meta_pixel_ids: string[];

  gallery: GalleryImage[];
  menu: Menu | null;

  google_rating: number | null;
  google_reviews_count: number | null;
  google_place_url: string | null;
}

export type DomainKind = "mysite_single" | "mysite_multi" | "custom";

export interface TenantDomain {
  hostname: string;
  location_id: string;
  is_primary: boolean;
  kind: DomainKind;
}

export interface TenantContext {
  org: TenantOrganization;
  brand: TenantBrand;
  location: TenantLocation;
  domain: TenantDomain;
  primaryHostname: string;
  isPrimaryDomain: boolean;
}
