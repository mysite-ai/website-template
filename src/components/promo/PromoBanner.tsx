import { Gift, Clock } from "lucide-react";
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
 * - One headline + one subline. Optionally, one urgency countdown row
 *   underneath (opt-in per tenant). We initially shipped without a
 *   countdown, but low /rewards conversion (notably Stacks) pointed at a
 *   lack of urgency, so a *bounded, opt-in* countdown was added. It is
 *   OFF by default and only appears when a future deadline is provided.
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
      className="group relative block overflow-hidden rounded-2xl bg-primary px-6 py-5 text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.35),0_28px_60px_-30px_rgb(0_0_0/0.45)] ring-1 ring-inset ring-primary-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_40px_-16px_rgb(0_0_0/0.45),0_36px_80px_-30px_rgb(0_0_0/0.55)] active:translate-y-0 active:duration-75 sm:px-7 sm:py-6"
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
 * The urgency row. Rendered only when a deadline was passed down. Uses
 * the shared countdown hook (fixed-deadline mode). When the promo has
 * already expired, we render nothing so the banner silently degrades to
 * the plain CTA — no "0 days left" nag.
 */
function PromoCountdownRow({ deadline }: { deadline: string | Date }) {
  const countdown = usePromoCountdown(deadline);

  if (countdown.expired) return null;

  const { days, hours, minutes, seconds } = countdown;

  // Copy scales with remaining time: multi-day promos read as "Only N
  // days left" (calm but present); the final day switches to a live
  // HH:MM:SS clock to sharpen urgency.
  const urgencyLabel =
    days >= 1
      ? `Only ${days} ${days === 1 ? "day" : "days"} left`
      : `Ends in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <div className="relative mt-3.5 flex items-center gap-2 rounded-xl bg-primary-foreground/12 px-3.5 py-2.5 ring-1 ring-inset ring-primary-foreground/15">
      <Clock size={15} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] tabular-nums sm:text-[13.5px]">
        {urgencyLabel}
      </span>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
