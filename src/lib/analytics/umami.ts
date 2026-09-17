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
  /**
   * Attaches properties to the *session* rather than to a single event.
   * Available in the Umami tracker we load; optional here so a stale
   * cached script can't throw.
   */
  identify?: (data: Record<string, unknown>) => void;
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

/**
 * Attaches properties to the current Umami *session*, so every subsequent
 * event in it can be filtered by them.
 *
 * The reason this exists alongside `trackUmami`: event properties can only
 * be read on the event that carried them. Knowing a visitor was "12 minutes
 * away" is only interesting in combination with what they did *next* —
 * whether they went on to order, call, or claim a reward. Session
 * properties are what make that join possible in the dashboard, turning a
 * one-off measurement into a segment.
 *
 * Keep the value space small and stable (buckets, not raw numbers) — these
 * become filter dimensions, and a high-cardinality one is unreadable.
 */
export function identifyUmami(data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.identify?.(data);
  } catch {
    // Same contract as above: analytics is never load-bearing.
  }
}
