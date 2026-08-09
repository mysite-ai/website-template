import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "@/lib/tenant/types";

interface Props {
  images: GalleryImage[];
}

/**
 * GalleryBrowser — mosaic gallery grid + fullscreen lightbox preview.
 *
 * Layout:
 *   - 1 featured tile (16:9) on top
 *   - 3-up square strip
 *   - 2-up landscape strip
 *
 * Click any tile → opens a fullscreen dialog with keyboard nav
 * (Arrow left/right, Escape). Follows shadcn Dialog conventions
 * but styled for image preview (dark backdrop, no chrome).
 *
 * Defensive: broken image URLs are tracked in state via `onError`
 * and silently dropped from both the mosaic AND the lightbox so an
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

  // Filter out broken images. Everything downstream — grid layout, lightbox
  // count, prev/next — reads from this filtered array.
  const visible = useMemo(
    () => images.filter((img) => !brokenSrcs.has(img.src)),
    [images, brokenSrcs],
  );

  // If the currently-selected image is dropped as broken, close the lightbox.
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

  const featured = visible[0];
  const row3 = visible.slice(1, 4);
  const row2 = visible.slice(4, 6);
  const selected = selectedIndex !== null ? visible[selectedIndex] : null;

  return (
    <>
      <div className="grid gap-2 sm:gap-2.5">
        {featured && (
          <ImageTile
            image={featured}
            aspect="aspect-[16/9]"
            radius="rounded-2xl"
            onClick={() => setSelectedIndex(0)}
            onError={() => markBroken(featured.src)}
          />
        )}
        {row3.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {row3.map((image, i) => (
              <ImageTile
                key={image.src}
                image={image}
                aspect="aspect-square"
                radius="rounded-xl"
                onClick={() => setSelectedIndex(i + 1)}
                onError={() => markBroken(image.src)}
              />
            ))}
          </div>
        )}
        {row2.length > 0 && (
          <div className={`grid gap-2 sm:gap-2.5 ${row2.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {row2.map((image, i) => (
              <ImageTile
                key={image.src}
                image={image}
                aspect="aspect-[4/3]"
                radius="rounded-xl"
                onClick={() => setSelectedIndex(i + 4)}
                onError={() => markBroken(image.src)}
              />
            ))}
          </div>
        )}
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

interface ImageTileProps {
  image: GalleryImage;
  aspect: string;
  radius: string;
  onClick: () => void;
  onError: () => void;
}

function ImageTile({ image, aspect, radius, onClick, onError }: ImageTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full ${aspect} overflow-hidden ${radius} ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
      aria-label={image.alt || "Open image"}
      data-umami-event="click-gallery-tile"
    >
      <img
        src={image.src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={onError}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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

function Lightbox({ image, index, total, onClose, onPrev, onNext, onError }: LightboxProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Image preview"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <img
        src={image.src}
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
