-- 034_sushisawa_countdown_and_replay.sql
--
-- Roll the same conversion + analytics setup we gave Stacks out to
-- Sushi Sawa:
--   1. Urgency countdown on the hero promo CTA, 15-day window.
--   2. Umami session replay (recorder.js) enabled for this location.
--
-- Both are per-location flags already wired through the app; this just
-- flips them on for Sushi Sawa. Replay also requires the "Replays"
-- toggle enabled for this website in the Umami dashboard (done).

update public.template_locations l
   set promo_countdown_enabled = true,
       promo_deadline          = date_trunc('day', now() at time zone 'utc') + interval '15 days' + interval '23 hours 59 minutes 59 seconds',
       umami_replay_enabled    = true
  from public.template_brands b
  join public.template_organizations o on o.id = b.org_id
 where l.brand_id = b.id
   and b.slug = 'sushisawa'
   and o.slug = 'sushisawa';
