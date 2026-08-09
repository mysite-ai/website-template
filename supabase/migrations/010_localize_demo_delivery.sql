-- 010_localize_demo_delivery.sql
--
-- Swap DoorDash / Uber Eats for Wolt / Glovo / Pyszne.pl on the demo
-- tenant since the location was rebranded to Warsaw. Cosmetic-only —
-- exercises the Delivery section renderer with more than 2 items.

update public.template_locations
   set delivery = '[
     {"name":"Wolt","url":"https://wolt.com/en/pol"},
     {"name":"Glovo","url":"https://glovoapp.com/pl/en/warsaw/"},
     {"name":"Pyszne.pl","url":"https://www.pyszne.pl/"}
   ]'::jsonb
 where slug = 'demo'
   and brand_id in (
     select id from public.template_brands where slug = 'demo'
       and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
   );
