-- 011_switch_reserved_domain_to_mysite_social.sql
--
-- Switches the reserved-brand-root protection from `mysite.so` to
-- `mysite.social`. Migration 002 originally hardcoded `mysite.so`
-- inside `template_domains_allow_single()`. We now serve production
-- under `mysite.social`, so update the trigger to gate against that
-- domain instead.
--
-- Rules preserved:
--   * Bare `<slug>.mysite.social` is REJECTED unless the row has
--     kind='mysite_single' AND the brand.slug === location.slug.
--   * Multi-location clients MUST use `<location>.<brand>.mysite.social`.
--   * Anything else (custom apex, custom subdomain, ANY vercel.app
--     preview URL) passes untouched.

create or replace function public.template_domains_allow_single()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare
  loc_slug   text;
  brand_slug text;
begin
  if new.hostname !~ '^[a-z0-9-]+\.mysite\.social$' then
    return new;
  end if;

  if new.kind <> 'mysite_single' then
    raise exception 'hostname % looks like a bare brand root; only single-location clients (brand.slug = location.slug) may use this shape', new.hostname;
  end if;

  select l.slug, b.slug into loc_slug, brand_slug
  from public.template_locations l
  join public.template_brands b on b.id = l.brand_id
  where l.id = new.location_id;

  if loc_slug is null or brand_slug is null then
    raise exception 'template_domains: location % has no brand', new.location_id;
  end if;

  if loc_slug <> brand_slug then
    raise exception 'hostname % requires brand.slug (%) = location.slug (%); use <location>.<brand>.mysite.social for multi-location brands', new.hostname, brand_slug, loc_slug;
  end if;

  return new;
end $$;
