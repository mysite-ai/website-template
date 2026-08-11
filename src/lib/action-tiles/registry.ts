import {
  Calendar,
  ExternalLink,
  Globe,
  Mail,
  MessageCircle,
  Navigation,
  Phone,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ActionTileType } from "@/lib/tenant/types";

/**
 * Registry mapping every supported action-tile `type` to:
 *   - the lucide icon rendered in the tile (single source of truth)
 *   - a default label the operator gets when they don't override it
 *   - a hint about the expected href scheme, purely for docs (the
 *     component doesn't validate — assumes the operator wrote a valid
 *     URL/uri).
 *   - a Umami analytics event name so every tile is trackable
 *     uniformly across tenants.
 *
 * Adding a new tile type is a two-line PR: extend `ActionTileType` in
 * tenant/types.ts and add an entry here.
 */

export interface TileDefinition {
  icon: LucideIcon;
  defaultLabel: string;
  hrefHint: string;
  umamiEvent: string;
}

export const TILE_REGISTRY: Record<ActionTileType, TileDefinition> = {
  call: {
    icon: Phone,
    defaultLabel: "Call",
    hrefHint: "tel:+15555550100",
    umamiEvent: "click-call",
  },
  directions: {
    icon: Navigation,
    defaultLabel: "Directions",
    hrefHint: "https://www.google.com/maps/search/?api=1&query=…",
    umamiEvent: "click-directions",
  },
  order: {
    icon: ShoppingBag,
    defaultLabel: "Order online",
    hrefHint: "https://wolt.com/…",
    umamiEvent: "click-order",
  },
  book: {
    icon: Calendar,
    defaultLabel: "Book a table",
    hrefHint: "https://opentable.com/… or https://resy.com/…",
    umamiEvent: "click-book",
  },
  reserve: {
    icon: Utensils,
    defaultLabel: "Reserve",
    hrefHint: "https://sevenrooms.com/… or a bespoke reservation form",
    umamiEvent: "click-reserve",
  },
  website: {
    icon: Globe,
    defaultLabel: "Website",
    hrefHint: "https://…",
    umamiEvent: "click-website",
  },
  whatsapp: {
    icon: MessageCircle,
    defaultLabel: "WhatsApp",
    hrefHint: "https://wa.me/15555550100",
    umamiEvent: "click-whatsapp",
  },
  email: {
    icon: Mail,
    defaultLabel: "Email",
    hrefHint: "mailto:hello@example.com",
    umamiEvent: "click-email",
  },
};

/**
 * Whether a tile's href should open in a new tab. Local schemes
 * (`tel:`, `mailto:`, `sms:`) stay in-page; everything else is treated
 * as an external navigation.
 */
export function isExternalHref(href: string): boolean {
  if (href.startsWith("tel:")) return false;
  if (href.startsWith("mailto:")) return false;
  if (href.startsWith("sms:")) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return false;
  return true;
}

/**
 * Icon fallback in the (extremely unlikely) event the resolver's
 * enum check somehow lets an unknown type through. Never reached in
 * normal operation — belt and suspenders.
 */
export const FALLBACK_ICON: LucideIcon = ExternalLink;
