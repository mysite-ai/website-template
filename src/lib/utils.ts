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
