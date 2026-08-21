-- 040_lindley_logo.sql
--
-- Lindley Pet's own site uses a typographic wordmark plus a green
-- rounded-square paw mark (their icon.svg). We self-host that paw mark in
-- the app (public/logos/lindley-paw.svg) so it doesn't depend on their
-- site, and set it as the brand logo. Relative URL — served by the app on
-- the tenant's own host.

update public.template_brands
   set logo_url = '/logos/lindley-paw.svg'
 where slug = 'lindleypet';
