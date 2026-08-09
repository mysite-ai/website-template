/**
 * Client-side attribution collector.
 *
 * Ported VERBATIM from wbc-v2's `useQrTracker.ts` cookie/localStorage
 * harvesting — same keys, same source-of-truth precedence
 * (query -> sessionStorage). `gclid`/`gbraid`/`wbraid` are intentionally
 * NOT captured; matches wbc-v2 exactly.
 */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "r",
  "c",
] as const;

const ATTRIBUTION_KEYS = [...UTM_KEYS, "fbclid"] as const;

const STORAGE_PREFIX = "_attr_";

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getCookie(name: string): string | null {
  if (!canUseBrowser()) return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export function getGaSessionCookie(): string | null {
  if (!canUseBrowser()) return null;
  const match = document.cookie.split("; ").find((c) => /^_ga_/.test(c.split("=")[0] ?? ""));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export function persistUtmParams() {
  if (!canUseBrowser()) return;
  const params = new URLSearchParams(window.location.search);
  for (const key of ATTRIBUTION_KEYS) {
    const val = params.get(key);
    if (val) {
      try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, val);
      } catch {
        /* private mode */
      }
    }
  }
}

export function getAttributionParam(key: string): string | null {
  if (!canUseBrowser()) return null;
  const params = new URLSearchParams(window.location.search);
  const current = params.get(key);
  if (current) return current;
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    return null;
  }
}

export function getMultiFbc(): string | null {
  if (!canUseBrowser()) return null;
  try {
    return localStorage.getItem("multiFbc");
  } catch {
    return null;
  }
}
