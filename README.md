# e-menu — Restaurant Ordering & Kitchen System

A responsive restaurant web application (formerly named BITECRAFT).

## Routes

Customer website: `/`

Chef / kitchen: `/chef`

Administrator: `/admin`

## What is fixed / included

### Customer
- Premium restaurant homepage using the warm burgundy / cream / yellow visual direction from the reference.
- Searchable, filterable menu.
- Dish customization with variants, extras, quantity and per-plate special requirements.
- Persistent cart.
- Checkout with customer name, phone, table selection, general requirements and allergy / dietary notes.
- Server-validated order creation through the Supabase `create_order_secure` RPC.
- Unique order number and private tracking token.
- Live order-status screen at `/order/:token` with polling plus Supabase realtime support.
- Guest reviews with moderation: submitted reviews start as `PENDING` and only approved reviews are public.
- Closed restaurant mode: menu remains visible but ordering is disabled.

### Chef / kitchen
- Protected `/chef` sign-in.
- No public chef registration.
- Orders grouped by active / ready / all.
- Table number, guest name, elapsed time, every ordered plate, modifiers and table notes are visible.
- Status workflow: NEW → CONFIRMED → PREPARING → READY → SERVED, with cancellation for active orders.
- Realtime order refresh via Supabase plus a polling fallback.

### Admin
- Protected `/admin` sign-in.
- Dashboard statistics use actual order/menu data.
- CRUD for menu items, categories, tables, reviews and gallery.
- Menu editor supports price, image, availability, featured / popular flags, preparation time, variants and add-ons.
- Chef account creation is admin-only through a Supabase Edge Function that uses the service role only on the server.
- Chef accounts can be enabled / disabled.
- Order monitoring, customer summaries and review moderation.
- Site content editor for hero, warm CTA band, why-us, about, CTA and footer.
- Visual site editor with section visibility and a live-looking preview; publishing writes the selected settings to Supabase, which the public site reads.
- Restaurant settings: name, contact, address, hours, currency, tax and OPEN / CLOSED state.

## Local demo mode

The app intentionally works without Supabase variables so you can inspect the full UI and workflow locally. Demo data is kept in browser `localStorage`.

Demo admin:
- Email: `jemuvalos@gmail.com`
- Password: any value (demo mode only)

Demo chef:
- Use the chef login page.
- In demo mode any email/password pair can enter the kitchen portal.

This local demo is not an authentication system. Use Supabase for real deployment.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In Supabase **Authentication → Users**, create the administrator user with:
   `jemuvalos@gmail.com`
4. After the user exists, run:

```sql
update public.profiles
set role = 'admin', active = true
where lower(email) = lower('jemuvalos@gmail.com');
```

5. Copy `.env.example` to `.env` and add the project's URL and anon key:

```bash
cp .env.example .env
```

6. For real staff creation, deploy the Edge Function:

```bash
supabase functions deploy create-chef
```

The Edge Function verifies the caller is an active `admin` before using the server-side service role to create a staff user. The service role key must never be placed in Vite frontend environment variables.

7. The SQL migration already adds `orders` to Supabase Realtime when possible. The customer tracking page also polls so it still updates if a Realtime client has a temporary connection problem.

## Storage / images

The current UI accepts image URLs from the admin panel, which keeps the project deployable without requiring a storage bucket setup. You can later add Supabase Storage uploads without changing the database model.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

For Netlify / Vercel:
- Build command: `npm run build`
- Publish directory: `dist`
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

## Important security details

- Guest browsers do not have a direct INSERT policy for `orders` or `order_items`.
- Guest ordering uses `create_order_secure`, which re-reads menu prices, variant prices, add-on prices, tax and table availability on the server.
- Guest order lookup uses a private tracking token rather than exposing all orders.
- Admin / staff data is protected by Supabase Row Level Security.
- Chef account creation uses the Edge Function, not a client-side service-role key.


## Visual website editor

The admin visual editor now includes: live draft preview while typing, clickable section selection inside the preview, Desktop/Tablet/Phone viewport switching, device-specific responsive controls, and a section media library that accepts uploaded photos/videos or remote URLs.

### Website visuals setup

Run the updated `supabase/schema.sql` in the Supabase SQL Editor. It now creates the `site_media` table, the public `site-media` Storage bucket, and the Storage RLS policies required for admin uploads.

In `/admin/site-editor`, select a section, switch to Desktop, Tablet or Phone, then edit the content. Changes appear immediately in the center preview and are only pushed to the public site when you click `PUBLISH CHANGES`.

Uploaded visuals are attached to the selected section. The first active visual for the Hero/About/CTA section is used by the public homepage; visuals added to Gallery are shown in the gallery. Videos are rendered as muted looping visuals for a polished restaurant presentation.


## Branding & uploads

`/admin/branding` (Admin → Branding) controls the website name, logo and four colors (primary, accent, page background, text). The name and logo appear everywhere: public navigation and footer, sign-in pages, kitchen and admin sidebars, the visual editor preview, the browser tab title and the favicon. Colors apply to the whole app, and leaving a color empty keeps the original BITECRAFT look. Changing the name in Settings also updates it everywhere.

Every photo or video upload is limited to **10 MB per file**: the site visual editor (photos and videos), logo, dish, category and gallery images, and the hero image. Pasting a URL is optional. Supabase enforces the same 10 MB limit on the `site-media` bucket.

Re-run the updated `supabase/schema.sql` once: it adds the `brand_theme` column and sets the 10 MB bucket limit. In local demo mode photos are shrunk to fit browser storage, and videos are kept in IndexedDB.

## Deploying on Netlify

`netlify.toml` and `public/_redirects` are included (build `npm run build`, publish `dist`, and all routes rewrite to `index.html` so `/admin`, `/chef` and `/order/...` work on refresh).

1. Push the project to GitHub and import it in Netlify (Add new site → Import from Git).
2. Site configuration → Environment variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then deploy. Without them the site runs in demo mode.
3. In Supabase → Authentication → URL Configuration, set the Site URL to your Netlify address.
