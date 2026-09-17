import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Apple, Car, Footprints, LoaderCircle, MapPin, Navigation, RotateCw, X } from "lucide-react";
import { identifyUmami, trackUmami } from "@/lib/analytics/umami";
import {
  appleMapsHref,
  distanceBucket,
  estimateTravel,
  etaBucket,
  formatDistance,
  formatDuration,
  googleMapsHref,
  haversineKm,
  prefersAppleMaps,
  snapForTelemetry,
  usesImperial,
  WALK_MAX_KM,
  type LatLng,
  type TravelEstimate,
  type TravelMode,
} from "@/lib/geo/travel-time";
import { cn } from "@/lib/utils";

interface Props {
  venue: LatLng;
  /** Venue country — decides km vs mi. See `usesImperial`. */
  country: string | null;
  /** Venue display name, used as the Apple Maps pin label. */
  venueName: string;
  /** Stable key for the per-session result cache. */
  locationId: string;
}

type Phase =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; origin: LatLng; estimate: TravelEstimate }
  | { status: "too-far"; km: number }
  | { status: "error"; kind: GeoErrorKind };

type GeoErrorKind = "denied" | "unavailable" | "timeout";

/**
 * "How long will it take me to get there?" — answered in one tap, from the
 * top of the page.
 *
 * ── Why a compact button + bottom sheet ─────────────────────────────────
 * The first cut rendered this as a panel inside the Contact section at the
 * very bottom of the page, where it went unseen: travel time is a *pre*-
 * decision question, so it has to sit next to Directions in the primary
 * action row, not below the opening hours. But a full result panel in that
 * row would push the other actions down and make the row lopsided before
 * anyone even taps.
 *
 * A bottom sheet resolves both: the trigger stays a single quiet chip in
 * the action row, and the answer arrives in the thumb zone — which is also
 * where a phone user expects a result they may want to dismiss.
 *
 * ── Why an estimate and not a routed ETA ────────────────────────────────
 * Everything is computed in the browser from the venue's coordinates and
 * the visitor's position (see lib/geo/travel-time.ts). No routing API is
 * called, so the feature has no marginal cost and cannot be turned into a
 * bill by someone hammering the button. The trade-off is precision, which
 * is why every number is prefixed "~" and the footnote says "estimated".
 *
 * ── Why the position never leaves the device un-snapped ─────────────────
 * The visitor granted location access to learn a travel time. The precise
 * fix is used for exactly that, in memory; anything reported to analytics
 * is quantised to a grid first (`snapForTelemetry`) and reduced to buckets.
 */
export default function TravelTime({ venue, country, venueName, locationId }: Props) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TravelMode>("drive");
  /**
   * `null` = unknown/unsupported (assume we may ask). `"denied"` hides the
   * trigger entirely: a browser-level block can't be undone from JS, so
   * offering the tap would burn trust and pollute the funnel with intent
   * we can never fulfil. Directions still sits next to us in the row, so
   * nothing is lost by staying quiet.
   */
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const imperial = usesImperial(country);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Per-session memo of the fix, so re-opening the sheet, switching
   * drive↔walk, or coming back from /menu answers instantly instead of
   * re-prompting. Snapped before storage — the precise fix is never
   * persisted anywhere, not even in this tab.
   */
  const cacheKey = `eta:${locationId}`;

  const applyPosition = useCallback(
    (origin: LatLng, forMode: TravelMode, opts: { report: boolean }) => {
      const estimate = estimateTravel(origin, venue, forMode);

      if (!estimate) {
        const km = haversineKm(origin, venue);
        setPhase({ status: "too-far", km });
        if (opts.report) {
          trackUmami("eta-result", {
            outcome: "too_far",
            distance_bucket: distanceBucket(km, imperial),
          });
        }
        return;
      }

      setPhase({ status: "ready", origin, estimate });

      if (opts.report) {
        const snapped = snapForTelemetry(origin, venue);
        const eta = etaBucket(estimate.durationMin);
        // Straight-line, not road distance: this dimension exists to size
        // an ad-targeting radius, and a radius is a circle. See
        // `distanceBucket`.
        const dist = distanceBucket(estimate.straightKm, imperial);

        trackUmami("eta-result", {
          outcome: "ok",
          mode: forMode,
          source: estimate.source,
          duration_min: estimate.durationMin,
          eta_bucket: eta,
          distance_bucket: dist,
          // Kept as a separate field so the two are never confused in a
          // report: this one is modelled, `distance_bucket` is exact.
          road_distance_bucket: distanceBucket(estimate.distanceKm, imperial),
          // Snapped to a few hundred metres — enough to map a catchment
          // area, useless for locating a person. See `snapForTelemetry`.
          lat: snapped.lat,
          lng: snapped.lng,
        });

        // Session-scoped, so *later* events (order, call, reward) inherit
        // the segmentation. That's what tells us which radius converts.
        identifyUmami({ eta_bucket: eta, distance_bucket: dist });
      }
    },
    [imperial, venue],
  );

  /**
   * Mount: replay a fix already captured in this session, otherwise find
   * out whether asking for one is even possible.
   */
  useEffect(() => {
    let cancelled = false;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const saved = JSON.parse(raw) as LatLng;
        if (Number.isFinite(saved?.lat) && Number.isFinite(saved?.lng)) {
          // `report: false` — this visitor already produced an `eta-result`
          // when the fix was taken; re-firing it on every page view would
          // inflate the one metric this feature exists to measure.
          applyPosition(saved, mode, { report: false });
          return;
        }
      }
    } catch {
      // Private-mode / quota failures are not worth a branch.
    }

    // Permissions API is absent on some older Safari builds; leaving the
    // state `null` means "unknown", which keeps the trigger visible.
    if (!navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((res) => {
        if (cancelled) return;
        setPermission(res.state);
        res.addEventListener("change", () => {
          if (!cancelled) setPermission(res.state);
        });
      })
      .catch(() => {
        /* treat as unknown */
      });

    return () => {
      cancelled = true;
    };
    // Mount-only: `mode` is read once to replay a cached fix, and
    // `applyPosition` is stable for a given venue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const requestLocation = useCallback(
    (forMode: TravelMode) => {
      if (!("geolocation" in navigator)) {
        setPhase({ status: "error", kind: "unavailable" });
        trackUmami("eta-permission", { state: "unavailable" });
        return;
      }

      setPhase({ status: "locating" });

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mountedRef.current) return;
          const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          trackUmami("eta-permission", { state: "granted" });

          try {
            // Store snapped, never precise.
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify(snapForTelemetry(origin, venue)),
            );
          } catch {
            /* non-fatal */
          }

          applyPosition(origin, forMode, { report: true });
        },
        (err) => {
          if (!mountedRef.current) return;
          const kind: GeoErrorKind =
            err.code === err.PERMISSION_DENIED
              ? "denied"
              : err.code === err.TIMEOUT
                ? "timeout"
                : "unavailable";
          setPhase({ status: "error", kind });
          trackUmami("eta-permission", { state: kind });
        },
        {
          // A city-block-accurate fix from Wi-Fi/cell towers returns in
          // well under a second; forcing the GPS radio would cost 5-15s
          // and a visible battery hit to sharpen a number we then round
          // to the nearest 5 minutes.
          enableHighAccuracy: false,
          timeout: 8000,
          // Reuse a recent fix from another site/tab — instant answer.
          maximumAge: 300_000,
        },
      );
    },
    [applyPosition, cacheKey, venue],
  );

  const handleTrigger = useCallback(() => {
    trackUmami("eta-intent", { mode, target: "quick-actions" });
    setOpen(true);
    // A replayed fix is already in `ready` — don't re-prompt, just show it.
    if (phase.status === "idle" || phase.status === "error") {
      requestLocation(mode);
    }
  }, [mode, phase.status, requestLocation]);

  const switchMode = useCallback(
    (next: TravelMode) => {
      setMode(next);
      // Recomputing is free and offline; no second prompt, no second call.
      if (phase.status === "ready") {
        applyPosition(phase.origin, next, { report: false });
        trackUmami("eta-mode-switch", { mode: next });
      }
    },
    [applyPosition, phase],
  );

  // Nothing we can offer: the row already has a Directions tile.
  if (permission === "denied") return null;

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-foreground/15 bg-card px-3.5 text-[12.5px] font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.05] active:translate-y-px"
      >
        <Car size={15} strokeWidth={2} aria-hidden="true" className="text-primary" />
        {/* Answers "why would I tap this?" without a tooltip. */}
        {phase.status === "ready"
          ? `~${formatDuration(phase.estimate.durationMin)} away`
          : "Travel time"}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        {phase.status === "locating" && <LocatingState />}

        {phase.status === "ready" && (
          <ReadyState
            estimate={phase.estimate}
            mode={mode}
            imperial={imperial}
            venue={venue}
            venueName={venueName}
            onSwitchMode={switchMode}
          />
        )}

        {phase.status === "too-far" && (
          <TooFarState
            km={phase.km}
            imperial={imperial}
            venue={venue}
            venueName={venueName}
          />
        )}

        {phase.status === "error" && (
          <ErrorState
            kind={phase.kind}
            venue={venue}
            venueName={venueName}
            onRetry={() => requestLocation(mode)}
          />
        )}
      </Sheet>
    </>
  );
}

/**
 * Minimal bottom sheet, hand-rolled rather than composed from
 * `@/components/ui/sheet`.
 *
 * That primitive pulls `@base-ui/react`'s dialog into the bundle, which
 * measured at 21.8 kB gzipped against 4.0 kB for this component — a 5×
 * increase in the JavaScript every visitor downloads on the home page, for
 * one optional panel. `GalleryBrowser.tsx` made the same call for its
 * lightbox ("Follows shadcn Dialog conventions but styled for image
 * preview"), so this matches an established pattern in the repo rather
 * than inventing one.
 *
 * What the primitive would have given us is reproduced here because it is
 * genuinely needed: `role="dialog"` + `aria-modal`, Escape to close,
 * backdrop click to close, scroll lock, and focus moved into the panel on
 * open. What is deliberately skipped is a full focus trap — the sheet has
 * at most four controls and closes on Escape or an outside tap, so the
 * cost of the extra dependency is not justified by the marginal gain.
 */
function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Same scroll-lock approach as GalleryBrowser's lightbox.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus in so Escape and screen readers land on the panel, not on
    // the trigger behind the backdrop.
    panelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in-0 duration-150 supports-backdrop-filter:backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Travel time"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-popover px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 text-popover-foreground shadow-2xl outline-none animate-in slide-in-from-bottom duration-200"
      >
        {/* Grab handle — the affordance that says "swipe me away". */}
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-foreground/15" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        {children}
      </div>
    </div>
  );
}

function LocatingState() {
  return (
    <div className="py-6 text-center" role="status" aria-live="polite">
      <h2 className="sr-only">Getting your location</h2>
      <LoaderCircle
        size={22}
        strokeWidth={2}
        aria-hidden="true"
        className="mx-auto animate-spin text-muted-foreground"
      />
      <p className="mt-3 text-[13.5px] text-muted-foreground">Getting your location…</p>
    </div>
  );
}

/**
 * The answer. Duration is the hero — it is the question that was asked —
 * with distance as supporting detail, then the hand-off to a real map.
 */
function ReadyState({
  estimate,
  mode,
  imperial,
  venue,
  venueName,
  onSwitchMode,
}: {
  estimate: TravelEstimate;
  mode: TravelMode;
  imperial: boolean;
  venue: LatLng;
  venueName: string;
  onSwitchMode: (m: TravelMode) => void;
}) {
  // Offering "walk" for a 20 km trip is noise, and in a routed future it
  // would be a wasted paid call. The toggle only exists where plausible.
  const showWalkToggle = estimate.straightKm <= WALK_MAX_KM || mode === "walk";

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 text-[34px] font-semibold leading-none tracking-tight tabular-nums">
            {/* The "~" is load-bearing: this is a model, not a measurement. */}
            ~{formatDuration(estimate.durationMin)}
            <span className="text-[15px] font-normal text-muted-foreground">
              {formatDistance(estimate.distanceKm, imperial)}
            </span>
          </h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Estimated {mode === "walk" ? "walk" : "drive"} to {venueName}
          </p>
        </div>

        {showWalkToggle && (
          <div
            className="flex shrink-0 gap-1 rounded-lg bg-muted/60 p-0.5 ring-1 ring-inset ring-foreground/10"
            role="group"
            aria-label="Travel mode"
          >
            <ModeButton active={mode === "drive"} label="Drive" onClick={() => onSwitchMode("drive")}>
              <Car size={15} strokeWidth={1.75} aria-hidden="true" />
            </ModeButton>
            <ModeButton active={mode === "walk"} label="Walk" onClick={() => onSwitchMode("walk")}>
              <Footprints size={15} strokeWidth={1.75} aria-hidden="true" />
            </ModeButton>
          </div>
        )}
      </div>

      <MapHandoff venue={venue} venueName={venueName} />
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TooFarState({
  km,
  imperial,
  venue,
  venueName,
}: {
  km: number;
  imperial: boolean;
  venue: LatLng;
  venueName: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight">
        <MapPin size={19} strokeWidth={2} aria-hidden="true" className="text-muted-foreground" />
        About {formatDistance(km, imperial)} away
      </h2>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        Too far for a useful estimate — open a map for the full route.
      </p>
      <MapHandoff venue={venue} venueName={venueName} />
    </div>
  );
}

/**
 * Error states each get the action that can actually resolve them — a
 * retry for transient failures, a map for a permanent refusal. A dead end
 * with an apology would waste the strongest intent signal on the page.
 */
function ErrorState({
  kind,
  venue,
  venueName,
  onRetry,
}: {
  kind: GeoErrorKind;
  venue: LatLng;
  venueName: string;
  onRetry: () => void;
}) {
  const canRetry = kind !== "denied";
  const message =
    kind === "denied"
      ? "Location access is off"
      : kind === "timeout"
        ? "Couldn't get your location in time"
        : "Location isn't available here";

  return (
    <div>
      <h2 className="text-[19px] font-semibold tracking-tight">{message}</h2>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
        {canRetry
          ? "Try again, or open a map to see the route."
          : "Open a map to see the route to us."}
      </p>

      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-card text-[13.5px] font-medium ring-1 ring-foreground/10 transition-colors hover:bg-muted active:translate-y-px"
        >
          <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
          Try again
        </button>
      )}

      <MapHandoff venue={venue} venueName={venueName} />
    </div>
  );
}

/**
 * Hand-off to a real map, once the guest knows the trip is worth making.
 *
 * Both platforms get their native default, ordered so the likely one comes
 * first — on iOS a Google-only link is a dead end for anyone without the
 * app installed. Coordinates rather than a name, so a chain can't resolve
 * to the wrong branch.
 */
function MapHandoff({ venue, venueName }: { venue: LatLng; venueName: string }) {
  const [appleFirst, setAppleFirst] = useState(false);

  // Deferred to an effect: the UA check must not run during SSR, and a
  // hydration mismatch on the primary CTA would be worse than a repaint.
  useEffect(() => setAppleFirst(prefersAppleMaps()), []);

  const apple = (
    <MapLink key="apple" href={appleMapsHref(venue, venueName)} provider="apple" primary={appleFirst}>
      <Apple size={15} strokeWidth={2} aria-hidden="true" />
      Apple Maps
    </MapLink>
  );
  const google = (
    <MapLink key="google" href={googleMapsHref(venue)} provider="google" primary={!appleFirst}>
      <Navigation size={15} strokeWidth={2} aria-hidden="true" />
      Google Maps
    </MapLink>
  );

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {appleFirst ? [apple, google] : [google, apple]}
    </div>
  );
}

function MapLink({
  href,
  provider,
  primary,
  children,
}: {
  href: string;
  provider: string;
  primary: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[13.5px] font-medium transition-all active:translate-y-px",
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "bg-card text-foreground ring-1 ring-foreground/10 hover:bg-muted",
      )}
      data-umami-event="click-directions"
      data-umami-event-target={`eta-sheet-${provider}`}
    >
      {children}
    </a>
  );
}
