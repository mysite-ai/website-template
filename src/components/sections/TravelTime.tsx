import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Car, Footprints, LoaderCircle, MapPin, Navigation, RotateCw } from "lucide-react";
import { identifyUmami, trackUmami } from "@/lib/analytics/umami";
import {
  distanceBucket,
  estimateTravel,
  etaBucket,
  formatDistance,
  formatDuration,
  haversineKm,
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
  /** Stable key for the per-session result cache. */
  locationId: string;
  /** Google Maps deep link, used as the fallback whenever we can't measure. */
  directionsHref: string | null;
}

type Phase =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; origin: LatLng; estimate: TravelEstimate }
  | { status: "too-far"; km: number }
  | { status: "error"; kind: GeoErrorKind };

type GeoErrorKind = "denied" | "unavailable" | "timeout";

/**
 * "How long will it take me to get there?" — answered in one tap.
 *
 * ── Why this is an estimate and not a routed ETA ────────────────────────
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
 *
 * ── The behavioural signal ──────────────────────────────────────────────
 * This is the highest-intent event the site can produce — stronger than a
 * Directions click, because it carries *distance*. Two things are emitted:
 *   - `eta-*` events, for the funnel (intent → permission → result);
 *   - session properties via `identifyUmami`, so every later event in the
 *     session (order, call, reward) can be sliced by how far away the
 *     guest was. That's what tells us which radius actually converts.
 */
export default function TravelTime({ venue, country, locationId, directionsHref }: Props) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const [mode, setMode] = useState<TravelMode>("drive");
  /**
   * `null` = unknown/unsupported (assume we may ask). `"denied"` lets us
   * skip rendering a button that could only ever fail: a browser-level
   * block can't be undone from JS, so offering the tap would burn trust
   * and pollute the funnel with intent we can never fulfil.
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
   * Per-session memo of the fix, so switching drive↔walk, or coming back to
   * the page from /menu, re-renders instantly instead of re-prompting.
   * Position is snapped before storage — the precise fix is never persisted
   * anywhere, not even in this tab.
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
        const dist = distanceBucket(estimate.distanceKm, imperial);

        trackUmami("eta-result", {
          outcome: "ok",
          mode: forMode,
          source: estimate.source,
          duration_min: estimate.durationMin,
          eta_bucket: eta,
          distance_bucket: dist,
          // Snapped to a few hundred metres — enough to map a catchment
          // area, useless for locating a person. See `snapForTelemetry`.
          lat: snapped.lat,
          lng: snapped.lng,
        });

        // Session-scoped, so *later* events inherit the segmentation.
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
    // state `null` means "unknown", which keeps the button visible.
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
      trackUmami("eta-intent", { mode: forMode, target: "section-location" });

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

  // A hard browser-level block can't be recovered from in-page: offer the
  // one thing that still works instead of a button that cannot succeed.
  if (permission === "denied" && phase.status === "idle") {
    return directionsHref ? <MapsFallback href={directionsHref} /> : null;
  }

  return (
    <div className="mt-4 rounded-xl bg-muted/40 p-3.5 ring-1 ring-inset ring-foreground/[0.07]">
      {phase.status === "idle" && (
        <button
          type="button"
          onClick={() => requestLocation(mode)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-card text-[13.5px] font-medium text-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted active:translate-y-px"
        >
          <Car size={16} strokeWidth={1.75} aria-hidden="true" />
          Check travel time
        </button>
      )}

      {phase.status === "locating" && (
        <div
          className="flex h-10 items-center justify-center gap-2 text-[13.5px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
          Getting your location…
        </div>
      )}

      {phase.status === "ready" && (
        <Result
          estimate={phase.estimate}
          mode={mode}
          imperial={imperial}
          onSwitchMode={switchMode}
          directionsHref={directionsHref}
        />
      )}

      {phase.status === "too-far" && (
        <div className="text-center">
          <p className="text-[13.5px] text-muted-foreground">
            <MapPin size={14} strokeWidth={1.75} aria-hidden="true" className="mr-1 inline align-[-2px]" />
            About {formatDistance(phase.km, imperial)} away
          </p>
          {directionsHref && <MapsLink href={directionsHref} className="mt-2" />}
        </div>
      )}

      {phase.status === "error" && (
        <ErrorState
          kind={phase.kind}
          directionsHref={directionsHref}
          onRetry={() => requestLocation(mode)}
        />
      )}
    </div>
  );
}

/**
 * The answer. Duration is the hero — it is the question that was asked —
 * with distance as supporting detail on the same line.
 */
function Result({
  estimate,
  mode,
  imperial,
  onSwitchMode,
  directionsHref,
}: {
  estimate: TravelEstimate;
  mode: TravelMode;
  imperial: boolean;
  onSwitchMode: (m: TravelMode) => void;
  directionsHref: string | null;
}) {
  // Offering "walk" for a 20 km trip is noise, and in Phase 2 it would be a
  // wasted paid call. The toggle only exists where walking is plausible.
  const showWalkToggle = estimate.distanceKm <= WALK_MAX_KM || mode === "walk";
  const Icon = mode === "walk" ? Footprints : Car;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-card ring-1 ring-inset ring-foreground/10"
        >
          <Icon size={17} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[19px] font-semibold leading-none tracking-tight tabular-nums">
            {/* The "~" is load-bearing: this is a model, not a measurement. */}~
            {formatDuration(estimate.durationMin)}
            <span className="ml-2 text-[13.5px] font-normal text-muted-foreground">
              {formatDistance(estimate.distanceKm, imperial)}
            </span>
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Estimated {mode === "walk" ? "walk" : "drive"} from your location
          </p>
        </div>

        {showWalkToggle && (
          <div
            className="flex shrink-0 gap-1 rounded-lg bg-card p-0.5 ring-1 ring-inset ring-foreground/10"
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

      {directionsHref && <MapsLink href={directionsHref} className="mt-3" />}
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
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Error states each get the action that can actually resolve them —
 * a retry for transient failures, Maps for a permanent refusal. A dead end
 * with an apology would waste the strongest intent signal on the page.
 */
function ErrorState({
  kind,
  directionsHref,
  onRetry,
}: {
  kind: GeoErrorKind;
  directionsHref: string | null;
  onRetry: () => void;
}) {
  const canRetry = kind !== "denied";
  const message =
    kind === "denied"
      ? "Location access is off."
      : kind === "timeout"
        ? "Couldn't get your location in time."
        : "Location isn't available on this device.";

  return (
    <div className="text-center">
      <p className="text-[13px] text-muted-foreground">{message}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-card px-3 text-[13px] font-medium ring-1 ring-foreground/10 transition-colors hover:bg-muted"
          >
            <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
            Try again
          </button>
        )}
        {directionsHref && <MapsLink href={directionsHref} />}
      </div>
    </div>
  );
}

function MapsLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-primary hover:underline",
        className,
      )}
      data-umami-event="click-directions"
      data-umami-event-target="section-eta"
    >
      <Navigation size={14} strokeWidth={2} aria-hidden="true" />
      Open in Maps
    </a>
  );
}

function MapsFallback({ href }: { href: string }) {
  return (
    <div className="mt-4 rounded-xl bg-muted/40 p-3.5 text-center ring-1 ring-inset ring-foreground/[0.07]">
      <MapsLink href={href} />
    </div>
  );
}
