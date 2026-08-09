import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Polish phone stored as either `+48500000000` or `500000000`
 * into `+48 500 000 000` for display. Non-PL phones are returned as-is
 * with light grouping.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  const match = /^\+48(\d{9})$/.exec(digits) ?? /^(\d{9})$/.exec(digits);
  if (match?.[1]) {
    const n = match[1];
    return `+48 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return digits;
}

export function stripSlash(value: string): string {
  return value.replace(/\/$/, "");
}
