import { useEffect, useMemo, useRef, useState } from "react";
import type { Menu, MenuCategory, MenuItem } from "@/lib/menu/types";
import { formatMoney } from "@/lib/menu/parse";
import { cn } from "@/lib/utils";

interface Props {
  menu: Menu;
}

export default function MenuBrowser({ menu }: Props) {
  const categories = menu.categories;
  const [activeId, setActiveId] = useState<string>(categories[0]?.id ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});

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
      <div
        ref={tabsRef}
        className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-xl border-b border-border/60"
      >
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollTo(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
                activeId === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-8">
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
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
}

function CategorySection({ category, registerRef }: CategorySectionProps) {
  return (
    <section
      ref={registerRef}
      data-category-id={category.id}
      className="scroll-mt-16"
      aria-labelledby={`menu-cat-${category.id}`}
    >
      <h2 id={`menu-cat-${category.id}`} className="text-lg font-semibold tracking-tight">
        {category.name}
      </h2>
      {category.description && (
        <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
      )}

      <ul className="mt-3 space-y-2">
        {category.items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

interface ItemProps {
  item: MenuItem;
}

function Item({ item }: ItemProps) {
  const priceLabel = useMemo(() => {
    if (!item.price) return null;
    return formatMoney(item.price);
  }, [item.price]);

  return (
    <li className="map-card p-4 flex items-start gap-3">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="h-16 w-16 rounded-xl object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold truncate">{item.name}</p>
          {priceLabel ? (
            <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{priceLabel}</span>
          ) : (
            <span className="text-xs text-muted-foreground uppercase">Market price</span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="pill text-[10px] uppercase tracking-wide"
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
