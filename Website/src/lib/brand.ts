/**
 * Single source of truth for the client's visual identity.
 *
 * Values taken from the client's existing site (WordPress / Kadence global
 * palette). Re-skinning means editing this file and the matching CSS variables
 * in globals.css — not hunting through components.
 */

/**
 * Path to the client's logo inside /public.
 * null falls back to a typeset wordmark built from the brand name.
 *
 * The client's mark exists as:
 *   - cropped-leading-properties-logo.png  (colour, for light backgrounds)
 *   - Leading-Properties-Logo-Black.jpg    (black, for light backgrounds)
 * Ask the client for the original SVG or a transparent PNG at 2x header width —
 * the JPG cannot be used over a coloured background because it has no
 * transparency, and the logo renders at three sizes across the site.
 */
export const LOGO_SRC: string | null = null;

/** Logo for dark backgrounds (the footer). Falls back to LOGO_SRC. */
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
