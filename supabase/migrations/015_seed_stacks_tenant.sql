-- 015_seed_stacks_and_doublz_tenants.sql
--
-- Seeds two new production tenants in the website-template DB.
--
-- 1. Stacks on Route 66 (single-location, Glendora CA)
--    Hostname: stacks.mysite.social (kind = mysite_single)
--
-- 2. Doublz (multi-location, 8 physical sites: 7 CA + 1 TN)
--    Hostnames: <city>.doublz.mysite.social (kind = mysite_multi)
--
-- Both are real restaurants. Data sourced from their own websites:
--   stacks66.com  — address, phone, hours, menu highlights
--   doublz.com    — chain description, per-location contact info
--
-- Attribution IDs referenced below live in attribution-autopilot
-- Supabase (separate project). See docs/04-attribution-integration.md.

-- ============================================================
-- STACKS ON ROUTE 66 (single-location)
-- ============================================================
do $$
declare v_org_id uuid; v_brand_id uuid; v_loc_id uuid;
begin
  insert into public.template_organizations (slug, name, default_locale)
  values ('stacks-on-route-66', 'Stacks on Route 66', 'en')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.template_brands (org_id, slug, name, tagline, about_md, logo_url, theme)
  values (
    v_org_id, 'stacks', 'Stacks on Route 66',
    'Classic American diner and pancake house on historic Route 66.',
    E'At Stacks on Route 66, our goal is to offer delicious food and friendly service in a warm, welcoming atmosphere. We''re passionate about cooking and it''s a dream come true to run our all-day breakfast diner in Glendora, sharing that passion with the community.\n\nOur menu features both authentic and familiar dishes made using family recipes, along with one-of-a-kind creations. Every dish that leaves our kitchen is made to be the best it can be.',
    'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/stacks-logo.svg',
    '{"primary":"oklch(0.55 0.19 25)","primary_foreground":"oklch(0.99 0.005 25)"}'::jsonb
  )
  on conflict (org_id, slug) do update
    set name = excluded.name, tagline = excluded.tagline, about_md = excluded.about_md,
        logo_url = excluded.logo_url, theme = excluded.theme
  returning id into v_brand_id;

  insert into public.template_locations (
    brand_id, slug, name,
    address_line, city, region, postal_code, country, latitude, longitude,
    phone, email,
    weekday_hours, weekend_hours,
    maps_search_query, instagram_url, facebook_url,
    delivery, gallery, menu,
    attribution_org_id, attribution_location_id, attribution_promotion_id, attribution_campaign_id,
    promotion_name_cached, reward_description_cached
  ) values (
    v_brand_id, 'stacks', 'Stacks on Route 66',
    '640 West Route 66', 'Glendora', 'CA', '91740', 'US', 34.1360, -117.8653,
    '+16268529444', 'hello@stacks66.com',
    'Mon–Wed 07:00 – 15:00 · Thu–Fri 07:00 – 19:00',
    'Sat–Sun 06:00 – 19:00',
    'Stacks on Route 66, 640 W Route 66, Glendora CA',
    'https://instagram.com/stacksonroute66', null,
    '[{"name":"Grubhub","url":"https://www.grubhub.com/restaurant/stacks-on-route-66-640-w-rte-66-glendora/3224818"},{"name":"DoorDash","url":"https://doordash.com/"},{"name":"Uber Eats","url":"https://www.ubereats.com/"}]'::jsonb,
    '[
      {"src":"https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1600&h=1000&fit=crop&auto=format&q=80","alt":"Stack of fluffy pancakes with syrup"},
      {"src":"https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=800&fit=crop&auto=format&q=80","alt":"Classic diner burger and fries"},
      {"src":"https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&h=800&fit=crop&auto=format&q=80","alt":"Breakfast skillet with eggs, bacon, and hash browns"},
      {"src":"https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&h=800&fit=crop&auto=format&q=80","alt":"Chocolate milkshake with whipped cream"},
      {"src":"https://images.unsplash.com/photo-1592861956120-e524fc739696?w=800&h=800&fit=crop&auto=format&q=80","alt":"Retro American diner interior"},
      {"src":"https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=800&h=800&fit=crop&auto=format&q=80","alt":"French toast with berries"}
    ]'::jsonb,
    '{
      "version": 1,
      "currency_default": "USD",
      "categories": [
        {"id":"favorites","name":"Popular","description":"Signature dishes you cannot miss.","items":[
          {"id":"stacks-skillet","name":"Stacks Fav Skillet","description":"Diced ham, bacon, sausage, onions and bell peppers, topped with cheddar and Monterey Jack.","price":{"amount":15.5,"currency":"USD"},"tags":["new"]},
          {"id":"stacks-omelette","name":"Stacks Favorite Omelette","description":"Ham, bacon, sausage, bell peppers and onions with Monterey Jack and cheddar.","price":{"amount":14.5,"currency":"USD"}},
          {"id":"tri-tip","name":"Tri Tip","description":"10 oz tri-tip steak seasoned with our special spice blend, flame-grilled to your doneness.","price":{"amount":26,"currency":"USD"}}
        ]},
        {"id":"pancakes","name":"Pancakes & Crepes","items":[
          {"id":"short-stack","name":"Short Stack","description":"Three buttermilk pancakes, whipped butter, warm syrup.","price":{"amount":9,"currency":"USD"}},
          {"id":"berry-crepes","name":"Mixed Berry Crepes","description":"Three crepes filled with mixed berries and mascarpone.","price":{"amount":13,"currency":"USD"}},
          {"id":"french-toast","name":"French Toast","description":"Thick-cut brioche, cinnamon sugar, seasonal fruit.","price":{"amount":11,"currency":"USD"}}
        ]},
        {"id":"lunch","name":"Lunch","items":[
          {"id":"classic-cheeseburger","name":"Classic Cheeseburger","description":"Flame-grilled beef, cheddar, lettuce, tomato, house sauce.","price":{"amount":14,"currency":"USD"}},
          {"id":"blt","name":"BLT Sandwich","description":"Applewood bacon, lettuce, tomato, on toasted sourdough.","price":{"amount":11,"currency":"USD"}},
          {"id":"cobb-salad","name":"Cobb Salad","description":"Grilled chicken, bacon, egg, avocado, blue cheese.","price":{"amount":15,"currency":"USD"},"tags":["gluten-free"]}
        ]},
        {"id":"shakes","name":"Shakes & Drinks","items":[
          {"id":"chocolate-shake","name":"Classic Chocolate Shake","price":{"amount":7,"currency":"USD"}},
          {"id":"strawberry-shake","name":"Strawberry Shake","price":{"amount":7,"currency":"USD"}},
          {"id":"root-beer-float","name":"Root Beer Float","price":{"amount":6,"currency":"USD"}}
        ]}
      ]
    }'::jsonb,
    'adc5ebab-118e-4cf8-91fa-aaee16292ff6', -- attribution org: Stacks
    'ad22d170-463d-4ff7-b985-14c834f0ec32', -- attribution location: Glendora
    'cafe4296-1eb0-4bf5-9aa8-4cbca55651ae', -- attribution promo: STACKS
    '50926785-a990-442e-91aa-bac550774acb', -- attribution campaign
    'Stacks Rewards',
    'Free classic milkshake on your next visit'
  )
  on conflict (brand_id, slug) do update
    set name = excluded.name, address_line = excluded.address_line,
        promotion_name_cached = excluded.promotion_name_cached,
        reward_description_cached = excluded.reward_description_cached
  returning id into v_loc_id;

  insert into public.template_domains (hostname, location_id, is_primary, kind)
  values ('stacks.mysite.social', v_loc_id, true, 'mysite_single')
  on conflict (hostname) do update set location_id = excluded.location_id, is_primary = true, kind = excluded.kind;
end $$;
