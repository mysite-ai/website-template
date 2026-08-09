import { useEffect, useState } from "react";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export interface PromoCountdown {
  target: Date;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

/**
 * Returns the end of the coming Sunday (23:59:59 local time). Rolls
 * over to the following Sunday if we're already past today's end.
 * Matches wbc-v2's `getNextSundayPromoEnd` verbatim so the promo
 * "resets weekly" cadence stays consistent across MySite sites.
 */
export function getNextSundayPromoEnd(now = new Date()): Date {
  const target = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(23, 59, 59, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

export function formatPromoEndDate(target: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(target);
}

function calculateCountdown(target: Date): PromoCountdown {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    target,
    days: Math.floor(diff / DAY_MS),
    hours: Math.floor((diff % DAY_MS) / HOUR_MS),
    minutes: Math.floor((diff % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((diff % MINUTE_MS) / 1000),
    expired: diff <= 0,
  };
}

export function usePromoCountdown(): PromoCountdown {
  const [countdown, setCountdown] = useState(() =>
    calculateCountdown(getNextSundayPromoEnd()),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown((current) => {
        const target =
          current.target.getTime() <= Date.now()
            ? getNextSundayPromoEnd()
            : current.target;
        return calculateCountdown(target);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return countdown;
}
