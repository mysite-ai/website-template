# 03 — Design system

The base is **MySite's own shadcn `base-nova` design system**, not a from-scratch Apple palette. Apple-Maps is applied as a *composition layer* on top: surface treatments, whitespace rhythm, section shapes.

## Base tokens — copied verbatim from admin

`src/styles/tokens.css` is a copy of [attribution-autopilot/admin/src/index.css](../../attribution-autopilot/admin/src/index.css). Keeping the two files in sync is deliberate: the operator dashboard, the guest dashboard, and every restaurant site are one visual product family.

- **shadcn config** (`components.json`): `style: "base-nova"`, `baseColor: "neutral"`, `iconLibrary: "lucide"`, `cssVariables: true`.
- **Font**: `@fontsource-variable/geist` → `--font-sans: 'Geist Variable', sans-serif`.
- **Color space**: OKLCH. `--background: oklch(1 0 0)`, `--foreground: oklch(0.145 0 0)`, `--primary: oklch(0.205 0 0)` (near-black), full dark-mode counterpart included.
- **Radius scale**: `--radius: 0.625rem` with a computed `sm..4xl` scale (`sm = 0.6×`, ..., `4xl = 2.6×`) inside the `@theme inline` block of `src/styles/globals.css`.

## Apple-Maps composition layer

Defined in `src/styles/components.css`. All classes work in `class="..."` on any Astro or React element.

- **`.map-card`** — the primary content container. Translucent, blurred, subtle border and shadow. Use for hero, hours, gallery, about, delivery, menu items.
- **`.action-tile`** — the 4-up quick-action button (Call · Directions · Menu · Order). Icon over label, ≥64px tap target.
- **`.pill`** — small status chip (Open Now · Closes 21:00). Uses `--muted` + `--foreground` from base tokens.
- **`.floating-panel`** — the translucent sheet that slides up on mobile / docks left on desktop.
- **`.section-well`** — mobile-first single column with `max-w-md` (bumped to `max-w-2xl` on `md`), `mx-auto`, `px-4`. Every section wraps its content in this class.

## Per-brand override

`template_brands.theme` (JSONB) can override two variables at runtime — kept intentionally narrow:

- `--primary` (defaults to MySite near-black)
- `--primary-foreground`

`BrandStyleTag.astro` renders a single `<style>` block in `<head>`:

```1:32:src/components/layout/BrandStyleTag.astro
---
import type { TenantBrand } from "@/lib/tenant/types";

interface Props {
  brand: TenantBrand;
}

const { brand } = Astro.props;
```

Nothing else is themable. Radius is deliberately **not** overridable — the derived `--radius-sm .. --radius-4xl` scale is resolved at build time inside `@theme inline`, so injecting `<style>:root{--radius:1rem}</style>` at request time would change `--radius` but leave the scale bound to the build-time value, breaking the visual system. If per-brand radius ever becomes a real requirement, move the scale out of `@theme inline` into plain `@theme` or a separate CSS block referencing `var(--radius)` directly.

## When to add a component

Add UI primitives to `src/components/ui/` following shadcn's `base-nova` conventions. The four primitives we ship (`button`, `card`, `input`, `badge`) cover the entire template — add more only when a section needs it. Every new primitive should:

1. Use tokens (`bg-card`, `text-foreground`, `border-border`, `rounded-md/lg/xl`, etc.) — never raw color hex values.
2. Use `cn()` from `@/lib/utils` for class merging.
3. Be `<200 LOC` including variants.

## Reference

For the operator: the admin panel at `attribution.mysite.cx` IS the visual reference — the template must feel like the same product.
