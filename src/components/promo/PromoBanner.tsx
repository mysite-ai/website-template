import { Gift } from "lucide-react";
import { usePromoCountdown } from "@/lib/promo/usePromoCountdown";

interface Props {
  href: string;
  /** The single big headline. Short and grabby, e.g. "-50% OFF ANY DRINK!". */
  headline: string;
  /** Small line under the headline — the tap invitation. */
  subline: string;
  /**
   * Optional promo deadline (ISO string or Date). When set AND in the
   * future, the banner renders a live urgency countdown ("Only N days
   * left"). Controlled per-tenant via `promo_countdown_enabled` +
   * `promo_deadline` — the parent only passes a value here when the
   * countdown is enabled and the deadline hasn't passed.
   */
  deadline?: string | Date | null;
}

/**
 * PromoBanner — the primary click-bait CTA at the top of the hero.
 *
 * Design contract:
 * - One headline + one subline. Optionally, a live DD:HH:MM:SS countdown
 *   underneath (opt-in per tenant). We initially shipped without a
 *   countdown, but low /rewards conversion (notably Stacks) pointed at a
 *   lack of urgency, so a *bounded, opt-in* ticking countdown was added.
 *   It is OFF by default and only appears when a future deadline is
 *   provided (the seconds visibly tick so the offer feels time-boxed).
 * - Sized to be unmistakably the primary action on a phone: large tap
 *   target, big headline, prominent icon. It should out-weigh the logo.
 * - Uses --primary / --primary-foreground so per-brand overrides
 *   propagate automatically.
 * - Icons are real lucide glyphs — an inline emoji renders as tofu on
 *   some fonts (Android WebView, older Chromium builds).
 */
export default function PromoBanner({ href, headline, subline, deadline }: Props) {
  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-inset ring-primary-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 active:translate-y-0 active:duration-75 sm:px-7 sm:py-6"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      {/* Subtle diagonal shine on hover, one accent that reads as "premium". */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-primary-foreground/10 opacity-0 blur-md transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100"
      />

      <div className="relative flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-foreground/15 ring-1 ring-inset ring-primary-foreground/20"
        >
          <Gift size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[18px] font-semibold leading-tight tracking-tight sm:text-[20px]">
            {headline}
          </p>
          <p className="mt-1 text-[13.5px] leading-snug text-primary-foreground/85 sm:text-[14px]">
            {subline}
          </p>
        </div>
      </div>

      {deadline != null && <PromoCountdownRow deadline={deadline} />}
    </a>
  );
}

/**
 * The urgency countdown. Rendered only when a deadline was passed down.
 * A real, always-ticking DD:HH:MM:SS clock — the seconds visibly count
 * down so the promo feels time-boxed and live. Uses the shared countdown
 * hook (fixed-deadline mode). When the promo has already expired we
 * render nothing, so the banner silently degrades to the plain CTA.
 */
function PromoCountdownRow({ deadline }: { deadline: string | Date }) {
  const countdown = usePromoCountdown(deadline);

  if (countdown.expired) return null;

  const { days, hours, minutes, seconds } = countdown;

  const segments: Array<{ value: number; label: string }> = [
    { value: days, label: days === 1 ? "Day" : "Days" },
    { value: hours, label: "Hrs" },
    { value: minutes, label: "Min" },
    { value: seconds, label: "Sec" },
  ];

  return (
    <div className="relative mt-4 rounded-xl bg-primary-foreground/10 px-3 py-2.5 ring-1 ring-inset ring-primary-foreground/15 sm:px-3.5">
      <p className="mb-2 text-center text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary-foreground/75">
        Hurry — offer ends in
      </p>
      <div className="flex items-start justify-center gap-1.5 sm:gap-2">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex items-start gap-1.5 sm:gap-2">
            <div className="flex w-[46px] flex-col items-center sm:w-[52px]">
              <div className="grid h-11 w-full place-items-center rounded-lg bg-primary-foreground/15 ring-1 ring-inset ring-primary-foreground/20 sm:h-12">
                <span className="text-[22px] font-bold leading-none tabular-nums sm:text-[25px]">
                  {pad(seg.value)}
                </span>
              </div>
              <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-primary-foreground/70 sm:text-[10px]">
                {seg.label}
              </span>
            </div>
            {i < segments.length - 1 && (
              <span
                aria-hidden="true"
                className="pt-2 text-[20px] font-bold leading-none text-primary-foreground/45 sm:pt-2.5 sm:text-[22px]"
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
