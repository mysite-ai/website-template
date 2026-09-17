-- 044_seed_taava_kitchen.sql
--
-- Taava Kitchen (Oakland, CA) — single-location tenant.
-- Reference: https://taavakitchen.com (a Square Online site).
--
-- Indian / Pakistani / halal takeout, delivery and catering, operating out of
-- the Forage Kitchen shared kitchen in Uptown Oakland since January 2023.
-- Explicitly NO dine-in — that shapes the action tiles (no `book`/`reserve`).
--
-- Where every value came from
-- ---------------------------
-- Copy, item names, item descriptions, categories: scraped from their own
-- site. Square renders prices client-side only, but the per-product
-- `og:title` / `og:description` ARE server-side, and their category tree is
-- public at /app/store/api/v5/pub/users/144151034/sites/173240458223628156/
-- categories. The `preferred_order_product_ids` arrays on those categories
-- are what decided which item sits in which section — the grouping is theirs,
-- not ours.
--
-- Address: they publish two. Their delivery listings (DoorDash, Uber Eats,
-- Grubhub) and visitoakland.com say "372 24th Street"; Yelp, Forage Kitchen's
-- own site and their venue photo say "478 25th St". It's one building that
-- spans the block. We use the 25th St / Forage Kitchen form because that's the
-- door a guest actually walks to, and this column drives the Directions tile
-- and the map embed.
--
-- Hours: 11:30 AM – 2:30 PM and 4:30 – 9:30 PM, Tue–Sun, closed Monday.
-- Consistent across Yelp, Uber Eats and Restaurantji. NOTE: the "Monday
-- 09:00–17:00" block on their own homepage is unedited Square boilerplate
-- (it sits next to a "Square Inc, Market Street, (555) 555-5555" contact
-- card), so it is not a source.
--
-- Rating: NOT set. 4.6 agrees across Uber Eats (390+), Restaurantji (122) and
-- Grubhub, but none of those is Google, and `Hero.astro` labels the number
-- "Google reviews". It also gates the whole badge on BOTH columns
-- (`rating !== null && reviewCount > 0`), so writing `google_rating` alone
-- renders nothing and just leaves the row looking half-configured. Set both
-- together once someone reads the real figures off the Google Business
-- Profile — same state as guidos / lindleypet / sushisawa / elpolloperu.
--
-- Prices: NOT included, on purpose. Square only serves prices to an
-- authenticated merchant session and no public source carries them. Shipping
-- invented numbers on a live restaurant's menu is a trust break, so the menu
-- ships as a browsable catalogue and every ordering CTA hands off to Square
-- for live pricing. Backfill `price` per item when the client sends a list.
--
-- Per-item `image_url`: NOT set, though we did scrape a real photo for ~95% of
-- items. Design-system rule from migration 023 is "either every item has a
-- thumbnail or none", four items have no photo, and all 22 existing tenants
-- are on "none". Their good dish photography goes into the gallery instead,
-- self-hosted per migration 019.
--
-- Loyalty / QR: intentionally NOT wired. All four `attribution_*` columns stay
-- NULL, which makes Header hide the "Rewards" nav item and /rewards render its
-- empty state. Nothing needs to be inserted into attribution-autopilot's
-- `location_origins` for this tenant, and there is no CORS cache lag to wait
-- out. To enable loyalty later, follow docs/02-adding-a-client.md step 2.
--
-- Meta pixel: `RestaurantsWebPixel` (849479710958676). Confirmed with the
-- operator per .cursor/rules/meta-pixel-selection.mdc — gastro, not retail.
--
-- Umami: left NULL. Create the website in Umami, then set
-- `umami_website_id` (see docs/08-managing-tenants.md).
--
-- Instagram: instagram.com/taavakitchen. Not machine-verifiable — Instagram
-- gates both the profile page and its web_profile_info API (401), and Taava's
-- own Square site carries `"social": []`, i.e. they never linked one from the
-- site. The handle comes from third-party directories and was confirmed by the
-- operator during onboarding.
--
-- Assets — must be uploaded to Supabase Storage bucket `assets` before this
-- tenant renders correctly:
--   logos/taava-wordmark.png   hero mark  (their wordmark, recovered from the
--                              white-on-photo lockup on their own social image
--                              and recoloured to their brand red #9a1c1f)
--   logos/taava-mark.png       nav mark   (same lockup, tagline row dropped —
--                              "indian | pakistani | halal | catering" is
--                              unreadable at a 48px header height)
--   favicons/taava.svg         favicon    (their own icon is a cropped stock
--                              frying-pan JPEG, illegible at 16px)
--   gallery-v3/taava/*.webp    9 photos × 400w/800w/1600w
--
-- Theme: `oklch(0.5 0.17 25)` ≈ #9a1c1f, taken from their Square site's own
-- `secondaryColors` palette. Their `primaryColor` is #000000, which the
-- template already uses as its neutral, so the red is the distinguishing mark.

with
  new_org as (
    insert into public.template_organizations (name, slug, default_locale)
    values ('Taava Kitchen', 'taavakitchen', 'en')
    returning id
  ),
  new_brand as (
    insert into public.template_brands (
      org_id, slug, name,
      logo_url, logo_url_nav, favicon_url,
      tagline, about_md, theme
    )
    select
      id,
      'taavakitchen',
      'Taava Kitchen',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/taava-wordmark.png',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/logos/taava-mark.png',
      'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/favicons/taava.svg',
      'Indian · Pakistani · halal · catering. Spiced right, made fresh to order.',
      $md$Taava Kitchen is a **halal Indian and Pakistani kitchen in Uptown Oakland**, cooking food for takeout, delivery and catering since January 2023.

We're housed in the shared kitchen space at **Forage Kitchen** on 25th Street, between Broadway and Telegraph. Our goal is to be a destination for the flavours of the Indian Sub-Continent — **India, Pakistan and Nepal**.

We're not new to this. Our curry cook, our tandoor specialist and our management each bring **more than 15 years** in Indian kitchens. Everything is made fresh to order, including our house-made chutneys, samosas and Indian desserts — and there are plenty of **vegan, vegetarian and gluten-free** options.

**Order direct and delivery is free.** No third parties, no price mark-ups, no platform fees — better for you, better for our drivers, better for us.

We also care about what your food arrives in, so we use **sustainable, compostable takeout packaging** wherever we can.

*Please note: we're a takeout kitchen with outdoor patio seating — no indoor dining room.*
$md$,
      jsonb_build_object(
        -- Taava brand red, lifted from their own Square palette (#9a1c1f).
        'primary', 'oklch(0.5 0.17 25)',
        'primary_foreground', 'oklch(0.99 0.005 25)'
      )
    from new_org
    returning id, org_id
  ),
  new_location as (
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
      'taavakitchen',
      'Taava Kitchen',
      'Inside Forage Kitchen, 478 25th St',
      'Oakland', 'CA', '94612', 'US',
      -- Geocoded from the Forage Kitchen building itself (Nominatim), not from
      -- the 24th St address their delivery listings use.
      37.81479, -122.26718,
      '+15105315912',
      null, -- no public email address on their site or listings
      'Tue–Fri 11:30 AM – 2:30 PM · 4:30 – 9:30 PM · Closed Monday',
      'Sat–Sun 11:30 AM – 2:30 PM · 4:30 – 9:30 PM',
      'https://www.google.com/maps?q=Taava+Kitchen,+478+25th+St,+Oakland,+CA+94612&output=embed',
      'Taava Kitchen, 478 25th St, Oakland, CA 94612',
      'https://www.instagram.com/taavakitchen/', -- operator-confirmed
      null, -- no Facebook page linked from their site
      -- Their Square site stays live; we link out to it with MySite UTMs so
      -- they can see the referral in their own analytics.
      'https://www.taavakitchen.com/',
      -- Direct ordering first. Their entire homepage pitch is "No third
      -- parties. No price mark-ups. FREE in-house delivery." — but they are on
      -- the marketplaces too, so those stay for guests who only order there.
      jsonb_build_array(
        jsonb_build_object('name', 'Order direct — free delivery', 'url', 'https://www.taavakitchen.com/s/order'),
        jsonb_build_object('name', 'Uber Eats', 'url', 'https://www.ubereats.com/store/taava-kitchen/58n1pBC5R8CJu_J9UbfZ5w'),
        jsonb_build_object('name', 'DoorDash',  'url', 'https://www.doordash.com/en/store/taava-kitchen-24606199/'),
        jsonb_build_object('name', 'Grubhub',   'url', 'https://www.grubhub.com/restaurant/taava-kitchen-372-24th-street-oakland/11798280')
      ),
      -- `order_direct` (not `order`) for their own channel so Umami reports
      -- commission-free orders as a distinct event — see migration 042.
      -- No `book`/`reserve` tile: this is a takeout kitchen, no reservations.
      jsonb_build_array(
        jsonb_build_object(
          'type', 'order_direct',
          'href', 'https://www.taavakitchen.com/s/order',
          'label', 'Order — free delivery'
        ),
        jsonb_build_object(
          'type', 'directions',
          'href', 'https://www.google.com/maps/search/?api=1&query=Taava+Kitchen,+478+25th+St,+Oakland,+CA+94612'
        ),
        jsonb_build_object(
          'type', 'call',
          'href', 'tel:+15105315912'
        )
      ),
      array['849479710958676']::text[], -- RestaurantsWebPixel (gastro)
      'https://www.google.com/maps/search/?api=1&query=Taava+Kitchen,+478+25th+St,+Oakland,+CA+94612',
      jsonb_build_array(
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/01-box-two-favs-800w.webp',
          'alt', 'Taava two-favourites box — saag, basmati rice, karahi and fresh naan'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/02-makhani-800w.webp',
          'alt', 'Makhani — creamy tomato curry served with basmati rice'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/03-tikka-kabab-800w.webp',
          'alt', 'Tandoori tikka kababs with pickled onion, tomato and lime'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/04-tandoori-wings-800w.webp',
          'alt', 'Tandoori hot wings, fresh out of the clay oven'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/05-bhel-puri-800w.webp',
          'alt', 'Bhel puri — Mumbai street-food snack with house chutneys'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/06-biryani-800w.webp',
          'alt', 'Vegetable biryani with saffron basmati and cucumber-carrot raita'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/07-aloo-tikki-chaat-800w.webp',
          'alt', 'Aloo tikki chaat with chana masala, onion and chutneys'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/08-forage-kitchen-800w.webp',
          'alt', 'Our home at Forage Kitchen on 25th Street, with patio seating'
        ),
        jsonb_build_object(
          'src', 'https://tkltfqshwwxykxhxthem.supabase.co/storage/v1/object/public/assets/gallery-v3/taava/09-sustainable-packaging-800w.webp',
          'alt', 'Certified compostable takeout packaging'
        )
      ),
      $menu${
  "version": 1,
  "currency_default": "USD",
  "categories": [
    {
      "id": "boxes",
      "name": "Boxes & Plates",
      "items": [
        {
          "id": "box-1",
          "name": "Box 1 (Options-1 fav+rice+naan)",
          "description": "Aromatic choice, featuring a blend of spices and tender meat or vegetables, served alongside our fragrant basmati rice and warm, soft naan bread/roti (vegan)/papadum (vegan) or our loaded garlic bread."
        },
        {
          "id": "box-2",
          "name": "Box 2 (Options-2 favs+rice+naan)",
          "description": "Choose any two of your favorite dishes, complemented by aromatic basmati rice and a warm, fluffy naan bread/roti (vegan)/papadum (vegan) or our delicious garlic bread."
        },
        {
          "id": "lunchbox-1",
          "name": "LunchBox 1 (Options-1 fav+rice+naan)",
          "description": "A delightful lunchbox featuring your choice of one favorite curry or entrée, served alongside aromatic basmati rice and a soft, buttery naan bread/roti (vegan)/papadum (vegan) or our loaded garlic naan."
        },
        {
          "id": "lunchbox-2",
          "name": "LunchBox 2 (Options-2 favs+rice+naan)",
          "description": "Choose any two of your favorite dishes, complemented by fragrant basmati rice and a side of soft, freshly baked naan/roti (vegan)/papadum(vegan) or our delicious garlic naan."
        }
      ],
      "description": "Pick your favourites — every box comes with basmati rice and bread."
    },
    {
      "id": "curries",
      "name": "Curries",
      "items": [
        {
          "id": "makhani",
          "name": "Makhani (Vegan, Protein Options)",
          "description": "A rich and creamy sauce infused with aromatic spices, served with your choice of vegan protein. This dish brings a harmonious blend of flavors and textures, perfect for a satisfying meal.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "tikka-masala",
          "name": "Tikka Masala [gf] (Vegan, Protein Options)",
          "description": "A rich and creamy tikka masala sauce, made with a blend of aromatic spices, tomatoes, and coconut milk. Enjoy it with your choice of vegan protein options for a satisfying meal.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "curry",
          "name": "Curry (Vegan, Protein Options)",
          "description": "A rich and aromatic vegan curry featuring a blend of spices and protein choices like organic tofu, paneer, halal chicken & lamb.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "karahi",
          "name": "Karahi (Vegan, Protein Options)",
          "description": "A flavorful vegan Karahi dish loaded with a medley of aromatic spices, fresh bell peppers, red onions, tomatoes, served with customizable options like mixed vegetables, tofu, paneer, halal chicken and halal lamb.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "korma",
          "name": "Korma (Vegan, Protein Options)",
          "description": "Korma features aromatic spices cooked in a light-creamy sauce with vegetarian options such as tofu, paneer, mixed vegetables and tender meat choices such as halal chicken, halal lamb.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "vindaloo",
          "name": "Vindaloo (Vegan, Protein Options)",
          "description": "A fiery vegan and gluten-free curry featuring tender potatoes and your choice of protein simmered in a spicy, aromatic sauce brimming with traditional Indian spices.",
          "tags": [
            "vegan",
            "spicy"
          ]
        },
        {
          "id": "rogan-josh",
          "name": "Rogan Josh [gf]",
          "description": "Tender pieces of lamb cooked in a rich blend of aromatic spices and creamy yogurt, creating a flavorful and aromatic curry. Naturally gluten-free for those with dietary preferences.",
          "tags": [
            "gluten-free"
          ]
        },
        {
          "id": "saag",
          "name": "Saag [gf] (Vegan, Protein Options)",
          "description": "Spinach, mustard greens, broccoli sauce and a very light cream",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "mattar-peas",
          "name": "Mattar/Peas [gf] (Vegan, Protein Options)",
          "description": "Tender green peas cooked to perfection, offering a burst of natural sweetness. This vegan, gluten-free option can be enhanced with your choice of plant-based protein for a complete, nutritious meal.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "kheema-curry",
          "name": "Kheema (halal minced meat) Curry",
          "description": "Minced chicken/lamb simmered in a rich, aromatic curry sauce with a blend of traditional spices, onions, tomatoes, and fresh cilantro."
        }
      ],
      "description": "Gluten-free, with vegan and halal protein options."
    },
    {
      "id": "grill",
      "name": "Grill · Tandoori Clay Oven",
      "items": [
        {
          "id": "tandoori-chicken",
          "name": "Tandoori Chicken (half/full order)",
          "description": "Chicken (on bone) marinated in a mildly spiced yogurt blend, cooked in our clay oven (tandoor). As our other items, we prepare our grill fresh to order, so please allow 30 minutes for the grill items."
        },
        {
          "id": "tandoori-seekh-kabab-lamb",
          "name": "Tandoori Seekh Kabab (Options - Chicken (halal), Lamb (halal))",
          "description": "Juicy seekh kababs, marinated in aromatic tandoori spices and grilled to perfection, available in succulent chicken or tender lamb options."
        },
        {
          "id": "tandoori-tikka-kabab-shrimp-fish",
          "name": "Tandoori Tikka Kabab (Options-Paneer, Chicken(halal), Shrimp, Fish (salmon)",
          "description": "Choose from paneer, halal chicken, succulent shrimp, or fresh salmon, all marinated in a traditional, gluten-free, tandoori blend of yogurt, spices, and herbs, then expertly grilled to perfection."
        },
        {
          "id": "tandoori-bites",
          "name": "Tandoori Bites",
          "description": "A smaller version of our popular grills. Choose from various available options - chicken, shrimp & lamb."
        },
        {
          "id": "tandoori-hot-wings-with-jalapeno-dip",
          "name": "Tandoori Hot Wings with Jalapeno dip",
          "description": "Marinated wings cooked in the tandoor, spiced to levels you like, served with our jalapeno-ranch dipping sauce. As our other items, we prepare our grill fresh to order, so please allow 20-30 min for preparation.",
          "tags": [
            "spicy"
          ]
        },
        {
          "id": "chicken-fritters",
          "name": "Chicken Fritters (Indian-style) [gf]",
          "description": "Taking our marinated chicken in a new direction! Dipped & fried in our garbanzo flour batter.",
          "tags": [
            "gluten-free"
          ]
        }
      ],
      "description": "Marinated and fired to order — please allow 20–30 minutes."
    },
    {
      "id": "exclusives",
      "name": "Taava Kitchen Exclusives",
      "items": [
        {
          "id": "methi-fenugreek",
          "name": "Methi/Fenugreek [gf] (Vegan, Protein Options)",
          "description": "Sautéed fenugreek leaves, seasoned with aromatic spices, available with your choice of protein options such as tofu, chicken, lamb, etc. This gluten-free dish offers a flavorful and nutritious plant-based meal.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "achari",
          "name": "Achari [v, gf] (Protein Option)",
          "description": "A medley of pickled spices infuses a tangy flavor into your choice of protein, creating a gluten-free dish that tantalizes the taste buds.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "chili",
          "name": "Chili [gf] (Protein Options)",
          "description": "Choice of protein cooked in spicy-tangy chili sauce with fresh bell peppers, red onions & tomatoes.",
          "tags": [
            "gluten-free",
            "spicy"
          ]
        },
        {
          "id": "aloo-masala-naan",
          "name": "Aloo Masala Naan",
          "description": "Our version of this naan is amazingly flavorful! A must try."
        },
        {
          "id": "chicken-tikka-naan",
          "name": "Chicken Tikka Naan",
          "description": "marinated & grilled in the tandoor, chicken tikka, is stuffed in the naan with fresh onions, cilantro & spices!"
        },
        {
          "id": "kheema-naan",
          "name": "Kheema (minced) Naan",
          "description": "Yumm - Naan stuffed with our spiced minced chicken, cilantro & spices."
        },
        {
          "id": "stuffed-naan",
          "name": "Stuffed Naan",
          "description": "Stuffed with goodies, tandoori bread."
        }
      ],
      "description": "Dishes you won't find at the Indian place down the road."
    },
    {
      "id": "vegetables",
      "name": "Vegetables",
      "items": [
        {
          "id": "aloo-gobi",
          "name": "Aloo Gobi [v, gf]",
          "description": "Tender potatoes and cauliflower, cooked with a medley of aromatic spices, create a hearty and flavorful vegetarian and gluten-free dish.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "chana-masala",
          "name": "Chana Masala [v, gf]",
          "description": "A hearty dish of chickpeas simmered in a rich tomato gravy, infused with aromatic spices like cumin, coriander, and garam masala, finished with fresh cilantro. Perfect for a gluten-free and vegetarian delight.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "bhindi-masala",
          "name": "Bhindi Masala [v, gf]",
          "description": "Tender okra cooked with a blend of aromatic spices, onions, and tomatoes. This vibrant dish is both vegan and gluten-free, offering a flavorful and wholesome meal.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "baingan-bharta",
          "name": "Baingan Bharta [v, gf]",
          "description": "Baingan Bharta features roasted eggplant mashed with a blend of traditional spices, offering a rich and smoky flavor. This vegetarian and gluten-free dish is perfect for those seeking a savory and aromatic delight.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "mixed-vegetable-masala",
          "name": "Mixed Vegetable Masala [v, gf]",
          "description": "A vibrant medley of fresh mixed vegetables simmered in a rich blend of aromatic spices, offering a flavorful and gluten-free delight.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "daal-tadka",
          "name": "Daal Tadka [Protein Options]",
          "description": "A hearty bowl of yellow lentils, simmered to perfection and infused with a blend of aromatic spices, then finished with a sizzling tempering of cumin, garlic, and mustard seeds."
        },
        {
          "id": "kaali-daal",
          "name": "Kaali Daal (lentils) [Protein Options]",
          "description": "A rich and hearty dish made with slow-cooked black lentils seasoned with aromatic spices. We have made this with vegan as well as offer protein options. This comforting daal (lentils) is a staple of North Indian cuisine."
        },
        {
          "id": "chole-bhature",
          "name": "Chole Bhature",
          "description": "Chole bhature is a food dish popular in the northern areas of the Indian subcontinent. It is a combination of chana masala and bhatura/puri, a deep-fried bread made from all-purpose flour."
        },
        {
          "id": "bhatura",
          "name": "Bhatura",
          "description": "Bhatura is a fluffy deep-fried leavened bread originating from the Indian subcontinent. It is commonly served as a midday meal or a breakfast dish in northern and eastern India."
        }
      ],
      "description": "Vegan and gluten-free unless noted."
    },
    {
      "id": "smallplates",
      "name": "Small Plates & Chaat",
      "items": [
        {
          "id": "aloo-tikki-chaat-with-chutneys",
          "name": "Aloo Tikki Chaat [v, gf], with chutneys",
          "description": "Seasoned potato patties (2 pieces) with chana (garbanzo) masala, garnished with onions, cilantro & chutneys.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "vegetable-samosa-chaat-with-chutneys",
          "name": "Vegetable Samosa Chaat [V] with chutneys",
          "description": "Garbanzo bean mix over vegetable samosa, garnished with onions, cilantro, and chutneys.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "aloo-tikki-with-chutneys",
          "name": "Aloo Tikki (2pcs) [v, gf], with chutneys",
          "description": "Seasoned potato patties served with chutneys",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "vegetable-samosa-with-chutneys",
          "name": "Vegetable Samosa (2pcs) with chutneys",
          "description": "Seasoned potatoes and peas, wrapped in a flaky pastry. Great for kids"
        },
        {
          "id": "cocktail-vegetable-samosa-with-chutneys",
          "name": "Cocktail Vegetable Samosa (2pcs) with chutneys",
          "description": "Seasoned potatoes and peas, wrapped in a flaky pastry - just smaller than our regular size. Great for kids"
        }
      ],
      "description": "Served with our house-made chutneys."
    },
    {
      "id": "fingerfood",
      "name": "Finger Food",
      "items": [
        {
          "id": "papadum-with-chutneys",
          "name": "Papadum [v, gf] with chutneys",
          "description": "Crispy lentil wafers.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "onion-bhaji",
          "name": "Onion Bhaji (Pakora)",
          "description": "Thinly sliced onions, coated in a fragrant blend of spices and gram flour, deep-fried to achieve a golden, crispy texture. Served hot and perfect for dipping in chutney or enjoying on their own."
        },
        {
          "id": "chicken-kheema-samosa",
          "name": "Chicken Kheema Samosa [2 pcs]",
          "description": "Introducing YUMM! - full of flavor in every bite. Chicken (minced), pomegranate, mango, ginger, garlic, sesame turmeric and a litany of spices."
        },
        {
          "id": "dosa-rolls",
          "name": "Dosa Rolls (v)",
          "description": "Same great flavor, just made them bite size - made with potatoes, onions, spices wrapped in a light, crispy pastry (like Spring Rolls). Enjoy with your choice of chutney.",
          "tags": [
            "vegan"
          ]
        }
      ],
      "description": "Made fresh to order — also our catering platters."
    },
    {
      "id": "roadside",
      "name": "Roadside Snacks",
      "items": [
        {
          "id": "bhel-puri-with-chutneys",
          "name": "Bhel Puri with Chutneys",
          "description": "Originating from the beaches of Mumbai & found on corner kiosks throughout India, this crunchy snack offers a refreshing burst of flavors."
        },
        {
          "id": "masala-peanuts",
          "name": "Masala Peanuts",
          "description": "Spicy, tangy peanuts - Indian-style! A mix of peanuts in spices, tomatoes, red onions, cilantro & lime. Easily pairs with beer & white wine - we think."
        }
      ],
      "description": "Indian street food, the way the corner kiosks make it."
    },
    {
      "id": "nepal",
      "name": "From Our Northern Neighbour · Nepal",
      "items": [
        {
          "id": "chicken-momo",
          "name": "Chicken Momo (6 pcs)",
          "description": "A popular, beloved, and savory steamed dumpling that originated in Tibet and is now a staple dish in Nepal, India, and surrounding regions."
        },
        {
          "id": "vegetable-momos",
          "name": "Vegetable Momos (8 pcs)",
          "description": "Vegetable momos are a popular, healthy, and flavorful steamed dumpling dish that originated in Tibet and Nepal and is now a beloved street food across India and worldwide."
        }
      ],
      "description": "Hand-folded steamed momos."
    },
    {
      "id": "rice",
      "name": "Rice",
      "items": [
        {
          "id": "basmati-rice",
          "name": "Basmati Rice [v, gf]",
          "description": "Delicate, long grains of basmati rice, known for their fragrant aroma, provide a gluten-free option that pairs seamlessly with any dish.",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "vegetable-rice-pilaf",
          "name": "Vegetable Rice Pilaf [v, gf]",
          "description": "Basmati rice cooked with peas & carrots",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "biryani-with-raita",
          "name": "Biryani, with raita",
          "description": "Basmati rice sautéed with onions, bell-peppers, and spices, garnished with cilantro. Served with our cucumber-carrot raita"
        }
      ]
    },
    {
      "id": "breads",
      "name": "Breads & Wraps",
      "items": [
        {
          "id": "naan",
          "name": "Naan",
          "description": "Bread cooked in a tandoor oven"
        },
        {
          "id": "tandoori-roti",
          "name": "Tandoori Roti [v]",
          "description": "Whole wheat flour naan, cooked in the tandoor.",
          "tags": [
            "vegan"
          ]
        },
        {
          "id": "tandoori-wraps-served-with-chutneys",
          "name": "Tandoori Wraps, served with chutneys",
          "description": "greens, red onions, cucumbers, chutneys wrapped in naan"
        }
      ],
      "description": "Cooked in the tandoor."
    },
    {
      "id": "sides",
      "name": "Sides & Chutneys",
      "items": [
        {
          "id": "raita",
          "name": "Raita",
          "description": "Yogurt, cucumbers, carrots, and spices"
        },
        {
          "id": "mango-chutney",
          "name": "Mango Chutney",
          "description": "Mangoes, tangy and sweet mix"
        },
        {
          "id": "achar-1",
          "name": "Achar 1 [v, gf]",
          "description": "Mixed pickle - green mangoes, lemon, lotus root, and green chilies",
          "tags": [
            "vegan",
            "gluten-free"
          ]
        },
        {
          "id": "extra-curries",
          "name": "Extra Curries",
          "description": "Love our curries but want to do your own thing! Here you have it."
        }
      ]
    },
    {
      "id": "desserts",
      "name": "Desserts",
      "items": [
        {
          "id": "rasmalai",
          "name": "Rasmalai (2 pcs)",
          "description": "Soft cheese patties in a delicately sweetened & flavored creamy milk sauce."
        },
        {
          "id": "gulab-jamun",
          "name": "Gulab Jamun",
          "description": "3 pieces. Milk dumplings in cardamom-sugar syrup"
        },
        {
          "id": "new-ice-cream-sandwiches",
          "name": "NEW - Ice cream Sandwiches (many flavors)",
          "description": "Locally made ice cream between two wafers — easy to eat on the go. Several flavours to choose from.",
          "tags": [
            "new"
          ]
        },
        {
          "id": "kulfipops",
          "name": "Kulfipops (for pickup orders & on-site ONLY)",
          "description": "The classic Indian frozen dairy dessert, on a stick. Pickup and on-site orders only."
        },
        {
          "id": "indian-icecream",
          "name": "Indian Icecream (for pickup orders & on-site ONLY)",
          "description": "Original Indian ice cream — vegetarian, gelatin-free and egg-free. Chikoo fruit, with a sweet custard-like flavour. Pickup and on-site orders only."
        }
      ],
      "description": "House-made, including our Indian sweets."
    },
    {
      "id": "drinks",
      "name": "Drinks",
      "items": [
        {
          "id": "lassi",
          "name": "Lassi (yogurt & plant-based)",
          "description": "Creamy yogurt & plant-based blends with mango-pulp, agave nectar, cardamom creates a refreshing and smooth beverage."
        },
        {
          "id": "lemonade",
          "name": "Lemonade"
        },
        {
          "id": "turmeric-ginger-lemonade",
          "name": "Turmeric Ginger Lemonade",
          "description": "Lemonade infused with turmeric & ginger juice with black pepper."
        },
        {
          "id": "arnold-palmer",
          "name": "Arnold Palmer",
          "description": "Our Iced Tea & Lemonade mixed up!"
        },
        {
          "id": "iced-tea",
          "name": "Iced Tea"
        },
        {
          "id": "chai-plain-cardamom-ginger-saffron-mint",
          "name": "Chai (Indian-style) - Plain | Cardamom | Ginger | Saffron | Mint |",
          "description": "Traditionally-made, Indian black tea boiled with milk - made to order, just like on street corners in India!"
        },
        {
          "id": "coconut-water",
          "name": "Coconut Water",
          "description": "Hydrate with Vita Coco coconut water (from small farms, from the source in the tropics), packed with nutrients, electrolytes, & fresh coconut taste in an eco-friendly packaging."
        },
        {
          "id": "ginger-beer",
          "name": "Ginger Beer",
          "description": "Australian Family Owned. Popular Ginger Beer."
        },
        {
          "id": "san-pellegrino-italian-sparkling-drinks",
          "name": "San Pellegrino - Italian Sparkling Drinks",
          "description": "Popular drink from Italy - Made with ingredients from natural origin!"
        },
        {
          "id": "athletic-brewing-co-the-unbeer",
          "name": "Athletic Brewing Co. - The Unbeer!",
          "description": "Non-alcoholic craft brews (under 0.5% ABV) in 12 oz cans, including the Free Wave hazy IPA and Upside Dawn golden ale."
        }
      ],
      "description": "Non-alcoholic."
    }
  ]
}$menu$::jsonb
    from new_brand
    returning id
  )
-- Primary hostname plus the `go.` alias every recent tenant carries (used for
-- QR/short links). `go.<slug>.mysite.social` is two labels deep, so it must be
-- registered as `mysite_multi` — the `template_domains_validate` trigger only
-- lets `<slug>.mysite.social` through when kind = 'mysite_single'.
insert into public.template_domains (hostname, location_id, is_primary, kind)
select h.hostname, l.id, h.is_primary, h.kind
  from new_location l
 cross join (values
   ('taavakitchen.mysite.social',    true,  'mysite_single'),
   ('go.taavakitchen.mysite.social', false, 'mysite_multi')
 ) as h(hostname, is_primary, kind);
