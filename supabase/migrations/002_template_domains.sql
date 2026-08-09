-- 002_template_domains.sql
--
-- Authoritative hostname -> location_id mapping used by the tenant resolver.
--
-- Rules:
--   * hostnames are stored EXACT-MATCH, lowercased. `www.karat.pl` and
--     `karat.pl` are separate rows.
--   * exactly one primary domain per location (partial unique index).
--   * bare brand root like `doublz.mysite.so` is REJECTED at insert time
--     by a CHECK constraint. Every valid URL must resolve to a specific
--     location.
--
-- `kind` is metadata only and is not used for resolution.

create table if not exists public.template_domains (
  hostname    text primary key
              check (
                hostname = lower(hostname)
                and hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
                -- Reject `<slug>.mysite.so` — bare brand root. Multi-location
                -- clients MUST use `<location>.<brand>.mysite.so`.
                and hostname !~ '^[a-z0-9-]+\.mysite\.so$'
              ),
  location_id uuid not null references public.template_locations(id) on delete cascade,
  is_primary  boolean not null default false,
  kind        text not null default 'custom'
              check (kind in ('mysite_single', 'mysite_multi', 'custom')),
  created_at  timestamptz not null default now()
);

-- One primary domain per location.
create unique index if not exists template_domains_one_primary_per_location
  on public.template_domains(location_id)
  where is_primary;

create index if not exists template_domains_location_id_idx
  on public.template_domains(location_id);

-- Escape hatch for the CHECK: a specific single-location client whose
-- domain happens to be `<slug>.mysite.so` is allowed because for
-- SINGLE-location clients `brand.slug === location.slug`, so the two
-- concepts collapse. The `mysite_single` kind labels that case.
-- Enforced by trigger — the CHECK above intentionally blanket-rejects,
-- and this trigger reinstates the allowed case.
create or replace function public.template_domains_allow_single()
returns trigger language plpgsql as $$
declare
  loc_slug  text;
  brand_slug text;
begin
  -- Fast-path: not the ambiguous shape, nothing to do.
  if new.hostname !~ '^[a-z0-9-]+\.mysite\.so$' then
    return new;
  end if;

  -- Only mysite_single is allowed to bypass the CHECK.
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
    raise exception 'hostname % requires brand.slug (%) = location.slug (%); use <location>.<brand>.mysite.so for multi-location brands', new.hostname, brand_slug, loc_slug;
  end if;

  return new;
end $$;

-- Trigger cannot bypass a CHECK constraint, so we relax the CHECK to
-- allow anything and enforce the two shapes via BEFORE INSERT/UPDATE.
-- (Simpler than an INSTEAD OF trigger on a view.)
alter table public.template_domains drop constraint if exists template_domains_hostname_check;
alter table public.template_domains add constraint template_domains_hostname_check
  check (
    hostname = lower(hostname)
    and hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  );

drop trigger if exists template_domains_validate on public.template_domains;
create trigger template_domains_validate
  before insert or update on public.template_domains
  for each row execute function public.template_domains_allow_single();
