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
  /**
   * `"icon"` — a square, icon-only chip sized to sit inside the Directions
   * row at the top of the page, where horizontal space is the constraint.
   * `"full"` — a labelled, full-width button for the Contact section, where
   * there is room to explain itself and no adjacent tile to compete with.
   */
  variant?: "icon" | "full";
  /**
   * Where this instance renders. Rides along on every event so the two
   * placements can be compared: the whole reason the top chip exists is a
   * suspicion that the bottom one goes unseen, and this is what settles it.
   */
  placement: string;
}

type Phase =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; origin: LatLng; estimate: TravelEstimate }
  | { status: "too-far"; km: number }
  | { status: "error"; kind: GeoErrorKind };

type GeoErrorKind = "denied" | "unavailable" | "timeout";

/**
 * Broadcast channel between the two instances on a page.
 *
 * Both placements render the same feature, but as separate islands they get
 * separate React state — so without this, tapping the top chip would leave
 * the bottom button still offering to do the thing that was already done,
 * and a guest scrolling down would see two different answers to one
 * question.
 *
 * The event carries the *precise* position rather than the snapped one so
 * both instances display identical numbers (a snapped hand-off would show
 * two figures a few hundred metres apart on the same page). It never leaves
 * the document — same-page state sharing, not transmission.
 *
 * Only the instance that actually asked for the fix reports to analytics;
 * listeners apply it silently. That keeps `eta-result` a count of real
 * measurements rather than a count of components mounted.
 */
const FIX_EVENT = "mysite:eta-fix";

type FixEventDetail = { origin: LatLng };

/**
 * "How long will it take me to get there?" — answered in one tap, from the
 * top of the page.
 *
 * ── Why a compact button + bottom sheet ─────────────────────────────────
 * The first cut rendered this only as a panel inside the Contact section at
 * the very bottom of the page, where it went unseen: travel time is a
 * *pre*-decision question, so it has to be reachable from the primary
 * action row too. But a full result panel in that row would push the other
 * actions down and make the row lopsided before anyone even taps.
 *
 * A bottom sheet resolves both: the trigger stays a quiet chip in the
 * action row, and the answer arrives in the thumb zone — which is also
 * where a phone user expects a result they may want to dismiss.
 *
 * Two instances render per page (`variant="icon"` in the action row,
 * `variant="full"` in Contact) and stay in lockstep through `FIX_EVENT`.
 * Both are the same component on purpose: a separate "small" version would
 * drift from this one the first time either changed.
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
export default function TravelTime({
  venue,
  country,
  venueName,
  locationId,
  variant = "icon",
  placement,
}: Props) {
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
            placement,
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
          placement,
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
    [imperial, placement, venue],
  );

  /**
   * Mount: listen for a fix found by the *other* instance, then either
   * replay one already captured in this session or find out whether asking
   * for one is even possible.
   */
  useEffect(() => {
    let cancelled = false;

    // Sibling instance found a fix — adopt it silently. `report: false`
    // because that instance already logged the measurement; counting it
    // twice would double every number in the funnel.
    const onSiblingFix = (e: Event) => {
      if (cancelled) return;
      const detail = (e as CustomEvent<FixEventDetail>).detail;
      if (!detail?.origin) return;
      applyPosition(detail.origin, mode, { report: false });
    };
    window.addEventListener(FIX_EVENT, onSiblingFix);

    const cleanup = () => {
      cancelled = true;
      window.removeEventListener(FIX_EVENT, onSiblingFix);
    };

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const saved = JSON.parse(raw) as LatLng;
        if (Number.isFinite(saved?.lat) && Number.isFinite(saved?.lng)) {
          // `report: false` — this visitor already produced an `eta-result`
          // when the fix was taken; re-firing it on every page view would
          // inflate the one metric this feature exists to measure.
          applyPosition(saved, mode, { report: false });
          return cleanup;
        }
      }
    } catch {
      // Private-mode / quota failures are not worth a branch.
    }

    // Permissions API is absent on some older Safari builds; leaving the
    // state `null` means "unknown", which keeps the trigger visible.
    if (!navigator.permissions?.query) return cleanup;

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

    return cleanup;
    // Mount-only: `mode` is read once to replay a cached fix, and
    // `applyPosition` is stable for a given venue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const requestLocation = useCallback(
    (forMode: TravelMode) => {
      if (!("geolocation" in navigator)) {
        setPhase({ status: "error", kind: "unavailable" });
        trackUmami("eta-permission", { state: "unavailable", placement });
        return;
      }

      setPhase({ status: "locating" });

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mountedRef.current) return;
          const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          trackUmami("eta-permission", { state: "granted", placement });

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

          // Bring the sibling instance up to date so a guest who scrolls on
          // doesn't meet a button offering to redo what just happened.
          window.dispatchEvent(
            new CustomEvent<FixEventDetail>(FIX_EVENT, { detail: { origin } }),
          );
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
          trackUmami("eta-permission", { state: kind, placement });
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
    [applyPosition, cacheKey, placement, venue],
  );

  const handleTrigger = useCallback(() => {
    trackUmami("eta-intent", { mode, placement });
    setOpen(true);
    // A replayed fix is already in `ready` — don't re-prompt, just show it.
    if (phase.status === "idle" || phase.status === "error") {
      requestLocation(mode);
    }
  }, [mode, phase.status, placement, requestLocation]);

  const switchMode = useCallback(
    (next: TravelMode) => {
      setMode(next);
      // Recomputing is free and offline; no second prompt, no second call.
      if (phase.status === "ready") {
        applyPosition(phase.origin, next, { report: false });
        trackUmami("eta-mode-switch", { mode: next, placement });
      }
    },
    [applyPosition, phase, placement],
  );

  // Nothing we can offer: both placements sit next to a Directions link.
  if (permission === "denied") return null;

  /**
   * The result, condensed to a label. Shown on both variants once a fix is
   * known, so a guest gets the answer without opening anything — and, for
   * the icon variant, so the row isn't left with a mystery glyph.
   */
  const answer =
    phase.status === "ready" ? `~${formatDuration(phase.estimate.durationMin)}` : null;

  return (
    <>
      {variant === "icon" ? (
        /*
         * Icon-only, and square while it has nothing to say — the action row
         * is horizontally tight, and a labelled chip here would crowd the
         * Directions tile it belongs to. `self-stretch` makes it match that
         * tile's height exactly, whatever the tile's content does, which is
         * what keeps the row's vertical rhythm intact.
         *
         * Once the answer exists the chip widens to show it: at that point
         * the number has earned the space the label never did.
         */
        <button
          type="button"
          onClick={handleTrigger}
          aria-label={answer ? `Travel time: ${answer}` : "Check travel time"}
          title={answer ? `${answer} away` : "Check travel time"}
          className={cn(
            "group/eta flex shrink-0 items-center justify-center gap-1.5 self-stretch rounded-2xl border border-foreground/15 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_18px_-12px_rgb(0_0_0/0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.05] active:translate-y-0 active:scale-[0.99]",
            answer ? "px-4" : "aspect-square w-[52px]",
          )}
        >
          <Car
            size={18}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-primary transition-transform duration-200 group-hover/eta:scale-110"
          />
          {answer && (
            <span className="text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
              {answer}
            </span>
          )}
        </button>
      ) : (
        /*
         * Full-width and labelled, matching the Directions link it sits
         * under in the Contact card. Down here there is no adjacent tile to
         * crowd and no guarantee the guest saw the icon chip at the top, so
         * this one spells itself out.
         */
        <button
          type="button"
          onClick={handleTrigger}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-card text-[13.5px] font-medium text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted active:translate-y-px"
        >
          <Car size={16} strokeWidth={1.75} aria-hidden="true" />
          {answer ? `${answer} away — see details` : "Check travel time"}
        </button>
      )}

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
