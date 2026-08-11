-- 024_wbc_demo_osm_map_embed.sql
--
-- Replace the Google Maps embed URL for the WBC demo tenant with an
-- OpenStreetMap embed. Reason: the Google embed we shipped uses an
-- unbilled key which renders the "For development purposes only"
-- watermark diagonally across the tile — fatal on paid-traffic
-- landing pages. OSM has no watermark, no key, no billing.
--
-- The "Directions" button still deep-links to Google Maps via
-- maps_search_query — users get the map they want on tap.
--
-- Bbox covers ~150m around Marszalkowska 87, Warsaw
-- (52.2214, 21.0154). Marker centered on the same coord.

update public.template_locations
   set maps_embed_url = 'https://www.openstreetmap.org/export/embed.html?bbox=21.0119%2C52.2199%2C21.0189%2C52.2229&layer=mapnik&marker=52.2214%2C21.0154'
 where slug = 'whitebear'
   and brand_id in (
     select id from public.template_brands where slug = 'whitebear'
   );
