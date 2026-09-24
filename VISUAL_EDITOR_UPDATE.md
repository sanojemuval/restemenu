# BITECRAFT Visual Editor Update

Added:
- True live draft preview while editing.
- Desktop, Tablet and Phone preview modes.
- Device-specific hero typography/height and section spacing.
- Click any section in the preview to edit it.
- Photo/video uploads directly from the browser.
- Remote image/video URL support.
- Section media library with previews and delete actions.
- Hero/about/CTA video and image support on the public homepage.
- Gallery media support for images and videos.
- Supabase `site_media` table and `site-media` storage bucket/policies.
- Stable media ordering per section.

Deployment note:
- Run the updated `supabase/schema.sql` in Supabase.
- Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured.
