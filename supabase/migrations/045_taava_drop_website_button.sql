-- 045_taava_drop_website_button.sql
--
-- Taava Kitchen: remove the "Visit our website" main button.
--
-- `website_url` was seeded in migration 044 on the reasoning that their Square
-- site stays live and we should link out to it with UTMs. That was wrong about
-- what this product is: the MySite page IS the landing page. A prominent
-- primary-colour button that ships the guest to a different site competes with
-- the ordering CTA directly beneath it — the two most prominent controls on the
-- page pull in opposite directions, and the one we don't measure wins on visual
-- weight (it's the filled button; ordering is an outline tile).
--
-- Setting the column to NULL is the supported "hidden" state — Hero.astro
-- renders the button only when `website_url` is non-empty, so this is a
-- data-only change with no code path to touch.
--
-- Scoped to Taava on purpose. Six other locations also have `website_url` set
-- (cantonbistro ×2, elpolloperu, pardisushi, lindleypet, shaddaiprintshop) and
-- are deliberately left alone: for the two retail tenants their own site is the
-- only product catalogue that exists, so removing the link there would strand
-- the guest. Revisit per-tenant, not in bulk.
--
-- Ordering links are unaffected — they stay, and now carry landing-page UTMs
-- (utm_source=mysite / utm_medium=mysitelp / utm_campaign=<inherited|mysite>)
-- applied at runtime by components/attribution/OutboundTagger.astro.

update public.template_locations l
   set website_url = null
  from public.template_brands b
 where l.brand_id = b.id
   and b.slug = 'taavakitchen';
