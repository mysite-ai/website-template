-- Replace all stock/generic images with real photos scraped from each tenant's live site.
-- All URLs point to our Supabase Storage — no external dependencies.
--
-- Sources:
--   WBC:    https://marszalkowska.thewhitebearcoffee.pl/images/*.webp (9 photos)
--   Stacks: https://www.stacks66.com/images/* (6 photos)
--   Doublz: https://le-cdn.hibuwebsites.com/ba4199312f484a91a2eb8d4c81cedced/... (4 photos + logo)
--
-- Storage paths (self-hosted):
--   gallery/whitebear-v2/wbc-*.jpg (9 files)
--   menu/whitebear-v2/{latte,cold-brew,matcha,croissant}.jpg
--   gallery/stacks-v2/stacks-*.jpg (6 files)
--   gallery/doublz-v2/doublz-*.jpg (4 files)
--   logos/doublz-logo-v2.png (real blue/yellow logo)

-- ---------------------------------------------------------------------------
-- 1. WBC Marszałkowska — replace 6 generic gallery images with 9 real photos
-- ---------------------------------------------------------------------------
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-01-interior.jpg',     'alt', 'Colourful WBC counter with cakes, panda mascots and pink shelves'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-03-latte-art.jpg',    'alt', 'Two cappuccinos with fern latte art on the green marble counter'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-08-croissants.jpg',   'alt', 'Almond croissant, matcha latte and cappuccino with a White Bear napkin'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-02-bar.jpg',          'alt', 'The main bar and espresso machine inside the café'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-04-coffee-beans.jpg', 'alt', 'Freshly roasted coffee beans from our roastery'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-05-palarnia.jpg',     'alt', 'Coffee bags from the White Bear roastery in Białystok'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-06-cold-brew.jpg',    'alt', 'Cold brew coffee ready to serve'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-07-barista.jpg',      'alt', 'One of our baristas serving coffee'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear-v2/wbc-09-pink-latte.jpg',   'alt', 'Signature pink latte with heart latte art')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'whitebear-coffee';

-- ---------------------------------------------------------------------------
-- 2. WBC menu — strip 4 Unsplash URLs; keep only the one item we have a real
--    matching photo for (Flat White → real WBC latte art)
-- ---------------------------------------------------------------------------
update public.template_locations l
set menu = jsonb_set(
  l.menu,
  '{categories}',
  (
    select jsonb_agg(
      jsonb_set(
        c,
        '{items}',
        (
          select jsonb_agg(
            case
              when i->>'name' = 'Flat White'
                then jsonb_set(i, '{image_url}', to_jsonb('https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/menu/whitebear-v2/latte.jpg'::text))
              else i - 'image_url'  -- strip Unsplash from items where we don't have a real match
            end
          )
          from jsonb_array_elements(c->'items') as i
        )
      )
    )
    from jsonb_array_elements(l.menu->'categories') as c
  )
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'whitebear-coffee';

-- ---------------------------------------------------------------------------
-- 3. Stacks on Route 66 — replace 6 stock photos with 6 real photos from
--    stacks66.com (their own diner exterior, plates, storefront)
-- ---------------------------------------------------------------------------
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-01-diner.jpg',     'alt', 'The Stacks on Route 66 diner'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-02-skillet.jpg',   'alt', 'Stacks Fav Skillet with two sunny-side-up eggs'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-03-omelette.jpg',  'alt', 'Stacks Favorite Omelette with ham, bacon and cheese'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-04-tri-tip.jpg',   'alt', 'Flame-grilled tri-tip steak, our signature dish'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-05-inside.jpg',    'alt', 'Inside the diner — classic booths and counter seating'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks-v2/stacks-06-storefront.jpg', 'alt', 'Our Glendora storefront on historic Route 66')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'stacks-on-route-66';

-- ---------------------------------------------------------------------------
-- 4. Doublz — swap synthetic logo for real Doublz-Logo-blue-yellow-02.png
-- ---------------------------------------------------------------------------
update public.template_brands b
set logo_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/doublz-logo-v2.png'
from public.template_organizations o
where b.org_id = o.id and o.slug = 'doublz';

-- ---------------------------------------------------------------------------
-- 5. Doublz — replace 6 stock burger photos with 4 real photos from doublz.com
--    (their own content-home breakfast/club sandwich/hero shots).
--    All 8 locations share these — Doublz's own site treats them as brand-level
--    content, not per-store.
-- ---------------------------------------------------------------------------
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz-v2/doublz-02-hero.jpg',       'alt', 'Doublz — American diner classics done right'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz-v2/doublz-01-breakfast.jpg',  'alt', 'Breakfast plates: eggs, bacon, sausage, toast, French toast'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz-v2/doublz-03-club.jpg',       'alt', 'Turkey club sandwich with fries'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz-v2/doublz-04-breakfast2.jpg', 'alt', 'Two Doublz breakfast plates — pancakes, eggs and sides')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'doublz';
