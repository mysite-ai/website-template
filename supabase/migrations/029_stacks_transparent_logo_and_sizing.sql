-- 029_stacks_transparent_logo_and_sizing.sql
--
-- UX fix for the Stacks on Route 66 tenant logo.
--
-- Problem:
--   1. `logo_url` pointed at a 1024x1024 *JPG* (assets/logos/stacks-logo.jpg).
--      JPG has no alpha, so the mark rendered on a hard background box —
--      ugly on the tinted hero band and against the translucent nav bar.
--   2. Nav re-used that big square mark at the default 56px height, so the
--      "STACKS / ON ROUTE 66" wordmark inside it was illegible.
--   3. Hero used it at the default 200px, too small for a square logo that
--      is meant to be the page centerpiece.
--
-- Fix:
--   * Point `logo_url` at a tight-cropped, transparent PNG uploaded to the
--     shared Supabase assets bucket (assets/logos/stacks-logo.png), matching
--     the storage convention used by every other tenant logo.
--   * Raise the per-tenant sizing knobs (added in 026) so the square,
--     text-bearing mark reads clearly in both the nav and the hero.
--
-- The logo is a full wordmark (it already contains the brand name), so the
-- Header renders the image alone with no separate text label — bumping its
-- height is what makes the name legible.

update public.template_brands
   set logo_url            = 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/stacks-logo.png',
       logo_header_height  = 68,   -- square mark: needs vertical room to stay legible in nav (max 96)
       logo_hero_max_height = 280   -- square mark: generous hero centerpiece (max 320)
 where slug = 'stacks'
   and org_id in (
     select id from public.template_organizations where slug = 'stacks-on-route-66'
   );
