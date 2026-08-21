-- 032_promo_fine_print.sql
--
-- Optional per-promotion "fine print" subline for the hero PromoBanner —
-- a small muted line for conditions like "Valid after 2 PM only" or
-- "One per customer". Per-location and independently toggleable, exactly
-- like the countdown (migration 030): most tenants leave it off, and any
-- one location can opt in with its own text.
--
-- Two columns so the text can be authored once and shown/hidden with a
-- flag (rather than clearing the text to hide it):
--   * promo_fine_print_enabled — master on/off (default false)
--   * promo_fine_print          — the condition text (null = nothing)
--
-- The banner renders the line only when enabled AND the text is present,
-- so it fails safe.

alter table public.template_locations
  add column if not exists promo_fine_print_enabled boolean not null default false,
  add column if not exists promo_fine_print          text;

comment on column public.template_locations.promo_fine_print_enabled is
  'Master on/off switch for the small "fine print" condition line under the hero PromoBanner. Default false. When true but promo_fine_print is null/empty, nothing renders (fails safe).';
comment on column public.template_locations.promo_fine_print is
  'Small print / conditions shown under the promo CTA when promo_fine_print_enabled is true, e.g. "Valid after 2 PM only". Null = no fine print.';

-- Off for everyone (re-assert the default for already-existing rows).
update public.template_locations
   set promo_fine_print_enabled = false;

-- Demo it on Stacks on Route 66 with the 2 PM condition.
update public.template_locations l
   set promo_fine_print_enabled = true,
       promo_fine_print         = 'Valid after 2 PM only'
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'stacks'
   and o.slug = 'stacks-on-route-66';
