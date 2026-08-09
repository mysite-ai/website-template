import { ArrowUpRight } from "lucide-react";
import { formatPromoEndDate, usePromoCountdown } from "@/lib/promo/usePromoCountdown";

interface Props {
  href: string;
  headline: string;
  subline: string;
  validUntilLabel: string;
  expiredLabel: string;
  locale: string;
}

/**
 * PromoBanner — anchors the hero as the one "loud" element on the page.
 * Uses only the tokenized surface pair (--primary / --primary-foreground)
 * so per-brand overrides via BrandStyleTag actually take effect. No
 * hardcoded palette values — a black-primary tenant gets a black banner,
 * a wine-red-primary tenant gets a wine-red banner, etc.
 *
 * Mounted `client:load` because the countdown ticks every second.
 * Rendered as <a> so it works with Astro SSR routing + Meta Pixel
 * click tracking.
 */
export default function PromoBanner({
  href,
  headline,
  subline,
  validUntilLabel,
  expiredLabel,
  locale,
}: Props) {
  const countdown = usePromoCountdown();
  const endLabel = formatPromoEndDate(countdown.target, locale);
  const dayLabel = countdown.days === 1 ? "day" : "days";

  return (
    <a
      href={href}
      className="group relative block overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_2px_8px_rgb(0_0_0/0.06),0_18px_50px_-24px_rgb(0_0_0/0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/0.08),0_28px_60px_-24px_rgb(0_0_0/0.45)]"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      {/* Subtle surface highlight — same colour family as the foreground,
         just very low opacity. Reads as a soft glow in every theme. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground/90" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground/60">
              Live rewards
            </p>
          </div>

          <p className="mt-3 text-lg font-semibold leading-tight tracking-tight sm:text-xl">
            {headline}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-primary-foreground/70">
            {subline}
          </p>
        </div>

        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-primary-foreground/20">
          <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden="true" />
        </div>
      </div>

      {countdown.expired ? (
        <p className="relative mt-5 text-sm text-primary-foreground/70">{expiredLabel}</p>
      ) : (
        <div className="relative mt-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { value: countdown.days, label: dayLabel },
              { value: countdown.hours, label: "hrs" },
              { value: countdown.minutes, label: "min" },
              { value: countdown.seconds, label: "sec" },
            ].map((item, i) => (
              <div key={i} className="num-tile">
                <span className="num-tile__value">
                  {String(item.value).padStart(2, "0")}
                </span>
                <span className="num-tile__label text-primary-foreground/60">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/50">
            {validUntilLabel.replace("{date}", endLabel)}
          </p>
        </div>
      )}
    </a>
  );
}
