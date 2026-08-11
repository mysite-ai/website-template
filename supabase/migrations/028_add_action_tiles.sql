-- 028_add_action_tiles.sql
--
-- Configurable "action tiles" grid below the Hero — the row of
-- primary next-step CTAs (Directions, Order online, Book a table,
-- Call, Website, Email, WhatsApp, …).
--
-- Motivation: not every tenant runs a loyalty program, and even
-- tenants that do have different "next step" priorities:
--   - a sushi bar: Book a table + Call
--   - a fast-casual burger joint: Order online + Directions
--   - a specialty coffee shop: Directions + Instagram + Order
--
-- Rather than baking those combinations into the code, we let the
-- operator pick from a standardized set of tile types and provide the
-- destination URL. The order of items in the array drives the render
-- order.
--
-- ┌─────────────────────── Contract ────────────────────────┐
-- │ action_tiles JSONB = array of objects, each:            │
-- │   {                                                     │
-- │     "type":  "call" | "directions" | "order" | "book"   │
-- │           | "reserve" | "website" | "whatsapp" | "email"│
-- │     "href":  "https://…" | "tel:…" | "mailto:…"         │
-- │     "label": "Book a table"        // optional override  │
-- │   }                                                     │
-- │                                                         │
-- │ Unknown `type` values are silently skipped by the       │
-- │ renderer, so adding a new type in code is backwards-    │
-- │ compatible.                                             │
-- └─────────────────────────────────────────────────────────┘
--
-- NULL means "use the component's auto-derived defaults" — same as
-- pre-migration behaviour, for tenants we haven't manually configured
-- yet. The renderer handles the NULL case by generating a sensible
-- default from `phone` + `maps_search_query` + `delivery[0]`.

alter table public.template_locations
  add column if not exists action_tiles jsonb;

comment on column public.template_locations.action_tiles is
  'Ordered list of action tiles rendered below the Hero. JSONB array of {type, href, label?} objects. Supported types: call, directions, order, book, reserve, website, whatsapp, email. NULL means "auto-derive from phone/maps_search_query/delivery[0]".';

-- Seed sensible defaults for every existing tenant so the new column
-- reflects what the site already shows today. Any tenant whose fields
-- don't match a given tile just gets that tile omitted.
--
-- WBC / U Babci / Stacks / Doublz all get Directions + Order online
-- as their two primary tiles because that's what QuickActions.astro
-- has been rendering for them since the Kinoko redesign.
update public.template_locations l
   set action_tiles = (
     select jsonb_agg(t)
       from (
         values
           (
             'directions'::text,
             case
               when l.maps_search_query is not null
                 then 'https://www.google.com/maps/search/?api=1&query=' || replace(l.maps_search_query, ' ', '+')
               else null
             end,
             null::text
           ),
           (
             'order'::text,
             case
               when jsonb_typeof(l.delivery) = 'array' and jsonb_array_length(l.delivery) > 0
                 then l.delivery -> 0 ->> 'url'
               else null
             end,
             case
               when jsonb_typeof(l.delivery) = 'array' and jsonb_array_length(l.delivery) > 0
                 then l.delivery -> 0 ->> 'name'
               else null
             end
           )
       ) as v(type, href, label)
       cross join lateral (
         select case
           when v.href is null then null
           else jsonb_strip_nulls(
             jsonb_build_object(
               'type', v.type,
               'href', v.href,
               'label', v.label
             )
           )
         end as t
       ) as built
       where built.t is not null
   )
 where l.action_tiles is null;
