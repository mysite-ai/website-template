-- 033_umami_replay_enabled.sql
--
-- Per-tenant gate for Umami session replay (the recorder.js script).
--
-- We roll session recordings out gradually rather than to every tenant
-- that happens to have Umami configured. This flag decides whether the
-- site loads the replay recorder for a given location; it must be paired
-- with the "Replays" toggle enabled for that website in the Umami
-- dashboard.
--
-- Off for everyone by default. Enabled only for Stacks on Route 66 for
-- the initial rollout.

alter table public.template_locations
  add column if not exists umami_replay_enabled boolean not null default false;

comment on column public.template_locations.umami_replay_enabled is
  'When true, the site loads Umami session-replay (recorder.js) for this location. Requires umami_website_id set AND the Replays toggle enabled for the website in the Umami dashboard. Default false — recordings roll out per tenant.';

-- Re-assert the off baseline for existing rows.
update public.template_locations
   set umami_replay_enabled = false;

-- Enable for Stacks on Route 66 only.
update public.template_locations l
   set umami_replay_enabled = true
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'stacks'
   and o.slug = 'stacks-on-route-66';
