import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "@/lib/tenant/types";

interface Props {
  images: GalleryImage[];
}

/**
 * GalleryBrowser — square gallery grid + fullscreen lightbox preview.
 *
 * Performance notes:
 *   - Any image URL that ends with `-800w.webp` is treated as a member of a
 *     three-size responsive set (`-400w.webp`, `-800w.webp`, `-1600w.webp`)
 *     living under the same folder. We emit a `srcset`+`sizes` combo so the
 *     browser can pick the smallest variant that still fills the tile
 *     without downloading 1.5–4 MB originals.
 *   - First tile: `loading="eager" fetchpriority="high"` so the LCP image
 *     starts fetching immediately.
 *   - All other tiles: `loading="lazy" decoding="async"`.
 *   - `content-visibility: auto` on off-screen tiles hints the browser to
 *     skip layout/paint work on rows well below the fold.
 *
 * Layout: 2 columns on mobile, 3 columns from `sm:` up. Every tile is a
 * perfect square rendered `object-cover`. Matches the "Our cafe" grid on
 * marszalkowska.thewhitebearcoffee.pl.
 *
 * Click any tile → opens a fullscreen dialog with keyboard nav
 * (Arrow left/right, Escape). Follows shadcn Dialog conventions
 * but styled for image preview (dark backdrop, no chrome). The lightbox
 * jumps straight to the `-1600w.webp` variant for a crisp full-view.
 *
 * Defensive: broken image URLs are tracked in state via `onError`
 * and silently dropped from both the grid AND the lightbox so an
 * ugly "alt-text + broken glyph" tile never renders.
 */
export default function GalleryBrowser({ images }: Props) {
  const [brokenSrcs, setBrokenSrcs] = useState<Set<string>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const markBroken = useCallback((src: string) => {
    setBrokenSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);

  const visible = useMemo(
    () => images.filter((img) => !brokenSrcs.has(img.src)),
    [images, brokenSrcs],
  );

  useEffect(() => {
    if (selectedIndex === null) return;
    if (selectedIndex >= visible.length) setSelectedIndex(null);
  }, [selectedIndex, visible.length]);

  const close = useCallback(() => setSelectedIndex(null), []);

  const prev = useCallback(() => {
    setSelectedIndex((i) => {
      if (i === null || visible.length === 0) return null;
      return i > 0 ? i - 1 : visible.length - 1;
    });
  }, [visible.length]);

  const next = useCallback(() => {
    setSelectedIndex((i) => {
      if (i === null || visible.length === 0) return null;
      return i < visible.length - 1 ? i + 1 : 0;
    });
  }, [visible.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedIndex, close, prev, next]);

  if (visible.length === 0) return null;

  const selected = selectedIndex !== null ? visible[selectedIndex] : null;

  // Grid choice by count so the last row always fills:
  //   8  → 2 cols mobile (4 rows), 4 cols lg+ (2 rows)
  //   6  → 2 cols mobile (3 rows), 3 cols sm+ (2 rows)
  //   4  → 2 cols mobile (2 rows), 4 cols lg+ (1 row)
  //   3  → 3 cols on every breakpoint (1×3)
  //   2  → 2 cols on every breakpoint
  //   default (5, 7, 9…) → 2 cols mobile, 3 cols sm+
  const gridClass = (() => {
    switch (visible.length) {
      case 2:
        return "grid grid-cols-2 gap-2 sm:gap-2.5";
      case 3:
        return "grid grid-cols-3 gap-2 sm:gap-2.5";
      case 4:
        return "grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4 lg:gap-3";
      case 6:
        return "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:gap-3";
      case 8:
        return "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 lg:gap-3";
      default:
        return "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:gap-3";
    }
  })();

  return (
    <>
      <div className={gridClass}>
        {visible.map((image, i) => (
          <ImageTile
            key={image.src}
            image={image}
            eager={i === 0}
            onClick={() => setSelectedIndex(i)}
            onError={() => markBroken(image.src)}
          />
        ))}
      </div>

      {selected && selectedIndex !== null && (
        <Lightbox
          image={selected}
          index={selectedIndex}
          total={visible.length}
          onClose={close}
          onPrev={prev}
          onNext={next}
          onError={() => markBroken(selected.src)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Responsive URL builder
// ---------------------------------------------------------------------------

const SIZE_RE = /-800w\.webp$/;

/**
 * If `src` matches our v3 responsive naming convention (`.../foo-800w.webp`),
 * return the `srcset` + `sizes` + hi-res URLs. Otherwise return `null` and
 * the caller falls back to a single-source `<img src>` (legacy behaviour).
 */
function responsiveSet(src: string): {
  srcSet: string;
  sizes: string;
  full: string;
} | null {
  if (!SIZE_RE.test(src)) return null;
  const base = src.replace(SIZE_RE, "");
  return {
    srcSet: [
      `${base}-400w.webp 400w`,
      `${base}-800w.webp 800w`,
      `${base}-1600w.webp 1600w`,
    ].join(", "),
    // Tile widths (approximate):
    //   mobile (default):        ~48vw  (2-col grid, minus gap)
    //   sm and up (≥640px):      ~32vw  (3-col grid)
    //   md and up (≥768px):      ~240px (container caps around 720px wide)
    sizes: "(min-width: 768px) 240px, (min-width: 640px) 32vw, 48vw",
    full: `${base}-1600w.webp`,
  };
}

interface ImageTileProps {
  image: GalleryImage;
  eager: boolean;
  onClick: () => void;
  onError: () => void;
}

function ImageTile({ image, eager, onClick, onError }: ImageTileProps) {
  const set = responsiveSet(image.src);
  const imgProps = set
    ? { src: image.src, srcSet: set.srcSet, sizes: set.sizes }
    : { src: image.src };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block aspect-square w-full overflow-hidden rounded-xl ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [content-visibility:auto] [contain-intrinsic-size:400px]"
      aria-label={image.alt || "Open image"}
      data-umami-event="click-gallery-tile"
    >
      <img
        {...imgProps}
        alt=""
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onError={onError}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
    </button>
  );
}

interface LightboxProps {
  image: GalleryImage;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onError: () => void;
}

function Lightbox({
  image,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onError,
}: LightboxProps) {
  // In the lightbox we want the full-quality asset if we have a responsive
  // set; otherwise fall back to whatever URL we have.
  const set = responsiveSet(image.src);
  const previewSrc = set?.full ?? image.src;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Image preview"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <img
        src={previewSrc}
        alt={image.alt}
        onError={onError}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous image"
          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6 sm:h-12 sm:w-12"
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next image"
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6 sm:h-12 sm:w-12"
        >
          <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {total > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[12px] font-medium tabular-nums text-white/80">
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}
