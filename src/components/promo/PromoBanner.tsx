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
 * PromoBanner — dark premium card that anchors the hero, replacing the
 * earlier neon-orange treatment. The one accent is a subtle red dot +
 * "Ends" caption; everything else is monochrome so the promo feels
 * like an Apple keynote card rather than a Groupon banner.
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
      className="group relative block overflow-hidden rounded-3xl bg-neutral-950 p-6 text-neutral-100 shadow-[0_2px_8px_rgb(0_0_0/0.06),0_18px_50px_-24px_rgb(0_0_0/0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgb(0_0_0/0.08),0_28px_60px_-24px_rgb(0_0_0/0.45)] dark:bg-neutral-900"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      {/* subtle amber gradient in the top-right corner as the sole accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-amber-500/25 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Live rewards
            </p>
          </div>

          <p className="mt-3 text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
            {headline}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
            {subline}
          </p>
        </div>

        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-white/20">
          <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden="true" />
        </div>
      </div>

      {countdown.expired ? (
        <p className="relative mt-5 text-sm text-neutral-400">{expiredLabel}</p>
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
                <span className="num-tile__value text-white">
                  {String(item.value).padStart(2, "0")}
                </span>
                <span className="num-tile__label text-neutral-400">{item.label}</span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
            {validUntilLabel.replace("{date}", endLabel)}
          </p>
        </div>
      )}
    </a>
  );
}
