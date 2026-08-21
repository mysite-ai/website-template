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

/**
 * Supported action-tile types. This is a closed enum on purpose —
 * every tile ships with a hardcoded icon + default label + link
 * treatment so the "Action tiles" grid stays visually consistent
 * across every tenant.
 *
 * To add a new type: extend both this union AND the TILE_REGISTRY
 * in src/lib/action-tiles/registry.ts. Unknown types coming back
 * from the DB are silently dropped by the renderer, so DB changes
 * that anticipate a new type are safe to apply before the code
 * ships.
 */
export type ActionTileType =
  | "call"
  | "directions"
  | "order"
  | "book"
  | "reserve"
  | "website"
  | "whatsapp"
  | "email";

export interface ActionTile {
  type: ActionTileType;
  /** Destination — `tel:`, `mailto:`, `https:` etc. Required. */
  href: string;
  /** Optional override for the default label from the registry. */
  label?: string;
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

  /**
   * Ordered list of "next step" tiles shown below the Hero. When
   * `null`, `QuickActions.astro` falls back to an auto-derived
   * default (Directions + first Order provider, if configured). Set
   * to `[]` to render no tiles at all.
   */
  action_tiles: ActionTile[] | null;

  attribution_promotion_id: string | null;
  attribution_campaign_id: string | null;
  attribution_org_id: string | null;
  attribution_location_id: string | null;

  promotion_name_cached: string | null;
  reward_description_cached: string | null;

  /**
   * Urgency countdown for the hero PromoBanner. When
   * `promo_countdown_enabled` is true AND `promo_deadline` is a future
   * date, the banner shows a live "Only N days left" counter. Both are
   * per-location so multi-location tenants can run different windows.
   * Off for every tenant by default (see migration 030).
   */
  promo_countdown_enabled: boolean;
  /** ISO timestamp for when the promotion ends. Null = no countdown. */
  promo_deadline: string | null;

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
