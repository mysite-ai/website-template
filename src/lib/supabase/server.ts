import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. Uses SUPABASE_SERVICE_ROLE_KEY and must
 * NEVER be imported into a `.tsx` island or any file that ends up in
 * client bundles.
 *
 * Tenant resolution + all SSR reads go through this single client.
 * RLS is `anon_deny_all` on every template_* table; service_role bypasses
 * that, which is why we're careful about where this file is imported.
 */
let cached: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env missing: set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "website-template" } },
  });

  return cached;
}
