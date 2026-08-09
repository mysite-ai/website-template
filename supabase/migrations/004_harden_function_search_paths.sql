-- 004_harden_function_search_paths.sql
--
-- Addresses Supabase's `function_search_path_mutable` linter (0011)
-- for the two trigger functions defined in earlier migrations. Both
-- only touch triggered rows or catalog-typed columns, so pinning to
-- pg_catalog (with `public` where the function joins template_* tables)
-- matches Supabase's recommended pattern:
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

alter function public.set_updated_at() set search_path = pg_catalog;
alter function public.template_domains_allow_single() set search_path = pg_catalog, public;
