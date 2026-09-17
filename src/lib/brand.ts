/**
 * Single source of truth for the client's visual identity.
 *
 * Everything brand-specific lives here and in the matching CSS variables in
 * globals.css. Re-skinning the site means editing these two places, not hunting
 * through components.
 */

/**
 * Path to the client's logo inside /public.
 * Set to null to fall back to a typeset wordmark built from the brand name.
 *
 * SVG is strongly preferred — the logo renders at three sizes across the site
 * (header, footer, print) and a raster mark will soften at the largest of them.
 */
export const LOGO_SRC: string | null = null;

/** Logo file for use on dark backgrounds (the footer). Falls back to LOGO_SRC. */
export const LOGO_SRC_DARK: string | null = null;

/** Rendered width of the logo in the header, in pixels. Height scales automatically. */
export const LOGO_WIDTH = 160;

/**
 * Brand colours.
 *
 * These are duplicated as CSS custom properties in globals.css because Tailwind
 * needs them at build time while the raw values are occasionally needed at
 * runtime (inline gradients, the SVG placeholder panels). Keep the two in step.
 */
export const BRAND = {
  /** Primary — headers, primary buttons, dark sections. */
  primary: "#1a1918",
  primaryDark: "#0f0e0d",
  /** Accent — call-to-action buttons, eyebrow text, underlines. */
  accent: "#b78a4f",
  accentSoft: "#d7bf96",
  /** Page background and body text. */
  background: "#f6f6f5",
  text: "#1a1918",
  textMuted: "#6a6860",
} as const;
