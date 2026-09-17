import { useEffect, useMemo, useRef, useState } from "react";
import type { Menu, MenuCategory, MenuItem } from "@/lib/menu/types";
import { formatMoney } from "@/lib/menu/parse";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface Props {
  menu: Menu;
}

export default function MenuBrowser({ menu }: Props) {
  const categories = menu.categories;
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

  /*
   * "Market" is the per-item fallback for a dish whose price genuinely varies
   * (catch of the day, market-price steak). It only carries that meaning when
   * it sits NEXT TO real prices.
   *
   * Some tenants ship a menu with no prices at all — either the client hasn't
   * sent a price list yet, or their prices live on an external ordering
   * platform we hand off to (Taava Kitchen: prices are only available inside
   * an authenticated Square session). On those menus, stamping "MARKET" on
   * every one of 74 rows tells the guest nothing and actively misleads —
   * it reads as "every single dish here is market-priced".
   *
   * So when NO item in the whole menu has a price, drop the column entirely
   * and let the item name + description carry the row. A partially priced
   * menu still shows "Market" on the unpriced items, which is correct.
   */
  const anyPriced = useMemo(
    () => categories.some((cat) => cat.items.some((item) => !!item.price)),
    [categories],
  );

  // Sync active tab as sections scroll into view.
  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-category-id");
            if (id) setActiveId(id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    for (const el of Object.values(sectionsRef.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories.length]);

  const scrollTo = (id: string) => {
    const el = sectionsRef.current[id];
    if (!el) return;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      {/* Sticky category tabs — pill-shaped, tabular-tighter, backdrop-blur */}
      <div className="sticky top-14 z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 py-2.5 bg-background/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollTo(cat.id)}
              data-umami-event="click-menu-category"
              data-umami-event-target={cat.id}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                activeId === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-6 lg:mt-8 lg:space-y-8">
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            showMarketFallback={anyPriced}
            registerRef={(el) => {
              sectionsRef.current[cat.id] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: MenuCategory;
  registerRef: (el: HTMLDivElement | null) => void;
  /** False when no item in the entire menu is priced — see MenuBrowser. */
  showMarketFallback: boolean;
}

function CategorySection({ category, registerRef, showMarketFallback }: CategorySectionProps) {
  return (
    <section
      ref={registerRef}
      data-category-id={category.id}
      className="scroll-mt-24"
      aria-labelledby={`menu-cat-${category.id}`}
    >
      <div className="mb-3 px-1">
        <h2
          id={`menu-cat-${category.id}`}
          className="text-[19px] font-semibold tracking-tight lg:text-[20px]"
        >
          {category.name}
        </h2>
        {category.description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        )}
      </div>

      <Card className="!p-0 gap-0">
        <ul className="divide-y divide-foreground/10">
          {category.items.map((item) => (
            <Item key={item.id} item={item} showMarketFallback={showMarketFallback} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

interface ItemProps {
  item: MenuItem;
  showMarketFallback: boolean;
}

function Item({ item, showMarketFallback }: ItemProps) {
  const priceLabel = useMemo(() => {
    if (!item.price) return null;
    return formatMoney(item.price);
  }, [item.price]);

  return (
    <li className="flex items-start gap-3 px-4 py-4">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-semibold tracking-tight truncate">{item.name}</p>
          {priceLabel ? (
            <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-foreground">
              {priceLabel}
            </span>
          ) : showMarketFallback ? (
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              Market
            </span>
          ) : null}
        </div>
        {item.description && (
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
