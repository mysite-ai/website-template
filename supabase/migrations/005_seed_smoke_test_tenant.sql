-- 005_seed_smoke_test_tenant.sql
--
-- Seeds one placeholder tenant so the production URL renders 200 out
-- of the box. Idempotent — safe to re-run.
--
-- Remove this whole demo tenant when you onboard the first real client
-- per `docs/02-adding-a-client.md`:
--
--   delete from public.template_organizations where slug = 'mysite-demo';
--
-- The tenant maps to Vercel's stable production alias
-- `website-template-iota-one.vercel.app`. Migration 006 later refines
-- the copy and images; migration 007 wires attribution IDs. This
-- migration exists so the tenant is fully present after step 5 alone —
-- useful when running migrations against a fresh DB in a test env.

do $$
declare
  v_org_id   uuid;
  v_brand_id uuid;
  v_loc_id   uuid;
begin
  insert into public.template_organizations (slug, name, default_locale)
  values ('mysite-demo', 'MySite Demo', 'en')
  on conflict (slug) do update
    set name = excluded.name, default_locale = excluded.default_locale
  returning id into v_org_id;

  insert into public.template_brands (org_id, slug, name, tagline, about_md)
  values (
    v_org_id, 'demo', 'MySite Bistro',
    'Neighborhood bistro — coffee, brunch, and evenings.',
    E'MySite Bistro is a placeholder tenant used to smoke-test the website-template deployment.\n\nWhen you onboard the first real client, remove this org and its cascaded rows per `docs/02-adding-a-client.md`.'
  )
  on conflict (org_id, slug) do update
    set name = excluded.name, tagline = excluded.tagline, about_md = excluded.about_md
  returning id into v_brand_id;

  insert into public.template_locations (
    brand_id, slug, name,
    address_line, city, region, postal_code, country,
    latitude, longitude,
    weekday_hours, weekend_hours,
    maps_search_query,
    menu
  )
  values (
    v_brand_id, 'demo', 'MySite Bistro',
    '245 5th Avenue', 'New York', 'NY', '10016', 'US',
    40.7449, -73.9857,
    'Mon–Fri 07:00 – 22:00', 'Sat–Sun 08:00 – 23:00',
    'MySite Bistro, 245 5th Avenue, New York',
    '{
      "version": 1,
      "currency_default": "USD",
      "categories": [
        {
          "id": "coffee",
          "name": "Coffee",
          "items": [
            {"id":"flat-white","name":"Flat White","description":"Double ristretto, silky steamed milk.","price":{"amount":5,"currency":"USD"}},
            {"id":"matcha-latte","name":"Matcha Latte","price":{"amount":6,"currency":"USD"},"tags":["vegan"]}
          ]
        },
        {
          "id": "brunch",
          "name": "Brunch",
          "items": [
            {"id":"avocado-toast","name":"Avocado Toast","description":"Smashed avocado, sourdough, chili flakes, poached egg.","price":{"amount":14,"currency":"USD"},"tags":["vegetarian"]}
          ]
        }
      ]
    }'::jsonb
  )
  on conflict (brand_id, slug) do update
    set name = excluded.name
  returning id into v_loc_id;

  insert into public.template_domains (hostname, location_id, is_primary, kind)
  values ('website-template-iota-one.vercel.app', v_loc_id, true, 'custom')
  on conflict (hostname) do nothing;
end $$;
