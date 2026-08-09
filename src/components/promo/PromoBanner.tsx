interface Props {
  href: string;
  /** The single big headline. Should be short and grabby, e.g. "-50% OFF ANY DRINK!". */
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
 * - One headline + one subline. Nothing else. No "live rewards"
 *   caption, no countdown clock (proven distracting), no arrow chip
 *   in the corner.
 * - Uses --primary / --primary-foreground so per-brand overrides
 *   propagate automatically.
 * - Compact: ~110px tall, feels like a button not a card.
 */
export default function PromoBanner({ href, headline, subline }: Props) {
  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-2xl bg-primary px-5 py-4 text-center text-primary-foreground shadow-[0_2px_8px_rgb(0_0_0/0.06),0_10px_28px_-16px_rgb(0_0_0/0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_10px_rgb(0_0_0/0.10),0_18px_40px_-16px_rgb(0_0_0/0.45)] active:translate-y-0"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      {/* Subtle diagonal shine on hover, one accent that reads as "premium". */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-primary-foreground/10 opacity-0 blur-md transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100"
      />

      <p className="relative text-[17px] font-semibold tracking-tight leading-tight sm:text-lg">
        🎁 {headline}
      </p>
      <p className="relative mt-1 text-[13px] leading-snug text-primary-foreground/80">
        {subline}
      </p>
    </a>
  );
}
