import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Mail, ArrowLeft, CheckCircle, Sun, Moon } from "lucide-react";
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
  email: z.string().email("Enter a valid email address"),
});
type Form = z.infer<typeof schema>;
type SubmitError = string | null;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const navigate   = useNavigate();
  const [mode, setMode]         = React.useState<"light" | "dark">(getInitialMode);
  const [sent, setSent]         = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState("");
  const [submitError, setSubmitError] = React.useState<SubmitError>(null);
  const D = mode === "dark" ? DARK : LIGHT;

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setSubmitError(null);
    try {
      await authApi.forgotPassword(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : "Something went wrong. Please try again.";
      setSubmitError(msg);
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
          aria-label="Toggle theme"
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
            {!sent ? (
              <>
                {/* Header */}
                <div className="mb-8">
                  <div
                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                    style={{ background: D.accentDim }}
                  >
                    <Mail className="h-6 w-6" style={{ color: D.accent }} />
                  </div>
                  <h1 className="text-xl font-bold mb-1" style={{ color: D.white }}>
                    Forgot your password?
                  </h1>
                  <p className="text-sm" style={{ color: D.muted }}>
                    Enter your account email and we'll send you a link to reset your password.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  <div>
                    <label
                      className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                      style={{ color: D.muted }}
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: D.muted }}
                      />
                      <input
                        type="email"
                        placeholder="you@company.com"
                        autoComplete="email"
                        autoFocus
                        {...register("email")}
                        className="w-full h-11 pl-10 pr-4 rounded-lg border text-[13px] outline-none transition-all duration-200"
                        style={{
                          background:  D.inputBg,
                          color:       D.white,
                          borderColor: errors.email ? "#ef4444" : D.inputBorder,
                          boxShadow:   errors.email ? "0 0 0 3px rgba(239,68,68,0.12)" : "none",
                        }}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-[11px]" style={{ color: "#ef4444" }}>
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <div
                      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
                    >
                      <span className="mt-0.5 shrink-0">✕</span>
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                    style={{ background: D.accent, color: "#fff" }}
                  >
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : "Send reset link"}
                  </button>
                </form>

                {/* Back */}
                <div className="mt-6 text-center">
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline"
                    style={{ color: D.muted }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to login
                  </Link>
                </div>
              </>
            ) : (
              /* Success state */
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
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>
                  Password reset link sent!
                </h2>
                <p className="text-sm mb-1" style={{ color: D.muted }}>
                  We sent a password reset link to
                </p>
                <p className="text-sm font-semibold mb-3" style={{ color: D.white }}>
                  {sentEmail}
                </p>
                <p className="text-xs mb-8" style={{ color: D.muted }}>
                  Click the link in the email to reset your password. It expires in 60 minutes.<br />
                  Check your spam folder if you don't see it.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => { setSent(false); }}
                    className="w-full h-10 rounded-lg text-sm font-medium border transition-colors"
                    style={{ borderColor: D.border, color: D.muted, background: D.faint }}
                  >
                    Resend email
                  </button>
                  <Link
                    to="/auth/login"
                    className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition-opacity"
                    style={{ background: D.accent, color: "#fff" }}
                  >
                    Back to login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
