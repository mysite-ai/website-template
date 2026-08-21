-- 036_sushisawa_hide_reviews_badge.sql
--
-- Hide the Google reviews badge (rating + review count pill) in the hero
-- for Sushi Sawa. The Hero renders that badge only when both
-- google_rating and google_reviews_count are present, so clearing them
-- removes the badge — no code change, purely per-tenant data.

update public.template_locations l
   set google_rating = null,
       google_reviews_count = null
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'sushisawa'
   and o.slug = 'sushisawa';
