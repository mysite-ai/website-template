export type Currency = "PLN" | "EUR" | "USD";

export type Money = { amount: number; currency: Currency };

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: Money;
  image_url?: string;
  tags?: Array<"vegan" | "vegetarian" | "gluten-free" | "spicy" | "new">;
  allergens?: string[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface Menu {
  version: 1;
  currency_default: Currency;
  categories: MenuCategory[];
}
