import { Gift } from "lucide-react";

interface Props {
  href: string;
  /** The single big headline. Short and grabby, e.g. "-50% OFF ANY DRINK!". */
  headline: string;
  /** Small line under the headline — the tap invitation. */
  subline: string;
}

/**
 * PromoBanner — a single, compact click-bait CTA at the top of the
 * hero. Modeled after the White Bear Coffee promo pill on
 * marszalkowska.thewhitebearcoffee.pl (which converts).
 *
 * Design contract:
 * - One headline + one subline. Nothing else. No live counter, no
 *   countdown clock (proven distracting), no arrow chip in the corner.
 * - Uses --primary / --primary-foreground so per-brand overrides
 *   propagate automatically.
 * - Icon is a real lucide <Gift/> — an inline emoji rendered as tofu
 *   on some fonts (Android WebView, older Chromium builds).
 * - Compact: ~104px tall on mobile, feels like a button not a card.
 */
export default function PromoBanner({ href, headline, subline }: Props) {
  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-16px_rgb(0_0_0/0.35),0_28px_60px_-30px_rgb(0_0_0/0.45)] ring-1 ring-inset ring-primary-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_40px_-16px_rgb(0_0_0/0.45),0_36px_80px_-30px_rgb(0_0_0/0.55)] active:translate-y-0 active:duration-75"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      {/* Subtle diagonal shine on hover, one accent that reads as "premium". */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-primary-foreground/10 opacity-0 blur-md transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100"
      />

      <div className="relative flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-foreground/15 ring-1 ring-inset ring-primary-foreground/20"
        >
          <Gift size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[15.5px] font-semibold leading-tight tracking-tight sm:text-[16px]">
            {headline}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-primary-foreground/80">
            {subline}
          </p>
        </div>
      </div>
    </a>
  );
}
