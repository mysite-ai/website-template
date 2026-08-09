-- 009_refresh_demo_promo_cache.sql
--
-- Syncs the cached display strings (promotion_name_cached +
-- reward_description_cached) with the renamed smoke-test attribution
-- promotion so the pre-reveal PromoBanner CTA on the landing and the
-- /promocja hero both show the correct "White Bear Rewards" name.
--
-- attribution-autopilot side (applied separately via MCP):
--   * promotions.name → 'White Bear Rewards'
--   * loyalty_rewards[visit=1] → 'Free specialty coffee on your next visit'
--   * loyalty_rewards[visit=2] → '20% off your next brunch'

update public.template_locations
   set promotion_name_cached     = 'White Bear Rewards',
       reward_description_cached = 'Free specialty coffee on your next visit'
 where slug = 'demo'
   and brand_id in (
     select id from public.template_brands where slug = 'demo'
       and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
   );
