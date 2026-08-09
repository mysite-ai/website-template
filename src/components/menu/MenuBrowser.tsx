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
      {/* Sticky category tabs — pill-shaped, tabular-tighter, backdrop-blur */}
      <div className="sticky top-0 z-20 -mx-5 sm:-mx-6 px-5 sm:px-6 py-2.5 bg-background/85 backdrop-blur-xl">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollTo(cat.id)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors",
                activeId === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-10">
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
      className="scroll-mt-20"
      aria-labelledby={`menu-cat-${category.id}`}
    >
      <div className="mb-3 px-1">
        <h2
          id={`menu-cat-${category.id}`}
          className="text-[18px] font-semibold tracking-tight"
        >
          {category.name}
        </h2>
        {category.description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{category.description}</p>
        )}
      </div>

      <ul className="card overflow-hidden divide-y divide-border/40">
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
    <li className="flex items-start gap-3.5 px-5 py-3.5 sm:px-6">
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
            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
              {priceLabel}
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-muted-foreground uppercase tracking-wide">
              Market
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug line-clamp-2">
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
