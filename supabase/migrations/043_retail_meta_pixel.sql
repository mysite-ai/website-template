-- 043_retail_meta_pixel.sql
--
-- Split retail tenants off the restaurant pixel.
--
-- Until now every tenant we configured shared one Meta dataset,
-- `RestaurantsWebPixel` (849479710958676) — including the two tenants that
-- aren't restaurants at all. That pollutes the restaurant pixel's audiences
-- with pet-store and print-shop traffic, and it means a retail lookalike
-- can't be built without gastro visitors leaking into the seed.
    10|--
-- Meta now has a dedicated dataset `RetailWebPixel` (4347830552199286,
-- business Mysite AI, created 2026-09-07). Point the two non-gastro tenants
-- at it instead:
--
--   Lindley Pet Food and Supplies  — pet store
--   Shaddai Print Shop             — print shop
--
-- Replace rather than append: the whole point of a second dataset is that
-- retail and gastro signals stay separated. A tenant that genuinely needs
-- both can list both ids — the array is ordered and `MetaPixel.tsx` inits
    20|-- every entry — but that's the exception, not the default.
--
-- Every other tenant is unaffected. Which pixel a NEW tenant gets is not a
-- guess: see .cursor/rules/meta-pixel-selection.mdc — the operator is asked
-- during onboarding.

update public.template_locations l
   set meta_pixel_ids = array['4347830552199286']::text[]
  from public.template_brands b
 where l.brand_id = b.id
    30|   and b.slug in ('lindleypet', 'shaddaiprintshop');
