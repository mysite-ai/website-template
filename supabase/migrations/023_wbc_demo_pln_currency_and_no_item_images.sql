-- 023_wbc_demo_pln_currency_and_no_item_images.sql
--
-- Bring the White Bear Coffee demo tenant into line with its address:
--
-- 1. Menu currency USD -> PLN. Prices converted at ~4x (rough eyeball)
--    so numbers still read like a Warsaw specialty coffee menu.
-- 2. Remove per-item image_url on all menu items. Rationale: the design
--    system now enforces "either every item has a thumbnail (Sweetgreen)
--    OR none (Blue Bottle)". We pick "none" as the safe default so
--    tenants that don't have a full photo set never ship a page with
--    one lonely thumbnail bug.
-- 3. Drop the NY Cheesecake (US-flavored copy) and replace with a
--    Polish-friendly seasonal option.
--
-- Idempotent: replaces the whole menu blob for the demo location.

update public.template_locations
   set menu = '{
     "version": 1,
     "currency_default": "PLN",
     "categories": [
       {
         "id": "brunch",
         "name": "Brunch",
         "description": "Served daily until 3pm.",
         "items": [
           {"id":"avocado-toast","name":"Avocado Toast","description":"Smashed avocado, sourdough, chili flakes, poached egg.","price":{"amount":36,"currency":"PLN"},"tags":["vegetarian","new"]},
           {"id":"shakshuka","name":"Shakshuka","description":"Two eggs poached in spiced tomato sauce, feta, herbs.","price":{"amount":42,"currency":"PLN"},"tags":["vegetarian"]},
           {"id":"buttermilk-pancakes","name":"Buttermilk Pancakes","description":"Stack of three, maple syrup, seasonal fruit.","price":{"amount":32,"currency":"PLN"}}
         ]
       },
       {
         "id": "coffee",
         "name": "Coffee & Tea",
         "description": "Locally roasted, single-origin.",
         "items": [
           {"id":"flat-white","name":"Flat White","description":"Double ristretto, silky steamed milk.","price":{"amount":16,"currency":"PLN"}},
           {"id":"cortado","name":"Cortado","price":{"amount":14,"currency":"PLN"}},
           {"id":"matcha-latte","name":"Matcha Latte","description":"Ceremonial grade, oat milk on request.","price":{"amount":19,"currency":"PLN"},"tags":["vegan"]},
           {"id":"cold-brew","name":"Cold Brew","price":{"amount":17,"currency":"PLN"}}
         ]
       },
       {
         "id": "mains",
         "name": "Mains",
         "items": [
           {"id":"burrata-pasta","name":"Burrata Pasta","description":"Bucatini, cherry tomatoes, basil, torn burrata.","price":{"amount":58,"currency":"PLN"},"tags":["vegetarian"]},
           {"id":"grilled-salmon","name":"Grilled Salmon","description":"Wild-caught, lemon herb butter, greens.","price":{"amount":74,"currency":"PLN"},"tags":["gluten-free"]},
           {"id":"harvest-bowl","name":"Harvest Bowl","description":"Quinoa, roasted vegetables, tahini dressing.","price":{"amount":48,"currency":"PLN"},"tags":["vegan","gluten-free"]}
         ]
       },
       {
         "id": "desserts",
         "name": "Desserts",
         "items": [
           {"id":"seasonal-cake","name":"Seasonal Cake","description":"Baked in-house, ask what is on today.","price":{"amount":22,"currency":"PLN"},"tags":["vegetarian"]},
           {"id":"tiramisu","name":"Tiramisu","price":{"amount":24,"currency":"PLN"}}
         ]
       }
     ]
   }'::jsonb
 where slug = 'whitebear'
   and brand_id in (
     select id from public.template_brands where slug = 'whitebear'
   );
