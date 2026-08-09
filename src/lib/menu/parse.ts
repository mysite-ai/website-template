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

export function formatMoney(price: { amount: number; currency: string }, locale = "pl-PL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 2,
  }).format(price.amount);
}
