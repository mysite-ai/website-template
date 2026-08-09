-- 019_selfhost_gallery_images.sql
--
-- Move all gallery images from Unsplash hotlinking to Supabase Storage.
--
-- Rationale: Unsplash IDs can go 404 without notice (already happened
-- twice — photo-1587899897387 in the original Doublz seed, then
-- photo-1553979459 turned out to be a burger, not onion rings).
-- Self-hosted images in `assets/gallery/<brand-slug>/<file>.jpg` are
-- stable forever, respect our privacy story (no third-party CDN
-- knows who visits our tenants), and are still cheap on Supabase's
-- free tier storage.
--
-- Storage layout:
--   assets/gallery/whitebear/wbc-01-featured.jpg  ..  wbc-06-cocktail.jpg
--   assets/gallery/stacks/stacks-01-featured.jpg  ..  stacks-06-french-toast.jpg
--   assets/gallery/doublz/doublz-01-featured.jpg  ..  doublz-06-rings.jpg
--
-- The GalleryBrowser React island also has defensive onError handling
-- now: if any image URL fails to load in the browser, the tile is
-- dropped silently rather than rendering a broken-image glyph.

-- White Bear Coffee
update public.template_locations
   set gallery = '[
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-01-featured.jpg","alt":"Warm bistro dining room in the evening"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-02-barista.jpg","alt":"Barista pouring latte art"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-03-avocado.jpg","alt":"Avocado toast plate on marble counter"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-04-pasta.jpg","alt":"Pasta dish with fresh herbs"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-05-salad.jpg","alt":"Fresh salad bowl overhead shot"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/whitebear/wbc-06-cocktail.jpg","alt":"Craft cocktails on the bar"}
   ]'::jsonb
 where brand_id in (
     select id from public.template_brands where slug = 'whitebear'
       and org_id in (select id from public.template_organizations where slug = 'whitebear-coffee')
   );

-- Stacks on Route 66
update public.template_locations
   set gallery = '[
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-01-featured.jpg","alt":"Stack of fluffy pancakes with syrup"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-02-burger.jpg","alt":"Classic diner burger and fries"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-03-skillet.jpg","alt":"Breakfast skillet with eggs, bacon, and hash browns"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-04-shake.jpg","alt":"Chocolate milkshake with whipped cream"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-05-diner.jpg","alt":"Retro American diner interior"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/stacks/stacks-06-french-toast.jpg","alt":"French toast with berries"}
   ]'::jsonb
 where brand_id in (
     select id from public.template_brands where slug = 'stacks'
       and org_id in (select id from public.template_organizations where slug = 'stacks-on-route-66')
   );

-- Doublz (all 8 locations share the same brand gallery)
update public.template_locations
   set gallery = '[
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-01-featured.jpg","alt":"Doublz flame-broiled cheeseburger stacked high"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-02-double.jpg","alt":"Classic double cheeseburger with fries"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-03-fries.jpg","alt":"Loaded chili cheese fries"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-04-burrito.jpg","alt":"Breakfast burrito with eggs and bacon"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-05-chicken.jpg","alt":"Crispy chicken sandwich with pickles"},
     {"src":"https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery/doublz/doublz-06-rings.jpg","alt":"Golden crispy onion rings"}
   ]'::jsonb
 where brand_id in (
     select id from public.template_brands where slug = 'doublz'
       and org_id in (select id from public.template_organizations where slug = 'doublz')
   );
