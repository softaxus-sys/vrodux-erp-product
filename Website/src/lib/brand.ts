/**
 * Single source of truth for the client's visual identity.
 *
 * Values taken from the client's existing site (WordPress / Kadence global
 * palette). Re-skinning means editing this file and the matching CSS variables
 * in globals.css — not hunting through components.
 */

/**
 * The client's logo, served from /public.
 *
 * Drop the file in as Website/public/logo.png (or .svg) and it appears
 * automatically — no code change needed. If the file is absent the Logo
 * component falls back to a typeset wordmark rather than a broken image.
 *
 * Prefer the original SVG: the mark renders at several sizes across the site
 * and a small raster will soften in the header. Failing that, a PNG with a
 * transparent background at roughly 2x the header width (about 380px).
 */
export const LOGO_SRC: string | null = "/logo.png";

/**
 * Logo for dark backgrounds (the footer). The client's standard mark is black
 * type, which disappears on the dark footer — so supply a white/reversed
 * version here as /public/logo-light.png. Until then the footer falls back to
 * the wordmark, which stays legible.
 */
export const LOGO_SRC_DARK: string | null = null;

/** Rendered logo width in the header, in pixels. Height scales automatically. */
export const LOGO_WIDTH = 190;

/**
 * Brand colours, matching the client's existing palette.
 *
 * Duplicated as CSS custom properties in globals.css: Tailwind needs them at
 * build time, while the raw values are occasionally needed at runtime (inline
 * gradients, the listing placeholder panels). Keep the two in step.
 */
export const BRAND = {
  /** Brand red — primary calls to action, accents, active states. */
  accent: "#E5262B",
  accentHover: "#C81F24",
  /** Near-black — headers, dark sections, primary buttons. */
  primary: "#1A202C",
  primaryDark: "#12161F",
  /** Neutrals. */
  text: "#1A202C",
  textMuted: "#4A5568",
  background: "#FFFFFF",
  backgroundAlt: "#EDF2F7",
} as const;
