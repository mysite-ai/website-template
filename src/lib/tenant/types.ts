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
  logo_url: string | null;
  theme: TenantBrandTheme;
  tagline: string | null;
  about_md: string | null;
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
