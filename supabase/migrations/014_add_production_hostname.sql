-- 014_add_production_hostname.sql
--
-- Attach `whitebear.mysite.social` as the PRIMARY hostname of the
-- demo tenant. The old vercel.app URL (`website-template-iota-one.
-- vercel.app`) stays as a non-primary fallback so preview links keep
-- working.
--
-- Applied in tandem with:
--   1. Vercel: add `*.mysite.social` and `whitebear.mysite.social`
--      to the website-template project (done via API).
--   2. attribution-autopilot: INSERT into location_origins so CORS
--      accepts requests from https://whitebear.mysite.social.
--
-- Primary domain drives canonical URLs (SEO JSON-LD, og:url) — see
-- src/lib/seo/schema.ts.

do $$
declare
  v_loc_id uuid;
begin
  select l.id into v_loc_id
  from public.template_locations l
  join public.template_brands b on b.id = l.brand_id
  join public.template_organizations o on o.id = b.org_id
  where o.slug = 'whitebear-coffee' and b.slug = 'whitebear' and l.slug = 'whitebear';

  if v_loc_id is null then
    raise exception 'demo location not found — run migration 013 first';
  end if;

  -- Demote old primary
  update public.template_domains
     set is_primary = false
   where location_id = v_loc_id and is_primary;

  -- Insert / promote whitebear.mysite.social as new primary
  insert into public.template_domains (hostname, location_id, is_primary, kind)
  values ('whitebear.mysite.social', v_loc_id, true, 'mysite_single')
  on conflict (hostname) do update
    set is_primary = true, kind = excluded.kind;
end $$;
