-- 025_add_google_rating_columns.sql
--
-- Optional Google Business Profile chip below the Hero H1.
--
-- These three columns power the "4.6 * 394 reviews" chip inspired by
-- Kinoko's landing page. All nullable — the chip only renders when
-- BOTH `google_rating` and `google_reviews_count` are non-null, so
-- tenants without a GBP listing just skip it cleanly.
--
-- Design choice: we do NOT ship placeholder ratings. Fake values look
-- fine in a demo but become fraud the moment a real customer visits
-- and compares to the actual Google listing. Every rating shown MUST
-- match the tenant's actual GBP data — set these columns during
-- onboarding, per client, with the real numbers.
--
-- To set the chip for a tenant:
--
--   update public.template_locations
--      set google_rating         = 4.6,
--          google_reviews_count  = 394,
--          google_place_url      = 'https://www.google.com/maps/place/?q=place_id:CHIJxxxxx'
--    where slug = 'my-cafe';

alter table public.template_locations
  add column if not exists google_rating numeric(2,1),
  add column if not exists google_reviews_count integer,
  add column if not exists google_place_url text;

comment on column public.template_locations.google_rating is
  'Google Business Profile star rating (e.g. 4.6). Nullable — chip in Hero only renders when both this and google_reviews_count are set. Use the REAL rating from the tenant''s GBP listing; never seed a placeholder.';
comment on column public.template_locations.google_reviews_count is
  'Google Business Profile review count. Nullable — chip in Hero only renders when both this and google_rating are set. Use the REAL count from the tenant''s GBP listing.';
comment on column public.template_locations.google_place_url is
  'Optional deep-link to the tenant''s Google Business Profile. When set, the rating chip becomes clickable and opens the GBP listing in a new tab.';
