import { defineMiddleware } from "astro:middleware";
import { resolvePreviewTenant, resolveTenant } from "@/lib/tenant/resolve";

/**
 * Tenant resolution middleware.
 *
 * Runs before every request. Looks up the incoming Host in
 * `template_domains` and attaches the resolved TenantContext to
 * `Astro.locals.tenant`. If nothing matches, the request falls
 * through to the 404 route.
 *
 * See docs/01-architecture.md for the flow diagram.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get("host");
  const url = new URL(context.request.url);

  const preview =
    context.cookies.get("x-preview")?.value === "1"
      ? url.searchParams.get("tenant")
      : null;

  const tenant = preview
    ? await resolvePreviewTenant(preview)
    : await resolveTenant(host ?? "");

  if (!tenant) {
    // Let the 404 route render — do not rewrite here so the URL is preserved.
    // Only rewrite when the request is not already targeting /404.
    if (url.pathname !== "/404") {
      return context.rewrite("/404");
    }
    return next();
  }

  context.locals.tenant = tenant;
  return next();
});
