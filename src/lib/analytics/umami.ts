/**
 * Tiny, safe wrapper around the Umami tracker for firing *programmatic*
 * custom events (as opposed to the declarative `data-umami-event`
 * attributes used on links/buttons).
 *
 * Use this for events that must fire on *success* rather than on click —
 * e.g. a QR code was actually generated, or a phone number was saved —
 * so the analytics reflect real conversions, not just intent.
 *
 * No-ops safely when:
 *   - running on the server (no `window`), or
 *   - the tenant has no Umami configured (script never loaded, so
 *     `window.umami` is undefined).
 */
type UmamiFn = {
  track: (
    event: string,
    data?: Record<string, unknown>,
  ) => void;
};

declare global {
  interface Window {
    umami?: UmamiFn;
  }
}

export function trackUmami(event: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the UX.
  }
}
