-- 007_wire_demo_attribution.sql
--
-- Wires the smoke-test tenant (`mysite-demo` / `demo` / `demo`) to a
-- dedicated `MySite Test` promotion in attribution-autopilot so that
-- /promocja renders the full QR + phone flow end-to-end, driving real
-- POST /api/users calls against `https://attribution.mysite.cx/api`.
--
-- The four UUIDs below live in a DIFFERENT Supabase project
-- (attribution-autopilot) and are stored here as soft FKs. See
-- `docs/04-attribution-integration.md` for the full contract.
--
-- To reproduce the attribution-autopilot side (only needed if you're
-- resurrecting this from scratch), run:
--
--   insert into public.organizations (slug, name, integration_type,
--     scan_mode, currency, geo)
--   values ('mysite-test', 'MySite Test', 'manual', 'manual', 'USD',
--           'US')
--   returning id;
--   -- ... plus locations, promotions (code_prefix='BISTROTEST'),
--   -- loyalty_campaigns, two loyalty_rewards, and a location_origins
--   -- row for `https://website-template-iota-one.vercel.app`.

update public.template_locations
   set attribution_org_id        = '5896f864-7a35-440a-887d-dfd03b63b3fe',
       attribution_location_id   = '628e921c-bc84-474f-b882-dca0bd793527',
       attribution_promotion_id  = 'd9fbbf2d-31a4-47a4-9c61-1444211cc48f',
       attribution_campaign_id   = '0c5101cf-f7bd-48db-83a1-ac7d344af952',
       promotion_name_cached     = 'MySite Bistro Rewards',
       reward_description_cached = 'Free coffee on your next visit'
 where slug = 'demo'
   and brand_id in (
     select id from public.template_brands where slug = 'demo'
       and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
   );
