/**
 * Brand palette, extracted directly from the web app's design tokens so the two clients read as
 * one product rather than two skins. Source of truth:
 *   FrontendVite/src/index.css  (`:root` HSL custom properties -- --primary, --success, etc.)
 *   FrontendVite/public/favicon.svg (the #2563eb -> #1e3a8a brand gradient)
 *   FrontendVite/public/vrodux-logo.png (the "V" mark: bright blue -> navy, small accent squares)
 * `--primary: 221.2 83.2% 53.3%` etc. convert to exactly Tailwind's default palette (blue-600,
 * green-600, red-500, amber-600, sky-500, slate-*) -- shadcn/ui's stock "Blue" theme, which is
 * what the web app runs with before any per-tenant palette override. Mobile deliberately does
 * NOT read the tenant's palette override (Module: web ThemeProvider) -- v1 ships one fixed brand
 * look; per-tenant theming is a later pass, flagged in the README, not built here.
 *
 * Light mode only for this pass -- see the README for why dark mode is out of scope.
 */
export const colors = {
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

/** Semantic tone -> {bg, fg} pair, for anything status-driven (badges, banners). */
export type Tone = "success" | "warning" | "destructive" | "info" | "primary" | "neutral";

export const toneColors: Record<Tone, { bg: string; fg: string; dot: string }> = {
  success: { bg: colors.successLight, fg: colors.success, dot: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warning, dot: colors.warning },
  destructive: { bg: colors.destructiveLight, fg: colors.destructive, dot: colors.destructive },
  info: { bg: colors.infoLight, fg: colors.info, dot: colors.info },
  primary: { bg: colors.primaryLight, fg: colors.primaryDark, dot: colors.primary },
  neutral: { bg: colors.muted, fg: colors.mutedForeground, dot: colors.subtleForeground },
};
