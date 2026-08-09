-- 003_rls.sql
--
-- Decision: anon_deny_all on every template_* table, matching
-- `attribution-autopilot`'s pattern.
--
-- Tenant resolution runs entirely in Astro middleware using the service
-- role key — the template ships ZERO client-side Supabase reads. Any
-- future client-side Supabase feature must justify opening a specific
-- column-level anon policy AND must exclude PII columns
-- (phone, email).

alter table public.template_organizations enable row level security;
alter table public.template_brands        enable row level security;
alter table public.template_locations     enable row level security;
alter table public.template_domains       enable row level security;

-- Explicit deny — no anon policies, service_role bypasses RLS.
-- Policies below serve as documentation: NOBODY at the anon role gets rows.

drop policy if exists anon_deny_all on public.template_organizations;
create policy anon_deny_all on public.template_organizations
  for all to anon using (false) with check (false);

drop policy if exists anon_deny_all on public.template_brands;
create policy anon_deny_all on public.template_brands
  for all to anon using (false) with check (false);

drop policy if exists anon_deny_all on public.template_locations;
create policy anon_deny_all on public.template_locations
  for all to anon using (false) with check (false);

drop policy if exists anon_deny_all on public.template_domains;
create policy anon_deny_all on public.template_domains
  for all to anon using (false) with check (false);
