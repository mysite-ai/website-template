-- U Babci Polish Cuisine (Lake Forest, CA) — single-location tenant
-- Reference: https://www.ubabci.com/
--
-- Assets:
--   Logo:    /assets/logos/ubabci-logo.png (transparent 1000×1000)
--   Favicon: /assets/favicons/ubabci.svg   (Polish crimson "UB" monogram)
--   Gallery: /assets/gallery/ubabci/*.jpg  (4 authentic catering photos)
--
-- Attribution IDs (from attribution-autopilot Supabase):
--   org_id:       006708f6-bbba-4aee-baa0-de2c7e2cbf02
--   location_id:  d140d317-42c7-4b2b-9a64-9b47d33f4fd9
--   promotion_id: ea0a791c-dd8f-45a6-98eb-fe9c21ab6fd7
--   campaign_id:  fresh random UUID (matches Doublz/Stacks convention)
--   code_prefix:  UBABCI
--   origin whitelisted: https://ubabci.mysite.social

with
  new_org as (
    insert into public.template_organizations (name, slug, default_locale)
    values ('U Babci', 'ubabci', 'en')
    returning id
  ),
  new_brand as (
    insert into public.template_brands (
      org_id, slug, name, logo_url, favicon_url, tagline, about_md, theme
    )
    select
      id,
      'ubabci',
      'U Babci',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/ubabci-logo.png',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/ubabci.svg',
      'Authentic Polish cuisine from a small village to Orange County.',
      $md$U Babci — meaning **"At Grandma's"** — was born in a small village in Poland.

Twenty-three years and hundreds of recipes later, U Babci has become the **#1 Polish catering company in Orange County**. In February 2025 we finally opened the doors to our first restaurant in Lake Forest.

Chef **Teresa Turek** learned traditional Polish cooking from her grandmother during her childhood in communist-era Poland. Her catering career began by volunteering to cook for the annual Polish Harvest Festival "Dożynki" at the Pope John Paul II Polish Center in Yorba Linda. Today, guests from all over Orange County come to experience the familiar Polish flavours they remember from childhood.

**From Poland with love — zapraszamy!**
$md$,
      jsonb_build_object(
        -- Deep Polish crimson (godło Polski) — warm, appetite-forward
        'primary', 'oklch(0.55 0.20 25)',
        'primary_foreground', 'oklch(0.99 0.005 25)'
      )
    from new_org
    returning id, org_id
  ),
  new_location as (
    insert into public.template_locations (
      brand_id, slug, name,
      address_line, city, region, postal_code, country,
      latitude, longitude,
      phone, email,
      weekday_hours, weekend_hours,
      maps_embed_url, maps_search_query,
      instagram_url, facebook_url,
      delivery,
      attribution_org_id, attribution_location_id,
      attribution_promotion_id, attribution_campaign_id,
      promotion_name_cached, reward_description_cached,
      gallery, menu
    )
    select
      id,
      'ubabci',
      'U Babci — Lake Forest',
      '22641 Lake Forest Dr. #B7',
      'Lake Forest', 'CA', '92630', 'US',
      33.6604, -117.6812,
      '+1-949-229-2984',
      'info@ubabci.com',
      '11:00 AM – 9:00 PM (Tue–Fri) · Closed Monday',
      '12:00 PM – 9:00 PM (Sun) · Closed Saturday',
      'https://www.google.com/maps?q=22641+Lake+Forest+Dr+%23B7,+Lake+Forest,+CA+92630&output=embed',
      '22641 Lake Forest Dr #B7, Lake Forest, CA 92630',
      null, -- Instagram: not linked from ubabci.com homepage
      null, -- Facebook: not linked from ubabci.com homepage
      jsonb_build_array(
        jsonb_build_object('name', 'Order Online (U Babci)', 'url', 'https://www.ubabci.com/order-online'),
        jsonb_build_object('name', 'DoorDash',   'url', 'https://www.doordash.com/'),
        jsonb_build_object('name', 'Uber Eats',  'url', 'https://www.ubereats.com/'),
        jsonb_build_object('name', 'Grubhub',    'url', 'https://www.grubhub.com/')
      ),
      '006708f6-bbba-4aee-baa0-de2c7e2cbf02'::uuid,
      'd140d317-42c7-4b2b-9a64-9b47d33f4fd9'::uuid,
      'ea0a791c-dd8f-45a6-98eb-fe9c21ab6fd7'::uuid,
      gen_random_uuid(),
      'U Babci Rewards',
      'Free homemade pierogi on your next visit',
      jsonb_build_array(
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/ubabci/ubabci-01-catering-buffet.jpg',
          'alt', 'Polish catering buffet with traditional platters'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/ubabci/ubabci-02-family-kitchen.jpg',
          'alt', 'The Turek family in the U Babci kitchen'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/ubabci/ubabci-03-endive-platter.jpg',
          'alt', 'Endive salad platter with red-pepper roses'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/ubabci/ubabci-04-kielbasa-canapes.jpg',
          'alt', 'Kiełbasa canapés and spinach wraps ready to serve'
        )
      ),
      jsonb_build_object(
        'version', 1,
        'currency_default', 'USD',
        'categories', jsonb_build_array(
          jsonb_build_object(
            'id', 'signatures',
            'name', 'U Babci Signatures',
            'description', 'The dishes Teresa Turek is most famous for.',
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', 'pierogi-mixed',
                'name', 'Homemade Pierogi (Mixed)',
                'description', 'A dozen hand-folded dumplings: potato-and-cheese ruskie, savory meat, and sweet farmer''s cheese. Served with sautéed onion and sour cream.',
                'price', jsonb_build_object('amount', 18, 'currency', 'USD'),
                'tags', jsonb_build_array('new')
              ),
              jsonb_build_object(
                'id', 'gołąbki',
                'name', 'Gołąbki (Cabbage Rolls)',
                'description', 'Cabbage leaves stuffed with beef, pork and rice, slow-simmered in a rich tomato sauce.',
                'price', jsonb_build_object('amount', 19, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'bigos',
                'name', 'Bigos (Hunter''s Stew)',
                'description', 'Traditional Polish stew of sauerkraut, fresh cabbage, kielbasa, smoked bacon and mushrooms. Simmered for hours.',
                'price', jsonb_build_object('amount', 17, 'currency', 'USD'),
                'tags', jsonb_build_array('new')
              ),
              jsonb_build_object(
                'id', 'kielbasa-plate',
                'name', 'Kiełbasa & Kraut Plate',
                'description', 'Grilled Polish sausage over sauerkraut, boiled potato and horseradish.',
                'price', jsonb_build_object('amount', 16, 'currency', 'USD')
              )
            )
          ),
          jsonb_build_object(
            'id', 'starters',
            'name', 'Starters & Soups',
            'description', 'Warm Polish beginnings.',
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', 'zurek',
                'name', 'Żurek (Sour Rye Soup)',
                'description', 'Fermented rye soup with white sausage, egg and potato. Served in a bread bowl.',
                'price', jsonb_build_object('amount', 9, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'barszcz',
                'name', 'Barszcz Czerwony',
                'description', 'Clear ruby beetroot broth with tiny mushroom uszka dumplings.',
                'price', jsonb_build_object('amount', 8, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'placki',
                'name', 'Placki Ziemniaczane',
                'description', 'Crispy potato pancakes with sour cream and apple sauce.',
                'price', jsonb_build_object('amount', 10, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'sledz',
                'name', 'Śledź w Oleju',
                'description', 'Marinated herring in cold-pressed oil with onion, apple and dark rye.',
                'price', jsonb_build_object('amount', 11, 'currency', 'USD')
              )
            )
          ),
          jsonb_build_object(
            'id', 'plates',
            'name', 'Main Plates',
            'description', 'Home-style Polish dinners.',
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', 'schabowy',
                'name', 'Kotlet Schabowy',
                'description', 'Breaded pork cutlet, buttered mashed potatoes and mizeria cucumber salad.',
                'price', jsonb_build_object('amount', 20, 'currency', 'USD'),
                'tags', jsonb_build_array('new')
              ),
              jsonb_build_object(
                'id', 'roladki',
                'name', 'Beef Roladki',
                'description', 'Rolled beef with pickle, bacon and mustard in a dark gravy, served with kasha.',
                'price', jsonb_build_object('amount', 24, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'kotlet-mielony',
                'name', 'Kotlet Mielony',
                'description', 'Grandma''s pork-and-onion patty, dill potatoes, warm dill sauce.',
                'price', jsonb_build_object('amount', 16, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'pierogi-ruskie',
                'name', 'Pierogi Ruskie (10 pc)',
                'description', 'Ten potato-and-farmer''s-cheese dumplings, browned butter, caramelized onion.',
                'price', jsonb_build_object('amount', 16, 'currency', 'USD')
              )
            )
          ),
          jsonb_build_object(
            'id', 'sweets',
            'name', 'Sweet Endings',
            'description', 'Just like Babcia used to make.',
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', 'sernik',
                'name', 'Sernik (Polish Cheesecake)',
                'description', 'Airy farmer''s-cheese cake with raisins and a hint of vanilla.',
                'price', jsonb_build_object('amount', 8, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'makowiec',
                'name', 'Makowiec',
                'description', 'Rolled poppy-seed cake with orange zest and glazed nuts.',
                'price', jsonb_build_object('amount', 7, 'currency', 'USD')
              ),
              jsonb_build_object(
                'id', 'nalesniki',
                'name', 'Naleśniki z Serem',
                'description', 'Warm Polish crêpes stuffed with sweet farmer''s cheese, strawberry sauce.',
                'price', jsonb_build_object('amount', 9, 'currency', 'USD')
              )
            )
          )
        )
      )
    from new_brand
    returning id
  )
insert into public.template_domains (hostname, location_id, is_primary, kind)
select 'ubabci.mysite.social', id, true, 'mysite_single' from new_location;
