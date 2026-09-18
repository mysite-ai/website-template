/// <reference types="astro/client" />

import type { TenantContext } from "@/lib/tenant/types";

declare global {
  namespace App {
    interface Locals {
      tenant: TenantContext;
    }
  }

  interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
    readonly PUBLIC_ATTRIBUTION_API_BASE: string;
    /**
     * Mapbox access token for `/api/eta` (traffic-aware travel time).
     *
     * Server-only: deliberately NOT prefixed `PUBLIC_`, since Astro inlines
     * anything so prefixed into the client bundle. Optional — the endpoint
     * falls back to the free-flow estimate when it is absent, so a
     * deployment without it degrades rather than breaks.
     */
    readonly MAPBOX_TOKEN?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
