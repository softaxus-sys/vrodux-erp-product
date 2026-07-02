import * as React from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, MailCheck, CheckCircle, AlertCircle, Sun, Moon } from "lucide-react";
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

// ── Component ─────────────────────────────────────────────────────────────────

type State = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const navigate            = useNavigate();
  const [params]            = useSearchParams();
  const [mode, setMode]     = React.useState<"light" | "dark">(getInitialMode);
  const [state, setState]   = React.useState<State>("verifying");
  const [errorMsg, setErrorMsg]   = React.useState("This verification link is invalid or has expired.");
  const [resending, setResending] = React.useState(false);
  const D = mode === "dark" ? DARK : LIGHT;

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem(THEME_KEY, next);
  };

  // Auto-verify on mount using the token + email from the link.
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token || !email) {
      setErrorMsg("This link is missing required parameters.");
      setState("error");
      return;
    }

    authApi.verifyEmail(email, token)
      .then(() => setState("success"))
      .catch((err) => {
        setErrorMsg(err instanceof ApiError ? err.message : "This verification link is invalid or has expired.");
        setState("error");
      });
  }, [token, email]);

  const handleResend = async () => {
    if (!email) {
      toast.error("No email address to resend to.");
      return;
    }
    setResending(true);
    try {
      await authApi.resendVerification(email);
      toast.success("If the account exists and is unverified, a new link has been sent.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send the verification email.");
    } finally {
      setResending(false);
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
            {/* Verifying */}
            {state === "verifying" && (
              <div className="text-center py-4">
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
                  style={{ background: D.accentDim }}
                >
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: D.accent }} />
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>Verifying your email…</h2>
                <p className="text-sm" style={{ color: D.muted }}>
                  This will only take a moment.
                </p>
              </div>
            )}

            {/* Success */}
            {state === "success" && (
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
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>Email verified!</h2>
                <p className="text-sm mb-8" style={{ color: D.muted }}>
                  Your account is now active. You can log in and start using Softaxis ERP.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/auth/login")}
                  className="w-full h-11 rounded-lg text-sm font-semibold"
                  style={{ background: D.accent, color: "#fff" }}
                >
                  Go to login
                </button>
              </div>
            )}

            {/* Error */}
            {state === "error" && (
              <div className="text-center py-4">
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-5"
                  style={{ background: "rgba(239,68,68,0.1)" }}
                >
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: D.white }}>Verification failed</h2>
                <p className="text-sm mb-6" style={{ color: D.muted }}>
                  {errorMsg}
                </p>
                {email && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 mb-3"
                    style={{ background: D.accent, color: "#fff" }}
                  >
                    {resending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><MailCheck className="h-4 w-4" /> Resend verification link</>}
                  </button>
                )}
                <Link
                  to="/auth/login"
                  className="text-sm transition-colors hover:underline"
                  style={{ color: D.muted }}
                >
                  Back to login
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
