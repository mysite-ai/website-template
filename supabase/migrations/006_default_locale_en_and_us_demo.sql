-- 006_default_locale_en_and_us_demo.sql
--
-- Flip template defaults to English-first:
--
-- 1. `template_organizations.default_locale` default `pl` → `en`
--    (matches the plan's product direction — English is now the
--    primary market)
-- 2. `template_locations.country` default `PL` → `US`
-- 3. Update the smoke-test tenant to render as an English-speaking
--    US demo restaurant so the production URL doesn't look
--    Polish out of the box.

alter table public.template_organizations
  alter column default_locale set default 'en';

alter table public.template_locations
  alter column country set default 'US';

-- Update the seeded demo tenant. We only touch the rows created by
-- migration 005 (identified by slug); if an operator has already
-- customized them this is a safe no-op that just brings copy in line.
update public.template_organizations
  set default_locale = 'en'
  where slug = 'mysite-demo';

update public.template_brands
  set
    name = 'MySite Bistro',
    tagline = 'Neighborhood bistro — coffee, brunch, and evenings.',
    about_md = E'MySite Bistro is a placeholder tenant used to smoke-test the website-template deployment.\n\nWhen you onboard the first real client, remove this org and its cascaded rows per `docs/02-adding-a-client.md`.',
    logo_url = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200&h=200&fit=crop&auto=format&q=80'
  where slug = 'demo'
    and org_id in (select id from public.template_organizations where slug = 'mysite-demo');

update public.template_locations
  set
    name = 'MySite Bistro',
    address_line = '245 5th Avenue',
    city = 'New York',
    region = 'NY',
    postal_code = '10016',
    country = 'US',
    latitude = 40.7449,
    longitude = -73.9857,
    phone = '+12125555010',
    email = 'hello@mysite.ai',
    weekday_hours = 'Mon–Fri 07:00 – 22:00',
    weekend_hours = 'Sat–Sun 08:00 – 23:00',
    maps_embed_url = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.7!2d-73.9857!3d40.7449!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQ0JzQxLjYiTiA3M8KwNTknMDguNSJX!5e0!3m2!1sen!2sus!4v1',
    maps_search_query = 'MySite Bistro, 245 5th Avenue, New York',
    instagram_url = 'https://instagram.com/mysite.ai',
    facebook_url = null,
    delivery = '[
      {"name":"DoorDash","url":"https://doordash.com/"},
      {"name":"Uber Eats","url":"https://www.ubereats.com/"}
    ]'::jsonb,
    gallery = '[
      {"src":"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&h=1000&fit=crop&auto=format&q=80","alt":"Warm bistro dining room in the evening"},
      {"src":"https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=800&fit=crop&auto=format&q=80","alt":"Barista pouring latte art"},
      {"src":"https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&h=800&fit=crop&auto=format&q=80","alt":"Avocado toast plate on marble counter"},
      {"src":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=800&fit=crop&auto=format&q=80","alt":"Pasta dish with fresh herbs"},
      {"src":"https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&h=800&fit=crop&auto=format&q=80","alt":"Fresh salad bowl overhead shot"},
      {"src":"https://images.unsplash.com/photo-1543353071-10c8ba85a904?w=800&h=800&fit=crop&auto=format&q=80","alt":"Craft cocktails on the bar"},
      {"src":"https://images.unsplash.com/photo-1481833761820-0509d3217039?w=800&h=800&fit=crop&auto=format&q=80","alt":"Slice of cheesecake with berries"}
    ]'::jsonb,
    menu = '{
      "version": 1,
      "currency_default": "USD",
      "categories": [
        {
          "id": "brunch",
          "name": "Brunch",
          "description": "Served daily until 3pm.",
          "items": [
            {"id":"avocado-toast","name":"Avocado Toast","description":"Smashed avocado, sourdough, chili flakes, poached egg.","price":{"amount":14,"currency":"USD"},"image_url":"https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&h=400&fit=crop&auto=format&q=80","tags":["vegetarian","new"]},
            {"id":"shakshuka","name":"Shakshuka","description":"Two eggs poached in spiced tomato sauce, feta, herbs.","price":{"amount":16,"currency":"USD"},"tags":["vegetarian"]},
            {"id":"buttermilk-pancakes","name":"Buttermilk Pancakes","description":"Stack of three, maple syrup, seasonal fruit.","price":{"amount":13,"currency":"USD"}}
          ]
        },
        {
          "id": "coffee",
          "name": "Coffee & Tea",
          "description": "Locally roasted, single-origin.",
          "items": [
            {"id":"flat-white","name":"Flat White","description":"Double ristretto, silky steamed milk.","price":{"amount":5,"currency":"USD"},"image_url":"https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=400&fit=crop&auto=format&q=80"},
            {"id":"cortado","name":"Cortado","price":{"amount":4.5,"currency":"USD"}},
            {"id":"matcha-latte","name":"Matcha Latte","description":"Ceremonial grade, oat milk on request.","price":{"amount":6,"currency":"USD"},"tags":["vegan"]},
            {"id":"cold-brew","name":"Cold Brew","price":{"amount":5.5,"currency":"USD"}}
          ]
        },
        {
          "id": "mains",
          "name": "Mains",
          "items": [
            {"id":"burrata-pasta","name":"Burrata Pasta","description":"Bucatini, cherry tomatoes, basil, torn burrata.","price":{"amount":22,"currency":"USD"},"image_url":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop&auto=format&q=80","tags":["vegetarian"]},
            {"id":"grilled-salmon","name":"Grilled Salmon","description":"Wild-caught, lemon herb butter, greens.","price":{"amount":28,"currency":"USD"},"tags":["gluten-free"]},
            {"id":"harvest-bowl","name":"Harvest Bowl","description":"Quinoa, roasted vegetables, tahini dressing.","price":{"amount":17,"currency":"USD"},"tags":["vegan","gluten-free"]}
          ]
        },
        {
          "id": "desserts",
          "name": "Desserts",
          "items": [
            {"id":"cheesecake","name":"NY Cheesecake","description":"Classic slice, macerated berries.","price":{"amount":9,"currency":"USD"},"image_url":"https://images.unsplash.com/photo-1481833761820-0509d3217039?w=400&h=400&fit=crop&auto=format&q=80"},
            {"id":"tiramisu","name":"Tiramisu","price":{"amount":10,"currency":"USD"}}
          ]
        }
      ]
    }'::jsonb
  where slug = 'demo'
    and brand_id in (
      select id from public.template_brands where slug = 'demo'
        and org_id in (select id from public.template_organizations where slug = 'mysite-demo')
    );
