-- 046_seed_pizza_cassette.sql
--
-- Pizza Cassette (San Diego, CA) — MULTI-LOCATION tenant (docs Pattern B).
-- Reference: https://www.pizzacassette.com (a Wix / Thunderbolt site,
-- metaSiteId 84aa71b6-064b-43ba-9611-e41c8ec4bea8).
--
-- Wood-fired Neapolitan-leaning pizza, opened 2022 by Chef Jimmy Terwilliger
-- after a run of catering gigs and pop-ups. Two venues under one brand:
--
--   thegarten     5322 Banks St (Bay Park)  — a stall inside The Gärten, a
--                 communal outdoor food-and-drink yard shared with Lost Cause
--                 Meadery, Deft Brewing and Oddish Wines. Also their event /
--                 pizza-party venue. Orders are taken BY PHONE.
--   pacificbeach  1459 Garnet Ave           — their first standalone
--                 brick-and-mortar (took over the old Hoboken Pizza space).
--                 Full bar list, takes reservations, online ordering on Toast.
--
-- `brand.slug ('pizzacassette') <> location.slug`, so this is Pattern B: two
-- location rows sharing one brand row (same logo, theme and about copy), each
-- owning its own address, hours, gallery, menu and action tiles.
--
--
-- Where every value came from
-- ---------------------------
-- Their menu renders CLIENT-SIDE on Wix, so a plain `curl` of /menu returns a
-- shell with no dishes in it. Everything below was read out of the hydrated
-- DOM via `chrome --headless=old --dump-dom --virtual-time-budget=20000`.
--
-- MENUS — both locations have REAL PRICES, from two different sources:
--
--   The Gärten: /menu is a normal (if client-rendered) Wix page and carries
--   name + description + price inline. Transcribed 1:1, including their music
--   -pun section names (".38 Special(s)", "Opening Acts", "The Green Room",
--   "Sandwich Setlist", "Side A: Red Pies", "Side B: White Pies", "Bonus
--   Tracks"). Section grouping and ordering are theirs, not ours.
--
--   Pacific Beach: /pacific-beach-menu carries NO dish text at all — it is
--   three embedded JPEG scans of the printed menu plus an "ORDER ONLINE"
--   button. Those three images (a3bafb_932e85b3… food front,
--   a3bafb_1741f479… pies + Detroit + desserts, a3bafb_3b871535… beer / wine /
--   NA) were pulled at 2400px and transcribed by hand. PB runs $1–4 above
--   The Gärten on nearly every shared dish and is the only venue with a bar
--   programme, which is why the two menus are separate blobs rather than one
--   shared one.
--
--   NOT used: order.toasttab.com. Toast sits behind a Cloudflare interstitial
--   ("Just a moment…") that neither curl (403) nor headless Chrome gets past,
--   and ws-api.toasttab.com/consumer-app-bff 404s. Their own printed menu was
--   both easier and more authoritative.
--
-- Dietary tags: derived ONLY from annotations in the item NAME, per repo
-- convention — parsing descriptions over-claims. Across both menus that is
-- exactly one marker: the "(V)" on ROSSI. It is ambiguous (the pie is
-- cheeseless, which reads vegan, but the legend is never spelled out), so we
-- tag `vegetarian` — the claim that holds under either reading. "GF dough +3"
-- and "vegan cheese +2" are venue-wide upcharges, not properties of a dish,
-- so they live in the category description, not in `tags`.
--
-- Per-item `image_url`: NOT set. Migration 023 established "either every item
-- has a thumbnail or none", and every existing tenant is on "none". Their food
-- photography goes in the gallery instead, self-hosted per migration 019.
--
-- POSTAL CODE — their own Locations block prints "1459 Garnet Ave, San Diego,
-- CA 92019 US". 92019 is El Cajon, ~20 miles inland. Nominatim resolves
-- 1459 Garnet Avenue to Pacific Beach, San Diego, **92109**, and Times of San
-- Diego / San Diego Magazine both write "1459 Garnet Ave., San Diego, CA
-- 92109". We store 92109 because this column drives the Directions tile and
-- the map embed; a typo'd zip there sends a guest to the wrong side of the
-- county. Flagged to the operator so they can fix their Wix site too.
--
-- Coordinates: geocoded per address with Nominatim (5322 Banks St →
-- 32.764479 / -117.199122; 1459 Garnet Ave → 32.798990 / -117.243174).
--
-- Hours: from their own "Locations / Visit Us" block. Their copy lists Monday
-- through Sunday individually with "(NOW OPEN)" annotations; collapsed into the
-- weekday/weekend pair the schema exposes. Note the Gärten's Mon–Thu block is
-- uniform (3–9 PM) while PB opens later Mon–Tue (4 PM) and at noon Wed–Thu, so
-- the two rows read differently on purpose. A cached older version of their
-- site had 8 PM closes; the live DOM says 9/10 PM, and the live DOM wins.
-- The day names are kept INSIDE the value, matching every existing tenant
-- (`Mon–Thu 11:00 – 20:00` on cantonbistro, etc.), because Contact.astro:74
-- hardcodes the row labels "Mon – Fri" / "Sat – Sun" no matter what the venue
-- actually does. So the Gärten's real Mon–Thu block renders under a "Mon – Fri"
-- label and reads a little redundantly. Pre-existing platform wart shared by
-- every tenant whose week doesn't split 5/2 — following the convention here
-- keeps the true days visible rather than trusting the wrong label.
--
-- Phone: (619) 930-1339, the ONLY number their site publishes. It backs both
-- "Bay Park Order Now" and the Gärten "Get in Touch" button, i.e. both uses
-- are Bay Park / Gärten context — so it is attached to `thegarten` only.
-- `pacificbeach.phone` is left NULL rather than assuming the two venues share
-- a line; see the operator follow-ups at the bottom of this file.
--
-- Email: NULL. The current site publishes no address and has no `mailto:`
-- anywhere in the DOM. (A stale search-engine cache shows a personal
-- jimmy@ address; we don't store an address we can't see on the live site.)
--
-- "Bay Park Order Now" — resolved. The button on their homepage is NOT an
-- online-ordering link: its href is `tel:(619)930-1339`. Bay Park / The Gärten
-- takes orders over the phone. So `thegarten` gets a `call` tile labelled to
-- say so, and no `order`/`order_direct` tile, and `delivery` stays `[]`.
--
-- Ordering — `order_direct` (not `order`) for the PB Toast link, because Toast
-- is their own commission-free channel and `order_direct` fires a distinct
-- Umami event (migration 042 / docs 08), so direct orders stay countable
-- separately from marketplaces. They are on no marketplace we could find.
-- No `utm_*` is baked into any stored URL — components/attribution/
-- OutboundTagger.astro appends utm_source=mysite / utm_medium=mysitelp /
-- utm_campaign=<inherited|mysite> at runtime.
--
--   Verified on PB: the Toast tile, both socials and the footer mysite.ai link
--   all come out tagged, while the Maps tile and internal links stay clean, and
--   the campaign appears only in the hydrated DOM (never in the SSR HTML, which
--   is what keeps the 60s CDN cache safe).
--
--   NOT so on `thegarten`, and it is worth knowing why before someone files it
--   as a bug against this tenant. BaseLayout only ships OutboundTagger when
--   `hasTaggableOutboundLink` (lib/attribution/outbound.ts) says there is
--   something to tag, and that helper inspects ONLY `action_tiles`, `delivery`
--   and `website_url`. The Gärten's two tiles are a `tel:` and a Maps link —
--   both on the skip list — so the gate returns false and the tagger is never
--   rendered, which leaves its Instagram / Facebook / mysite.ai links untagged
--   even though `tagOutboundUrl` would happily tag them. Platform-level gap
--   (the gate ignores `instagram_url` / `facebook_url`), not a data problem
--   here: nothing we could put in this migration changes it, and adding a fake
--   tile just to trip the gate would be worse. Flagged to the operator.
--
-- Reservations — PB genuinely takes them, on OpenTable: their Wix
-- "Reservations - Pacific Beach" button opens a filesusr HTML component whose
-- only content is OpenTable's widget loader with `rid=1499530`. We did NOT
-- ship a `book` tile, because opentable.com refuses every request we can make
-- (curl gets a connection reset; headless Chrome gets a JS challenge), so no
-- candidate reservation URL could be verified to resolve — and the repo rule
-- is to never store an unverified outbound link. The ready-to-run tile insert
-- is parked as a comment at the bottom of this file for the operator to
-- uncomment once they paste the real OpenTable page URL. Nothing else needs
-- configuring: docs/08 §"OpenTable links" — the tagger detects OpenTable by
-- hostname and adds ot_source/ot_campaign on its own.
--
-- Event / catering inquiries: their two Toast lead forms
-- (toasttab.com/invoice/lead?rx=30828e77…&ot=…) both sit under the "Catering &
-- Events Inquires @ Pizza Cassette PB" heading, so they belong to PB. They are
-- deliberately NOT tiles — `action_tiles` has no inquiry-form type and the row
-- is for "next step now" actions, not lead capture. Left for a later promo
-- surface if the operator wants them.
--
-- `website_url`: NULL on both, per the product rule set in migration 045 —
-- the MySite page IS the landing page, so we don't ship a primary-colour
-- button that hands the guest off to the client's own site to compete with
-- the ordering CTA underneath it.
--
-- Rating: NOT set. No Google Business Profile figures were read, and
-- Hero.astro:23 gates the badge on `rating !== null && reviewCount > 0` while
-- labelling the number "Google reviews" — so a rating without a real Google
-- count renders nothing and just leaves the row looking half-configured. Set
-- both together once someone reads them off each venue's GBP. Same state as
-- taavakitchen / guidos / lindleypet / sushisawa / elpolloperu.
--
-- Socials: their footer carries two separate Instagram links plus one
-- Facebook page — instagram.com/pizzacassette (labelled "The Garten") and
-- instagram.com/pizzacassettepb (labelled "Pacific Beach"), so each handle is
-- attached to the matching location. Both handles are non-machine-verifiable
-- (Instagram 401s its profile API), but unlike a directory-sourced guess these
-- come from the client's own footer with their own per-venue labels. The
-- Facebook page is brand-level (only one exists), so both rows carry it.
--
-- Loyalty / QR: intentionally NOT wired. All four `attribution_*` columns stay
-- NULL on both locations, which makes Header hide the "Rewards" nav item and
-- /rewards render its empty state. Nothing needs inserting into
-- attribution-autopilot's `location_origins` and there is no CORS cache lag to
-- wait out. To enable later, follow docs/02-adding-a-client.md step 2.
--
-- Meta pixel: `RestaurantsWebPixel` (849479710958676) on both. Gastro, not
-- retail, per .cursor/rules/meta-pixel-selection.mdc — a pizzeria is the
-- textbook case for that dataset.
--
-- Umami: left NULL on both. Create the two websites in Umami, then set
-- `umami_website_id` per location (docs/08-managing-tenants.md).
--
-- Assets — uploaded to Supabase Storage bucket `assets` before this migration:
--   logos/pizza-cassette-wordmark.png  hero mark — their own printed-menu
--                                      header lockup (cassette mark + the
--                                      light-blue "PIZZA CASSETTE" wordmark +
--                                      "WOOD-FIRED ARTISAN PIZZA / Good Vibes
--                                      Only!"), lifted at 2400px, flood-filled
--                                      off the white paper to transparency and
--                                      trimmed. The per-venue address lines
--                                      that sit under it on the menu were cut,
--                                      since this is a brand-level asset.
--   logos/pizza-cassette-mark.png      nav mark — the cassette-with-headphones
--                                      illustration on its own. This is the
--                                      exact image their Wix site serves as
--                                      its own 32/180/192px app icon, so it is
--                                      designed to hold up small; the wide
--                                      wordmark would be crushed at a 48px
--                                      header height.
--   favicons/pizza-cassette.svg        favicon — a redrawn 64px cassette on a
--                                      brand-red tile. Their own icon is the
--                                      full illustration (fine headphone wire,
--                                      pepperoni speckle) and turns to mush at
--                                      16px, which is the same call made for
--                                      taava in 044.
--   gallery-v3/pizzacassette/*.webp    16 photos × 400w/800w/1600w
--
-- Gallery: their own Wix media, self-hosted per migration 019 — WebP q82,
-- three widths, never upscaled past the source. The stored `src` is the
-- `-800w.webp` variant on purpose: GalleryBrowser.tsx matches that exact
-- suffix to build the 400/800/1600 `srcset` and uses 1600w in the lightbox.
-- All three widths were re-checked over HTTP for every one of the 16 photos
-- (48 objects, all 200 image/webp) — a missing 400w or 1600w is invisible
-- until a browser picks it, so it does not show up in a page smoke-test.
-- Three of the sources (01 the-garten-patio, 09 pacific-beach-storefront,
-- 15 burrata-pan-pie) are narrower than 1600px (750 / 680 / 750), so their
-- `-1600w` file is byte-identical to their `-800w` one. That is the
-- never-upscale rule doing its job, not a botched upload.
-- Nine entries per location, but Gallery.astro:21 does
-- `gallery.slice(0, 8)`, so only the first eight ever render — the ninth is
-- a deliberate spare that promotes itself if an earlier photo is pulled.
-- Six other locations already store nine for the same reason.
-- Photos are split by venue where the shot identifies a venue (the Gärten's
-- string-lit patio and chalkboard; the PB storefront and its neon sign) and
-- shared where it's just their food. Skipped: a decorative black-and-white
-- heart graphic, a letterboxed phone screenshot, and a 150px thumbnail.
--
-- Theme: `oklch(0.572 0.189 25.5)` = #d03838, the red they rule their printed
-- menu with and set "Good Vibes Only!" in. Their other brand colour is the
-- #68c0d0 wordmark blue, which is too light (L 0.76) to carry white CTA text,
-- so the red is primary and the blue stays where it belongs — in the logo.

with
  new_org as (
    insert into public.template_organizations (name, slug, default_locale)
    values ('Pizza Cassette', 'pizzacassette', 'en')
    returning id
  ),
  new_brand as (
    insert into public.template_brands (
      org_id, slug, name,
      logo_url, logo_url_nav, favicon_url,
      tagline, about_md, theme,
      logo_hero_max_height
    )
    select
      id,
      'pizzacassette',
      'Pizza Cassette',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/pizza-cassette-wordmark.png',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/pizza-cassette-mark.png',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/pizza-cassette.svg',
      -- Their own strapline, straight off the menu header.
      'Wood-fired artisan pizza in San Diego. Good vibes only.',
      $md$Pizza Cassette is a **wood-fired pizza kitchen in San Diego**, started in 2022 by Chef Jimmy — a dream that had been in the works since 2014.

Chef Jimmy came up through La Jolla's Catania Coastal Italian and then local favourites **Buona Forchetta** and **Biga**, sharpening his craft along the way. In 2019 he began catering and running mobile pop-ups, and in 2022 all of it turned into Pizza Cassette.

He believes great pizza is an art form and that **the fire is the soul of the craft**. Every pie is hand-stretched from house-made dough, topped with locally sourced produce, premium meats and house-made sauces, then fired until the crust is perfectly charred. Almost everything is made in-house from his own recipes — the meatballs, the corned beef, the chicken, the dressings, the dough.

Alongside the pizza there are **sandwiches, salads and other favourites**.

Come along for the ride.
$md$,
      jsonb_build_object(
        -- #d03838 — the red on their printed menu and in "Good Vibes Only!".
        'primary', 'oklch(0.572 0.189 25.5)',
        'primary_foreground', 'oklch(0.99 0.01 25.5)'
      ),
      -- Wide wordmark carrying two rows of fine print under it; the 160px
      -- default squeezes "WOOD-FIRED ARTISAN PIZZA" into illegibility. Same
      -- reasoning as The White Bear Coffee (docs/08 §"Adjust logo size").
      -- `logo_header_height` left NULL — the nav mark is near-square and reads
      -- fine at the 48px component default.
      176
    from new_org
    returning id, org_id
  ),
  -- ── Location 1 · The Gärten (Bay Park) ────────────────────────────────────
  loc_garten as (
    insert into public.template_locations (
      brand_id, slug, name,
      address_line, city, region, postal_code, country,
      latitude, longitude,
      phone, email,
      weekday_hours, weekend_hours,
      maps_embed_url, maps_search_query,
      instagram_url, facebook_url,
      website_url,
      delivery, action_tiles,
      meta_pixel_ids,
      google_place_url,
      gallery, menu
    )
    select
      id,
      'thegarten',
      'Pizza Cassette @ The Gärten',
      '5322 Banks St',
      'San Diego', 'CA', '92110', 'US',
      32.764479, -117.199122,
      '+16199301339',
      null, -- no email published anywhere on the live site
      -- Their block lists Mon/Tue/Wed/Thu individually, all 3:00–9:00 PM.
      'Mon–Thu 3:00 – 9:00 PM',
      'Fri–Sat 12:00 PM – 10:00 PM · Sun 12:00 – 9:00 PM',
      'https://www.google.com/maps?q=Pizza+Cassette,+5322+Banks+St,+San+Diego,+CA+92110&output=embed',
      'Pizza Cassette, 5322 Banks St, San Diego, CA 92110',
      -- Footer link labelled "The Garten".
      'https://www.instagram.com/pizzacassette/',
      'https://www.facebook.com/p/Pizza-Cassette-61555642803203/',
      null, -- see header: no "visit our website" button (migration 045 rule)
      -- No online ordering and no marketplace at this venue — their own
      -- "Bay Park Order Now" button is a `tel:` link.
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'directions',
          'href', 'https://www.google.com/maps/search/?api=1&query=Pizza+Cassette,+5322+Banks+St,+San+Diego,+CA+92110'
        ),
        jsonb_build_object(
          'type', 'call',
          'href', 'tel:+16199301339',
          -- Label spells out that the phone IS the ordering channel here,
          -- mirroring their own "Bay Park Order Now" button.
          'label', 'Call to order'
        )
      ),
      array['849479710958676']::text[], -- RestaurantsWebPixel (gastro)
      'https://www.google.com/maps/search/?api=1&query=Pizza+Cassette,+5322+Banks+St,+San+Diego,+CA+92110',
      jsonb_build_array(
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/01-the-garten-patio-800w.webp',
          'alt', 'The Gärten — string-lit picnic tables and the Pizza Cassette chalkboard'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/02-wood-fired-oven-800w.webp',
          'alt', 'Chef pulling a pie off the peel at the wood-fired oven'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/03-pies-and-heirlooms-800w.webp',
          'alt', 'Two pies on a wooden table with heirloom tomatoes and drinks'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/04-red-pie-roasted-tomato-800w.webp',
          'alt', 'Red pie with roasted tomatoes and basil, charred crust'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/05-cherry-tomato-pie-800w.webp',
          'alt', 'Wood-fired pie topped with heirloom cherry tomatoes and greens'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/06-table-spread-800w.webp',
          'alt', 'A table spread of pies and salads'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/07-prosciutto-arugula-slice-800w.webp',
          'alt', 'Slice of the prosciutto and arugula pie, close up'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/08-green-pie-800w.webp',
          'alt', 'Pie finished with fresh greens straight out of the oven'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/16-crew-tee-800w.webp',
          'alt', 'Pizza Cassette crew tee with the cassette logo on the back'
        )
      ),
      $menu${
  "version": 1,
  "currency_default": "USD",
  "categories": [
    {
      "id": "specials",
      "name": ".38 Special(s)",
      "description": "Weekly specials that change with the seasons. Happy hour 3–5 PM Tuesday through Friday: $5 off pies.",
      "items": [
        {
          "id": "weekly-specials",
          "name": "Weekly Specials",
          "description": "We offer weekly specials that change with the seasons — ask your server what's on today."
        },
        {
          "id": "happy-hour",
          "name": "Happy Hour — $5 off pies",
          "description": "3 PM to 5 PM, Tuesday through Friday."
        }
      ]
    },
    {
      "id": "opening-acts",
      "name": "Opening Acts",
      "description": "Appetizers.",
      "items": [
        {
          "id": "olive-branch",
          "name": "Olive Branch",
          "description": "Olives marinated in citrus, herbs & garlic.",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "home-grown-tomatoes",
          "name": "Home Grown Tomatoes",
          "description": "Heirloom tomatoes, mozzarella, basil, balsamic.",
          "price": {
            "amount": 14,
            "currency": "USD"
          }
        },
        {
          "id": "double-dip",
          "name": "Double Dip (Set)",
          "description": "Heirloom tomato salsa, cannellini bean, hummus, pita.",
          "price": {
            "amount": 14,
            "currency": "USD"
          }
        },
        {
          "id": "great-balls-of-fire",
          "name": "Great Balls of Fire",
          "description": "Wood-fired meatballs, marinara, parmesan, basil, crostini.",
          "price": {
            "amount": 16,
            "currency": "USD"
          }
        },
        {
          "id": "cheese-plate-incident",
          "name": "Cheese Plate Incident",
          "description": "Chef's choice of two meats and two cheeses, seasonal pickled vegetables, dijon, jam, crostini.",
          "price": {
            "amount": 22,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "green-room",
      "name": "The Green Room",
      "description": "Salads.",
      "items": [
        {
          "id": "salad-days",
          "name": "Salad Days",
          "description": "Mixed greens, seasonal vegetable medley, parmesan, choice of ranch or lemon vinaigrette. Add roasted chicken +6.",
          "price": {
            "amount": 12,
            "currency": "USD"
          }
        },
        {
          "id": "fearless-flyer-salad",
          "name": "Fearless Flyer Salad",
          "description": "Kale caesar with roasted chicken breast, heirloom cherry tomatoes, parmesan, bread.",
          "price": {
            "amount": 18,
            "currency": "USD"
          }
        },
        {
          "id": "buffalo-soldier",
          "name": "Buffalo Soldier",
          "description": "Classic buffalo chicken salad with mixed greens, heirloom cherry tomatoes, market red onion and house-made ranch dressing.",
          "price": {
            "amount": 18,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "sandwich-setlist",
      "name": "Sandwich Setlist",
      "items": [
        {
          "id": "tomato-can",
          "name": "Tomato Can",
          "description": "Heirloom tomatoes, mozzarella, basil, arugula, balsamic vinaigrette.",
          "price": {
            "amount": 16,
            "currency": "USD"
          }
        },
        {
          "id": "nwa",
          "name": "N.W.A",
          "description": "Wood-fired pork belly, heirloom tomato, arugula, shallot, garlic mayo.",
          "price": {
            "amount": 18,
            "currency": "USD"
          }
        },
        {
          "id": "korned-beef",
          "name": "Korn(ed) Beef",
          "description": "Brined + smoked pastrami, swiss, kohlrabi slaw, dijon mayo.",
          "price": {
            "amount": 20,
            "currency": "USD"
          }
        },
        {
          "id": "rocky-top",
          "name": "Rocky Top",
          "description": "Salami, capicola, mortadella, provolone, arugula, pepper relish, garlic mayo, lemon vinaigrette.",
          "price": {
            "amount": 18,
            "currency": "USD"
          }
        },
        {
          "id": "cbgb",
          "name": "CBGB",
          "description": "Smoked chicken, wood-fired pork belly, heirloom tomato, arugula, Unseen Ravine ranch.",
          "price": {
            "amount": 20,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "side-a-red-pies",
      "name": "Side A: Red Pies",
      "description": "Organic Di Napoli San Marzano-style tomato sauce. Add toppings +2 each · gluten-free dough +3 · vegan cheese +2.",
      "items": [
        {
          "id": "rossi",
          "name": "Rossi (V)",
          "description": "No cheese — basil, garlic, oregano.",
          "price": {
            "amount": 16,
            "currency": "USD"
          },
          "tags": [
            "vegetarian"
          ]
        },
        {
          "id": "queen",
          "name": "Queen",
          "description": "Mozzarella, parmesan, basil.",
          "price": {
            "amount": 19,
            "currency": "USD"
          }
        },
        {
          "id": "elvis",
          "name": "Elvis",
          "description": "Prosciutto, mozzarella, parmesan, arugula.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "sting",
          "name": "Sting",
          "description": "Salami, mozzarella, parmesan, jalapeño, hot honey.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "fungadelic",
          "name": "Fungadelic",
          "description": "Salami, mushroom, mozzarella, parmesan, garlic, shallot.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "h-to-the-ezzo",
          "name": "H to the Ezzo",
          "description": "Sausage, Ezzo pepperoni, mozzarella mix, parmesan, mushroom, shallot, peppers.",
          "price": {
            "amount": 26,
            "currency": "USD"
          }
        },
        {
          "id": "pizza-in-a-pan",
          "name": "Pizza in a Pan +10",
          "description": "Take the slow train for a long ride — turn any house pie into a “cassette style” pan pizza, +10. Serves 3–4; allow extra cook time."
        }
      ]
    },
    {
      "id": "side-b-white-pies",
      "name": "Side B: White Pies",
      "description": "Add toppings +2 each · gluten-free dough +3 · vegan cheese +2.",
      "items": [
        {
          "id": "soprano",
          "name": "Soprano",
          "description": "Mozzarella, fontina, asiago, parmesan, garlic, oregano.",
          "price": {
            "amount": 22,
            "currency": "USD"
          }
        },
        {
          "id": "canned-heat",
          "name": "Canned Heat",
          "description": "Mozzarella, fontina, parmesan, house-made hot sauce, basil.",
          "price": {
            "amount": 23,
            "currency": "USD"
          }
        },
        {
          "id": "nduja-love-me",
          "name": "Nduja Love Me?",
          "description": "Mozzarella, fontina, Spanish chorizo, shallot, basil.",
          "price": {
            "amount": 24,
            "currency": "USD"
          }
        },
        {
          "id": "lemon-song",
          "name": "Lemon Song",
          "description": "Sausage, lemon, ricotta, mozzarella, parmesan, spinach.",
          "price": {
            "amount": 24,
            "currency": "USD"
          }
        },
        {
          "id": "parliament",
          "name": "Parliament",
          "description": "Sausage, ricotta, mozzarella, parmesan, mushroom, oregano.",
          "price": {
            "amount": 24,
            "currency": "USD"
          }
        },
        {
          "id": "pork-soda",
          "name": "Pork Soda",
          "description": "Bacon, onion jam, mozzarella, parmesan, cherry tomato, arugula, balsamic.",
          "price": {
            "amount": 24,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "bonus-tracks",
      "name": "Bonus Tracks",
      "description": "House-made desserts.",
      "items": [
        {
          "id": "frozen-scoops",
          "name": "Limited Edition Frozen Scoops",
          "description": "Seasonal flavors!",
          "price": {
            "amount": 7,
            "currency": "USD"
          }
        },
        {
          "id": "james-brownie",
          "name": "James Brown(ie)",
          "description": "Hot fudge brownie with house-made vanilla ice cream.",
          "price": {
            "amount": 11,
            "currency": "USD"
          }
        },
        {
          "id": "dont-stop-me-now",
          "name": "Don't Stop Me Now",
          "description": "Tiramisu — cuz I'm having a good time.",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        }
      ]
    }
  ]
}$menu$::jsonb
    from new_brand
    returning id
  ),
  -- ── Location 2 · Pacific Beach ────────────────────────────────────────────
  loc_pb as (
    insert into public.template_locations (
      brand_id, slug, name,
      address_line, city, region, postal_code, country,
      latitude, longitude,
      phone, email,
      weekday_hours, weekend_hours,
      maps_embed_url, maps_search_query,
      instagram_url, facebook_url,
      website_url,
      delivery, action_tiles,
      meta_pixel_ids,
      google_place_url,
      gallery, menu
    )
    select
      id,
      'pacificbeach',
      'Pizza Cassette Pacific Beach',
      '1459 Garnet Ave',
      'San Diego', 'CA',
      -- NOT the 92019 their own site prints — see the header note. 92019 is
      -- El Cajon; 1459 Garnet Ave is Pacific Beach, 92109.
      '92109', 'US',
      32.798990, -117.243174,
      -- NULL on purpose: the only number they publish is used exclusively in
      -- Bay Park / Gärten contexts. Needs operator confirmation.
      null,
      null,
      -- PB opens later at the start of the week than the Gärten does.
      'Mon–Tue 4:00 – 9:00 PM · Wed–Thu 12:00 – 9:00 PM',
      'Fri–Sat 12:00 PM – 10:00 PM · Sun 12:00 – 9:00 PM',
      'https://www.google.com/maps?q=Pizza+Cassette+Pacific+Beach,+1459+Garnet+Ave,+San+Diego,+CA+92109&output=embed',
      'Pizza Cassette, 1459 Garnet Ave, San Diego, CA 92109',
      -- Footer link labelled "Pacific Beach".
      'https://www.instagram.com/pizzacassettepb/',
      'https://www.facebook.com/p/Pizza-Cassette-61555642803203/',
      null, -- see header: no "visit our website" button (migration 045 rule)
      -- Toast is their own channel, not a marketplace — kept here so the
      -- delivery card also carries it, and surfaced as `order_direct` below.
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Order online — Toast',
          'url', 'https://order.toasttab.com/online/pizza-cassette-pacific-beach-1459-garnet-avenue'
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'order_direct',
          'href', 'https://order.toasttab.com/online/pizza-cassette-pacific-beach-1459-garnet-avenue',
          'label', 'Order online'
        ),
        jsonb_build_object(
          'type', 'directions',
          'href', 'https://www.google.com/maps/search/?api=1&query=Pizza+Cassette,+1459+Garnet+Ave,+San+Diego,+CA+92109'
        )
      ),
      array['849479710958676']::text[], -- RestaurantsWebPixel (gastro)
      'https://www.google.com/maps/search/?api=1&query=Pizza+Cassette,+1459+Garnet+Ave,+San+Diego,+CA+92109',
      jsonb_build_array(
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/09-pacific-beach-storefront-800w.webp',
          'alt', 'The Pacific Beach storefront on Garnet Ave'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/10-neon-sign-800w.webp',
          'alt', 'The Pizza Cassette neon sign glowing blue'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/11-prosciutto-pie-800w.webp',
          'alt', 'Prosciutto and arugula pie, fresh from the wood-fired oven'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/12-pesto-pie-800w.webp',
          'alt', 'Pie dressed with pesto and heirloom cherry tomatoes'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/13-pies-overhead-800w.webp',
          'alt', 'Two pies shot from overhead on a wooden table'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/14-three-pies-800w.webp',
          'alt', 'Three pies side by side, ready to share'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/15-burrata-pan-pie-800w.webp',
          'alt', 'Pie with burrata carried out on the pan'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/05-cherry-tomato-pie-800w.webp',
          'alt', 'Wood-fired pie topped with heirloom cherry tomatoes and greens'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/pizzacassette/02-wood-fired-oven-800w.webp',
          'alt', 'Chef pulling a pie off the peel at the wood-fired oven'
        )
      ),
      $menu${
  "version": 1,
  "currency_default": "USD",
  "categories": [
    {
      "id": "opening-acts",
      "name": "Opening Acts",
      "description": "Appetizers. A 4% surcharge is added to all checks to support fair wages and benefits for the team — it is not a gratuity.",
      "items": [
        {
          "id": "olive-branch",
          "name": "Olive Branch",
          "description": "Olives marinated in citrus, herbs & garlic.",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "home-grown-tomatoes",
          "name": "Home Grown Tomatoes",
          "description": "Heirloom tomatoes, mozzarella, basil, balsamic.",
          "price": {
            "amount": 16,
            "currency": "USD"
          }
        },
        {
          "id": "double-dip",
          "name": "Double Dip (Set)",
          "description": "Cannellini bean hummus, bread, heirloom tomato salsa.",
          "price": {
            "amount": 15,
            "currency": "USD"
          }
        },
        {
          "id": "great-balls-of-fire",
          "name": "Great Balls of Fire",
          "description": "Wood-fired meatballs, marinara, parmesan, basil, bread.",
          "price": {
            "amount": 17,
            "currency": "USD"
          }
        },
        {
          "id": "cheese-plate-incident",
          "name": "Cheese Plate Incident",
          "description": "Chef's choice of two meats + two cheeses, seasonal pickled vegetables, dijon, jam, bread.",
          "price": {
            "amount": 26,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "deep-fried-frenz",
      "name": "Deep Fried Frenz",
      "items": [
        {
          "id": "my-alices-arancini",
          "name": "My Alices Arancini",
          "description": "Deep fried risotto balls with smoked provolone, mozzarella and organic tomato sauce.",
          "price": {
            "amount": 16,
            "currency": "USD"
          }
        },
        {
          "id": "mamas-and-papas-bravas",
          "name": "Mamas and Papas Bravas",
          "description": "Deep fried fingerling potatoes, chimichurri, calabrian chili sauce.",
          "price": {
            "amount": 12,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "sandwich-setlist",
      "name": "Sandwich Setlist",
      "items": [
        {
          "id": "tomato-can",
          "name": "Tomato Can",
          "description": "Heirloom tomatoes, mozzarella, basil, arugula, balsamic vinaigrette.",
          "price": {
            "amount": 17,
            "currency": "USD"
          }
        },
        {
          "id": "nwa",
          "name": "N.W.A.",
          "description": "Wood-fired pork belly, heirloom tomato, arugula, shallot, garlic mayo.",
          "price": {
            "amount": 19,
            "currency": "USD"
          }
        },
        {
          "id": "korned-beef",
          "name": "Korn(ed) Beef",
          "description": "Brined + smoked pastrami, swiss, kohlrabi slaw, dijon mayo.",
          "price": {
            "amount": 21,
            "currency": "USD"
          }
        },
        {
          "id": "rocky-top",
          "name": "Rocky Top",
          "description": "Salami, capicola, mortadella, provolone, arugula, pepper relish, garlic mayo, lemon vinaigrette.",
          "price": {
            "amount": 19,
            "currency": "USD"
          }
        },
        {
          "id": "cbgb",
          "name": "CBGB",
          "description": "Smoked chicken, wood-fired pork belly, heirloom tomato, arugula, house-made ranch.",
          "price": {
            "amount": 21,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "green-room",
      "name": "The Green Room",
      "description": "Salads.",
      "items": [
        {
          "id": "buffalo-soldier",
          "name": "Buffalo Soldier",
          "description": "Classic buffalo chicken salad with mixed greens, heirloom cherry tomatoes, market red onion, house-made ranch.",
          "price": {
            "amount": 19,
            "currency": "USD"
          }
        },
        {
          "id": "salad-days",
          "name": "Salad Days",
          "description": "Mixed greens, seasonal vegetable medley, parmesan, choice of house-made ranch or lemon vinaigrette. Add roasted chicken +7.",
          "price": {
            "amount": 13,
            "currency": "USD"
          }
        },
        {
          "id": "fearless-flyer-salad",
          "name": "Fearless Flyer Salad",
          "description": "Kale caesar with roasted chicken breast, heirloom cherry tomatoes, parmesan, bread.",
          "price": {
            "amount": 19,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "side-a-red-pies",
      "name": "Side A: Red Pies",
      "description": "Organic Di Napoli San Marzano-style tomato sauce. Add toppings +2 each · gluten-free dough +3 · vegan cheese +2.",
      "items": [
        {
          "id": "rossi",
          "name": "Rossi (V)",
          "description": "No cheese — basil, garlic, oregano.",
          "price": {
            "amount": 18,
            "currency": "USD"
          },
          "tags": [
            "vegetarian"
          ]
        },
        {
          "id": "queen",
          "name": "Queen",
          "description": "Mozzarella, parmesan, basil.",
          "price": {
            "amount": 20,
            "currency": "USD"
          }
        },
        {
          "id": "the-elvis",
          "name": "The Elvis",
          "description": "Prosciutto, mozzarella, parmesan, arugula.",
          "price": {
            "amount": 26,
            "currency": "USD"
          }
        },
        {
          "id": "the-sting",
          "name": "The Sting",
          "description": "Salami, mozzarella, parmesan, jalapeño, hot honey.",
          "price": {
            "amount": 26,
            "currency": "USD"
          }
        },
        {
          "id": "fungadelic",
          "name": "Fungadelic",
          "description": "Salami, mushroom, mozzarella, parmesan, garlic, shallot.",
          "price": {
            "amount": 26,
            "currency": "USD"
          }
        },
        {
          "id": "h-to-the-ezzo",
          "name": "H to the Ezzo",
          "description": "Sausage, Ezzo pepperoni, mozzarella mix, parmesan, mushroom, shallot, peppers.",
          "price": {
            "amount": 27,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "side-b-white-pies",
      "name": "Side B: White Pies",
      "description": "Add toppings +2 each · gluten-free dough +3 · vegan cheese +2.",
      "items": [
        {
          "id": "soprano",
          "name": "Soprano",
          "description": "Mozzarella, fontina, asiago, parmesan, garlic, oregano.",
          "price": {
            "amount": 23,
            "currency": "USD"
          }
        },
        {
          "id": "canned-heat",
          "name": "Canned Heat",
          "description": "Mozzarella, fontina, parmesan, house-made hot sauce, basil.",
          "price": {
            "amount": 24,
            "currency": "USD"
          }
        },
        {
          "id": "nduja-love-me",
          "name": "Nduja Love Me?",
          "description": "Mozzarella, fontina, Spanish chorizo, shallot, basil.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "lemon-song",
          "name": "Lemon Song",
          "description": "Sausage, lemon, ricotta, mozzarella, parmesan, spinach.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "parliament",
          "name": "Parliament",
          "description": "Sausage, ricotta, mozzarella, parmesan, mushroom, oregano.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        },
        {
          "id": "pork-soda",
          "name": "Pork Soda",
          "description": "Bacon, onion jam, mozzarella, parmesan, cherry tomato, arugula, balsamic.",
          "price": {
            "amount": 25,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "detroit-style",
      "name": "Detroit Style",
      "description": "Take the slow train for a long ride — turn any house pie into a “cassette style” pan pizza. Serves 3–4; allow extra cook time.",
      "items": [
        {
          "id": "detroit-cheese",
          "name": "Detroit Style — Cheese",
          "price": {
            "amount": 42,
            "currency": "USD"
          }
        },
        {
          "id": "detroit-any-pie",
          "name": "Detroit Style — Any Pie",
          "price": {
            "amount": 44,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "bonus-tracks",
      "name": "Bonus Tracks",
      "description": "All house made.",
      "items": [
        {
          "id": "james-brownie",
          "name": "James Brown(ie)",
          "description": "Hot fudge brownie with vanilla ice cream.",
          "price": {
            "amount": 12,
            "currency": "USD"
          }
        },
        {
          "id": "dont-stop-me-now",
          "name": "Don't Stop Me Now",
          "description": "Tiramisu.",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "beer-drafts",
      "name": "Beer · Drafts",
      "items": [
        {
          "id": "salty-crew",
          "name": "Coronado Brewing — Salty Crew",
          "description": "Blonde ale · 4.5% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "plenty-for-all",
          "name": "Fall Brewing — Plenty For All",
          "description": "Pilsner · 4.5% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "pupil",
          "name": "Societe — Pupil",
          "description": "IPA · 7.5% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "calidad",
          "name": "Calidad",
          "description": "Mexican lager · 5% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "diamond-dust",
          "name": "Pure Project — Diamond Dust",
          "description": "IPA · 6.7% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "pure-west-draft",
          "name": "Pure Project — Pure West",
          "description": "West coast IPA · 6.3% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "when-in-rom",
          "name": "RÖM — When In RÖM",
          "description": "Italian pilsner · 4.7% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "bier-von-bayern",
          "name": "Barley & Sword — Bier von Bayern",
          "description": "Hefeweizen · 5% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "boat-shoes",
          "name": "Karl Strauss — Boat Shoes",
          "description": "Hazy IPA · 7.2% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "michelob-ultra",
          "name": "Michelob Ultra",
          "description": "Lager · 4.2% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "beer-cans",
      "name": "Beer · Cans",
      "items": [
        {
          "id": "harland-hazy",
          "name": "Harland — Hazy IPA",
          "description": "IPA · 6.5% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "harland-japanese-lager",
          "name": "Harland — Japanese Lager",
          "description": "Japanese lager · 5% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "pure-west-can",
          "name": "Pure Project — Pure West",
          "description": "West coast IPA · 6.3% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "pure-project-rain",
          "name": "Pure Project — Rain",
          "description": "Pilsner · 5.3% ABV",
          "price": {
            "amount": 9,
            "currency": "USD"
          }
        },
        {
          "id": "magical-and-delicious",
          "name": "Fall Brewing — Magical & Delicious",
          "description": "Pale ale · 5.3% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "moose-drool",
          "name": "Big Sky — Moose Drool",
          "description": "Brown ale · 5% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "midnight-painkiller",
          "name": "June Shine — Midnight Painkiller",
          "description": "Hard kombucha · 6% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "capacity-mexican-lager",
          "name": "Capacity Brewing — Mexican Lager",
          "description": "Non-alcoholic · 0.05% ABV",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "wine",
      "name": "Wine",
      "description": "Priced by the glass; bottle price follows where offered.",
      "items": [
        {
          "id": "pinot-grigio",
          "name": "Between the Vines — Pinot Grigio",
          "description": "White · glass 8 / bottle 38",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "chardonnay",
          "name": "Steele Canyon — Chardonnay",
          "description": "White · glass 8 / bottle 38",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "sauvignon-blanc",
          "name": "Brownstone — Sauvignon Blanc",
          "description": "White · glass 8 / bottle 38",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "malbec",
          "name": "3 Sapas — Malbec",
          "description": "Red · glass 10 / bottle 48",
          "price": {
            "amount": 10,
            "currency": "USD"
          }
        },
        {
          "id": "pinot-noir-steele",
          "name": "Steele Canyon — Pinot Noir",
          "description": "Red · glass 8 / bottle 38",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "pinot-noir-david-bruce",
          "name": "David Bruce — Pinot Noir",
          "description": "Red · bottle only",
          "price": {
            "amount": 85,
            "currency": "USD"
          }
        },
        {
          "id": "cabernet-napa",
          "name": "Napa by N.A.P.A. — Cabernet",
          "description": "Red · bottle only",
          "price": {
            "amount": 60,
            "currency": "USD"
          }
        },
        {
          "id": "dry-rose",
          "name": "Regio — Dry Rosé",
          "description": "Rosé · glass 10 / bottle 48",
          "price": {
            "amount": 10,
            "currency": "USD"
          }
        },
        {
          "id": "brut-bubbles",
          "name": "Los Cuernos — Brut Bubbles",
          "description": "Sparkling · by the glass",
          "price": {
            "amount": 10,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "mocktails",
      "name": "Mocktails",
      "items": [
        {
          "id": "spiritless-margarita",
          "name": "Spiritless Margarita",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        },
        {
          "id": "spiritless-old-fashioned",
          "name": "Spiritless Old Fashioned",
          "price": {
            "amount": 8,
            "currency": "USD"
          }
        }
      ]
    },
    {
      "id": "beverages",
      "name": "Beverages",
      "items": [
        {
          "id": "coke-can",
          "name": "Coke Can",
          "price": {
            "amount": 3,
            "currency": "USD"
          }
        },
        {
          "id": "diet-coke-can",
          "name": "Diet Coke Can",
          "price": {
            "amount": 3,
            "currency": "USD"
          }
        },
        {
          "id": "sprite-can",
          "name": "Sprite Can",
          "price": {
            "amount": 3,
            "currency": "USD"
          }
        },
        {
          "id": "mexican-coke",
          "name": "Mexican Coke",
          "price": {
            "amount": 4.5,
            "currency": "USD"
          }
        },
        {
          "id": "aranciata",
          "name": "A Siciliana Aranciata",
          "price": {
            "amount": 5,
            "currency": "USD"
          }
        },
        {
          "id": "limonata",
          "name": "A Siciliana Limonata",
          "price": {
            "amount": 5,
            "currency": "USD"
          }
        },
        {
          "id": "san-pellegrino",
          "name": "San Pellegrino",
          "price": {
            "amount": 7,
            "currency": "USD"
          }
        },
        {
          "id": "panna",
          "name": "Panna",
          "price": {
            "amount": 7,
            "currency": "USD"
          }
        },
        {
          "id": "bottle-water",
          "name": "Bottle Water",
          "price": {
            "amount": 3,
            "currency": "USD"
          }
        }
      ]
    }
  ]
}$menu$::jsonb
    from new_brand
    returning id
  ),
  -- ── Hostnames ─────────────────────────────────────────────────────────────
  -- Pattern B: `<location>.<brand>.mysite.social` is primary per location,
  -- plus the `go.` alias every recent tenant carries for QR / short links.
  -- Both labels-deep forms must be `mysite_multi` — the
  -- `template_domains_validate` trigger only lets `<slug>.mysite.social`
  -- through when kind = 'mysite_single'. Deliberately NO bare
  -- `pizzacassette.mysite.social` row: the trigger rejects it and the bare
  -- brand root is 404 by design (docs/02 Pattern B).
  -- Shape matches the existing multi-location precedent
  -- `go.palmsprings.cantonbistro.mysite.social`.
  dom_garten as (
    insert into public.template_domains (hostname, location_id, is_primary, kind)
    select h.hostname, l.id, h.is_primary, h.kind
      from loc_garten l
     cross join (values
       ('thegarten.pizzacassette.mysite.social',    true,  'mysite_multi'),
       ('go.thegarten.pizzacassette.mysite.social', false, 'mysite_multi')
     ) as h(hostname, is_primary, kind)
    returning 1
  )
insert into public.template_domains (hostname, location_id, is_primary, kind)
select h.hostname, l.id, h.is_primary, h.kind
  from loc_pb l
 cross join (values
   ('pacificbeach.pizzacassette.mysite.social',    true,  'mysite_multi'),
   ('go.pacificbeach.pizzacassette.mysite.social', false, 'mysite_multi')
 ) as h(hostname, is_primary, kind);

-- ── Operator follow-ups ──────────────────────────────────────────────────────
--
-- 1. Pacific Beach phone number. Their site publishes only (619) 930-1339 and
--    only in Bay Park contexts, so `pacificbeach.phone` is NULL and PB has no
--    `call` tile. Once confirmed:
--
--      update public.template_locations l
--         set phone = '+1619XXXXXXX',
--             action_tiles = l.action_tiles || jsonb_build_array(
--               jsonb_build_object('type', 'call', 'href', 'tel:+1619XXXXXXX'))
--        from public.template_brands b
--       where l.brand_id = b.id and b.slug = 'pizzacassette'
--         and l.slug = 'pacificbeach';
--
-- 2. Pacific Beach reservations. They are on OpenTable (`rid=1499530`, read out
--    of the widget loader their own site embeds), but opentable.com blocks every
--    request we can make, so no reservation URL could be verified and none was
--    stored. Paste the real page URL — the direct opentable.com one, NOT a
--    shortener and NOT an OpenTable-dashboard tracking link (docs/08) — and:
--
--      update public.template_locations l
--         set action_tiles = jsonb_insert(
--               l.action_tiles, '{1}',
--               jsonb_build_object(
--                 'type', 'book',
--                 'href', 'https://www.opentable.com/...',
--                 'label', 'Book a table'))
--        from public.template_brands b
--       where l.brand_id = b.id and b.slug = 'pizzacassette'
--         and l.slug = 'pacificbeach';
--
-- 3. Instagram handles. `pizzacassette` → The Gärten and `pizzacassettepb` →
--    Pacific Beach, per the labels in their own footer. Instagram 401s its
--    profile API so neither could be machine-checked; worth an eyeball.
--
-- 4. Their Wix site prints the wrong Pacific Beach zip (92019 → should be
--    92109). Worth telling them so their own site's map stops pointing at
--    El Cajon.
--
-- 5. Google rating + review count for both venues, read off each GBP. Set
--    `google_rating` and `google_reviews_count` TOGETHER or the badge stays
--    hidden (Hero.astro:23).
--
-- 6. Umami website IDs for both locations.
--
-- 7. The Gärten ships no UTM tagging on its outbound social links. Cause is
--    platform-side, not data-side: `hasTaggableOutboundLink` gates the tagger
--    on `action_tiles` / `delivery` / `website_url` only, and this venue's
--    tiles are a `tel:` and a Maps link, both of which are on the tagger's own
--    skip list. So the gate never fires and Instagram / Facebook / the footer
--    mysite.ai link go out untagged. PB is unaffected (its Toast tile trips
--    the gate). Fixing it properly means teaching that helper about
--    `instagram_url` / `facebook_url` — a template change, not a seed change,
--    so it is deliberately not done in this migration. Every phone-only tenant
--    has the same hole.
