-- 018_update_logos_favicons_gallery.sql
--
-- Housekeeping for the three seeded tenants:
--   1. Replace Stacks placeholder SVG logo with the real client-supplied
--      1024x1024 JPG (uploaded to assets/logos/stacks-logo.jpg).
--   2. Replace one broken Unsplash gallery image on Doublz — the URL
--      photo-1587899897387 returns 404 from Unsplash and was rendering
--      as an empty tile in the gallery mosaic.
--   3. Assign per-brand favicons for WBC / Stacks / Doublz. Each is a
--      64x64 SVG with the brand's primary color as background + first
--      letter in the primary-foreground color. Uploaded to
--      assets/favicons/<slug>.svg in Supabase Storage.

-- 1. Real Stacks logo
update public.template_brands
   set logo_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/stacks-logo.jpg'
 where slug = 'stacks'
   and org_id in (select id from public.template_organizations where slug = 'stacks-on-route-66');

-- 2. Fix Doublz broken gallery image
update public.template_locations
   set gallery = '[
     {"src":"https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1600&h=1000&fit=crop&auto=format&q=80","alt":"Doublz flame-broiled cheeseburger stacked high"},
     {"src":"https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&h=800&fit=crop&auto=format&q=80","alt":"Classic double cheeseburger with fries"},
     {"src":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=800&fit=crop&auto=format&q=80","alt":"Loaded chili cheese fries"},
     {"src":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&h=800&fit=crop&auto=format&q=80","alt":"Breakfast burrito with eggs and bacon"},
     {"src":"https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=800&h=800&fit=crop&auto=format&q=80","alt":"Crispy chicken sandwich with pickles"},
     {"src":"https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=800&h=800&fit=crop&auto=format&q=80","alt":"Golden crispy onion rings"}
   ]'::jsonb
 where brand_id in (
     select id from public.template_brands
     where slug = 'doublz'
       and org_id in (select id from public.template_organizations where slug = 'doublz')
   );

-- 3. Per-brand favicons
update public.template_brands
   set favicon_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/wbc.svg'
 where slug = 'whitebear'
   and org_id in (select id from public.template_organizations where slug = 'whitebear-coffee');

update public.template_brands
   set favicon_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/stacks.svg'
 where slug = 'stacks'
   and org_id in (select id from public.template_organizations where slug = 'stacks-on-route-66');

update public.template_brands
   set favicon_url = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/doublz.svg'
 where slug = 'doublz'
   and org_id in (select id from public.template_organizations where slug = 'doublz');
