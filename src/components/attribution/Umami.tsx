import { useEffect } from "react";

interface Props {
  websiteId: string;
}

/**
 * Loads the Umami analytics script from the same-origin `/stats/` proxy
 * so it's not blocked by ad-blockers. The rewrite is configured in
 * `vercel.json`.
 */
export default function Umami({ websiteId }: Props) {
  useEffect(() => {
    if (!websiteId || typeof document === "undefined") return;
    if (document.querySelector('script[data-website-id]')) return;

    const script = document.createElement("script");
    script.src = "/stats/script.js";
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = websiteId;
    script.dataset.hostUrl = "/stats";
    // NOTE: we intentionally do NOT set data-do-not-track="true". With it
    // on, Umami skips any visitor whose browser sends the Do-Not-Track
    // signal — silently under-counting real traffic and clicks. Since
    // this is first-party, cookieless, same-origin-proxied analytics, we
    // track everyone so the visit/click numbers are complete.
    document.head.appendChild(script);
  }, [websiteId]);

  return null;
}
