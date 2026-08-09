-- 005_seed_smoke_test_tenant.sql
--
-- Seeds one placeholder tenant so the production URL renders 200 out
-- of the box. Idempotent — `on conflict do nothing` guards against
-- re-running on top of an already-seeded DB.
--
-- Remove this whole migration (or the org row via cascade) once you
-- onboard the first real client per docs/02-adding-a-client.md:
--
--   delete from public.template_organizations where slug = 'mysite-demo';
--
-- The tenant maps to Vercel's stable production alias
-- `website-template-iota-one.vercel.app`. If you rename the Vercel
-- project (which changes the alias), update this migration and
-- re-apply, or run `docs/06-developer-guide.md`'s cache-clear helper.

do $$
declare
  v_org_id   uuid;
  v_brand_id uuid;
  v_loc_id   uuid;
begin
  -- Org (idempotent by slug)
  insert into public.template_organizations (slug, name)
  values ('mysite-demo', 'MySite Demo')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  -- Brand
  insert into public.template_brands (org_id, slug, name, tagline, about_md)
  values (
    v_org_id, 'demo', 'MySite Demo',
    'Szablon restauracyjny MySite — placeholder na czas onboardingu.',
    E'To jest tymczasowy tenant zaseedowany na potrzeby smoke-testu wdrożenia produkcyjnego.\n\nPełny onboarding pierwszego prawdziwego klienta przebiega według `docs/02-adding-a-client.md`.'
  )
  on conflict (org_id, slug) do update set name = excluded.name
  returning id into v_brand_id;

  -- Location — includes a small demo menu so /menu renders items too.
  insert into public.template_locations (
    brand_id, slug, name,
    address_line, city, region, postal_code, country,
    latitude, longitude,
    weekday_hours, weekend_hours,
    maps_search_query,
    menu
  )
  values (
    v_brand_id, 'demo', 'MySite Demo',
    'ul. Testowa 1', 'Warszawa', 'mazowieckie', '00-001', 'PL',
    52.2297, 21.0122,
    'pon–pt 08:00 – 20:00', 'sob–ndz 09:00 – 21:00',
    'MySite Warszawa',
    '{
      "version": 1,
      "currency_default": "PLN",
      "categories": [
        {
          "id": "drinks",
          "name": "Napoje",
          "items": [
            {"id":"flat-white","name":"Flat White","description":"Podwójne espresso + spienione mleko.","price":{"amount":18,"currency":"PLN"}},
            {"id":"matcha-latte","name":"Matcha Latte","price":{"amount":22,"currency":"PLN"},"tags":["vegan"]}
          ]
        },
        {
          "id": "food",
          "name": "Kuchnia",
          "items": [
            {"id":"shakshuka","name":"Shakshuka","description":"Jajka duszone w sosie pomidorowym, feta, kolendra.","price":{"amount":34,"currency":"PLN"}}
          ]
        }
      ]
    }'::jsonb
  )
  on conflict (brand_id, slug) do update set name = excluded.name
  returning id into v_loc_id;

  -- Primary domain — Vercel's stable production alias.
  insert into public.template_domains (hostname, location_id, is_primary, kind)
  values ('website-template-iota-one.vercel.app', v_loc_id, true, 'custom')
  on conflict (hostname) do nothing;
end $$;
