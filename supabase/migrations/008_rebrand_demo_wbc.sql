-- 008_rebrand_demo_wbc.sql
--
-- Rebrand the demo tenant to "The White Bear Coffee — Marszalkowska"
-- so the WBC logo we uploaded to Supabase Storage, the section
-- structure inspired by wbc-v2, and the copy all cohere as one
-- reference implementation.
--
-- The White Bear Coffee is an actual MySite client — using their
-- flagship Warsaw Marszalkowska location as the demo lets us treat
-- the smoke-test tenant as a real reference restaurant, not a
-- placeholder.

update public.template_brands
   set name    = 'The White Bear Coffee',
       tagline = 'Specialty coffee, matcha, and homemade brunch — in the heart of Warsaw.',
       about_md = E'The White Bear Coffee is a Warsaw-born specialty coffee brand serving locally-roasted single-origin espresso, ceremonial-grade matcha, and a rotating brunch menu made in-house from seasonal ingredients.\n\nThis smoke-test tenant lives on `website-template-iota-one.vercel.app` — it renders the same code every real client site does. Remove via `docs/02-adding-a-client.md` when onboarding the first production tenant.',
       logo_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/wbc-logo.png'
 where slug = 'demo'
   and org_id in (select id from public.template_organizations where slug = 'mysite-demo');

update public.template_locations
   set name              = 'The White Bear Coffee — Marszalkowska',
       address_line      = 'Marszalkowska 87',
       city              = 'Warsaw',
       region            = 'Mazowieckie',
       postal_code       = '00-683',
       country           = 'PL',
       latitude          = 52.2214,
       longitude         = 21.0154,
       phone             = '+48533444555',
       email             = 'hello@thewhitebearcoffee.pl',
       weekday_hours     = '07:00 – 22:00',
       weekend_hours     = '08:00 – 23:00',
       maps_embed_url    = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2445.6!2d21.0154!3d52.2214!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDEzJzE3LjAiTiAyMcKwMDAnNTUuNCJF!5e0!3m2!1sen!2spl!4v1',
       maps_search_query = 'The White Bear Coffee, Marszalkowska 87, Warsaw',
       instagram_url     = 'https://instagram.com/thewhitebearcoffee',
       facebook_url      = 'https://facebook.com/thewhitebearcoffee'
 where slug = 'demo'
   and brand_id in (
     select id from public.template_brands where slug = 'demo'
       and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
   );
