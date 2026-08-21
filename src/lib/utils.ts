import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a phone number stored as E.164 (or any other libphonenumber-js
 * parseable form) into a human-readable international string:
 *
 *   "+48500111222"     -> "+48 500 111 222"
 *   "+15555550100"     -> "+1 555 555 0100"
 *   "500111222"        -> "500 111 222"   (national, no country context)
 *
 * When parsing fails we return the raw input untouched — better a raw
 * number than blowing up a footer or contact card.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw)
    ?? parsePhoneNumberFromString(raw, "PL");
  return parsed ? parsed.formatInternational() : raw;
}

export function stripSlash(value: string): string {
  return value.replace(/\/$/, "");
}

/**
 * Append MySite attribution UTMs to an outbound link to the tenant's own
 * ("regular") website. Lets the client see in their own Google Analytics
 * that the traffic was sent from their MySite.ai site.
 *
 *   utm_source   = mysite.ai
 *   utm_medium   = referral
 *   utm_campaign = <the MySite hostname that sent them>, e.g.
 *                  "lindleypet.mysite.social"
 *
 * Existing UTM params on the stored URL are overwritten so the source is
 * unambiguous. Falls back to the raw string if it isn't a valid URL.
 */
export function withMysiteUtms(rawUrl: string, campaign?: string | null): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("utm_source", "mysite.ai");
    url.searchParams.set("utm_medium", "referral");
    if (campaign) url.searchParams.set("utm_campaign", campaign);
    return url.toString();
  } catch {
    return rawUrl;
  }
}
