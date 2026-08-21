import { useEffect } from "react";

interface Props {
  websiteId: string;
  /**
   * When true, also load the session-replay recorder. Gated per-tenant
   * so recordings can be rolled out gradually (off by default). Requires
   * the "Replays" toggle enabled for this website in the Umami dashboard.
   */
  replay?: boolean;
}

/**
 * Loads Umami from the same-origin `/stats/` proxy (configured in
 * `vercel.json`) so it isn't blocked by ad-blockers.
 *
 * Two scripts, same `data-website-id`:
 *   1. `script.js`   — the core tracker (pageviews + `data-umami-event`s).
 *   2. `recorder.js` — session replay (rrweb), added *alongside* the
 *      tracker (it needs `window.umami.getSession()` from it). Requires
 *      Umami v3.1.0+ and the per-website "Replays" toggle enabled in the
 *      Umami dashboard; the sample rate / masking are controlled there.
 *      Loading it here is harmless when replays are off server-side.
 */
export default function Umami({ websiteId, replay = false }: Props) {
  useEffect(() => {
    if (!websiteId || typeof document === "undefined") return;

    // Core tracker.
    if (!document.querySelector('script[data-umami="tracker"]')) {
      const tracker = document.createElement("script");
      tracker.src = "/stats/script.js";
      tracker.async = true;
      tracker.defer = true;
      tracker.dataset.umami = "tracker";
      tracker.dataset.websiteId = websiteId;
      tracker.dataset.hostUrl = "/stats";
      // NOTE: we intentionally do NOT set data-do-not-track="true". With
      // it on, Umami skips any visitor whose browser sends the
      // Do-Not-Track signal — silently under-counting real traffic and
      // clicks. This is first-party, cookieless, same-origin analytics,
      // so we track everyone for complete numbers.
      document.head.appendChild(tracker);
    }

    // Session replay recorder — must load in addition to the tracker.
    // Gated per-tenant via `replay` so recordings only run where we've
    // opted in (currently Stacks). Config attributes: record 70% of
    // sessions, mask form inputs, cap each replay at 5 min. Loaded via
    // the /stats proxy (not the raw Umami URL) so it survives
    // ad-blockers, same as the tracker. Keep the dashboard's Replays
    // sample rate in sync (70%).
    if (replay && !document.querySelector('script[data-umami="recorder"]')) {
      const recorder = document.createElement("script");
      recorder.src = "/stats/recorder.js";
      recorder.async = true;
      recorder.defer = true;
      recorder.dataset.umami = "recorder";
      recorder.dataset.websiteId = websiteId;
      recorder.dataset.hostUrl = "/stats";
      recorder.dataset.sampleRate = "0.7";
      recorder.dataset.maskLevel = "moderate";
      recorder.dataset.maxDuration = "300000";
      document.head.appendChild(recorder);
    }
  }, [websiteId, replay]);

  return null;
}
