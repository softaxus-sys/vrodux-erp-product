/**
 * Brand palette, extracted directly from the web app's design tokens so the two clients read as
 * one product rather than two skins. Source of truth:
 *   FrontendVite/src/index.css  (`:root` / `.dark` HSL custom properties -- --primary, --success, etc.)
 *   FrontendVite/public/favicon.svg (the #2563eb -> #1e3a8a brand gradient)
 *   FrontendVite/public/vrodux-logo.png (the "V" mark: bright blue -> navy, small accent squares)
 * `--primary: 221.2 83.2% 53.3%` etc. convert to exactly Tailwind's default palette (blue-600,
 * green-600, red-500, amber-600, sky-500, slate-*) -- shadcn/ui's stock "Blue" theme, which is
 * what the web app runs with before any per-tenant palette override. Mobile deliberately does
 * NOT read the tenant's palette override (Module: web ThemeProvider) -- v1 ships one fixed brand
 * look; per-tenant theming is a later pass, flagged in the README, not built here.
 *
 * `darkColors` is converted the same way from index.css's `.dark` block (same HSL -> hex method),
 * not invented separately -- so dark mode reads as the same product's dark mode, not a generic
 * "invert everything" palette. `mutedActive`/`primaryDark`/`primarySoft`/`divider`/`borderLight`
 * have no live consumer yet (checked via grep) but are converted the same way for API symmetry.
 */
export const lightColors = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary: "#2563EB", // blue-600
  primaryDark: "#1E3A8A", // blue-900 -- the gradient's dark end, used for pressed/emphasis states
  primaryLight: "#DBEAFE", // blue-100 -- tinted backgrounds (badges, active chips' halo)
  primarySoft: "#EFF6FF", // blue-50 -- very light wash (selected row, info banners)
  primaryForeground: "#FFFFFF",

  // ── Surfaces ───────────────────────────────────────────────────────────
  background: "#F8FAFC", // slate-50 -- screen background
  card: "#FFFFFF",
  cardMuted: "#F8FAFC",
  border: "#E2E8F0", // slate-200
  borderLight: "#F1F5F9", // slate-100 -- hairlines inside a card (row separators)
  divider: "#EEF2F7",

  // ── Text ───────────────────────────────────────────────────────────────
  foreground: "#0F172A", // slate-900 -- primary text
  foregroundSecondary: "#334155", // slate-700
  mutedForeground: "#64748B", // slate-500 -- secondary text, meta lines
  subtleForeground: "#94A3B8", // slate-400 -- placeholders, disabled
  onPrimary: "#FFFFFF",

  // ── Status (exact hex of --success/--warning/--destructive/--info in index.css) ─────────────
  success: "#16A34A", // green-600
  successLight: "#DCFCE7", // green-100
  successSoft: "#F0FDF4", // green-50
  warning: "#D97706", // amber-600
  warningLight: "#FEF3C7", // amber-100
  warningSoft: "#FFFBEB", // amber-50
  destructive: "#EF4444", // red-500
  destructiveLight: "#FEE2E2", // red-100
  destructiveSoft: "#FEF2F2", // red-50
  info: "#0EA5E9", // sky-500
  infoLight: "#E0F2FE", // sky-100
  infoSoft: "#F0F9FF", // sky-50

  // ── Neutral chips / disabled ─────────────────────────────────────────────
  muted: "#F1F5F9", // slate-100 -- filter-chip / badge background
  mutedActive: "#0F172A", // active filter-chip background
  disabled: "#E2E8F0",

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
} as const;

/** Shape of the palette with widened (non-literal) string values -- `lightColors`/`darkColors`
 *  both satisfy this, but neither's *own* literal type (from `as const`) does the other. */
export type AppColors = { [K in keyof typeof lightColors]: string };

/**
 * `.dark`'s HSL values run through the same hsl->hex conversion as the light palette above.
 * Where index.css has no direct equivalent (the soft/light tint pairs, which only make sense as
 * pastels in light mode), the dark version follows the same idiom this app's badges/banners
 * already use elsewhere: a saturated-900 tint behind saturated-400/500 text, not an inverted pastel.
 */
export const darkColors: AppColors = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary: "#3B82F6", // blue-500 -- index.css .dark --primary
  primaryDark: "#93C5FD", // blue-300 -- reads as *foreground* on `primaryLight` (getToneColors'
  // primary.fg); light-mode's navy fg would be invisible on a dark tinted background, so this
  // flips to a light blue the same way status "light" tints flip to dark-900/text-400 pairs below.
  primaryLight: "#1E3A8A", // blue-900 -- dark-mode "tinted background", not a pastel
  primarySoft: "#172554", // blue-950
  primaryForeground: "#0F172A",

  // ── Surfaces ───────────────────────────────────────────────────────────
  background: "#020817", // index.css .dark --background
  card: "#0B1220", // a touch lighter than background, matching --card's slight elevation
  cardMuted: "#141E33",
  border: "#1E293B", // slate-800 -- index.css .dark --border
  borderLight: "#16213A",
  divider: "#16213A",

  // ── Text ───────────────────────────────────────────────────────────────
  foreground: "#F8FAFC", // index.css .dark --foreground
  foregroundSecondary: "#CBD5E1", // slate-300
  mutedForeground: "#94A3B8", // slate-400 -- index.css .dark --muted-foreground
  subtleForeground: "#64748B", // slate-500
  onPrimary: "#FFFFFF",

  // ── Status ─────────────────────────────────────────────────────────────
  success: "#22C55E", // green-500 -- index.css .dark --success
  successLight: "#14532D", // green-900
  successSoft: "#052E16", // green-950
  warning: "#E89330", // index.css .dark --warning
  warningLight: "#78350F", // amber-900
  warningSoft: "#451A03", // amber-950
  destructive: "#F87171", // red-400 -- brighter than light mode's red-500 for AA contrast on dark bg
  destructiveLight: "#7F1D1D", // red-900
  destructiveSoft: "#450A0A", // red-950
  info: "#38BDF8", // sky-400 -- index.css .dark --info
  infoLight: "#0C4A6E", // sky-900
  infoSoft: "#082F49", // sky-950

  // ── Neutral chips / disabled ─────────────────────────────────────────────
  muted: "#1E293B", // slate-800
  mutedActive: "#F1F5F9", // active chip inverts to a light fill on a dark tray
  disabled: "#334155", // slate-700

  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

/** Kept for any not-yet-migrated call site -- prefer `useAppTheme().colors` in components, since
 *  this is frozen at import time and never reflects the active (possibly dark) scheme. */
export const colors = lightColors;

/** Semantic tone -> {bg, fg, dot} triple, for anything status-driven (badges, banners). Computed
 *  from the active palette at render time -- call inside a component via `useAppTheme()`, not as
 *  a module-level constant, or it freezes on whichever scheme was active at first import. */
export type Tone = "success" | "warning" | "destructive" | "info" | "primary" | "neutral";

export function getToneColors(c: AppColors): Record<Tone, { bg: string; fg: string; dot: string }> {
  return {
    success: { bg: c.successLight, fg: c.success, dot: c.success },
    warning: { bg: c.warningLight, fg: c.warning, dot: c.warning },
    destructive: { bg: c.destructiveLight, fg: c.destructive, dot: c.destructive },
    info: { bg: c.infoLight, fg: c.info, dot: c.info },
    primary: { bg: c.primaryLight, fg: c.primaryDark, dot: c.primary },
    neutral: { bg: c.muted, fg: c.mutedForeground, dot: c.subtleForeground },
  };
}

/** Frozen light-mode tone map -- same caveat as `colors` above. */
export const toneColors = getToneColors(lightColors);
