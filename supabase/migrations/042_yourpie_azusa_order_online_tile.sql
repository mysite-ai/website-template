-- 042_yourpie_azusa_order_online_tile.sql
--
-- Your Pie Azusa: surface the venue's own ordering channel (Thanx) as a
-- top-of-page action tile, directly above the DoorDash tile. Direct
-- orders are commission-free and land in the venue's own guest list, so
-- they outrank the marketplace link — but DoorDash stays for the guests
-- who only ever order there.
--
-- Until now this location had `action_tiles = NULL`, i.e. it rendered the
    10|-- auto-derived fallback (Directions + delivery[0]). Writing the column
-- explicitly is what lets us slot a second order tile in the middle;
-- the first and third entries reproduce exactly what the fallback was
-- already showing, built from the same columns so nothing drifts.
--
-- Tile type `order_direct` (added alongside this migration in
-- src/lib/action-tiles/registry.ts) is what keeps the analytics clean:
-- it fires `click-order-direct` instead of `click-order`, so first-party
-- orders and DoorDash hand-offs are two distinct Umami events rather
-- than one indistinguishable bucket.
    20|--
-- Targeted by hostname rather than brand/location slug: the domain row is
-- the one identifier we can verify from the live site.

update public.template_locations l
   set action_tiles = jsonb_build_array(
     jsonb_build_object(
       'type', 'directions',
       'href',
       'https://www.google.com/maps/search/?api=1&query=' ||
         replace(l.maps_search_query, ' ', '+')
    30|     ),
     jsonb_build_object(
       'type', 'order_direct',
       'href', 'https://order.thanx.com/yourpie?location=15230',
       'label', 'Order online'
     ),
     jsonb_build_object(
       'type', 'order',
       'href', l.delivery -> 0 ->> 'url',
       'label', l.delivery -> 0 ->> 'name'
    40|     )
   )
 where l.id = (
   select d.location_id
     from public.template_domains d
    where d.hostname = 'azusa.yourpie.mysite.social'
 );

comment on column public.template_locations.action_tiles is
  'Ordered list of action tiles rendered below the Hero. JSONB array of {type, href, label?} objects. Supported types: call, directions, order, order_direct, book, reserve, website, whatsapp, email. NULL means "auto-derive from phone/maps_search_query/delivery[0]".';
