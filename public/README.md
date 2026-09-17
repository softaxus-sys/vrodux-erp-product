# Static assets

## logo.png

Drop the client's logo here as `logo.png` and it appears in the header
automatically. Until it exists the site renders a typeset wordmark instead of a
broken image.

- **SVG is better than PNG** — the mark renders at several sizes and a small
  raster softens in the header. If you have `logo.svg`, set `LOGO_SRC` in
  `src/lib/brand.ts` to `"/logo.svg"`.
- **The background must be transparent.** The `-Black.jpg` version on the
  client's site has a white background baked in, which shows as a white box.
- Aim for about 380px wide (2x the rendered header size) if supplying a raster.

## logo-light.png (optional)

The standard mark is black type, which is invisible on the dark footer. If the
client has a white or reversed version, add it here and set `LOGO_SRC_DARK` in
`src/lib/brand.ts` to `"/logo-light.png"`.

## properties/<slug>/

Listing photography. See the main README.
