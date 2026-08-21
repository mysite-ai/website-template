-- 039_add_menu_hidden.sql
--
-- The template started life restaurant-only, so the menu shows whenever
-- menu data exists. But some tenants are other verticals (retail,
-- services) where a "Menu" makes no sense — e.g. Lindley Pet (pet store)
-- and Shaddai Print Shop. Add a per-location kill switch so operators
-- can hide the menu regardless of any menu data present.
--
-- When true, the resolver drops the menu entirely, which hides the nav
-- link, the hero menu preview, and the /menu page in one place.

alter table public.template_locations
  add column if not exists menu_hidden boolean not null default false;

comment on column public.template_locations.menu_hidden is
  'Per-tenant kill switch to hide the menu (nav link + hero preview + /menu page). For non-restaurant verticals (retail, services). Default false — restaurants keep their menu.';

-- Hide the menu for the current non-restaurant tenants.
update public.template_locations l
   set menu_hidden = true
  from public.template_brands b
 where l.brand_id = b.id
   and b.slug in ('lindleypet', 'shaddaiprintshop');
