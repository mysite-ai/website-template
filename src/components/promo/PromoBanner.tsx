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
 * PromoBanner — bright gradient CTA that anchors the hero. Ports the
 * "promo lives in the hero with a live countdown" pattern that wbc-v2's
 * Index.tsx has proven in production.
 *
 * Mounted as a React island (`client:load`) because the countdown
 * ticks every second. Rendered as an <a href="/promocja"> so it works
 * with Astro's SSR routing and Meta Pixel click tracking.
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
      className="group relative block overflow-hidden rounded-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 p-5 shadow-[0_4px_20px_-4px_rgb(249_115_22/0.5)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_6px_28px_-4px_rgb(249_115_22/0.7)]"
      data-umami-event="click-promo-cta"
      data-umami-event-target="hero"
    >
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <div className="relative text-center text-white">
        <p className="mb-1 text-xl font-bold drop-shadow-sm sm:text-2xl">🎁 {headline}</p>
        <p className="mb-3 text-sm font-medium text-white/90">{subline}</p>

        {countdown.expired ? (
          <p className="text-sm font-medium text-yellow-200">{expiredLabel}</p>
        ) : (
          <>
            <div className="mb-2 flex justify-center gap-2 sm:gap-3">
              {[
                { value: countdown.days, label: dayLabel },
                { value: countdown.hours, label: "hrs" },
                { value: countdown.minutes, label: "min" },
                { value: countdown.seconds, label: "sec" },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/30 bg-white/20 text-xl font-bold tabular-nums text-white backdrop-blur sm:h-14 sm:w-14 sm:text-2xl">
                    {String(item.value).padStart(2, "0")}
                  </div>
                  <p className="mt-1 text-[10px] font-medium text-white/80 sm:text-xs">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-yellow-200">
              {validUntilLabel.replace("{date}", endLabel)}
            </p>
          </>
        )}
      </div>
    </a>
  );
}
