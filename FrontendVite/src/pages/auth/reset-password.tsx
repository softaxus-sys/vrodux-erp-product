import * as React from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/identity/auth.api";
import { ApiError } from "@/lib/api-client";
import { BrandLogo } from "@/components/brand/brand-logo";

// ── Palettes ──────────────────────────────────────────────────────────────────

type Palette = {
  bg: string; panel: string; card: string; border: string; accent: string;
  accentGlow: string; accentDim: string; white: string; muted: string;
  faint: string; inputBg: string; inputBorder: string;
};

const DARK: Palette = {
  bg: "#07090f", panel: "#0b0e17", card: "#10141f", border: "#1c2333",
  accent: "#4f7df3", accentGlow: "rgba(79,125,243,0.22)", accentDim: "rgba(79,125,243,0.12)",
  white: "#f0f4ff", muted: "#64748b", faint: "#1e293b", inputBg: "#0d1121", inputBorder: "#1e2d45",
};

const LIGHT: Palette = {
  bg: "#f4f6fb", panel: "#ffffff", card: "#ffffff", border: "#e2e8f0",
  accent: "#2563eb", accentGlow: "rgba(37,99,235,0.12)", accentDim: "rgba(37,99,235,0.06)",
  white: "#0f172a", muted: "#64748b", faint: "#f1f5f9", inputBg: "#ffffff", inputBorder: "#cbd5e1",
};

const THEME_KEY = "softaxis-theme-mode";

function getInitialMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  newPassword: z.string().min(8, "reset.minLength"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "reset.mismatch",
  path: ["confirmPassword"],
});
type Form = z.infer<typeof schema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate            = useNavigate();
  const [params]            = useSearchParams();
  const [mode, setMode]     = React.useState<"light" | "dark">(getInitialMode);
  const [done, setDone]     = React.useState(false);
  const [showPwd, setShowPwd]   = React.useState(false);
  const [showConf, setShowConf] = React.useState(false);
  const D = mode === "dark" ? DARK : LIGHT;

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const isValidLink = Boolean(token && email);

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    try {
      await authApi.resetPassword(email, token, data.newPassword);
      setDone(true);
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.statusCode === 429 ? t("forgot.throttled") : err.message)
        : t("shared.genericError");
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: D.bg, color: D.white }}>

      {/* Top bar */}
      <div
        className="h-10 flex items-center justify-between px-8 shrink-0 border-b"
        style={{ background: D.panel, borderColor: D.border }}
      >
        <div className="flex items-center gap-2">
          <BrandLogo className="h-5 w-5" />
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: D.muted }}>
            Softaxis ERP
          </span>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          aria-label={t("shared.toggleTheme")}
          className="flex items-center justify-center h-7 w-7 rounded-full border transition-colors"
          style={{ color: D.muted, borderColor: D.border, background: D.faint }}
        >
          {mode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div
            className="rounded-2xl border p-8"
            style={{ background: D.card, borderColor: D.border, boxShadow: `0 0 40px ${D.accentGlow}` }}
          >
            {/* Invalid link */}
            {!isValidLink && (
              <div className="text-center py-4">
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
                  style={{ background: "rgba(239,68,68,0.1)" }}
                >
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>{t("reset.invalidTitle")}</h2>
                <p className="text-sm mb-6" style={{ color: D.muted }}>
                  {t("reset.invalidBody")}
                </p>
                <Link
                  to="/auth/forgot-password"
                  className="inline-flex h-10 px-6 rounded-lg text-sm font-semibold items-center justify-center"
                  style={{ background: D.accent, color: "#fff" }}
                >
                  {t("reset.requestNew")}
                </Link>
              </div>
            )}

            {/* Success */}
            {isValidLink && done && (
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
                  style={{ background: "rgba(34,197,94,0.1)" }}
                >
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </motion.div>
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>{t("reset.doneTitle")}</h2>
                <p className="text-sm mb-8" style={{ color: D.muted }}>
                  {t("reset.doneBody")}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/auth/login")}
                  className="w-full h-11 rounded-lg text-sm font-semibold"
                  style={{ background: D.accent, color: "#fff" }}
                >
                  {t("shared.goToLogin")}
                </button>
              </div>
            )}

            {/* Form */}
            {isValidLink && !done && (
              <>
                <div className="mb-8">
                  <div
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                    style={{ background: D.accentDim }}
                  >
                    <Lock className="h-6 w-6" style={{ color: D.accent }} />
                  </div>
                  <h1 className="text-xl font-bold mb-1" style={{ color: D.white }}>
                    {t("reset.title")}
                  </h1>
                  <p className="text-sm" style={{ color: D.muted }}>
                    <Trans t={t} i18nKey="reset.subtitle" values={{ email }}
                      components={{ s: <span style={{ color: D.white }} /> }} />
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  {/* New password */}
                  <div>
                    <label
                      className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                      style={{ color: D.muted }}
                    >
                      {t("reset.newPassword")}
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: D.muted }}
                      />
                      <input
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••••••"
                        autoComplete="new-password"
                        autoFocus
                        {...register("newPassword")}
                        className="w-full h-11 pl-10 pr-11 rounded-lg border text-[13px] outline-none transition-all duration-200"
                        style={{
                          background:  D.inputBg,
                          color:       D.white,
                          borderColor: errors.newPassword ? "#ef4444" : D.inputBorder,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: D.muted }}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="mt-1.5 text-[11px]" style={{ color: "#ef4444" }}>
                        {t(errors.newPassword.message as string)}
                      </p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label
                      className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                      style={{ color: D.muted }}
                    >
                      {t("reset.confirmPassword")}
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: D.muted }}
                      />
                      <input
                        type={showConf ? "text" : "password"}
                        placeholder="••••••••••••"
                        autoComplete="new-password"
                        {...register("confirmPassword")}
                        className="w-full h-11 pl-10 pr-11 rounded-lg border text-[13px] outline-none transition-all duration-200"
                        style={{
                          background:  D.inputBg,
                          color:       D.white,
                          borderColor: errors.confirmPassword ? "#ef4444" : D.inputBorder,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConf(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: D.muted }}
                      >
                        {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-[11px]" style={{ color: "#ef4444" }}>
                        {t(errors.confirmPassword.message as string)}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                    style={{ background: D.accent, color: "#fff" }}
                  >
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("reset.updating")}</>
                      : t("reset.submit")}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/auth/login"
                    className="text-sm transition-colors hover:underline"
                    style={{ color: D.muted }}
                  >
                    {t("shared.backToLogin")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
