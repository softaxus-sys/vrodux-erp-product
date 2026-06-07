import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  Loader2, Eye, EyeOff, ArrowRight,
  DollarSign, Users, Package, BarChart3,
  Mail, Lock, ShieldCheck, Globe, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/identity/auth.api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";

// ─── Fixed dark palette (never inherits theme) ────────────────────────────────

const D = {
  bg:          "#07090f",
  panel:       "#0b0e17",
  card:        "#10141f",
  border:      "#1c2333",
  accent:      "#4f7df3",          // brand blue
  accentGlow:  "rgba(79,125,243,0.22)",
  accentDim:   "rgba(79,125,243,0.12)",
  white:       "#f0f4ff",
  muted:       "#64748b",
  faint:       "#1e293b",
  inputBg:     "#0d1121",
  inputBorder: "#1e2d45",
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Minimum 6 characters"),
  remember: z.boolean().optional(),
});
type Form = z.infer<typeof schema>;

// ─── Top status bar ───────────────────────────────────────────────────────────

const MODULES_STATUS = [
  "Finance", "HR & Payroll", "Inventory", "Sales", "Purchase",
  "CRM", "POS", "Real Estate", "Construction", "Hospitality",
];

function TopBar() {
  return (
    <div
      className="h-10 flex items-center justify-between px-8 shrink-0 border-b"
      style={{ background: D.panel, borderColor: D.border }}
    >
      {/* Module chips — scrolling on small screens */}
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: D.muted }}>
          Active Modules
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

      {/* System status */}
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ml-4 px-3 py-1 rounded-full border"
        style={{ color: "#22c55e", borderColor: "#22c55e30", background: "#22c55e10" }}
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-green-500"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        All systems operational
      </div>
    </div>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon:  DollarSign,
    color: "#4f7df3",
    title: "Finance & Accounting",
    desc:  "General ledger, invoicing, tax, budgeting, and bank reconciliation in one place.",
  },
  {
    icon:  Users,
    color: "#8b5cf6",
    title: "HR & Payroll",
    desc:  "Employee records, attendance tracking, leave management, and automated payroll.",
  },
  {
    icon:  Package,
    color: "#f59e0b",
    title: "Inventory & Procurement",
    desc:  "Multi-warehouse stock control, purchase orders, and vendor management.",
  },
  {
    icon:  BarChart3,
    color: "#22c55e",
    title: "Analytics & Reporting",
    desc:  "Real-time KPI dashboards and cross-module reports for data-driven decisions.",
  },
];

const COMPLIANCE_TAGS = [
  "Role-based access control",
  "Full audit trail",
  "Multi-currency support",
  "UAE VAT compliant",
];

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ─── Login page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate     = useNavigate();
  const { loginFromApi } = useAuthStore();
  const [showPwd, setShowPwd] = React.useState(false);
  const [focus,   setFocus]   = React.useState<string | null>(null);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const fillDemo = () => {
    setValue("email",    "admin@softaxis.io", { shouldValidate: true });
    setValue("password", "Admin@123456",      { shouldValidate: true });
  };

  const onSubmit = async (data: Form) => {
    try {
      const res = await authApi.login(data.email, data.password);
      loginFromApi(res.accessToken, res.refreshToken, res.user);
      toast.success(`Welcome back, ${res.user.firstName}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      // ApiError = server responded with an error envelope → show its message.
      // Anything else (TypeError: Failed to fetch, etc.) = couldn't reach server.
      toast.error(
        err instanceof ApiError
          ? (err.message || "Invalid email or password.")
          : "Unable to reach server. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: D.bg }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <TopBar />

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
                Unified Business Management
              </p>
              <h1
                className="text-[2.6rem] font-extrabold leading-[1.07] tracking-tight"
                style={{ color: D.white }}
              >
                The Digital Axis of<br />
                <span style={{ color: D.accent }}>Your Enterprise.</span>
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed max-w-[420px]" style={{ color: D.muted }}>
                Finance, HR, procurement, inventory, sales, and 8+ industry
                verticals — managed from a single, permission-controlled workspace.
              </p>
            </motion.div>

            {/* Feature cards 2 × 2 */}
            <div className="grid grid-cols-2 gap-3 mt-10">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
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
                      {f.title}
                    </p>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: D.muted }}>
                      {f.desc}
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
                  {tag}
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
                © 2026 Vrodux Technologies LLC · All rights reserved
              </p>
              <div className="flex items-center gap-4">
                {[
                  { icon: Globe,       text: "Multi-currency" },
                  { icon: Clock,       text: "99.9% Uptime"   },
                  { icon: ShieldCheck, text: "SOC 2 Ready"    },
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
          className="flex items-center justify-center p-8 shrink-0 w-full lg:w-[400px] xl:w-[420px]"
          style={{ background: D.panel, borderLeft: `1px solid ${D.border}` }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            className="w-full max-w-[340px]"
          >

            {/* Mobile logo */}
            <div className="lg:hidden mb-8">
              <BrandLogo height={36} subtitle="Enterprise Platform" plate />
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-[1.6rem] font-bold tracking-tight" style={{ color: D.white }}>
                Welcome back
              </h2>
              <p className="text-[13px] mt-1" style={{ color: D.muted }}>
                {greeting()} — sign in to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-[0.14em] mb-2"
                  style={{ color: D.muted }}
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-colors duration-200"
                    style={{ color: focus === "email" ? D.accent : D.muted }}
                  />
                  <input
                    type="email"
                    placeholder="you@company.com"
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
                  <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: D.muted }}
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-[11px] font-medium transition-colors hover:underline"
                    style={{ color: D.accent }}
                  >
                    Forgot password?
                  </button>
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
                  <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
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
                  Keep me signed in for 30 days
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
                  <><Loader2 className="h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  <>
                    Sign in
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
              Access is restricted to authorised personnel only.
              <br />
              Unauthorised use is strictly prohibited.
            </p>

            {/* Demo credentials */}
            <div
              className="mt-5 rounded-lg border px-4 py-3 flex items-center justify-between"
              style={{ background: D.card, borderColor: D.border }}
            >
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: D.muted + "60" }}
                >
                  Demo
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] truncate" style={{ color: D.muted }}>
                    admin@softaxis.io
                  </code>
                  <span style={{ color: D.border }}>·</span>
                  <code className="text-[11px] shrink-0" style={{ color: D.muted }}>
                    Admin@123456
                  </code>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={fillDemo}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="shrink-0 ml-3 text-[11px] font-bold hover:underline transition-colors"
                style={{ color: D.accent }}
              >
                Fill ↗
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
