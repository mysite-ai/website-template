-- 027_add_logo_url_nav.sql
--
-- Per-brand navigation logo variant.
--
-- Some brands ship two distinct marks:
--   1. A wide wordmark (e.g. "U Babci Polish Kitchen" + illustration) —
--      built for the hero. Reads great at 128-176px tall.
--   2. A compact square mark (illustration only, no wordmark) — built
--      for tight contexts (nav, favicon, promo header).
--
-- We store both. `logo_url` remains the canonical "hero" logo. When
-- `logo_url_nav` is set, the Header uses it instead. Falls back to
-- `logo_url` when null, so brands with a single logo Just Work.
--
-- Field is nullable, and no CHECK constraint (any valid URL is fine).

alter table public.template_brands
  add column if not exists logo_url_nav text;

comment on column public.template_brands.logo_url_nav is
  'Per-brand navigation-logo variant. Rendered in Header.astro when set; falls back to logo_url otherwise. Use for brands whose main (hero) mark is a wide wordmark that would be crushed to illegibility at nav sizes — put the compact square mark here.';

-- Seed U Babci with the two supplied variants.
update public.template_brands
   set logo_url     = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/ubabci-wordmark.png',
       logo_url_nav = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/ubabci-mark.png'
 where slug = 'ubabci';
