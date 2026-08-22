-- 041_stacks_promo_headline_2pm.sql
--
-- Stacks promo change: the offer is now "30% off your first visit" and
-- the operator wants the 2 PM condition spelled out *in the headline*
-- itself (the biggest, most prominent line, shown on both the hero promo
-- banner and the /rewards page title).
--
-- Since the "after 2 PM" now lives in the headline, disable the separate
-- fine-print bar so we don't repeat "after 2 PM" twice right next to
-- each other. (The promo_fine_print text is left in place, just off, so
-- it can be re-enabled later.)

update public.template_locations l
   set reward_description_cached = '30% off your first visit — after 2 PM only',
       promo_fine_print_enabled  = false
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'stacks'
   and o.slug = 'stacks-on-route-66';
