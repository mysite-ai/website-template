-- 038_shaddai_website_url.sql
--
-- Shaddai Print Shop keeps their own site (a Google Site). Surface it as
-- the hero "Visit our website" main button. Clean URL stored; MySite
-- UTMs are appended at render time (see 037 / withMysiteUtms).

update public.template_locations l
   set website_url = 'https://sites.google.com/view/shaddaiprintshop/inicio'
  from public.template_brands b
 where l.brand_id = b.id
   and b.slug = 'shaddaiprintshop';
