-- 013_rename_demo_slugs_to_whitebear.sql
--
-- Rename the demo tenant slugs so the hostname `whitebear.mysite.social`
-- validates as `mysite_single` (the trigger from migration 011 requires
-- brand.slug === location.slug === <hostname-first-label>).
--
-- Historical: originally seeded with slug='demo' for a placeholder
-- MySite Bistro tenant (migration 005). Later rebranded to White Bear
-- Coffee (migration 008) but slugs stayed 'demo'. Now that we're
-- attaching the real production hostname `whitebear.mysite.social`,
-- align the slugs.

update public.template_locations
   set slug = 'whitebear'
 where slug = 'demo'
   and brand_id in (
     select id from public.template_brands
     where slug = 'demo'
       and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
   );

update public.template_brands
   set slug = 'whitebear'
 where slug = 'demo'
   and org_id in (select id from public.template_organizations where slug = 'mysite-demo');

update public.template_organizations
   set slug = 'whitebear-coffee'
 where slug = 'mysite-demo';
