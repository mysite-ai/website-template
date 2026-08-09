-- 016_seed_doublz_multi_location.sql
--
-- Doublz — multi-location brand with 8 physical sites (7 CA + 1 TN).
-- All share the same brand, menu, gallery, and loyalty promo.
-- Each has its own address, phone, hours, and domain
-- (<slug>.doublz.mysite.social, kind = mysite_multi).
--
-- Location UUIDs referenced from `attribution_location_id` live in the
-- attribution-autopilot Supabase project (separate) and were created
-- via the same migration on that side. See docs/04-attribution-integration.md.

do $$
declare
  v_org_id uuid;
  v_brand_id uuid;
begin
  insert into public.template_organizations (slug, name, default_locale)
  values ('doublz', 'Doublz', 'en')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.template_brands (org_id, slug, name, tagline, about_md, logo_url, theme)
  values (
    v_org_id, 'doublz', 'Doublz',
    'Real fast food, made to order. Flame-broiled burgers, all-day breakfast, and comfort classics.',
    E'Doublz has been serving the greater Los Angeles area for over 25 years with the freshest food. All meals are cooked in our open exhibition kitchens — real fast food, homemade signature plates.\n\nOver 140 menu items, thirty breakfast items, more than a dozen flame-broiled burgers, salads, breakfast burritos and Mexican classics. Real ingredients, generous portions, value pricing.',
    'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/doublz-logo.png',
    '{"primary":"oklch(0.85 0.19 95)","primary_foreground":"oklch(0.20 0.10 260)"}'::jsonb
  )
  on conflict (org_id, slug) do update
    set name = excluded.name, tagline = excluded.tagline, about_md = excluded.about_md,
        logo_url = excluded.logo_url, theme = excluded.theme
  returning id into v_brand_id;

  insert into public.template_locations (
    brand_id, slug, name,
    address_line, city, region, postal_code, country, latitude, longitude,
    phone, email, weekday_hours, weekend_hours,
    maps_search_query, instagram_url, facebook_url,
    delivery, gallery, menu,
    attribution_org_id, attribution_location_id, attribution_promotion_id, attribution_campaign_id,
    promotion_name_cached, reward_description_cached
  )
  select
    v_brand_id, loc.slug, loc.name,
    loc.address_line, loc.city, loc.region, loc.postal_code, 'US', loc.lat, loc.lng,
    loc.phone, 'hello@doublz.com',
    'Mon–Fri 06:00 – 22:00', 'Sat–Sun 07:00 – 22:00',
    concat('Doublz, ', loc.address_line, ', ', loc.city, ', ', loc.region),
    'https://instagram.com/doublzofficial', 'https://facebook.com/doublzofficial',
    '[{"name":"DoorDash","url":"https://doordash.com/"},{"name":"Uber Eats","url":"https://www.ubereats.com/"},{"name":"Grubhub","url":"https://www.grubhub.com/"}]'::jsonb,
    '[
      {"src":"https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1600&h=1000&fit=crop&auto=format&q=80","alt":"Doublz flame-broiled cheeseburger stacked high"},
      {"src":"https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=800&fit=crop&auto=format&q=80","alt":"Classic double cheeseburger with fries"},
      {"src":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=800&fit=crop&auto=format&q=80","alt":"Loaded chili cheese fries"},
      {"src":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&h=800&fit=crop&auto=format&q=80","alt":"Breakfast burrito with eggs and bacon"},
      {"src":"https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&h=800&fit=crop&auto=format&q=80","alt":"Crispy chicken sandwich with pickles"},
      {"src":"https://images.unsplash.com/photo-1587899897387-091ebd01a6b6?w=800&h=800&fit=crop&auto=format&q=80","alt":"Onion rings golden crispy"}
    ]'::jsonb,
    '{
      "version": 1,
      "currency_default": "USD",
      "categories": [
        {"id":"burgers","name":"Burgers","description":"Flame-broiled, 100% pure beef patties.","items":[
          {"id":"classic-cheeseburger","name":"Classic Cheeseburger","description":"Lettuce, tomato, onion, pickles, cheese, our sauce.","price":{"amount":7.95,"currency":"USD"}},
          {"id":"double-cheeseburger","name":"Doublz Double","description":"Two flame-broiled patties, double cheese.","price":{"amount":10.95,"currency":"USD"}},
          {"id":"western-bacon","name":"Western Bacon Cheeseburger","description":"Bacon, onion rings, BBQ sauce, cheddar.","price":{"amount":11.95,"currency":"USD"}},
          {"id":"protein-style","name":"Protein-Style Burger","description":"Any burger lettuce-wrapped, no bun.","price":{"amount":8.95,"currency":"USD"},"tags":["gluten-free"]}
        ]},
        {"id":"chicken","name":"Chicken","items":[
          {"id":"crispy-tenders-4pc","name":"Crispy Chicken Tenders (4 pc)","price":{"amount":8.95,"currency":"USD"}},
          {"id":"chicken-sandwich","name":"Flame-Broiled Chicken Sandwich","description":"Grilled chicken breast, lettuce, tomato, mayo.","price":{"amount":9.95,"currency":"USD"}},
          {"id":"hot-wings-6pc","name":"Hot Wings (6 pc)","price":{"amount":9.95,"currency":"USD"},"tags":["spicy"]}
        ]},
        {"id":"breakfast","name":"Breakfast (All Day)","description":"Served every hour we are open.","items":[
          {"id":"breakfast-burrito","name":"Breakfast Burrito","description":"Eggs, cheese, potatoes, choice of bacon/sausage/ham.","price":{"amount":8.95,"currency":"USD"}},
          {"id":"pancakes-3","name":"Pancakes (3)","description":"Buttermilk pancakes with warm syrup.","price":{"amount":6.95,"currency":"USD"}},
          {"id":"french-toast-3","name":"French Toast (3)","price":{"amount":7.95,"currency":"USD"}}
        ]},
        {"id":"mexican","name":"Mexican","items":[
          {"id":"carne-asada-plate","name":"Carne Asada Plate","description":"Grilled steak, rice, beans, tortillas.","price":{"amount":13.95,"currency":"USD"}},
          {"id":"tacos-3","name":"Tacos (3)","description":"Choice of carne asada, chicken, or fish.","price":{"amount":10.95,"currency":"USD"}}
        ]},
        {"id":"sides","name":"Sides & Drinks","items":[
          {"id":"seasoned-fries","name":"Seasoned Fries","price":{"amount":3.95,"currency":"USD"}},
          {"id":"chili-cheese-fries","name":"Chili Cheese Fries","price":{"amount":6.95,"currency":"USD"}},
          {"id":"onion-rings","name":"Onion Rings","price":{"amount":4.95,"currency":"USD"}},
          {"id":"strawberry-shake","name":"Strawberry Shake","price":{"amount":4.95,"currency":"USD"}}
        ]}
      ]
    }'::jsonb,
    '19cf08af-90e8-49b3-b4c5-02502b4b759f',    -- Doublz attribution org
    loc.attribution_location_id,                -- per-location UUID (see values below)
    '5ea1e310-bc01-4e47-a4f9-3337fb6ebd65',    -- chain-wide promo: DOUBLZ
    '87e9601b-a9de-4528-92f5-dcfdf7996775',    -- chain-wide campaign
    'Doublz Rewards',
    'Free seasoned fries with your next order'
  from (values
    ('la-puente',        'Doublz — La Puente',        '825 N Hacienda Blvd',  'La Puente',       'CA', '91744', 34.0244, -117.9756, '+16262089334', '90abf922-6c26-4d13-8478-c44c49509029'::uuid),
    ('el-monte',         'Doublz — El Monte',         '11030 Valley Blvd',    'El Monte',        'CA', '91731', 34.0686, -118.0276, '+16262100887', '220a5e31-3e6b-488c-9539-7a5e0d41efae'::uuid),
    ('lancaster',        'Doublz — Lancaster',        '901-A West Ave J',     'Lancaster',       'CA', '93534', 34.6841, -118.1428, '+16612143514', 'fc225050-f39b-4ca4-8951-029a5d1fa8f1'::uuid),
    ('montebello',       'Doublz — Montebello',       '1720 W Whittier Blvd', 'Montebello',      'CA', '90640', 34.0163, -118.1246, '+13232722530', '81f382dc-3ecf-46a2-8dcc-187e9003710e'::uuid),
    ('palmdale',         'Doublz — Palmdale',         '2230 E Palmdale Blvd', 'Palmdale',        'CA', '93550', 34.5794, -118.0955, '+16612143544', 'e54b70aa-6cbc-4e1a-b6fe-ab7c25e446e7'::uuid),
    ('paramount',        'Doublz — Paramount',        '15100 Paramount Blvd', 'Paramount',       'CA', '90723', 33.8895, -118.1598, '+15622036468', '13dabcf5-1c76-4262-a737-fdfa8fc0c3fd'::uuid),
    ('santa-fe-springs', 'Doublz — Santa Fe Springs', '11242 Washington Blvd','Whittier',        'CA', '90606', 33.9812, -118.1128, '+15622037130', '37182984-fdec-4294-88d3-0db730b0dd9b'::uuid),
    ('nashville',        'Doublz — Nashville',        '3133 Lebanon Pike',    'Nashville',       'TN', '37214', 36.1875, -86.6889,  '+16152006615', '3870b98d-33e6-453f-8017-f2b3450de696'::uuid)
  ) as loc(slug, name, address_line, city, region, postal_code, lat, lng, phone, attribution_location_id)
  on conflict (brand_id, slug) do update
    set name = excluded.name, address_line = excluded.address_line,
        city = excluded.city, phone = excluded.phone,
        attribution_location_id = excluded.attribution_location_id;

  -- One domain per location: <slug>.doublz.mysite.social
  insert into public.template_domains (hostname, location_id, is_primary, kind)
  select concat(l.slug, '.doublz.mysite.social'), l.id, true, 'mysite_multi'
  from public.template_locations l
  where l.brand_id = v_brand_id
  on conflict (hostname) do update
    set location_id = excluded.location_id, is_primary = true, kind = excluded.kind;
end $$;
