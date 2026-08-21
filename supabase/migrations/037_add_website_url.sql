-- 037_add_website_url.sql
--
-- Some tenants keep their own ("regular") website and we proxy them, so
-- we want to surface a prominent main button that links out to their
-- real domain. Add a per-location column for it. The app appends MySite
-- UTMs at render time (utm_source=mysite.ai, utm_medium=referral,
-- utm_campaign=<mysite hostname>) so the client can attribute the
-- referral in their own analytics — the DB stores the clean URL.
--
-- Null = no button (the MySite site is the client's only web presence).

alter table public.template_locations
  add column if not exists website_url text;

comment on column public.template_locations.website_url is
  'The tenant''s own external website (clean URL, no UTMs). When set, the hero shows a prominent "Visit our website" button that links here with MySite UTMs appended at render time. Null = hidden.';

-- Lindley Pet Food and Supplies keeps their own site.
update public.template_locations l
   set website_url = 'https://lindleypetfoodandsupplies.com'
  from public.template_brands b
 where l.brand_id = b.id
   and b.slug = 'lindleypet';
