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
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
