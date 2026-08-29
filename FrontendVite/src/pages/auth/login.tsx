import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Loader2, Eye, EyeOff, ArrowRight,
  DollarSign, Users, Package, BarChart3,
  Mail, Lock, ShieldCheck, Globe, Clock, Sun, Moon, MailWarning, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/identity/auth.api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

// ─── Palettes (dark + light) ──────────────────────────────────────────────────

type Palette = {
  bg: string; panel: string; card: string; border: string; accent: string;
  accentGlow: string; accentDim: string; white: string; muted: string;
  faint: string; inputBg: string; inputBorder: string;
};

const DARK: Palette = {
  bg:          "#07090f",
  panel:       "#0b0e17",
  card:        "#10141f",
  border:      "#1c2333",
  accent:      "#4f7df3",          // brand blue
  accentGlow:  "rgba(79,125,243,0.22)",
  accentDim:   "rgba(79,125,243,0.12)",
  white:       "#f0f4ff",          // primary text
  muted:       "#64748b",
  faint:       "#1e293b",
  inputBg:     "#0d1121",
  inputBorder: "#1e2d45",
};

const LIGHT: Palette = {
  bg:          "#f4f6fb",
  panel:       "#ffffff",
  card:        "#ffffff",
  border:      "#e2e8f0",
  accent:      "#2563eb",
  accentGlow:  "rgba(37,99,235,0.12)",
  accentDim:   "rgba(37,99,235,0.06)",
  white:       "#0f172a",          // primary text (dark on light)
  muted:       "#64748b",
  faint:       "#f1f5f9",
  inputBg:     "#ffffff",
  inputBorder: "#cbd5e1",
};

const THEME_KEY = "softaxis-theme-mode";

function getInitialMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// ─── Schema ───────────────────────────────────────────────────────────────────

// Messages are i18n keys (in the "auth" namespace), resolved with t() at render.
const schema = z.object({
  email:    z.string().email("validation.emailInvalid"),
  password: z.string().min(6, "validation.passwordMin"),
  remember: z.boolean().optional(),
});
type Form = z.infer<typeof schema>;

// ─── Top status bar ───────────────────────────────────────────────────────────

const MODULES_STATUS = [
  "Finance", "HR & Payroll", "Inventory", "Sales", "Purchase",
  "CRM", "POS", "Real Estate", "Construction", "Hospitality",
];

function TopBar({ D, mode, onToggle }: { D: Palette; mode: "light" | "dark"; onToggle: () => void }) {
  const { t } = useTranslation("auth");
  return (
    <div
      className="h-10 flex items-center justify-between px-8 shrink-0 border-b"
      style={{ background: D.panel, borderColor: D.border }}
    >
      {/* Module chips — scrolling on small screens */}
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: D.muted }}>
          {t("activeModules")}
        </span>
        <div className="flex items-center gap-2 overflow-hidden">
          {MODULES_STATUS.map(m => (
            <span
              key={m}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-flex"
              style={{ color: D.muted, borderColor: D.border, background: D.faint }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ms-4">
        {/* Language switcher (pre-login) */}
        <LanguageSwitcher variant="full" />

        {/* Theme toggle (persisted) */}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle theme"
          title={mode === "dark" ? t("switchToLight") : t("switchToDark")}
          className="flex items-center justify-center h-7 w-7 rounded-full border transition-colors"
          style={{ color: D.muted, borderColor: D.border, background: D.faint }}
        >
          {mode === "dark"
            ? <Sun  className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* System status */}
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border"
          style={{ color: "#22c55e", borderColor: "#22c55e30", background: "#22c55e10" }}
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-green-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          {t("allSystemsOperational")}
        </div>
      </div>
    </div>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: DollarSign, color: "#4f7df3", titleKey: "feature.financeTitle",   descKey: "feature.financeDesc" },
  { icon: Users,      color: "#8b5cf6", titleKey: "feature.hrTitle",        descKey: "feature.hrDesc" },
  { icon: Package,    color: "#f59e0b", titleKey: "feature.inventoryTitle", descKey: "feature.inventoryDesc" },
  { icon: BarChart3,  color: "#22c55e", titleKey: "feature.analyticsTitle", descKey: "feature.analyticsDesc" },
];

const COMPLIANCE_TAGS = [
  "compliance.rbac",
  "compliance.auditTrail",
  "compliance.multiCurrency",
  "compliance.uaeVat",
];

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "greeting.morning" : h < 17 ? "greeting.afternoon" : "greeting.evening";
}

// ─── Login page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate     = useNavigate();
  const { t } = useTranslation("auth");
  const { loginFromApi } = useAuthStore();
  const [showPwd, setShowPwd] = React.useState(false);
  const [focus,   setFocus]   = React.useState<string | null>(null);

  // Theme: persisted per-browser so a returning user lands on their last choice.
  const [mode, setMode] = React.useState<"light" | "dark">(getInitialMode);
  const D = mode === "dark" ? DARK : LIGHT;
  const toggleTheme = () => setMode(prev => {
    const next = prev === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    return next;
  });

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const [mfaToken, setMfaToken]   = React.useState<string | null>(null);
  const [mfaCode, setMfaCode]     = React.useState("");
  const [verifying, setVerifying] = React.useState(false);

  // An unverified account is a state to resolve, not a transient error: it needs a persistent
  // panel with room to explain and a real button, not a toast that vanishes in eight seconds.
  const [unverified, setUnverified] = React.useState<string | null>(null);
  const [resendState, setResendState] = React.useState<"idle" | "sending" | "sent">("idle");

  const resendVerification = async () => {
    if (!unverified) return;
    setResendState("sending");
    try {
      await authApi.resendVerification(unverified);
      setResendState("sent");
    } catch {
      setResendState("idle");
      toast.error(t("toast.verificationFailed"));
    }
  };

  const onSubmit = async (data: Form) => {
    setUnverified(null);
    try {
      const res = await authApi.login(data.email, data.password);
      // Account has 2FA enabled → switch to the code-entry step instead of signing in.
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken);
        setMfaCode("");
        return;
      }
      loginFromApi(res.accessToken, res.refreshToken, res.user!);
      toast.success(t("toast.welcomeBack", { name: res.user!.firstName }));
      // The tenant requires 2FA and this account has none. Send them straight to the page that
      // sets it up rather than letting them discover the requirement later. (A user who already
      // has 2FA never reaches here — they went down the code-entry path above.)
      if (res.mustSetUpTwoFactor) {
        toast.warning(t("toast.mustSetUpTwoFactor", {
          defaultValue: "Your organisation requires two-factor authentication. Please set it up now.",
        }), { duration: 8000 });
        navigate("/settings/security", { replace: true });
        return;
      }
      if (res.user?.mustChangePassword) {
        // Administrator-issued password: land on the page that can replace it, and say why.
        toast.warning(t("toast.mustChangePassword"));
        navigate("/profile", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      // ApiError = server responded with an error envelope → show its message.
      // Anything else (TypeError: Failed to fetch, etc.) = couldn't reach server.
      if (!(err instanceof ApiError)) {
        toast.error(t("toast.unreachable"));
        return;
      }

      const msg = err.message || t("toast.invalidCredentials");
      // Unverified account → show the inline panel instead of a toast, and say nothing else:
      // the panel carries the explanation and the resend button.
      if (msg.toLowerCase().includes("verify your email")) {
        setUnverified(data.email);
        setResendState("idle");
        return;
      }

      toast.error(msg);
    }
  };

  const onVerify2fa = async () => {
    if (!mfaToken) return;
    setVerifying(true);
    try {
      const res = await authApi.verifyTwoFactor(mfaToken, mfaCode.trim());
      loginFromApi(res.accessToken, res.refreshToken, res.user!);
      toast.success(t("toast.welcomeBack", { name: res.user!.firstName }));
      if (res.user?.mustChangePassword) {
        // Administrator-issued password: land on the page that can replace it, and say why.
        toast.warning(t("toast.mustChangePassword"));
        navigate("/profile", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toast.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: D.bg }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <TopBar D={D} mode={mode} onToggle={toggleTheme} />

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════════════════════════════════════════════════════
            LEFT — value proposition
        ════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col flex-1 px-14 pt-14 pb-10 relative overflow-hidden">

          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(${D.border}55 1px, transparent 1px),
                linear-gradient(90deg, ${D.border}55 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
              opacity: 0.4,
            }}
          />

          {/* Soft glow */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(ellipse, ${D.accentGlow} 0%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />

          <div className="relative z-10 flex flex-col h-full">

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3"
            >
              <BrandLogo height={40} subtitle="Enterprise Platform" plate />
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-14"
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4"
                style={{ color: D.accent }}
              >
                {t("erpTag")}
              </p>
              <h1
                className="text-[2.5rem] font-extrabold leading-[1.08] tracking-tight"
                style={{ color: D.white }}
              >
                {t("headlineBefore")}
                <span style={{ color: D.accent }}>{t("headlineHighlight")}</span>
                {t("headlineAfter")}
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed max-w-[440px]" style={{ color: D.muted }}>
                {t("subhead")}
              </p>

              {/* Enterprise metrics band — reads like an ERP system overview */}
              <div
                className="grid grid-cols-4 gap-px mt-8 rounded-xl overflow-hidden border"
                style={{ borderColor: D.border, background: D.border }}
              >
                {[
                  { value: "13", label: t("metric.modules") },
                  { value: "6",  label: t("metric.industries") },
                  { value: t("metric.tenantValue"), label: t("metric.tenant") },
                  { value: "99.9%", label: t("metric.uptime") },
                ].map(s => (
                  <div key={s.label} className="px-3 py-3 text-center" style={{ background: D.card }}>
                    <p className="text-[20px] font-extrabold leading-none" style={{ color: D.white }}>{s.value}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider mt-1.5" style={{ color: D.muted }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Feature cards 2 × 2 */}
            <div className="grid grid-cols-2 gap-3 mt-10">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.titleKey}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.22 + i * 0.07 }}
                  className="rounded-xl border p-4 flex gap-3 transition-all duration-200 cursor-default"
                  style={{ background: D.card, borderColor: D.border }}
                  whileHover={{ borderColor: f.color + "50", boxShadow: `0 0 0 1px ${f.color}20` }}
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: f.color + "18" }}
                  >
                    <f.icon className="h-4 w-4" style={{ color: f.color }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: D.white }}>
                      {t(f.titleKey)}
                    </p>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: D.muted }}>
                      {t(f.descKey)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Compliance tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-2 mt-5"
            >
              {COMPLIANCE_TAGS.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full border"
                  style={{ color: D.muted, borderColor: D.border, background: D.faint }}
                >
                  <ShieldCheck className="h-3 w-3" style={{ color: D.accent }} />
                  {t(tag)}
                </span>
              ))}
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-auto pt-6 flex items-center justify-between border-t"
              style={{ borderColor: D.border }}
            >
              <p className="text-[11px]" style={{ color: D.muted + "60" }}>
                {t("footer.copyright")}
              </p>
              <div className="flex items-center gap-4">
                {[
                  { icon: Globe,       text: t("footer.multiCurrency") },
                  { icon: Clock,       text: t("footer.uptime")   },
                  { icon: ShieldCheck, text: t("footer.soc2")    },
                ].map(b => (
                  <div key={b.text} className="flex items-center gap-1.5" style={{ color: D.muted + "60" }}>
                    <b.icon className="h-3 w-3" />
                    <span className="text-[11px]">{b.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT — login form
        ════════════════════════════════════════════════════════ */}
        <div
          className="flex items-center justify-center p-6 sm:p-10 w-full lg:flex-1"
          style={{ background: D.bg }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="relative w-full max-w-[460px] rounded-2xl border p-8 sm:p-10 overflow-hidden"
            style={{
              background:  D.card,
              borderColor: D.border,
              boxShadow:   "0 30px 70px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02)",
            }}
          >
            {/* Top accent glow */}
            <div
              className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-40 w-[85%] rounded-full"
              style={{ background: `radial-gradient(ellipse at top, ${D.accentGlow} 0%, transparent 70%)`, filter: "blur(8px)" }}
            />

            <div className="relative">

            {/* Logo inside card */}
            <div className="mb-6">
              <BrandLogo height={34} subtitle="Enterprise Platform" plate />
            </div>

            {mfaToken ? (
            <div className="space-y-5">
              <div className="mb-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: D.accentGlow }}>
                  <ShieldCheck className="h-5 w-5" style={{ color: D.accent }} />
                </div>
                <h2 className="text-[1.6rem] font-bold tracking-tight" style={{ color: D.white }}>
                  {t("mfa.title")}
                </h2>
                <p className="text-[13px] mt-1" style={{ color: D.muted }}>
                  {t("mfa.subtitle")}
                </p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); onVerify2fa(); }} className="space-y-5">
                <input
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full h-12 rounded-lg px-4 text-center text-lg font-semibold tracking-[0.35em] outline-none border"
                  style={{ background: D.inputBg, borderColor: D.inputBorder, color: D.white }}
                />
                <motion.button
                  type="submit"
                  disabled={verifying || mfaCode.trim().length < 6}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="w-full h-12 rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: D.accent, color: "#fff", boxShadow: `0 4px 20px ${D.accentGlow}` }}
                >
                  {verifying ? (<><Loader2 className="h-4 w-4 animate-spin" />{t("mfa.verifying")}</>) : (<>{t("mfa.verify")}<ArrowRight className="h-4 w-4" /></>)}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setMfaToken(null); setMfaCode(""); }}
                  className="w-full text-center text-[12px] hover:underline"
                  style={{ color: D.muted }}
                >
                  {t("mfa.back")}
                </button>
              </form>
            </div>
            ) : (
            <>
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-[1.6rem] font-bold tracking-tight" style={{ color: D.white }}>
                {t("form.title")}
              </h2>
              <p className="text-[13px] mt-1" style={{ color: D.muted }}>
                {t(greetingKey())} {t("greeting.suffix")}
              </p>
            </div>

            {/* Unverified-account notice */}
            {unverified && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="mb-5 rounded-xl border p-4"
                style={{
                  borderColor: resendState === "sent" ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)",
                  background:  resendState === "sent" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {resendState === "sent"
                      ? <CheckCircle2 className="h-4 w-4" style={{ color: "#22c55e" }} />
                      : <MailWarning className="h-4 w-4" style={{ color: "#f59e0b" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: D.white }}>
                      {resendState === "sent" ? t("verify.sentTitle") : t("verify.title")}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: D.muted }}>
                      {resendState === "sent"
                        ? t("verify.sentBody", { email: unverified })
                        : t("verify.body", { email: unverified })}
                    </p>

                    {resendState !== "sent" && (
                      <button
                        type="button"
                        onClick={resendVerification}
                        disabled={resendState === "sending"}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-opacity disabled:opacity-60"
                        style={{ background: D.accent, color: "#fff" }}
                      >
                        {resendState === "sending" ? t("verify.sending") : t("verify.resend")}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                  style={{ color: D.muted }}
                >
                  {t("form.emailLabel")}
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200"
                    style={{ color: focus === "email" ? D.accent : D.muted }}
                  />
                  <input
                    type="email"
                    placeholder={t("form.emailPlaceholder")}
                    autoComplete="email"
                    autoFocus
                    {...register("email")}
                    onFocus={() => setFocus("email")}
                    onBlur={()  => setFocus(null)}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border text-[13px] outline-none transition-all duration-200"
                    style={{
                      background:  D.inputBg,
                      color:       D.white,
                      borderColor: focus === "email"
                        ? D.accent
                        : errors.email ? "#ef4444" : D.inputBorder,
                      boxShadow: focus === "email"
                        ? `0 0 0 3px ${D.accentDim}`
                        : errors.email ? "0 0 0 3px rgba(239,68,68,0.12)" : "none",
                    }}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1.5">{t(errors.email.message as string)}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: D.muted }}
                  >
                    {t("form.passwordLabel")}
                  </label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-[11px] font-medium transition-colors hover:underline"
                    style={{ color: D.accent }}
                  >
                    {t("form.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200"
                    style={{ color: focus === "password" ? D.accent : D.muted }}
                  />
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                    onFocus={() => setFocus("password")}
                    onBlur={()  => setFocus(null)}
                    className="w-full h-11 pl-10 pr-11 rounded-lg border text-[13px] outline-none transition-all duration-200"
                    style={{
                      background:  D.inputBg,
                      color:       D.white,
                      borderColor: focus === "password"
                        ? D.accent
                        : errors.password ? "#ef4444" : D.inputBorder,
                      boxShadow: focus === "password"
                        ? `0 0 0 3px ${D.accentDim}`
                        : errors.password ? "0 0 0 3px rgba(239,68,68,0.12)" : "none",
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: D.muted }}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1.5">{t(errors.password.message as string)}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={watch("remember") ?? false}
                  onChange={e => setValue("remember", e.target.checked)}
                  className="h-3.5 w-3.5 rounded cursor-pointer"
                  style={{ accentColor: D.accent }}
                />
                <span className="text-[12px]" style={{ color: D.muted }}>
                  {t("form.rememberMe")}
                </span>
              </label>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={{ scale: 1.015, boxShadow: `0 8px 32px ${D.accentGlow}` }}
                whileTap={{ scale: 0.985 }}
                className="w-full h-12 rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{
                  background: D.accent,
                  color:      "#fff",
                  boxShadow:  `0 4px 20px ${D.accentGlow}`,
                }}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("form.signingIn")}</>
                ) : (
                  <>
                    {t("form.signIn")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Security note */}
            <p
              className="text-center text-[11px] mt-5 leading-relaxed"
              style={{ color: D.muted + "70" }}
            >
              {t("form.securityNote1")}
              <br />
              {t("form.securityNote2")}
            </p>

            {/* Trial CTA */}
            <p className="text-center text-[12px] mt-3" style={{ color: D.muted }}>
              {t("form.noAccount")}{" "}
              <Link
                to="/trial"
                className="font-semibold hover:underline"
                style={{ color: D.accent }}
              >
                {t("form.startTrial")}
              </Link>
            </p>
            </>
            )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
