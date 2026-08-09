-- 017_add_favicon_url.sql
--
-- Add favicon_url to template_brands so operators can override the
-- browser tab icon per-brand. Nullable — BaseLayout falls back:
--   brand.favicon_url  →  brand.logo_url  →  /favicon.svg (default)
--
-- Convention: upload favicons to Supabase Storage bucket `assets`,
-- path `favicons/<slug>.svg` (or .png / .ico — any browser-supported
-- format works). Public URL:
--   https://<project>.supabase.co/storage/v1/object/public/assets/favicons/<slug>.svg

alter table public.template_brands
  add column if not exists favicon_url text;

comment on column public.template_brands.favicon_url is
  'Optional per-brand favicon URL (SVG/PNG/ICO). Falls back to logo_url, then to /favicon.svg.';
