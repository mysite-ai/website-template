-- 031_shrink_stacks_logo_to_default.sql
--
-- Follow-up to the /rewards conversion work. The Stacks on Route 66 hero
-- was dominated by a huge logo: migration 029 pushed its per-tenant knobs
-- to logo_header_height = 68 and logo_hero_max_height = 280 to make the
-- square wordmark "the page centerpiece". That is exactly the wrong
-- hierarchy for conversion — the logo dwarfed the promo CTA and the
-- action buttons, and almost nobody tapped through to /rewards.
--
-- New direction (matches the reference site
-- marszalkowska.thewhitebearcoffee.pl): the logo is a small brand signal,
-- and the promo button + action buttons are the hero. The components now
-- ship deliberately small logo defaults (hero 104px, header 48px), so we
-- reset Stacks' overrides to NULL and let it inherit those defaults.

update public.template_brands b
   set logo_header_height   = null,
       logo_hero_max_height = null
  from public.template_organizations o
 where b.org_id = o.id
   and b.slug = 'stacks'
   and o.slug = 'stacks-on-route-66';
