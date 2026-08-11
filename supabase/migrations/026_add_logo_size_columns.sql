-- 026_add_logo_size_columns.sql
--
-- Per-tenant logo sizing knobs. Motivation: tenant logos come in wildly
-- different shapes — a compact square monogram (Doublz, Stacks) reads
-- fine at 40px header height, but a wide wordmark with fine detail
-- (The White Bear Coffee, U Babci) becomes illegible at that size.
-- The design-system defaults are wrong for at least one of these
-- shapes, so we let each brand override.
--
-- Both columns are nullable — Header.astro / Hero.astro apply their
-- own defaults (see components) when the field is null, so this
-- migration is safe to ship without seeding every tenant.
--
-- Units are CSS pixels applied as `height` in the header (natural
-- width) and `max-height` in the hero (natural width, capped so wide
-- wordmarks don't take over the fold).

alter table public.template_brands
  add column if not exists logo_header_height  integer,
  add column if not exists logo_hero_max_height integer;

-- Range guards. Header caps at 96px because anything larger blows out
-- the sticky nav row; hero caps at 320px because a bigger mark starts
-- to eat the whole viewport. Minimum 16 so a fat-fingered value can't
-- reduce logo to invisibility.
alter table public.template_brands
  add constraint template_brands_logo_header_height_range
    check (logo_header_height is null or logo_header_height between 16 and 96),
  add constraint template_brands_logo_hero_max_height_range
    check (logo_hero_max_height is null or logo_hero_max_height between 32 and 320);

comment on column public.template_brands.logo_header_height is
  'Per-tenant override for the logo image height (in px) inside the sticky Header. Null = use component default (40 mobile, 48 desktop). Range 16-96.';
comment on column public.template_brands.logo_hero_max_height is
  'Per-tenant override for the logo image max-height (in px) inside the Hero on the home page. Null = use component default (128 mobile, 160 desktop). Range 32-320.';

-- The White Bear Coffee's mark is a wide wordmark with a fine linework
-- bear head — it benefits from more vertical presence than the default.
update public.template_brands
   set logo_header_height  = 56,
       logo_hero_max_height = 176
 where slug = 'whitebear';
