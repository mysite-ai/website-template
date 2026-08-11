import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CountryCode } from "libphonenumber-js";
import { ChevronDown, Check, Search } from "lucide-react";
import {
  examplePlaceholder,
  findCountry,
  formatAsYouType,
  orderedCountries,
  toE164,
  type PhoneCountry,
} from "@/lib/phone/config";
import { cn } from "@/lib/utils";

/**
 * PhoneField — country-aware phone input.
 *
 * The parent controls the submit lifecycle (loading state, error
 * reporting, etc.). This component only owns:
 *   - Local country selection (defaulted from the tenant's location.country
 *     but user-changeable via the picker).
 *   - Local input string as the user types.
 *   - Live E.164 normalisation + validity check.
 *
 * When the user clicks "Save number", we hand the parent the E.164
 * string (`+15555550100` / `+48500111222`) plus the raw display value
 * for optional UX affordances (e.g. showing the last 2 digits after
 * save).
 *
 * Backend note: attribution-autopilot's `phone.util.ts` already runs
 * libphonenumber-js server-side and normalises everything to E.164, so
 * we could technically send national-format strings. We send E.164
 * anyway — one less thing that can go wrong across the API boundary.
 */
export interface PhoneFieldProps {
  /**
   * Tenant's ISO country code (from `template_locations.country`) —
   * decides which country pre-fills the picker. Users can override.
   */
  defaultCountry: string | null;
  /**
   * Called with the E.164 string when the user submits a valid number.
   * The parent handles saving + navigation.
   */
  onSubmit: (e164: string) => void | Promise<void>;
  /** External "saving" state — disables the button and shows a spinner. */
  saving: boolean;
  /** Optional autofocus for the input on mount. */
  autoFocus?: boolean;
}

export default function PhoneField({
  defaultCountry,
  onSubmit,
  saving,
  autoFocus = false,
}: PhoneFieldProps) {
  const [country, setCountry] = useState<PhoneCountry>(() => findCountry(defaultCountry));
  const [raw, setRaw] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const displayValue = useMemo(
    () => (raw ? formatAsYouType(raw, country.code) : ""),
    [raw, country.code],
  );

  const e164 = useMemo(() => toE164(raw, country.code), [raw, country.code]);
  const isValid = e164 !== null;

  const handleChange = (next: string) => {
    // Strip everything except digits, spaces, and `+` — leave formatting
    // to AsYouType so cursor placement stays sane.
    const cleaned = next.replace(/[^\d\s+()-]/g, "");
    setRaw(cleaned);
  };

  const handleSubmit = () => {
    if (!e164 || saving) return;
    void onSubmit(e164);
  };

  const handleCountryPick = (next: PhoneCountry) => {
    setCountry(next);
    setPickerOpen(false);
    // Keep focus in the input so the user can keep typing.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex h-11 overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <CountryPicker
          country={country}
          open={pickerOpen}
          onToggle={() => setPickerOpen((o) => !o)}
          onPick={handleCountryPick}
          onClose={() => setPickerOpen(false)}
        />

        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isValid) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={examplePlaceholder(country.code)}
          maxLength={24}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/60 focus:outline-none"
          aria-label="Phone number"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !isValid}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg text-[14px] font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px enabled:bg-primary enabled:text-primary-foreground enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        data-umami-event="click-submit-phone"
        data-umami-event-target="promo-phone-form"
      >
        {saving ? "Saving…" : "Save number"}
      </button>
    </div>
  );
}

interface CountryPickerProps {
  country: PhoneCountry;
  open: boolean;
  onToggle: () => void;
  onPick: (next: PhoneCountry) => void;
  onClose: () => void;
}

function CountryPicker({ country, open, onToggle, onPick, onClose }: CountryPickerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<{ top: number; left: number; placement: "below" | "above" } | null>(null);

  const list = useMemo(() => orderedCountries(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.callingCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [list, query]);

  // Recompute anchor position whenever the picker opens or the viewport
  // scrolls/resizes. Popover lives in a document.body portal so CSS
  // `absolute` inside the (overflow-hidden) Card doesn't apply. We also
  // flip above the input when there's not enough room below.
  useEffect(() => {
    if (!open) {
      setAnchor(null);
      setQuery("");
      return;
    }
    const compute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const POPOVER_HEIGHT = 320; // rough max (search bar + list)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeAbove = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow;
      // For "below" mode we anchor to the button's bottom edge.
      // For "above" mode we compute the top edge directly (button top - popover height - gap)
      // so we don't rely on CSS translateY which conflicts with Tailwind animate-in.
      const top = placeAbove
        ? Math.max(8, rect.top - POPOVER_HEIGHT - 6)
        : rect.bottom + 6;
      setAnchor({ top, left: rect.left, placement: placeAbove ? "above" : "below" });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const popover =
    open && anchor && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            className="fixed z-[100] w-64 overflow-hidden rounded-xl bg-popover shadow-xl ring-1 ring-foreground/10 animate-in fade-in-0 duration-100"
            style={{
              top: anchor.top,
              left: anchor.left,
            }}
          >
            <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country"
                autoFocus
                className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] placeholder:text-muted-foreground/60 focus:outline-none"
                aria-label="Search country"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-[12.5px] text-muted-foreground">No matches</li>
              )}
              {filtered.map((c) => {
                const selected = c.code === country.code;
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onPick(c)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                        selected && "bg-muted/60",
                      )}
                    >
                      <span aria-hidden="true" className="text-[15px] leading-none">
                        {c.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {c.callingCode}
                      </span>
                      {selected && (
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative shrink-0 border-r border-input">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-full items-center gap-1.5 px-3 text-[13.5px] font-medium tabular-nums text-foreground hover:bg-muted/40"
      >
        <span aria-hidden="true" className="text-[15px] leading-none">
          {country.flag}
        </span>
        <span>{country.callingCode}</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {popover}
    </div>
  );
}
