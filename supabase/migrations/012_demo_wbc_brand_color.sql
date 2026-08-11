-- 012_demo_wbc_brand_color.sql
--
-- Sets the demo tenant (The White Bear Coffee — Marszalkowska) primary
-- color to warm orange, matching what visitors see on the live
-- WBC production site marszalkowska.thewhitebearcoffee.pl.
--
-- Applied via BrandStyleTag → :root { --primary: ...; --primary-foreground: ...; }
-- which propagates through every surface using bg-primary / text-primary-foreground:
--   * PromoBanner card on landing (the loud CTA)
--   * Primary CTA buttons across /rewards (Save to photos, Save number)
--   * Logo fallback tile if no logo_url is set
--
-- Kept out of migrations 005/008 (the original seed) because it's a
-- brand-cosmetic setting that could reasonably differ per tenant.

update public.template_brands
   set theme = '{"primary":"oklch(0.68 0.17 40)","primary_foreground":"oklch(0.99 0.005 40)"}'::jsonb
 where slug = 'demo'
   and org_id in (select id from public.template_organizations where slug = 'mysite-demo');
