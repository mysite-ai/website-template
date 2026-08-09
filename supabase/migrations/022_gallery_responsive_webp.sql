-- Performance: switch every tenant's gallery to responsive 3-size WebP variants.
--
-- Before: 6 tenants × ~500 KB–4 MB JPGs, no cache, mobile grid downloads full 1600px assets = 5–15 MB
-- After:  same photos re-encoded to 3 sizes each (400w / 800w / 1600w) and stored under
--         gallery-v3/<tenant>/<basename>-<size>w.webp with `cacheControl=31536000` metadata.
--
-- The DB URL points at the -800w.webp variant (a sensible default). GalleryBrowser detects the
-- `-800w.webp` suffix and expands it into a full `srcset` (400w/800w/1600w) so the browser picks
-- the smallest asset that still fills the tile. Lightbox jumps to -1600w.webp.
--
-- Wire ordering matches previous 021 migration (visual sequence stays identical).

-- WBC — 9 photos, keep the same visual order as 021
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/01-interior-800w.webp',     'alt', 'Colourful WBC counter with cakes, panda mascots and pink shelves'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/03-latte-art-800w.webp',    'alt', 'Two cappuccinos with fern latte art on the green marble counter'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/08-croissants-800w.webp',   'alt', 'Almond croissant, matcha latte and cappuccino with a White Bear napkin'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/02-bar-800w.webp',          'alt', 'The main bar and espresso machine inside the café'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/04-coffee-beans-800w.webp', 'alt', 'Freshly roasted coffee beans from our roastery'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/05-palarnia-800w.webp',     'alt', 'Coffee bags from the White Bear roastery in Białystok'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/06-cold-brew-800w.webp',    'alt', 'Cold brew coffee ready to serve'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/07-barista-800w.webp',      'alt', 'One of our baristas serving coffee'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/whitebear/09-pink-latte-800w.webp',   'alt', 'Signature pink latte with heart latte art')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'whitebear-coffee';

-- Stacks — 6 photos (note: filenames carry legacy .png/.webp extension segment before -Nw.webp;
-- the responsive-URL builder still matches the `-800w.webp` suffix so srcset works)
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/01-diner-exterior.webp-800w.webp', 'alt', 'The Stacks on Route 66 diner'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/02-fav-skillet.png-800w.webp',     'alt', 'Stacks Fav Skillet with two sunny-side-up eggs'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/03-omelette.png-800w.webp',        'alt', 'Stacks Favorite Omelette with ham, bacon and cheese'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/04-tri-tip.png-800w.webp',         'alt', 'Flame-grilled tri-tip steak, our signature dish'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/05-inside-diner.png-800w.webp',    'alt', 'Inside the diner — classic booths and counter seating'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/stacks/06-storefront.png-800w.webp',      'alt', 'Our Glendora storefront on historic Route 66')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'stacks-on-route-66';

-- Doublz — 4 photos, applied to all 8 locations
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/doublz/02-hero-800w.webp',       'alt', 'Doublz — American diner classics done right'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/doublz/01-breakfast-plate-800w.webp', 'alt', 'Breakfast plates: eggs, bacon, sausage, toast, French toast'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/doublz/03-club-sandwich-800w.webp',   'alt', 'Turkey club sandwich with fries'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/doublz/04-breakfast-two-800w.webp',   'alt', 'Two Doublz breakfast plates — pancakes, eggs and sides')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'doublz';

-- U Babci — 4 photos (the big win: 3–4 MB JPEGs → 22–78 KB WebPs at 400w)
update public.template_locations l
set gallery = jsonb_build_array(
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/ubabci/gallery-01-800w.webp', 'alt', 'Polish catering buffet with traditional platters'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/ubabci/gallery-02-800w.webp', 'alt', 'The Turek family in the U Babci kitchen'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/ubabci/gallery-03-800w.webp', 'alt', 'Endive salad platter with red-pepper roses'),
  jsonb_build_object('src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/ubabci/gallery-04-800w.webp', 'alt', 'Kiełbasa canapés and spinach wraps ready to serve')
)
from public.template_brands b, public.template_organizations o
where l.brand_id = b.id and b.org_id = o.id and o.slug = 'ubabci';
