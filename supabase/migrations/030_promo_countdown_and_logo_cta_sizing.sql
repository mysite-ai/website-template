-- 030_promo_countdown_and_logo_cta_sizing.sql
--
-- Two related conversion tweaks, driven by the observation that the
-- Stacks on Route 66 tenant gets almost no /rewards visits and almost
-- no generated codes.
--
-- Hypotheses:
--   1. The hero logo is visually dominant while the promo CTA is small,
--      so on a phone the "get your reward" button doesn't read as the
--      primary action. Fix in the components: shrink the logo defaults a
--      touch and enlarge the PromoBanner. For tenants whose mark still
--      needs to be big, the per-tenant logo-size knobs (026/029) stay.
--   2. There is no urgency. People assume "the offer will always be
--      there" and never tap. Fix: an optional per-promotion countdown
--      ("Only N days left") that renders inside the PromoBanner.
--
-- This migration owns the DATA side of #2 (a toggle + a deadline, both
-- per location so multi-location tenants can differ) and seeds the
-- rollout policy: OFF for everyone, ON for Stacks with a ~10-day window.
-- The logo/CTA sizing (#1) is a pure component change and ships in code.
--
-- Why on template_locations (not template_brands)?
--   The countdown describes a specific running *promotion*, and the
--   attribution/promotion config already lives per-location
--   (attribution_promotion_id, promotion_name_cached, ...). Keeping the
--   deadline next to them lets each location of a multi-location tenant
--   run its own window.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.template_locations
  add column if not exists promo_countdown_enabled boolean not null default false,
  add column if not exists promo_deadline           timestamptz;

comment on column public.template_locations.promo_countdown_enabled is
  'Master on/off switch for the urgency countdown shown in the hero PromoBanner. Default false (off) for every tenant — opt in per location. When true but promo_deadline is null or already past, the countdown is not rendered (fails safe).';
comment on column public.template_locations.promo_deadline is
  'When the current promotion ends (UTC). Drives the "Only N days left" countdown when promo_countdown_enabled is true. Null = no countdown. Operators bump this forward to extend the window.';

-- ---------------------------------------------------------------------------
-- Rollout policy: OFF for everyone (handled by the default above, but be
-- explicit so re-running against an already-migrated DB re-asserts it),
-- then ON for Stacks with a deadline ~10 days out.
-- ---------------------------------------------------------------------------

-- Belt-and-suspenders: force every existing row to the "off" baseline.
update public.template_locations
   set promo_countdown_enabled = false;

-- Enable for Stacks on Route 66 (single location, slug 'stacks' under the
-- 'stacks-on-route-66' org). Deadline is set 10 days from the moment this
-- migration runs, at end-of-day UTC so the "days left" number is stable.
update public.template_locations l
   set promo_countdown_enabled = true,
       promo_deadline          = date_trunc('day', now() at time zone 'utc') + interval '10 days' + interval '23 hours 59 minutes 59 seconds'
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'stacks'
   and o.slug = 'stacks-on-route-66';
