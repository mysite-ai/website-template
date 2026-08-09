import { useEffect } from "react";
import { trackMetaPageView, type PixelLocation } from "@/lib/attribution/metaPixel";

interface Props {
  location: PixelLocation;
}

/**
 * Mounted as `client:idle` so the initial page render isn't blocked by
 * pixel loading. Injects the fbq stub + init calls + a PageView.
 */
export default function MetaPixel({ location }: Props) {
  useEffect(() => {
    if (!location.metaPixelIds || location.metaPixelIds.length === 0) return;
    if (typeof window === "undefined") return;

    // fbq bootstrap (idempotent — Meta's snippet is safe to re-run).
    if (typeof window.fbq !== "function") {
      /* eslint-disable */
      // @ts-expect-error — Meta Pixel bootstrap
      !function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
    }

    for (const pixelId of location.metaPixelIds) {
      window.fbq?.("init", pixelId);
    }
    trackMetaPageView(location);
  }, [location]);

  return null;
}
