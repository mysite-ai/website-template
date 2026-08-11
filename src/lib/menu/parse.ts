import { z } from "zod";
import type { Menu } from "./types";

const currencySchema = z.enum(["PLN", "EUR", "USD"]);

const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: currencySchema,
});

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: moneySchema.optional(),
  image_url: z.string().url().optional(),
  tags: z
    .array(z.enum(["vegan", "vegetarian", "gluten-free", "spicy", "new"]))
    .optional(),
  allergens: z.array(z.string()).optional(),
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  items: z.array(itemSchema),
});

const menuSchema = z.object({
  version: z.literal(1),
  currency_default: currencySchema,
  categories: z.array(categorySchema),
});

/**
 * Parses a raw menu blob from Supabase.
 *
 * Returns `null` if the blob is missing or invalid — the /menu route
 * falls back to a "menu coming soon" state rather than crashing.
 */
export function parseMenu(raw: unknown): Menu | null {
  if (!raw || typeof raw !== "object") return null;
  const result = menuSchema.safeParse(raw);
  if (!result.success) {
    if (import.meta.env.DEV) {
      console.warn("[menu] invalid menu blob:", result.error.flatten());
    }
    return null;
  }
  return result.data;
}

/**
 * Pick a sensible locale from a currency code so PLN, EUR, and USD each
 * render in their own conventional format (thousands separator, currency
 * position, decimal marker) without every caller passing a locale hint.
 * Callers can still override by passing `locale` explicitly.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  PLN: "pl-PL",
  EUR: "de-DE",
  USD: "en-US",
};

export function formatMoney(
  price: { amount: number; currency: string },
  locale?: string,
): string {
  const resolvedLocale = locale ?? CURRENCY_LOCALE[price.currency] ?? "en-US";
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 2,
  }).format(price.amount);
}
