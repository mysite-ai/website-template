import {
  parsePhoneNumberFromString,
  getExampleNumber,
  AsYouType,
  type CountryCode,
} from "libphonenumber-js";
import examples from "libphonenumber-js/examples.mobile.json";

/**
 * Phone config — one module used by PromoFlow + any future form that
 * captures a phone number.
 *
 * Design:
 *   - Backend (attribution-autopilot) already uses libphonenumber-js and
 *     expects E.164 (`+15555550100`, `+48600111222`). We just build the
 *     same string client-side and hand it over.
 *   - We ship a curated list of countries so the picker isn't a 250-row
 *     wall. PL + US are first-class (their real customers). Rest are
 *     common EU + neighbours + a handful of frequently-visited markets.
 *   - `country` parameter defaults from `tenant.location.country` on
 *     the caller side. The user can always change it via the picker.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 country code. */
  code: CountryCode;
  /** Localised display name — English, kept short for the picker. */
  name: string;
  /** Emoji flag rendered next to the prefix. */
  flag: string;
  /** International dialing prefix, e.g. "+48". */
  callingCode: string;
}

/**
 * Curated country list. Ordered by rough likelihood for our current
 * customer base: PL/US first (real revenue), then major EU markets,
 * then commonly-encountered "visited by expats" additions. The picker
 * component alphabetises by name at render time except for the two
 * pinned rows.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: "PL", name: "Poland",          flag: "🇵🇱", callingCode: "+48" },
  { code: "US", name: "United States",   flag: "🇺🇸", callingCode: "+1" },
  { code: "GB", name: "United Kingdom",  flag: "🇬🇧", callingCode: "+44" },
  { code: "DE", name: "Germany",         flag: "🇩🇪", callingCode: "+49" },
  { code: "FR", name: "France",          flag: "🇫🇷", callingCode: "+33" },
  { code: "IT", name: "Italy",           flag: "🇮🇹", callingCode: "+39" },
  { code: "ES", name: "Spain",           flag: "🇪🇸", callingCode: "+34" },
  { code: "NL", name: "Netherlands",     flag: "🇳🇱", callingCode: "+31" },
  { code: "IE", name: "Ireland",         flag: "🇮🇪", callingCode: "+353" },
  { code: "PT", name: "Portugal",        flag: "🇵🇹", callingCode: "+351" },
  { code: "CZ", name: "Czechia",         flag: "🇨🇿", callingCode: "+420" },
  { code: "SK", name: "Slovakia",        flag: "🇸🇰", callingCode: "+421" },
  { code: "UA", name: "Ukraine",         flag: "🇺🇦", callingCode: "+380" },
  { code: "LT", name: "Lithuania",       flag: "🇱🇹", callingCode: "+370" },
  { code: "LV", name: "Latvia",          flag: "🇱🇻", callingCode: "+371" },
  { code: "SE", name: "Sweden",          flag: "🇸🇪", callingCode: "+46" },
  { code: "NO", name: "Norway",          flag: "🇳🇴", callingCode: "+47" },
  { code: "DK", name: "Denmark",         flag: "🇩🇰", callingCode: "+45" },
  { code: "FI", name: "Finland",         flag: "🇫🇮", callingCode: "+358" },
  { code: "CH", name: "Switzerland",     flag: "🇨🇭", callingCode: "+41" },
  { code: "AT", name: "Austria",         flag: "🇦🇹", callingCode: "+43" },
  { code: "BE", name: "Belgium",         flag: "🇧🇪", callingCode: "+32" },
  { code: "CA", name: "Canada",          flag: "🇨🇦", callingCode: "+1" },
  { code: "MX", name: "Mexico",          flag: "🇲🇽", callingCode: "+52" },
  { code: "AU", name: "Australia",       flag: "🇦🇺", callingCode: "+61" },
];

const PIN_ORDER: readonly CountryCode[] = ["PL", "US"];

/**
 * Returns the country list ordered for the picker: pinned countries at
 * the top (PL then US), then everything else alphabetically by name.
 * The current default country stays wherever it lands in that order —
 * we don't hoist it, the picker highlights it separately.
 */
export function orderedCountries(): PhoneCountry[] {
  const pinned = PIN_ORDER
    .map((code) => PHONE_COUNTRIES.find((c) => c.code === code))
    .filter((c): c is PhoneCountry => c !== undefined);
  const rest = PHONE_COUNTRIES
    .filter((c) => !PIN_ORDER.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

/**
 * Given a country ISO code (case-insensitive) — usually
 * `tenant.location.country` — return the matching config. Falls back
 * to Poland when we don't ship that country in the picker (rare) so
 * the form still works instead of crashing.
 */
export function findCountry(rawCountry: string | null | undefined): PhoneCountry {
  if (rawCountry) {
    const code = rawCountry.toUpperCase() as CountryCode;
    const match = PHONE_COUNTRIES.find((c) => c.code === code);
    if (match) return match;
  }
  return PHONE_COUNTRIES[0]; // PL default matches attribution backend fallback
}

/**
 * Placeholder text for the input — one representative mobile number
 * for the given country, formatted the way a local would type it.
 * libphonenumber-js's example database powers this; when it's missing
 * (rare countries) we fall back to a generic placeholder.
 */
export function examplePlaceholder(country: CountryCode): string {
  const example = getExampleNumber(country, examples);
  if (!example) return "500 000 000";
  return example.formatNational();
}

/**
 * Type-as-you-go formatter. Accepts whatever the user typed (with or
 * without country code) and returns a nicely-grouped version to render
 * back into the input. `country` is used as the default region when
 * the user types without a `+` prefix.
 */
export function formatAsYouType(input: string, country: CountryCode): string {
  return new AsYouType(country).input(input);
}

/**
 * Validate + normalise. Returns the E.164 string (`+15555550100`) when
 * the input is a valid mobile-or-fixed number for the given country;
 * null otherwise. This is what we hand to the backend.
 *
 * `country` is only used as a hint for local numbers; if the user
 * types a full `+1 555...` we honor that regardless.
 */
export function toE164(input: string, country: CountryCode): string | null {
  const cleaned = input.trim();
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/**
 * Human-readable international format for display (e.g. after save):
 * "+48 500 000 000". Returns the input untouched when not parseable.
 */
export function formatInternational(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
