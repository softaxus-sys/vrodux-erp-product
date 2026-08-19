import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Eye, EyeOff, Check, Sun, Moon, ArrowRight, ArrowLeft,
  ChevronDown, Search, X, Clock, AlertCircle, Info, Sparkles,
  Shield, Zap, Users2, BarChart2, HeadphonesIcon, Building2, Globe,
  ShieldCheck, Users, ListChecks, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/brand-logo";
import { COUNTRIES, INDUSTRIES, LANGUAGES, FISCAL_YEARS, getUtcOffset, detectCountry, type CountryMeta } from "@/lib/onboarding/geo-data";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { MODULES, BUSINESS_TYPES, MODULE_CATEGORIES, resolveModules, needsBusinessType, moduleLabel, moduleDesc, moduleCategoryLabel, businessTypeLabel, type ModuleId, type ModuleDef } from "@/lib/onboarding/module-data";
import { registerTrial, type TrialRegistrationRequest } from "@/lib/onboarding/trial.api";
import { useSignupAttribution, clearSignupAttribution } from "@/hooks/use-signup-attribution";
import { getPlan, amountFor, formatUsd } from "@/lib/billing/plans";
import { authApi } from "@/lib/identity/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { ApiError } from "@/lib/api-client";

// ── Palette (identical to login.tsx) ─────────────────────────────────────────

type P = { bg: string; panel: string; card: string; border: string; accent: string; accentGlow: string; accentDim: string; white: string; muted: string; faint: string; inputBg: string; inputBorder: string };

const DARK: P  = { bg:"#07090f", panel:"#0b0e17", card:"#10141f", border:"#1c2333", accent:"#4f7df3", accentGlow:"rgba(79,125,243,0.22)", accentDim:"rgba(79,125,243,0.12)", white:"#f0f4ff", muted:"#64748b", faint:"#1e293b", inputBg:"#0d1121", inputBorder:"#1e2d45" };
const LIGHT: P = { bg:"#f4f6fb", panel:"#ffffff",  card:"#ffffff",  border:"#e2e8f0", accent:"#2563eb", accentGlow:"rgba(37,99,235,0.12)",  accentDim:"rgba(37,99,235,0.06)",  white:"#0f172a", muted:"#64748b", faint:"#f1f5f9", inputBg:"#ffffff", inputBorder:"#cbd5e1" };

// Theme is shared with the auth pages (login / forgot / reset password) via this localStorage key
const THEME_KEY = "softaxis-theme-mode";

function getInitialMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// ── Industry → modules ────────────────────────────────────────────────────────

const INDUSTRY_MODULES: Record<string, ModuleId[]> = {
  "All Industries":           ["pos","inventory","sales","purchase","finance","hr","crm","hospitality","real-estate","construction","healthcare","education"],
  "Retail & E-Commerce":      ["pos","inventory","sales","crm","finance"],
  "Real Estate":              ["real-estate","crm","finance"],
  "Construction":             ["construction","purchase","hr","finance"],
  "Hospitality & Tourism":    ["hospitality","pos","hr","finance"],
  "Healthcare":               ["healthcare","hr","finance"],
  "Education":                ["education","hr","finance"],
  "Manufacturing":            ["inventory","purchase","hr","finance"],
  "Finance & Banking":        ["finance","hr","crm"],
  "Logistics & Supply Chain": ["inventory","purchase","hr"],
  "Food & Beverage":          ["pos","inventory","purchase","hr"],
  "Technology & IT":          ["crm","sales","hr","finance"],
  "Wholesale & Distribution": ["inventory","purchase","sales","finance"],
  "Professional Services":    ["crm","sales","hr","finance"],
  "Agriculture":              ["inventory","purchase","finance"],
  "Other":                    [],
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const s1Schema = z.object({
  fullName:    z.string().min(2,"validation.min2"),
  companyName: z.string().min(2,"validation.companyRequired"),
  workEmail:   z.string().email("validation.validEmail"),
  password:    z.string().min(8,"validation.min8").regex(/[A-Z]/,"validation.needsUpper").regex(/[0-9]/,"validation.needsNumber"),
  confirm:     z.string(),
  agree:       z.literal(true,{ errorMap:()=>({ message:"validation.acceptTerms" }) }),
}).refine(d=>d.password===d.confirm,{ message:"validation.passwordMismatch", path:["confirm"] });

const s2Schema = z.object({
  orgName:z.string().min(2,"validation.required"), industry:z.string().min(1,"validation.required"), country:z.string().min(1,"validation.required"), state:z.string().optional(),
  currency:z.string().min(1,"validation.required"), language:z.string().min(1,"validation.required"), timezone:z.string().min(1,"validation.required"),
  startDate:z.string().min(1,"validation.required"), fiscalYear:z.string().min(1,"validation.required"),
});

type S1 = z.infer<typeof s1Schema>;
type S2 = z.infer<typeof s2Schema>;

const STEP_META = [
  { key:"s1" }, { key:"s2" }, { key:"s3" }, { key:"s4" },
];

// ── Shared styling helpers ────────────────────────────────────────────────────

function iStyle(D:P, focused:boolean, err?:boolean): React.CSSProperties {
  return {
    background: D.inputBg, color: D.white,
    borderColor: err?"#ef4444": focused?D.accent: D.inputBorder,
    boxShadow: err?"0 0 0 3px rgba(239,68,68,0.12)": focused?`0 0 0 3px ${D.accentDim}`:"none",
  };
}

const INPUT_CLS = "w-full h-11 px-4 rounded-lg border text-[13px] outline-none transition-all duration-200 placeholder:opacity-40";

function Lbl({ D, children, req, err }: { D:P; children:React.ReactNode; req?:boolean; err?:string }) {
  const { t } = useTranslation("onboarding");
  // zod messages are declared at module scope, so they carry a translation KEY;
  // defaultValue lets any non-key message (e.g. from the API) pass straight through.
  const errText = err ? t(err, { defaultValue: err }) : undefined;
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color:D.muted }}>
        {children}{req&&<span className="text-red-400 ml-0.5">*</span>}
      </label>
      {errText&&<p className="flex items-center gap-1 text-[11px] text-red-400"><AlertCircle className="h-3 w-3 shrink-0"/>{errText}</p>}
    </div>
  );
}

function PwBar({ pw }: { pw:string }) {
  const { t } = useTranslation("onboarding");
  const s=[pw.length>=8,/[A-Z]/.test(pw),/[0-9]/.test(pw),/[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  // c[0] is a placeholder — any non-empty password shows at least "Weak" (c[1])
  const c=[null,{b:"#ef4444",t:"#ef4444",k:"weak"},{b:"#f59e0b",t:"#f59e0b",k:"fair"},{b:"#3b82f6",t:"#3b82f6",k:"good"},{b:"#22c55e",t:"#22c55e",k:"strong"}];
  if(!pw)return null;
  const ci = c[Math.max(1, s)]!; // guard: show Weak (c[1]) even when s=0 (no criteria met)
  return(
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">{[0,1,2,3].map(i=><div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ background:i<Math.max(1,s)?ci.b:"#1e293b" }}/>)}</div>
      <p className="text-[10px] font-bold" style={{ color:ci.t }}>{t(`pw.${ci.k}`)}</p>
    </div>
  );
}

// ── Searchable select ─────────────────────────────────────────────────────────

function SS({ D,placeholder,value,options,onChange,disabled,error,labelOf }:{ D:P;placeholder:string;value:string;options:string[];onChange:(v:string)=>void;disabled?:boolean;error?:boolean;labelOf?:(v:string)=>string }) {
  const lbl=(v:string)=>labelOf?labelOf(v):v;
  const [open,setOpen]=React.useState(false);
  const [q,setQ]=React.useState("");
  const [foc,setFoc]=React.useState(false);
  const ref=React.useRef<HTMLDivElement>(null);
  const filtered=options.filter(o=>(labelOf?labelOf(o):o).toLowerCase().includes(q.toLowerCase())||o.toLowerCase().includes(q.toLowerCase()));
  React.useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)){setOpen(false);setFoc(false);} };
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={()=>{ if(!disabled){setOpen(o=>!o);setFoc(true);} }}
        className="w-full h-11 pl-4 pr-3 rounded-lg border text-[13px] text-left flex items-center justify-between outline-none transition-all duration-200"
        style={{ ...iStyle(D,open||foc,error), opacity:disabled?.4:1, cursor:disabled?"not-allowed":"pointer" }}>
        <span style={{ color:value?D.white:D.muted+"60" }}>{value?lbl(value):placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform",open&&"rotate-180")} style={{ color:D.muted }}/>
      </button>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{ opacity:0,y:-6,scale:.98 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:-6,scale:.98 }} transition={{ duration:.13 }}
            className="absolute z-[200] left-0 right-0 mt-1 rounded-xl overflow-hidden border"
            style={{ background:D.card,borderColor:D.border,boxShadow:"0 20px 40px rgba(0,0,0,0.4)" }}>
            <div className="p-2 border-b" style={{ borderColor:D.border }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color:D.muted }}/>
                <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={i18n.t("onboarding:search.placeholder")}
                  className="w-full h-8 pl-8 pr-7 text-xs rounded-md border-0 outline-none" style={{ background:D.inputBg,color:D.white }}/>
                {q&&<button type="button" onClick={()=>setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3" style={{ color:D.muted }}/></button>}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length===0
                ?<p className="text-xs text-center py-4" style={{ color:D.muted }}>{i18n.t("onboarding:search.noResults")}</p>
                :filtered.map(opt=>(
                  <button key={opt} type="button" onClick={()=>{ onChange(opt);setOpen(false);setQ("");setFoc(false); }}
                    className="w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2 transition-colors"
                    style={{ color:value===opt?D.accent:D.white, background:value===opt?D.accentDim:"transparent" }}
                    onMouseEnter={e=>{ if(value!==opt)(e.currentTarget as HTMLElement).style.background=D.faint; }}
                    onMouseLeave={e=>{ if(value!==opt)(e.currentTarget as HTMLElement).style.background="transparent"; }}>
                    {value===opt?<Check className="h-3.5 w-3.5 shrink-0" style={{ color:D.accent }}/>:<span className="w-3.5"/>}
                    {lbl(opt)}
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Step 1 right context panel (wizard context, not login marketing) ──────────

const WIZARD_STEPS_INFO = [
  { icon:Users,      step:1, key:"s1" },
  { icon:Building2,  step:2, key:"s2" },
  { icon:ListChecks, step:3, key:"s3" },
  { icon:Settings2,  step:4, key:"s4" },
];

function WizardContextPanel({ D }: { D:P }) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l overflow-hidden" style={{ background:D.panel,borderColor:D.border }}>
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-6 flex flex-col">
        {/* Trial badge */}
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border self-start mb-6"
          style={{ color:"#22c55e",borderColor:"#22c55e40",background:"#22c55e10" }}>
          <Sparkles className="h-3 w-3"/>{t("trialBadge")}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color:D.muted }}>{t("aside.setupSteps")}</p>

        <div className="space-y-2">
          {WIZARD_STEPS_INFO.map((s,i)=>(
            <motion.div key={s.step} initial={{ opacity:0,x:10 }} animate={{ opacity:1,x:0 }} transition={{ delay:i*.07 }}
              className="flex items-start gap-3 p-3.5 rounded-xl border" style={{ background:s.step===1?D.accentDim:D.card,borderColor:s.step===1?D.accent+"50":D.border }}>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background:s.step===1?D.accent:D.faint }}>
                <s.icon className="h-3.5 w-3.5" style={{ color:s.step===1?"#fff":D.muted }}/>
              </div>
              <div>
                <p className="text-[12px] font-semibold" style={{ color:s.step===1?D.white:D.muted }}>{t(`aside.${s.key}`)}</p>
                <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color:D.muted+"90" }}>{t(`aside.${s.key}d`)}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border p-4" style={{ background:D.card,borderColor:D.border }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color:D.muted }}>{t("aside.included")}</p>
          <div className="space-y-2">
            {([
              [Shield,t("aside.inc1")],
              [Zap,t("aside.inc2")],
              [Users2,t("aside.inc3")],
              [BarChart2,t("aside.inc4")],
              [HeadphonesIcon,t("aside.inc5")],
              [ShieldCheck,"UAE VAT & IFRS compliant"],
            ] as const).map(([Icon,text])=>(
              <div key={text} className="flex items-center gap-2 text-[11px]" style={{ color:D.muted }}>
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color:D.accent }}/>{text}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-5 border-t" style={{ borderColor:D.border }}>
          <p className="text-[12px]" style={{ color:D.muted }}>
            Already have an account?{" "}
            <Link to="/auth/login" className="font-semibold hover:underline" style={{ color:D.accent }}>{t("aside.signIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar stepper ───────────────────────────────────────────────────────────

function Sidebar({ D,step,showBT,darkMode,toggleDarkMode }: { D:P;step:number;showBT:boolean;darkMode:boolean;toggleDarkMode:()=>void }) {
  const { t } = useTranslation("onboarding");
  const count = showBT?4:3;
  return(
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 h-screen border-r overflow-hidden" style={{ background:D.panel,borderColor:D.border }}>
      <div className="px-5 pt-6 pb-5 shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background:D.accent,boxShadow:`0 4px 14px ${D.accentGlow}` }}>
            <BrandLogo className="h-4 w-4 text-white"/>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color:D.white }}>{t("brand.name")}</p>
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color:D.muted }}>{t("brand.suite")}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border"
          style={{ color:"#22c55e",borderColor:"#22c55e30",background:"#22c55e10" }}>
          <Sparkles className="h-2.5 w-2.5"/>30-day free trial
        </div>
      </div>

      <div className="px-3 flex-1 min-h-0">
        <div className="relative">
          <div className="absolute left-[22px] top-5 w-px" style={{ background:D.border,height:"calc(100% - 2.5rem)" }}/>
          <div className="space-y-0.5">
            {Array.from({ length:count }).map((_,i)=>{
              const done=i<step,active=i===step;
              return(
                <div key={i} className="flex items-center gap-3 px-2 py-3 rounded-xl transition-all"
                  style={{ background:active?D.accentDim:"transparent" }}>
                  <div className="relative z-10 h-9 w-9 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background:done?D.accent:D.card, borderColor:done?D.accent:active?D.accent:D.border, color:done?"#fff":active?D.accent:D.muted, boxShadow:active?`0 0 0 3px ${D.accentDim}`:"none" }}>
                    {done?<Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5}/>:i+1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color:active?D.white:D.muted }}>{t(`stepper.${STEP_META[i].key}`)}</p>
                    <p className="text-[11px]" style={{ color:D.muted+"70" }}>{t(`stepper.${STEP_META[i].key}d`)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-5 pb-6 mt-auto shrink-0">
        <div className="h-px mb-4" style={{ background:D.border }}/>
        <div className="space-y-2.5 mb-5">
          {([
            [Zap,t("chip.c1")],
            [Shield,t("chip.c2")],
            [BarChart2,t("chip.c3")],
            [Users2,t("chip.c4")],
            [HeadphonesIcon,t("chip.c5")],
          ] as const).map(([Icon,text])=>(
            <div key={text} className="flex items-center gap-2 text-[11px]" style={{ color:D.muted }}>
              <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ background:D.accentDim }}>
                <Icon className="h-3 w-3" style={{ color:D.accent }}/>
              </div>{text}
            </div>
          ))}
        </div>
        <button type="button" onClick={toggleDarkMode} className="flex items-center gap-1.5 text-[11px]" style={{ color:D.muted }}>
          {darkMode?<><Sun className="h-3.5 w-3.5"/>{t("theme.light")}</>:<><Moon className="h-3.5 w-3.5"/>{t("theme.dark")}</>}
        </button>
      </div>
    </aside>
  );
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModCard({ D,mod,selected,auto,recommended,onToggle }: { D:P;mod:ModuleDef;selected:boolean;auto:boolean;recommended:boolean;onToggle:()=>void }) {
  const Icon=mod.icon;
  return(
    <button type="button" onClick={()=>!auto&&onToggle()}
      className="w-full text-left rounded-lg border px-3 py-2.5 flex items-center gap-2.5 transition-all duration-150"
      style={{ background:selected?D.accentDim:D.faint, borderColor:selected?D.accent:recommended?"#f59e0b50":D.border, boxShadow:selected?`0 0 0 1px ${D.accent}40`:"none", cursor:auto?"default":"pointer" }}>
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",mod.color)}>
        <Icon className={cn("h-3.5 w-3.5",mod.iconColor)}/>
      </div>
      <span className="text-xs font-semibold flex-1 truncate" style={{ color:D.white }}>{moduleLabel(mod)}</span>
      {auto&&<span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0" style={{ background:D.accentDim,color:D.accent }}>{i18n.t("onboarding:badge.required")}</span>}
      {!auto&&recommended&&!selected&&<span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 bg-amber-500/15 text-amber-500">{i18n.t("onboarding:badge.recommended")}</span>}
      {mod.popular&&!auto&&!recommended&&!selected&&<span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 bg-emerald-500/15 text-emerald-500">{i18n.t("onboarding:badge.popular")}</span>}
      <div className="h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
        style={{ background:selected?D.accent:"transparent",borderColor:selected?D.accent:D.border }}>
        {selected&&<Check className="h-2.5 w-2.5 text-white" strokeWidth={3}/>}
      </div>
    </button>
  );
}

function BizCard({ D,bt,selected,onToggle }: { D:P;bt:typeof BUSINESS_TYPES[number];selected:boolean;onToggle:()=>void }) {
  return(
    <button type="button" onClick={onToggle}
      className="w-full text-left rounded-lg border px-3 py-2.5 flex items-center gap-2.5 transition-all duration-150"
      style={{ background:selected?D.accentDim:D.faint, borderColor:selected?D.accent:D.border, boxShadow:selected?`0 0 0 1px ${D.accent}40`:"none" }}>
      <span className="text-xl select-none leading-none">{bt.emoji}</span>
      <span className="text-xs font-medium flex-1 line-clamp-1" style={{ color:D.white }}>{businessTypeLabel(bt)}</span>
      <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0"
        style={{ background:selected?D.accent:"transparent",borderColor:selected?D.accent:D.border }}>
        {selected&&<Check className="h-2.5 w-2.5 text-white" strokeWidth={3}/>}
      </div>
    </button>
  );
}

// ── Sticky nav bar ────────────────────────────────────────────────────────────

// ── API error banner ──────────────────────────────────────────────────────────

function ApiErrorBanner({ D, err, email, onChangeEmail }: { D:P; err:{ code:string|null; message:string }; email?:string; onChangeEmail?:()=>void }) {
  const isEmailTaken = err.code === "User.Email.Taken";
  return(
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }}
      className="shrink-0 mx-6 mb-1 rounded-xl border overflow-hidden"
      style={{ background: isEmailTaken?"#f59e0b0d":"#ef44440d", borderColor: isEmailTaken?"#f59e0b40":"#ef444440" }}>
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: isEmailTaken?"#f59e0b":"#ef4444" }}/>
        <div className="min-w-0 flex-1">
          {isEmailTaken ? (
            <>
              <p className="text-[13px] font-semibold" style={{ color:"#f59e0b" }}>
                This email is already registered
              </p>
              <p className="text-[11px] mt-0.5 mb-2.5" style={{ color:"#94a3b8" }}>
                {email && <><span className="font-medium" style={{ color:"#f0f4ff" }}>{email}</span> already has an account. </>}
                Sign in to your existing workspace, reset your password, or use a different email.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/auth/login"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all"
                  style={{ background:"#f59e0b", boxShadow:"0 2px 8px #f59e0b30" }}>
                  <ArrowRight className="h-3 w-3"/>{i18n.t("onboarding:step1.signInToAccount")}
                </Link>
                <Link to="/auth/forgot-password"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
                  style={{ color:"#f59e0b", borderColor:"#f59e0b40", background:"#f59e0b10" }}>
                  Forgot password?
                </Link>
                {onChangeEmail&&(
                  <button type="button" onClick={onChangeEmail}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
                    style={{ color:"#94a3b8", borderColor:"#94a3b840", background:"#94a3b810" }}>
                    <ArrowLeft className="h-3 w-3"/>{i18n.t("onboarding:step1.changeEmail")}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px]" style={{ color:"#ef4444" }}>{err.message}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Sticky nav bar ────────────────────────────────────────────────────────────

function NavBar({ D,onBack,onNext,nextLabel,loading,formId }: { D:P;onBack?:()=>void;onNext?:()=>void;nextLabel?:string;loading?:boolean;formId?:string }) {
  return(
    <div className="shrink-0 px-8 py-4 border-t flex items-center justify-between" style={{ background:D.panel,borderColor:D.border }}>
      {onBack
        ?<button type="button" onClick={onBack}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border font-semibold text-[13px] transition-all"
            style={{ borderColor:D.border,color:D.muted }}
            onMouseEnter={e=>(e.currentTarget.style.background=D.faint)}
            onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
            <ArrowLeft className="h-4 w-4"/>{i18n.t("onboarding:nav.back")}
          </button>
        :<div/>}
      <motion.button
        type={formId?"submit":"button"} form={formId} onClick={onNext} disabled={loading}
        whileHover={{ scale:1.03,boxShadow:`0 8px 24px ${D.accentGlow}` }}
        whileTap={{ scale:.97 }}
        className="inline-flex items-center gap-2 h-10 px-7 rounded-xl font-bold text-[13px] text-white transition-all disabled:opacity-50"
        style={{ background:D.accent,boxShadow:`0 4px 16px ${D.accentGlow}` }}>
        {loading?<><Loader2 className="h-4 w-4 animate-spin"/>{i18n.t("onboarding:nav.settingUp")}</>:<>{nextLabel ?? i18n.t("onboarding:nav.continue")}<ArrowRight className="h-4 w-4"/></>}
      </motion.button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { t } = useTranslation("onboarding");
  const navigate=useNavigate();
  const [mode,setMode]=React.useState<"light"|"dark">(getInitialMode);
  const darkMode=mode==="dark";
  const toggleDarkMode=()=>setMode(prev=>{
    const next=prev==="dark"?"light":"dark";
    try{ localStorage.setItem(THEME_KEY,next); }catch{ /* ignore */ }
    return next;
  });
  const D=darkMode?DARK:LIGHT;

  const [step,setStep]=React.useState(0);
  const [done,setDone]=React.useState(false);
  const [checkoutPending,setCheckoutPending]=React.useState(false);
  const [s1Data,setS1Data]=React.useState<S1|null>(null);

  const [selectedModules,setSelectedModules]=React.useState<Set<ModuleId>>(new Set());
  const [autoModules,setAutoModules]=React.useState<Set<ModuleId>>(new Set());
  const [recommendedMods,setRecommendedMods]=React.useState<Set<ModuleId>>(new Set());
  const [moduleError,setModuleError]=React.useState("");
  const [businessType,setBusinessType]=React.useState<string|null>(null);
  const [bizError,setBizError]=React.useState("");
  const [submitting,setSubmitting]=React.useState(false);

  // ── Pricing-page attribution ────────────────────────────────────────────────
  // erp.vrodux.com/trial?plan=micro&billing=annual&intent=buy&utm_source=pricing
  // Captured once on mount and stashed in sessionStorage, because this is a multi-step
  // form: the params live only on the entry URL and would be lost on a refresh or an
  // internal navigation before submit.
  const signup=useSignupAttribution();
  const selectedPlan=getPlan(signup.plan);

  const showBT=needsBusinessType(selectedModules);
  const totalSteps=showBT?4:3;
  const allResolved=resolveModules(selectedModules);

  // Forms
  const f1=useForm<S1>({ resolver:zodResolver(s1Schema), defaultValues:{ fullName:"",companyName:"",workEmail:"",password:"",confirm:"",agree:undefined as any } });
  const [showPw,setShowPw]=React.useState(false);
  const [showCf,setShowCf]=React.useState(false);
  const pw=f1.watch("password");
  const onS1=f1.handleSubmit(d=>{ setS1Data(d); setStep(1); });

  // Auto-detect the user's country from the local machine (browser locale → timezone) so
  // country/currency/timezone are pre-selected at account creation. Falls back to blank.
  const detectedCountry=React.useMemo(()=>detectCountry(),[]);
  const f2=useForm<S2>({ resolver:zodResolver(s2Schema), defaultValues:{ orgName:"",industry:"",country:detectedCountry?.name??"",state:"",currency:detectedCountry?.currency??"",language:"English",timezone:detectedCountry?.timezone??"",startDate:new Date().toISOString().split("T")[0],fiscalYear:"January - December" } });
  const country=f2.watch("country"); const industry=f2.watch("industry"); const tz=f2.watch("timezone");
  const meta:CountryMeta|undefined=COUNTRIES.find(c=>c.name===country);

  React.useEffect(()=>{ if(meta){ f2.setValue("currency",meta.currency,{shouldValidate:true}); f2.setValue("timezone",meta.timezone,{shouldValidate:true}); f2.setValue("state",""); } },[country]);
  React.useEffect(()=>{ if(step===1&&s1Data?.companyName)f2.setValue("orgName",s1Data.companyName); },[step]);

  const [foc,setFoc]=React.useState<string|null>(null);
  const fo=(n:string)=>({ onFocus:()=>setFoc(n),onBlur:()=>setFoc(null) });

  const applyIndustry=React.useCallback((ind:string)=>{
    const ids=(INDUSTRY_MODULES[ind]??[])as ModuleId[];
    const ex=new Set<ModuleId>(ids); const res=resolveModules(ex);
    const au=new Set<ModuleId>(); for(const r of res)if(!ex.has(r))au.add(r);
    const rc=new Set<ModuleId>(); for(const s of res){ const d=MODULES.find(m=>m.id===s); if(d)for(const r of d.recommends)if(!res.has(r))rc.add(r); }
    setSelectedModules(ex);setAutoModules(au);setRecommendedMods(rc);setBusinessType(null);
  },[]);

  const onS2=f2.handleSubmit(d=>{ applyIndustry(d.industry); setStep(2); });

  const toggleModule=React.useCallback((id:ModuleId)=>{
    setModuleError("");
    setSelectedModules(prev=>{
      const n=new Set(prev); n.has(id)?n.delete(id):n.add(id);
      const res=resolveModules(n); const au=new Set<ModuleId>(); for(const r of res)if(!n.has(r))au.add(r);
      const rc=new Set<ModuleId>(); for(const s of res){ const d=MODULES.find(m=>m.id===s); if(d)for(const r of d.recommends)if(!res.has(r))rc.add(r); }
      setAutoModules(au); setRecommendedMods(rc);
      // Clear business type if the new selection no longer requires it
      if(!needsBusinessType(n)) setBusinessType(null);
      return n;
    });
  },[]);

  const [apiError,setApiError]=React.useState<{ code:string|null; message:string }|null>(null);
  const onS3=()=>{ if(selectedModules.size===0){setModuleError(t("step3.selectOne"));return;} setModuleError(""); showBT?setStep(3):submitAll(); };
  const onS4=()=>{ if(!businessType){setBizError(t("step4.selectType"));return;} setBizError(""); submitAll(); };
  const submitAll=async()=>{
    if(!s1Data)return;
    setSubmitting(true); setApiError(null);
    try{
      const s2=f2.getValues();
      const payload: TrialRegistrationRequest = {
        fullName:    s1Data.fullName,
        email:       s1Data.workEmail,
        password:    s1Data.password,
        orgName:     s2.orgName||s1Data.companyName,
        industry:    s2.industry||undefined,
        country:     s2.country||undefined,
        businessType:businessType||undefined,
        fiscalYear:  s2.fiscalYear||undefined,
        language:    s2.language||undefined,
        // Submit the 3-letter ISO code (picker shows "PKR - Pakistani Rupee"); backend also normalises.
        currency:    s2.currency ? s2.currency.split(/[ -]/)[0].toUpperCase() : undefined,
        timezone:    s2.timezone||undefined,
        modules:     [...allResolved],
        // Pricing-page selection — the backend resolves the tier (and refuses to
        // self-provision Enterprise, which is sales-led).
        plan:        signup.plan||undefined,
        billing:     signup.billing,
        intent:      signup.intent||undefined,
        utmSource:   signup.utmSource||undefined,
      };
      const result=await registerTrial(payload);
      clearSignupAttribution();

      // ── "Buy Now" → take them straight to the payment form ──────────────────
      // These accounts get NO trial (the backend puts them in PendingPayment), so parking them on
      // a "check your email / go to login" screen would strand them with no access and no card
      // prompt. Checkout needs an authenticated tenant, so sign them in with the credentials they
      // just chose and hand off to billing, which auto-opens checkout.
      if(result.checkoutRequested){
        try{
          sessionStorage.setItem("vrodux.pendingCheckout", JSON.stringify({
            plan:    result.plan ?? signup.plan,
            billing: result.billingPeriod ?? signup.billing,
          }));
        }catch{ /* ignore */ }

        try{
          const auth=await authApi.login(payload.email, payload.password);
          // 2FA can't be enabled on an account created seconds ago, but guard anyway.
          if(auth.accessToken && auth.refreshToken && auth.user){
            useAuthStore.getState().loginFromApi(auth.accessToken, auth.refreshToken, auth.user);
            navigate("/settings/billing?checkout=1", { replace:true });
            return;
          }
        }catch{
          // Auto sign-in failed (rate limit, 2FA, anything) — fall through to the success screen,
          // which routes them to login. The pendingCheckout marker survives, so billing still
          // opens checkout once they're in. Never fail the signup over this.
        }
      }

      setCheckoutPending(!!result.checkoutRequested);
      setDone(true);
    }catch(e){
      if(e instanceof ApiError)setApiError({ code:e.errorCode, message:e.message });
      else setApiError({ code:null, message:t("error.generic") });
    }finally{ setSubmitting(false); }
  };

  // ── Success ──────────────────────────────────────────────────────────────

  if(done) return(
    <div className="h-screen flex items-center justify-center" style={{ background:D.bg }}>
      <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} className="text-center max-w-md w-full px-6">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:"spring",stiffness:260,damping:20,delay:.15 }}
          className="inline-flex h-24 w-24 rounded-full items-center justify-center mb-6"
          style={{ background:"#22c55e18",border:"2px solid #22c55e40",boxShadow:"0 0 40px #22c55e20" }}>
          <Check className="h-12 w-12 text-green-500" strokeWidth={2.5}/>
        </motion.div>
        <h1 className="text-3xl font-bold mb-2" style={{ color:D.white }}>{t("done.title")}</h1>
        <p className="text-sm mb-1" style={{ color:D.muted }}>
          <Trans t={t} i18nKey="done.workspaceReady" values={{ org:f2.getValues("orgName") }}
            components={{ 1:<span className="font-semibold" style={{ color:D.white }} /> }}/>
        </p>
        <p className="text-sm mb-7" style={{ color:D.muted }}>
          <Trans t={t} i18nKey="done.checkEmail" values={{ email:s1Data?.workEmail ?? "" }}
            components={{ 1:<span className="font-semibold" style={{ color:D.white }} /> }}/>
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 mb-7">
          {[...allResolved].map(id=>{ const m=MODULES.find(x=>x.id===id)!; const Icon=m.icon;
            return<span key={id} className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border",m.color,m.iconColor)}><Icon className="h-3 w-3"/>{moduleLabel(m)}</span>; })}
        </div>
        {/* "Buy Now" signups: say plainly that checkout comes after sign-in, so the jump to a
            payment page isn't a surprise. Your 30-day trial runs either way. */}
        {checkoutPending && selectedPlan && (
          <p className="text-xs mb-5 px-4 py-2.5 rounded-lg border inline-block"
            style={{ color:D.muted,borderColor:D.accent+"40",background:D.accent+"12" }}>
            Sign in to complete checkout for the{" "}
            <span className="font-semibold" style={{ color:D.white }}>{selectedPlan.label}</span> plan
            {amountFor(selectedPlan,signup.billing)!==null &&
              <> — {formatUsd(amountFor(selectedPlan,signup.billing))}/{signup.billing==="annual"?"year":"month"}</>}
            . Your 30-day trial has already started.
          </p>
        )}
        <button onClick={()=>navigate("/auth/login")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background:D.accent,boxShadow:`0 4px 20px ${D.accentGlow}` }}>
          {checkoutPending?"Sign in to complete purchase":"Go to Login"} <ArrowRight className="h-4 w-4"/>
        </button>
      </motion.div>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  return(
    <div className="h-screen flex overflow-hidden" style={{ background:D.bg }}>
      <Sidebar D={D} step={step} showBT={showBT} darkMode={darkMode} toggleDarkMode={toggleDarkMode}/>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* ── Wizard header (all steps) ──────────────────────────────────── */}
        <header className="shrink-0 border-b" style={{ background:D.panel,borderColor:D.border }}>
          {/* Accent progress bar */}
          <div className="h-[3px] w-full" style={{ background:D.faint }}>
            <motion.div
              className="h-full rounded-r-full"
              style={{ background:`linear-gradient(90deg,${D.accent},${D.accent}cc)`,boxShadow:`0 0 8px ${D.accentGlow}` }}
              animate={{ width:`${((step+1)/totalSteps)*100}%` }}
              transition={{ duration:.5,ease:"easeOut" }}
            />
          </div>

          <div className="flex items-center justify-between px-5 h-13" style={{ height:"52px" }}>
            {/* Left: logo (mobile only — sidebar hides on mobile) */}
            <div className="flex items-center gap-3">
              <div className="lg:hidden flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background:D.accent,boxShadow:`0 0 10px ${D.accentGlow}` }}>
                  <BrandLogo className="h-4 w-4 text-white"/>
                </div>
                <span className="font-bold text-sm" style={{ color:D.white }}>{t("brand.name")}</span>
              </div>

              {/* Step breadcrumb chips (desktop) */}
              <div className="hidden lg:flex items-center gap-1">
                {Array.from({ length:totalSteps }).map((_,i)=>{
                  const done=i<step, active=i===step;
                  return(
                    <React.Fragment key={i}>
                      {i>0&&<div className="h-px w-4 shrink-0" style={{ background:i<=step?D.accent:D.border }}/>}
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all")}
                        style={{
                          background: done?D.accent+"18":active?D.accentDim:"transparent",
                          color: done?D.accent:active?D.accent:D.muted,
                          border:`1px solid ${done||active?D.accent+"40":"transparent"}`,
                        }}>
                        <span className="flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-extrabold"
                          style={{ background:done?D.accent:active?D.accent:"transparent", color:done||active?"#fff":D.muted, border:done||active?"none":`1px solid ${D.border}` }}>
                          {done?<Check className="h-2.5 w-2.5" strokeWidth={3}/>:i+1}
                        </span>
                        {t(`stepper.${STEP_META[i].key}`)}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-3">
              {/* Plan chosen on the pricing page — confirms the user is signing up for what they clicked */}
              {selectedPlan && (
                <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                  style={{ color:D.white,borderColor:D.accent+"55",background:D.accent+"18" }}
                  title={signup.intent==="buy"
                    ? `You'll be taken to checkout for the ${selectedPlan.label} plan after signup`
                    : `30-day free trial on the ${selectedPlan.label} plan`}>
                  <span style={{ color:D.accent }}>{selectedPlan.label}</span>
                  {amountFor(selectedPlan,signup.billing)!==null && (
                    <span style={{ color:D.muted }}>
                      {formatUsd(amountFor(selectedPlan,signup.billing))}/{signup.billing==="annual"?"yr":"mo"}
                    </span>
                  )}
                </span>
              )}
              {/* Step counter badge */}
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                style={{ color:D.muted,borderColor:D.border,background:D.faint }}>
                <span style={{ color:D.accent }}>{step+1}</span>
                <span style={{ color:D.muted+"60" }}>/</span>
                {totalSteps}
              </span>
              <Link to="/auth/login" className="hidden sm:inline-block text-[12px] font-semibold hover:underline" style={{ color:D.muted }}>
                Sign in
              </Link>
              <button type="button" onClick={toggleDarkMode}
                className="h-8 w-8 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor:D.border,color:D.muted,background:D.faint }}>
                {darkMode?<Sun className="h-3.5 w-3.5"/>:<Moon className="h-3.5 w-3.5"/>}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ══ STEP 1 ══════════════════════════════════════════════════════ */}
            {step===0&&(
              <motion.div key="s1" className="flex-1 flex min-h-0"
                initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} transition={{ duration:.22 }}>

                {/* Center: form fills full height */}
                <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background:D.bg }}>
                  {/* form scrollable */}
                  <div className="flex-1 overflow-y-auto px-8 pt-10 pb-4">
                    <div className="max-w-[620px] mx-auto">
                      <h2 className="text-[1.6rem] font-bold tracking-tight mb-1" style={{ color:D.white }}>{t("step1.title")}</h2>
                      <p className="text-[13px] mb-7" style={{ color:D.muted }}>30 days free · No credit card · Cancel anytime</p>

                      <form id="f1" onSubmit={onS1}>
                        <div className="rounded-xl border p-6 space-y-5" style={{ background:D.card,borderColor:D.border }}>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Lbl D={D} req err={f1.formState.errors.fullName?.message}>{t("step1.fullName")}</Lbl>
                              <input {...f1.register("fullName")} {...fo("fn")} placeholder={t("step1.fullNamePlaceholder")} autoFocus autoComplete="name" className={INPUT_CLS} style={iStyle(D,foc==="fn",!!f1.formState.errors.fullName)}/>
                            </div>
                            <div className="space-y-1.5">
                              <Lbl D={D} req err={f1.formState.errors.companyName?.message}>{t("step1.companyName")}</Lbl>
                              <input {...f1.register("companyName")} {...fo("co")} placeholder={t("step1.companyNamePlaceholder")} autoComplete="organization" className={INPUT_CLS} style={iStyle(D,foc==="co",!!f1.formState.errors.companyName)}/>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Lbl D={D} req err={f1.formState.errors.workEmail?.message}>{t("step1.workEmail")}</Lbl>
                            <input {...f1.register("workEmail")} {...fo("em")} id="field-email" type="email" placeholder="john@acme.com" autoComplete="email" className={INPUT_CLS} style={iStyle(D,foc==="em",!!f1.formState.errors.workEmail)}/>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Lbl D={D} req err={f1.formState.errors.password?.message}>{t("step1.password")}</Lbl>
                              <div className="relative">
                                <input {...f1.register("password")} {...fo("pw")} type={showPw?"text":"password"} placeholder={t("step1.passwordPlaceholder")} autoComplete="new-password" className={INPUT_CLS+" pr-10"} style={iStyle(D,foc==="pw",!!f1.formState.errors.password)}/>
                                <button type="button" tabIndex={-1} onClick={()=>setShowPw(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:D.muted }}>
                                  {showPw?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                                </button>
                              </div>
                              <PwBar pw={pw}/>
                            </div>
                            <div className="space-y-1.5">
                              <Lbl D={D} req err={f1.formState.errors.confirm?.message}>{t("step1.confirm")}</Lbl>
                              <div className="relative">
                                <input {...f1.register("confirm")} {...fo("cf")} type={showCf?"text":"password"} placeholder={t("step1.confirmPlaceholder")} autoComplete="new-password" className={INPUT_CLS+" pr-10"} style={iStyle(D,foc==="cf",!!f1.formState.errors.confirm)}/>
                                <button type="button" tabIndex={-1} onClick={()=>setShowCf(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:D.muted }}>
                                  {showCf?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                                </button>
                              </div>
                            </div>
                          </div>

                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <div className="relative mt-0.5 shrink-0">
                              <input type="checkbox" {...f1.register("agree")} className="sr-only"/>
                              {/* JS-driven checkbox — CSS peer-checked cannot style descendants */}
                              <div className="h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150"
                                style={{
                                  background:   f1.watch("agree") ? "#3b82f6" : "transparent",
                                  borderColor:  f1.formState.errors.agree ? "#ef4444"
                                              : f1.watch("agree")          ? "#3b82f6"
                                              : D.inputBorder,
                                }}>
                                {f1.watch("agree") && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3}/>}
                              </div>
                            </div>
                            <span className="text-[12px] leading-relaxed" style={{ color:D.muted }}>
                              <Trans t={t} i18nKey="step1.agree" components={{
                                a:<a href="#" className="font-semibold hover:underline" style={{ color:D.accent }} />,
                                b:<a href="#" className="font-semibold hover:underline" style={{ color:D.accent }} />,
                              }}/>
                            </span>
                          </label>
                          {f1.formState.errors.agree&&<p className="text-[11px] text-red-400 -mt-2">{t(f1.formState.errors.agree.message as string)}</p>}
                        </div>
                      </form>

                      {/* Stats strip */}
                      <div className="grid grid-cols-4 gap-px mt-5 rounded-xl overflow-hidden border" style={{ borderColor:D.border,background:D.border }}>
                        {[{v:"30",l:t("step1.statTrial")},{v:"12+",l:t("step1.statModules")},{v:"∞",l:t("step1.statUsers")},{v:"99.9%",l:t("step1.statUptime")}].map(s=>(
                          <div key={s.l} className="px-3 py-3 text-center" style={{ background:D.card }}>
                            <p className="text-[18px] font-extrabold leading-none" style={{ color:D.white }}>{s.v}</p>
                            <p className="text-[10px] font-medium uppercase tracking-wider mt-1" style={{ color:D.muted }}>{s.l}</p>
                          </div>
                        ))}
                      </div>

                      {/* Trust regions */}
                      <div className="mt-5 flex items-center gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color:D.muted+"60" }}>{t("step1.trustedIn")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["🇦🇪 UAE","🇸🇦 KSA","🇵🇰 Pakistan","🇮🇳 India","🇬🇧 UK","🇺🇸 USA"].map(c=>(
                            <span key={c} className="text-[11px] font-medium px-2 py-0.5 rounded-full border" style={{ color:D.muted,borderColor:D.border,background:D.faint }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sticky nav */}
                  <NavBar D={D} formId="f1" nextLabel={t("step1.next")}/>
                </div>

                {/* Right: wizard context panel */}
                <WizardContextPanel D={D}/>
              </motion.div>
            )}

            {/* ══ STEP 2 ══════════════════════════════════════════════════════ */}
            {step===1&&(
              <motion.div key="s2" className="flex-1 flex min-h-0"
                initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} transition={{ duration:.22 }}>

                {/* Left: form fills full height */}
                <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background:D.bg }}>
                  <div className="flex-1 overflow-y-auto px-8 pt-8 pb-4">
                    <div className="max-w-[600px] mx-auto">
                      <h2 className="text-[1.6rem] font-bold tracking-tight mb-1" style={{ color:D.white }}>{t("step2.title")}</h2>
                      <p className="text-[13px] mb-6" style={{ color:D.muted }}>{t("step2.subtitle")}</p>

                      <form id="f2" onSubmit={onS2} className="space-y-6">
                        {/* Org section */}
                        <div className="rounded-xl border p-6" style={{ background:D.card,borderColor:D.border }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 flex items-center gap-1.5" style={{ color:D.muted }}>
                            <Building2 className="h-3 w-3"/>{t("step2.orgDetails")}
                          </p>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Lbl D={D} req err={f2.formState.errors.orgName?.message}>{t("step2.orgName")}</Lbl>
                                <input {...f2.register("orgName")} {...fo("on")} placeholder={t("step2.orgNamePlaceholder")} autoFocus className={INPUT_CLS} style={iStyle(D,foc==="on",!!f2.formState.errors.orgName)}/>
                              </div>
                              <div className="space-y-1.5">
                                <Lbl D={D} req err={f2.formState.errors.industry?.message}>{t("step2.industry")}</Lbl>
                                <Controller control={f2.control} name="industry" render={({ field })=>(
                                  <SS D={D} placeholder={t("step2.selectIndustry")} value={field.value} options={INDUSTRIES} labelOf={v=>t(`industry.${v}`,{defaultValue:v})} onChange={field.onChange} error={!!f2.formState.errors.industry}/>
                                )}/>
                                {industry&&<p className="text-[10px] font-medium flex items-center gap-1" style={{ color:D.accent }}>
                                  <Sparkles className="h-2.5 w-2.5"/>
                                  {!INDUSTRY_MODULES[industry]?.length?t("step2.manualModules"):t("step2.preSelected",{count:INDUSTRY_MODULES[industry].length})}
                                </p>}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Lbl D={D} req err={f2.formState.errors.country?.message}>{t("step2.country")}</Lbl>
                                <Controller control={f2.control} name="country" render={({ field })=>(
                                  <SS D={D} placeholder={t("step2.selectCountry")} value={field.value} options={COUNTRIES.map(c=>c.name)} onChange={field.onChange} error={!!f2.formState.errors.country}/>
                                )}/>
                              </div>
                              <div className="space-y-1.5">
                                <Lbl D={D}>{meta?.stateLabel??t("step2.stateDefault")}</Lbl>
                                <Controller control={f2.control} name="state" render={({ field })=>(
                                  <SS D={D} placeholder={meta?t("step2.selectState",{label:meta.stateLabel}):t("step2.selectCountryFirst")} value={field.value??""} options={meta?.states??[]} onChange={field.onChange} disabled={!meta}/>
                                )}/>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Regional section */}
                        <div className="rounded-xl border p-6" style={{ background:D.card,borderColor:D.border }}>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4 flex items-center gap-1.5" style={{ color:D.muted }}>
                            <Globe className="h-3 w-3"/>{t("step2.regional")}
                          </p>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Lbl D={D} req err={f2.formState.errors.currency?.message}>{t("step2.currency")}{meta&&<span className="normal-case font-normal ml-1" style={{ color:D.accent }}>{t("step2.auto")}</span>}</Lbl>
                                <Controller control={f2.control} name="currency" render={({ field })=>(
                                  <SS D={D} placeholder={t("step2.currency")} value={field.value} options={[...new Set(COUNTRIES.map(c=>c.currency))].sort()} onChange={field.onChange} error={!!f2.formState.errors.currency}/>
                                )}/>
                              </div>
                              <div className="space-y-1.5">
                                <Lbl D={D} req>{t("step2.language")}</Lbl>
                                <Controller control={f2.control} name="language" render={({ field })=>(
                                  <SS D={D} placeholder={t("step2.language")} value={field.value} options={LANGUAGES} onChange={field.onChange} labelOf={v=>t(`language.${v}`,{defaultValue:v})}/>
                                )}/>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Lbl D={D}>{t("step2.timezone")}{meta&&<span className="normal-case font-normal ml-1" style={{ color:D.accent }}>{t("step2.timezoneAuto")}</span>}</Lbl>
                              <div className="w-full h-11 px-4 rounded-lg border flex items-center gap-2.5" style={{ background:D.inputBg,borderColor:D.inputBorder }}>
                                <Clock className="h-4 w-4 shrink-0" style={{ color:D.muted }}/>
                                <span className="text-[13px] truncate" style={{ color:tz?D.white:D.muted+"50" }}>
                                  {tz?`(GMT ${getUtcOffset(tz)}) ${tz.replace(/_/g," ")}`:t("step2.timezoneEmpty")}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Lbl D={D} req err={f2.formState.errors.startDate?.message}>{t("step2.startDate")}</Lbl>
                                <input {...f2.register("startDate")} {...fo("sd")} type="date" className={INPUT_CLS} style={iStyle(D,foc==="sd",!!f2.formState.errors.startDate)}/>
                              </div>
                              <div className="space-y-1.5">
                                <Lbl D={D} req>{t("step2.fiscalYear")}</Lbl>
                                <Controller control={f2.control} name="fiscalYear" render={({ field })=>(
                                  <SS D={D} placeholder={t("step2.fiscalYear")} value={field.value} options={FISCAL_YEARS} onChange={field.onChange} labelOf={v=>t(`fiscalYear.${v}`,{defaultValue:v})}/>
                                )}/>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3" style={{ background:D.faint,borderColor:D.border }}>
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color:"#f59e0b" }}/>
                          <p className="text-[11px] leading-relaxed" style={{ color:D.muted }}>{t("step2.note")}</p>
                        </div>
                      </form>
                    </div>
                  </div>
                  <NavBar D={D} onBack={()=>setStep(0)} formId="f2" nextLabel={t("step2.next")}/>
                </div>

                {/* Right: module preview */}
                <div className="hidden lg:flex w-72 xl:w-80 shrink-0 border-l flex-col overflow-hidden" style={{ background:D.panel,borderColor:D.border }}>
                  <div className="px-5 pt-6 pb-3 border-b shrink-0" style={{ borderColor:D.border }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color:D.muted }}>{t("preview.title")}</p>
                    <p className="text-xs" style={{ color:D.muted }}>
                      {industry
                        ?!INDUSTRY_MODULES[industry]?.length?t("preview.manual")
                          :<Trans t={t} i18nKey="preview.forIndustry" values={{ industry:t(`industry.${industry}`,{defaultValue:industry}) }}
                             components={{ 1:<span className="font-semibold" style={{ color:D.white }} /> }}/>
                        :t("preview.selectIndustry")}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-3">
                    <AnimatePresence mode="wait">
                      {industry&&INDUSTRY_MODULES[industry]?.length>0?(
                        <motion.div key={industry} initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} className="space-y-1.5">
                          {(INDUSTRY_MODULES[industry]as ModuleId[]).map(id=>{ const m=MODULES.find(x=>x.id===id)!; if(!m)return null; const Icon=m.icon;
                            return(
                              <div key={id} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-lg border",m.color,"border-current/10")}>
                                <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0",m.color)}><Icon className={cn("h-3.5 w-3.5",m.iconColor)}/></div>
                                <div className="min-w-0 flex-1">
                                  <p className={cn("text-xs font-semibold",m.iconColor)}>{m.label}</p>
                                  <p className="text-[10px] truncate" style={{ color:D.muted }}>{moduleDesc(m)}</p>
                                </div>
                                <Check className={cn("h-3.5 w-3.5 shrink-0",m.iconColor)} strokeWidth={2.5}/>
                              </div>
                            );
                          })}
                          <div className="pt-1">
                            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background:D.accentDim }}>
                              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color:D.accent }}/>
                              <p className="text-[11px] font-semibold" style={{ color:D.accent }}>{(INDUSTRY_MODULES[industry]as ModuleId[]).length} modules pre-selected next</p>
                            </div>
                          </div>
                        </motion.div>
                      ):(
                        <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }} className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                          <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3" style={{ background:D.faint }}>
                            <Sparkles className="h-5 w-5" style={{ color:D.muted+"50" }}/>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color:D.muted }}>{t("preview.chooseIndustry")}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="shrink-0 px-4 py-3 border-t" style={{ borderColor:D.border }}>
                    <p className="text-[10px] flex items-center gap-1.5" style={{ color:D.muted }}><Info className="h-3 w-3 shrink-0"/>{t("preview.adjustable")}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══ STEP 3: Modules ══════════════════════════════════════════════ */}
            {step===2&&(
              <motion.div key="s3" className="flex-1 flex flex-col min-h-0"
                initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} transition={{ duration:.22 }}>
                <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-8 pb-4" style={{ background:D.bg }}>
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-[1.6rem] font-bold tracking-tight mb-1" style={{ color:D.white }}>{t("step3.title")}</h2>
                    <p className="text-[13px] mb-6" style={{ color:D.muted }}>
                      {industry&&INDUSTRY_MODULES[industry]?.length
                        ?<Trans t={t} i18nKey="step3.preSelectedFor" values={{ industry:t(`industry.${industry}`,{defaultValue:industry}) }}
                            components={{ 1:<span className="font-semibold" style={{ color:D.white }} /> }}/>
                        :t("step3.subtitle")}
                    </p>

                    <AnimatePresence>
                      {autoModules.size>0&&(
                        <motion.div initial={{ opacity:0,height:0 }} animate={{ opacity:1,height:"auto" }} exit={{ opacity:0,height:0 }}
                          className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 mb-5 overflow-hidden"
                          style={{ background:D.accentDim,borderColor:D.accent+"40" }}>
                          <Info className="h-3.5 w-3.5 shrink-0" style={{ color:D.accent }}/>
                          <span className="text-xs" style={{ color:D.muted }}><span className="font-semibold" style={{ color:D.white }}>{[...autoModules].map(id=>{const m=MODULES.find(x=>x.id===id);return m?moduleLabel(m):id;}).join(", ")}</span> auto-included as required.</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-5">
                      {MODULE_CATEGORIES.map(cat=>{
                        const mods=MODULES.filter(m=>m.category===cat.id);
                        return(
                          <div key={cat.id} className="rounded-xl border p-5" style={{ background:D.card,borderColor:D.border }}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color:D.muted }}>{moduleCategoryLabel(cat)}</p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              {mods.map(mod=>(
                                <ModCard key={mod.id} D={D} mod={mod}
                                  selected={selectedModules.has(mod.id)||autoModules.has(mod.id)}
                                  auto={autoModules.has(mod.id)}
                                  recommended={recommendedMods.has(mod.id)&&!selectedModules.has(mod.id)&&!autoModules.has(mod.id)}
                                  onToggle={()=>toggleModule(mod.id)}/>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {moduleError&&<p className="mt-3 text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/>{moduleError}</p>}

                    <AnimatePresence>
                      {allResolved.size>0&&(
                        <motion.div initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                          className="mt-5 rounded-xl border p-4" style={{ background:D.card,borderColor:D.border }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color:D.muted }}>{t("step3.willActivate")}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {[...allResolved].map(id=>{ const m=MODULES.find(x=>x.id===id)!; const Icon=m.icon;
                              return<span key={id} className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border",m.color,m.iconColor)}><Icon className="h-2.5 w-2.5"/>{moduleLabel(m)}</span>; })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence>
                  {apiError&&<ApiErrorBanner D={D} err={apiError} email={s1Data?.workEmail} onChangeEmail={()=>{ setApiError(null); setStep(0); setTimeout(()=>{ document.getElementById("field-email")?.focus(); },200); }}/>}
                </AnimatePresence>
                <NavBar D={D} onBack={()=>{ setApiError(null); setStep(1); }} onNext={onS3} nextLabel={showBT?t("step3.nextBt"):t("step3.getStarted")} loading={submitting}/>
              </motion.div>
            )}

            {/* ══ STEP 4: Business Type ════════════════════════════════════════ */}
            {step===3&&(
              <motion.div key="s4" className="flex-1 flex flex-col min-h-0"
                initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} transition={{ duration:.22 }}>
                <div className="flex-1 min-h-0 overflow-y-auto px-8 pt-8 pb-4" style={{ background:D.bg }}>
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-[1.6rem] font-bold tracking-tight mb-1" style={{ color:D.white }}>{t("step4.title")}</h2>
                    <p className="text-[13px] mb-5" style={{ color:D.muted }}>{t("step4.subtitle")}</p>

                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {[...allResolved].filter(id=>MODULES.find(m=>m.id===id)?.triggersBusinessType).map(id=>{ const m=MODULES.find(x=>x.id===id)!; const Icon=m.icon;
                        return<span key={id} className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border",m.color,m.iconColor)}><Icon className="h-3 w-3"/>{moduleLabel(m)}</span>; })}
                    </div>

                    <div className="rounded-xl border p-5" style={{ background:D.card,borderColor:D.border }}>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {BUSINESS_TYPES.map(bt=>(
                          <BizCard key={bt.id} D={D} bt={bt} selected={businessType===bt.id} onToggle={()=>{ setBusinessType(bt.id); setBizError(""); }}/>
                        ))}
                      </div>
                    </div>

                    {bizError&&<p className="mt-3 text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/>{bizError}</p>}

                    <AnimatePresence>
                      {businessType&&(()=>{ const bt=BUSINESS_TYPES.find(b=>b.id===businessType)!; const missing=bt.suggests.filter(id=>!allResolved.has(id)); if(!missing.length)return null;
                        return(
                          <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                            className="mt-4 flex items-start gap-2.5 rounded-xl border p-4"
                            style={{ background:D.accentDim,borderColor:D.accent+"40" }}>
                            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color:D.accent }}/>
                            <div>
                              <p className="text-[11px] font-semibold mb-2" style={{ color:D.white }}>{t("step4.alsoRecommended",{label:businessTypeLabel(bt)})}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {missing.map(id=>{ const m=MODULES.find(x=>x.id===id)!; const Icon=m.icon;
                                  return<button key={id} type="button" onClick={()=>{ toggleModule(id); setStep(2); }}
                                    className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border hover:opacity-80 transition-opacity",m.color,m.iconColor)}>
                                    <Icon className="h-2.5 w-2.5"/>+ {m.label}
                                  </button>; })}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence>
                  {apiError&&<ApiErrorBanner D={D} err={apiError} email={s1Data?.workEmail} onChangeEmail={()=>{ setApiError(null); setStep(0); setTimeout(()=>{ document.getElementById("field-email")?.focus(); },200); }}/>}
                </AnimatePresence>
                <div className="shrink-0 px-8 py-4 border-t flex items-center justify-between" style={{ background:D.panel,borderColor:D.border }}>
                  <button type="button" onClick={()=>{ setApiError(null); setStep(2); }}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border font-semibold text-[13px] transition-all"
                    style={{ borderColor:D.border,color:D.muted }}
                    onMouseEnter={e=>(e.currentTarget.style.background=D.faint)}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <ArrowLeft className="h-4 w-4"/>{t("nav.back")}
                  </button>
                  <div className="flex items-center gap-5">
                    <p className="text-[11px] hidden sm:block" style={{ color:D.muted }}>
                      <Trans t={t} i18nKey="step4.agree" components={{
                        a:<a href="#" className="font-semibold hover:underline" style={{ color:D.accent }} />,
                      }}/>
                    </p>
                    <motion.button type="button" onClick={onS4} disabled={submitting}
                      whileHover={{ scale:1.03,boxShadow:`0 8px 24px ${D.accentGlow}` }} whileTap={{ scale:.97 }}
                      className="inline-flex items-center gap-2 h-10 px-7 rounded-xl font-bold text-[13px] text-white transition-all disabled:opacity-50"
                      style={{ background:D.accent,boxShadow:`0 4px 16px ${D.accentGlow}` }}>
                      {submitting?<><Loader2 className="h-4 w-4 animate-spin"/>{t("nav.settingUp")}</>:<>{t("step4.getStarted")}<ArrowRight className="h-4 w-4"/></>}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
