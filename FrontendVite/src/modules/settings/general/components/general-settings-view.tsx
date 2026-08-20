import * as React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Building2, Globe, MapPin, Bell, Shield, Palette,
  CheckCircle, Camera, ChevronRight, Moon, Sun, Monitor,
  Mail, MessageSquare, Smartphone, Lock, Clock, KeyRound,
  ToggleLeft, Save, RotateCcw, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth.store";
import { useThemeStore } from "@/store/theme.store";
import { toast } from "sonner";
import { appSettingsApi } from "@/lib/identity/app-settings.api";
import { findCountry } from "@/lib/onboarding/geo-data";

// Keep for potential future use — avoids dead-import warnings
void MapPin; void ChevronRight;

const SETTINGS_KEY = "softaxis-app-settings";

// Option VALUES are persisted to the backend, so they stay canonical/English —
// only the displayed label goes through i18n.
const INDUSTRY_VALUES = [
  "IT Services / SaaS", "Real Estate", "Construction", "Hospitality",
  "Retail", "Manufacturing", "Healthcare", "Finance",
] as const;
const COMPANY_SIZE_VALUES = ["1-10", "11-50", "50-200", "201-500", "500+"] as const;
const COUNTRY_OPTIONS = [
  { value: "ae", flag: "🇦🇪" }, { value: "pk", flag: "🇵🇰" }, { value: "sa", flag: "🇸🇦" },
  { value: "om", flag: "🇴🇲" }, { value: "qa", flag: "🇶🇦" }, { value: "kw", flag: "🇰🇼" },
  { value: "bh", flag: "🇧🇭" }, { value: "in", flag: "🇮🇳" }, { value: "gb", flag: "🇬🇧" },
  { value: "us", flag: "🇺🇸" },
] as const;
const CURRENCY_VALUES = [
  "AED", "PKR", "SAR", "OMR", "QAR", "KWD", "BHD", "INR", "USD", "EUR", "GBP",
] as const;
const NUMBER_FORMATS = [
  { value: "1,234,567.89", key: "comma" },
  { value: "1.234.567,89", key: "dot" },
  { value: "1 234 567.89", key: "space" },
] as const;
const LANGUAGE_VALUES = ["en-US", "en-GB", "ar-AE", "fr-FR", "hi-IN"] as const;
const FISCAL_MONTHS = ["January", "February", "March", "April", "July", "October"] as const;
const DIGEST_VALUES = ["realtime", "hourly", "daily", "weekly"] as const;
const SESSION_TIMEOUTS = ["30", "60", "240", "480", "1440"] as const;
const LOGIN_ATTEMPTS = ["3", "5", "10"] as const;
const PASSWORD_LENGTHS = ["8", "10", "12", "14", "16"] as const;
const PASSWORD_EXPIRY = ["30", "60", "90", "180", "never"] as const;
const MODULE_KEYS = [
  "crm", "finance", "hr", "sales", "purchase", "inventory",
  "realEstate", "construction", "hospitality", "pos", "aiAssistant", "fileManager",
] as const;

// ─── Default values (used as fallback when backend has no data yet) ───────────
//
// The company block is intentionally EMPTY. It used to carry a sample company (Softaxis
// Technologies LLC, its address, TRN, registration number and email addresses), which every tenant
// with no saved settings then displayed as if it were their own. Showing a real-looking legal
// identity that belongs to someone else is worse than showing nothing, so these are blank and the
// inputs carry placeholders instead. `name`/`legalName` fall back to the tenant's own name below.
const DEFAULTS = {
  company: {
    name: "",
    legalName: "",
    industry: "",
    website: "",
    companySize: "",
    registrationNo: "",
    phone: "",
    email: "",
    supportEmail: "",
    address: "",
    poBox: "",
  },
  regional: {
    country: "",                // ISO country code — source of truth for POS/reports/receipt
    currency: "",               // falls back to the tenant's own currency (see loader)
    timezone: "",
    dateFormat: "DD/MM/YYYY",   // formatting defaults are functional, not identity — safe to keep
    language: "en-US",
    numberFormat: "1,234,567.89",
    vatRate: "",
    fiscalYearStart: "January",
    // A TRN is a legal identifier printed on tax invoices and VAT returns — never invent one.
    vatTrn: "",
  },
  appearance: {
    theme: "system" as "light" | "dark" | "system",
    sidebarCollapsed: false,
    compactMode: false,
    showBreadcrumbs: true,
    animationsEnabled: true,
    rtlSupport: false,
  },
  notifications: {
    emailApprovals: true,
    emailInvoices: true,
    emailLeaves: false,
    emailSystem: true,
    smsOtp: true,
    smsAlerts: false,
    inAppAll: true,
    inAppMentions: true,
    inAppTasks: true,
    inAppSystem: false,
    digestFrequency: "daily",
  },
  security: {
    enforce2FA: true,
    sessionTimeout: "480",
    passwordMinLength: "10",
    passwordRequireUpper: true,
    passwordRequireNumbers: true,
    passwordRequireSymbols: false,
    passwordExpiry: "90",
    maxLoginAttempts: "5",
    ipWhitelistEnabled: false,
    singleSession: false,
  },
  modules: {
    crm: true,
    finance: true,
    hr: true,
    sales: true,
    purchase: true,
    inventory: true,
    realEstate: true,
    construction: true,
    hospitality: true,
    pos: true,
    aiAssistant: true,
    fileManager: true,
    reports: true,
  },
};

type Snapshot = typeof DEFAULTS;

// ─── Parse helpers ────────────────────────────────────────────────────────────
function toBool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined || val === null || val === "") return fallback;
  return val === "true";
}
function toStr(val: string | undefined, fallback: string): string {
  return val !== undefined && val !== null && val !== "" ? val : fallback;
}

// NOTE: a currencyToCountry() helper used to live here, deriving the country from the currency
// with an arbitrary "pk" fallback. Country is now taken from the tenant itself (findCountry), so
// an unknown value yields no country rather than silently picking one.

/** Convert "light" | "dark" | "system" → boolean for useThemeStore */
function resolveThemeDark(theme: string): boolean {
  if (theme === "dark")  return true;
  if (theme === "light") return false;
  // "system" — follow OS preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({
  title, description, icon: Icon, children, badge,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {badge && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

// ─── Select Field ─────────────────────────────────────────────────────────────
function SelectField({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-9 px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({
  label, description, checked, onChange, badge,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning">{badge}</span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Unsaved Banner ───────────────────────────────────────────────────────────
function UnsavedBanner({
  onSave, onDiscard, saving,
}: {
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation("settings");
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl mb-4"
    >
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
      <p className="text-sm text-warning font-medium flex-1">{t("general.unsaved")}</p>
      <Button size="sm" variant="outline" onClick={onDiscard} disabled={saving}>
        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {t("general.discard")}
      </Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving
          ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          : <Save className="w-3.5 h-3.5 mr-1.5" />}
        {t("general.save")}
      </Button>
    </motion.div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function GeneralSettingsView() {
  const { t } = useTranslation("settings");
  // ── Section state ──────────────────────────────────────────────────────────
  const [company,       setCompany]       = React.useState(DEFAULTS.company);
  const [regional,      setRegional]      = React.useState(DEFAULTS.regional);
  const [appearance,    setAppearance]    = React.useState(DEFAULTS.appearance);
  const [notifications, setNotifications] = React.useState(DEFAULTS.notifications);
  const [security,      setSecurity]      = React.useState(DEFAULTS.security);
  const [modules,       setModules]       = React.useState(DEFAULTS.modules);

  // ── Request state ──────────────────────────────────────────────────────────
  const [isLoading,   setIsLoading]   = React.useState(true);
  const [isSaving,    setIsSaving]    = React.useState(false);
  const [isDirty,     setIsDirty]     = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Holds last successfully loaded (or saved) server state so Discard is instant
  const serverRef = React.useRef<Snapshot | null>(null);

  const updatePreferences = useAuthStore(s => s.updatePreferences);
  const setDarkMode       = useThemeStore(s => s.setDarkMode);

  // ── Load settings from backend ─────────────────────────────────────────────
  const applySnapshot = React.useCallback((snap: Snapshot) => {
    setCompany(snap.company);
    setRegional(snap.regional);
    setAppearance(snap.appearance);
    setNotifications(snap.notifications);
    setSecurity(snap.security);
    setModules(snap.modules);
  }, []);

  const loadSettings = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await appSettingsApi.getAll();
      const c   = data.company       ?? {};
      const r   = data.regional      ?? {};
      const a   = data.appearance    ?? {};
      const n   = data.notifications ?? {};
      const sec = data.security      ?? {};
      const m   = data.modules       ?? {};
      const D   = DEFAULTS;

      // Fall back to the CURRENT tenant's own identity (from the JWT/auth store) instead of the
      // hardcoded Softaxis sample company, so a fresh tenant admin sees their own company name.
      const tenant = useAuthStore.getState().tenant;
      const tenantName = tenant?.name?.trim() || D.company.name;

      const newCompany: typeof DEFAULTS.company = {
        name:           toStr(c.name,           tenantName),
        legalName:      toStr(c.legalName,      tenantName),
        industry:       toStr(c.industry,       D.company.industry),
        website:        toStr(c.website,        D.company.website),
        companySize:    toStr(c.companySize,    D.company.companySize),
        registrationNo: toStr(c.registrationNo, D.company.registrationNo),
        phone:          toStr(c.phone,          D.company.phone),
        email:          toStr(c.email,          D.company.email),
        supportEmail:   toStr(c.supportEmail,   D.company.supportEmail),
        address:        toStr(c.address,        D.company.address),
        poBox:          toStr(c.poBox,          D.company.poBox),
      };

      // The country chosen during onboarding is the source of truth here — it is stored on the
      // tenant and now travels in the JWT. Currency and timezone are derived FROM it when the
      // tenant has nothing saved yet, which is what keeps this panel internally consistent: it
      // previously showed a country derived from the currency (with an arbitrary "pk" fallback)
      // alongside a hardcoded AED/Asia-Dubai, so a UAE tenant could read "Pakistan · AED · Dubai".
      const tenantCountry  = tenant?.country ? findCountry(tenant.country) : undefined;
      const resolvedCountry = toStr(r.country, tenantCountry?.code.toLowerCase() ?? D.regional.country);

      // Prefer what the resolved country implies; only fall back to the tenant's currency claim.
      const countryMeta      = findCountry(resolvedCountry) ?? tenantCountry;
      const resolvedCurrency = toStr(
        r.currency,
        countryMeta?.currencyCode ?? tenant?.currency?.trim() ?? D.regional.currency,
      );

      const newRegional: typeof DEFAULTS.regional = {
        country:         resolvedCountry,
        currency:        resolvedCurrency,
        timezone:        toStr(r.timezone,        countryMeta?.timezone ?? D.regional.timezone),
        dateFormat:      toStr(r.dateFormat,      D.regional.dateFormat),
        language:        toStr(r.language,        D.regional.language),
        numberFormat:    toStr(r.numberFormat,    D.regional.numberFormat),
        vatRate:         toStr(r.vatRate,         D.regional.vatRate),
        fiscalYearStart: toStr(r.fiscalYearStart, D.regional.fiscalYearStart),
        vatTrn:          toStr(r.vatTrn,          D.regional.vatTrn),
      };

      const rawTheme = toStr(a.theme, D.appearance.theme);
      const newAppearance: typeof DEFAULTS.appearance = {
        theme:             (rawTheme === "light" || rawTheme === "dark" || rawTheme === "system")
                             ? rawTheme : D.appearance.theme,
        sidebarCollapsed:  toBool(a.sidebarCollapsed,  D.appearance.sidebarCollapsed),
        compactMode:       toBool(a.compactMode,        D.appearance.compactMode),
        showBreadcrumbs:   toBool(a.showBreadcrumbs,    D.appearance.showBreadcrumbs),
        animationsEnabled: toBool(a.animationsEnabled,  D.appearance.animationsEnabled),
        rtlSupport:        toBool(a.rtlSupport,         D.appearance.rtlSupport),
      };

      const newNotifications: typeof DEFAULTS.notifications = {
        emailApprovals:  toBool(n.emailApprovals,  D.notifications.emailApprovals),
        emailInvoices:   toBool(n.emailInvoices,   D.notifications.emailInvoices),
        emailLeaves:     toBool(n.emailLeaves,      D.notifications.emailLeaves),
        emailSystem:     toBool(n.emailSystem,      D.notifications.emailSystem),
        smsOtp:          toBool(n.smsOtp,           D.notifications.smsOtp),
        smsAlerts:       toBool(n.smsAlerts,        D.notifications.smsAlerts),
        inAppAll:        toBool(n.inAppAll,          D.notifications.inAppAll),
        inAppMentions:   toBool(n.inAppMentions,     D.notifications.inAppMentions),
        inAppTasks:      toBool(n.inAppTasks,        D.notifications.inAppTasks),
        inAppSystem:     toBool(n.inAppSystem,       D.notifications.inAppSystem),
        digestFrequency: toStr(n.digestFrequency,   D.notifications.digestFrequency),
      };

      const newSecurity: typeof DEFAULTS.security = {
        enforce2FA:              toBool(sec.enforce2FA,              D.security.enforce2FA),
        sessionTimeout:          toStr(sec.sessionTimeout,           D.security.sessionTimeout),
        passwordMinLength:       toStr(sec.passwordMinLength,        D.security.passwordMinLength),
        passwordRequireUpper:    toBool(sec.passwordRequireUpper,    D.security.passwordRequireUpper),
        passwordRequireNumbers:  toBool(sec.passwordRequireNumbers,  D.security.passwordRequireNumbers),
        passwordRequireSymbols:  toBool(sec.passwordRequireSymbols,  D.security.passwordRequireSymbols),
        passwordExpiry:          toStr(sec.passwordExpiry,           D.security.passwordExpiry),
        maxLoginAttempts:        toStr(sec.maxLoginAttempts,         D.security.maxLoginAttempts),
        ipWhitelistEnabled:      toBool(sec.ipWhitelistEnabled,      D.security.ipWhitelistEnabled),
        singleSession:           toBool(sec.singleSession,           D.security.singleSession),
      };

      const newModules: typeof DEFAULTS.modules = {
        crm:          toBool(m.crm,          D.modules.crm),
        finance:      toBool(m.finance,      D.modules.finance),
        hr:           toBool(m.hr,           D.modules.hr),
        sales:        toBool(m.sales,        D.modules.sales),
        purchase:     toBool(m.purchase,     D.modules.purchase),
        inventory:    toBool(m.inventory,    D.modules.inventory),
        realEstate:   toBool(m.realEstate,   D.modules.realEstate),
        construction: toBool(m.construction, D.modules.construction),
        hospitality:  toBool(m.hospitality,  D.modules.hospitality),
        pos:          toBool(m.pos,          D.modules.pos),
        aiAssistant:  toBool(m.aiAssistant,  D.modules.aiAssistant),
        fileManager:  toBool(m.fileManager,  D.modules.fileManager),
        reports:      toBool(m.reports,      D.modules.reports),
      };

      const snap: Snapshot = {
        company:       newCompany,
        regional:      newRegional,
        appearance:    newAppearance,
        notifications: newNotifications,
        security:      newSecurity,
        modules:       newModules,
      };

      applySnapshot(snap);
      serverRef.current = snap;
      setIsDirty(false);
      // Apply theme to DOM immediately
      setDarkMode(resolveThemeDark(newAppearance.theme));
      // ── Sync tenant in auth store so POS / reports / receipt read the correct
      //    country, currency and timezone without requiring a re-login.
      const { tenant: currentTenant, setTenant } = useAuthStore.getState();
      if (currentTenant) {
        setTenant({
          ...currentTenant,
          country:  snap.regional.country,
          currency: snap.regional.currency,
          timezone: snap.regional.timezone,
        });
      }

      // Also update localStorage cache
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(snap)); } catch { /* ignore */ }
    } catch {
      // Backend unavailable — fall back to localStorage cache
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Snapshot>;
          if (saved.company)       setCompany(c => ({ ...c, ...saved.company }));
          if (saved.regional)      setRegional(r => ({ ...r, ...saved.regional }));
          if (saved.appearance)    setAppearance(a => ({ ...a, ...saved.appearance }));
          if (saved.notifications) setNotifications(n => ({ ...n, ...saved.notifications }));
          if (saved.security)      setSecurity(s => ({ ...s, ...saved.security }));
          if (saved.modules)       setModules(m => ({ ...m, ...saved.modules }));
          toast.warning(t("general.toastCached"));
        }
      } catch { /* ignore */ }
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, setDarkMode, t]);

  React.useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build the appearance payload.
      // Also emit "darkMode" (boolean string) so that ThemeProvider can pick it
      // up on next login — it reads "darkMode" but General Settings saves "theme".
      const appearancePayload: Record<string, string> = Object.fromEntries(
        Object.entries(appearance).map(([k, v]) => [k, String(v)])
      );
      if (appearance.theme === "dark")        appearancePayload.darkMode = "true";
      else if (appearance.theme === "light")  appearancePayload.darkMode = "false";
      else if (appearance.theme === "system") appearancePayload.darkMode = ""; // cleared = follow OS

      await appSettingsApi.saveAll({
        company:       Object.fromEntries(Object.entries(company).map(([k, v]) => [k, String(v)])),
        regional:      Object.fromEntries(Object.entries(regional).map(([k, v]) => [k, String(v)])),
        appearance:    appearancePayload,
        notifications: Object.fromEntries(Object.entries(notifications).map(([k, v]) => [k, String(v)])),
        security:      Object.fromEntries(Object.entries(security).map(([k, v]) => [k, String(v)])),
        modules:       Object.fromEntries(Object.entries(modules).map(([k, v]) => [k, String(v)])),
      });

      // Update server ref so Discard can revert instantly
      serverRef.current = { company, regional, appearance, notifications, security, modules };

      // Update localStorage cache
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(serverRef.current)); } catch { /* ignore */ }

      // Ensure theme store stays in sync (source of truth for DOM)
      setDarkMode(resolveThemeDark(appearance.theme));

      // Sync auth store preferences for live theme/layout switching
      updatePreferences({
        theme: appearance.theme,
        language: regional.language.startsWith("ar") ? "ar" : "en",
        currency: regional.currency,
        dateFormat: regional.dateFormat,
        timezone: regional.timezone,
        sidebarCollapsed: appearance.sidebarCollapsed ?? false,
      });
      // ── Also sync tenant so POS / reports / receipt see the correct country
      //    immediately — no re-login required.
      const { tenant: currentTenant, setTenant } = useAuthStore.getState();
      if (currentTenant) {
        setTenant({
          ...currentTenant,
          country:  regional.country,
          currency: regional.currency,
          timezone: regional.timezone,
        });
      }

      setIsDirty(false);
      setSaveSuccess(true);
      toast.success(t("general.toastSaved"));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      toast.error(t("general.toastSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Discard ────────────────────────────────────────────────────────────────
  const handleDiscard = async () => {
    if (serverRef.current) {
      applySnapshot(serverRef.current);
      // Revert theme to last saved value
      setDarkMode(resolveThemeDark(serverRef.current.appearance.theme));
      setIsDirty(false);
    } else {
      await loadSettings();
    }
  };

  // ── Field updaters ─────────────────────────────────────────────────────────
  const updateCompany       = (key: string, value: string)          => { setCompany(p => ({ ...p, [key]: value }));       setIsDirty(true); };
  const updateRegional      = (key: string, value: string)          => { setRegional(p => ({ ...p, [key]: value }));      setIsDirty(true); };
  const updateAppearance    = (key: string, value: boolean | string) => {
    setAppearance(p => ({ ...p, [key]: value }));
    setIsDirty(true);
    // Live-preview theme without waiting for Save
    if (key === "theme" && typeof value === "string") {
      setDarkMode(resolveThemeDark(value));
    }
  };
  const updateNotifications = (key: string, value: boolean | string) => { setNotifications(p => ({ ...p, [key]: value })); setIsDirty(true); };
  const updateSecurity      = (key: string, value: boolean | string) => { setSecurity(p => ({ ...p, [key]: value }));     setIsDirty(true); };
  const updateModules       = (key: string, value: boolean)          => { setModules(p => ({ ...p, [key]: value }));      setIsDirty(true); };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("general.loading")}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("general.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("general.description")}
          </p>
        </div>
        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> {t("general.saved")}
          </span>
        )}
      </div>

      {/* Unsaved Banner */}
      {isDirty && (
        <UnsavedBanner onSave={handleSave} onDiscard={handleDiscard} saving={isSaving} />
      )}

      {/* ── Company Profile ── */}
      <SectionCard title={t("general.company.title")} description={t("general.company.description")} icon={Building2}>
        {/* Logo */}
        <div className="flex items-start gap-5 mb-6 pb-6 border-b border-border">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {(company.name?.[0] ?? "S").toUpperCase()}
              </span>
            </div>
            <button className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-muted/40 transition-colors">
              <Camera className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{company.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{company.industry}</p>
            {/* The "Verified" badge and a hardcoded company id (SXT-2019-001) used to render here
                unconditionally. There is no verification concept in the product, so the badge was a
                false trust signal, and the id belonged to the sample company. Show the tenant's own
                registration number instead, and only once they have entered one. */}
            {company.registrationNo.trim() && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {t("general.company.idLabel")} {company.registrationNo}
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-3 h-7 text-xs">{t("general.company.uploadLogo")}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={t("general.company.name")}>
            <Input value={company.name} onChange={e => updateCompany("name", e.target.value)} className="h-9 text-sm" />
          </FormField>
          <FormField label={t("general.company.legalName")}>
            <Input value={company.legalName} onChange={e => updateCompany("legalName", e.target.value)} className="h-9 text-sm" />
          </FormField>
          <FormField label={t("general.company.industry")}>
            <SelectField
              value={company.industry}
              onChange={v => updateCompany("industry", v)}
              options={INDUSTRY_VALUES.map(v => ({ value: v, label: t(`general.company.industryOption.${v}`) }))}
            />
          </FormField>
          <FormField label={t("general.company.size")}>
            <SelectField
              value={company.companySize}
              onChange={v => updateCompany("companySize", v)}
              options={COMPANY_SIZE_VALUES.map(v => ({ value: v, label: t(`general.company.sizeOption.${v}`) }))}
            />
          </FormField>
          <FormField label={t("general.company.website")}>
            <Input value={company.website} onChange={e => updateCompany("website", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.websitePlaceholder")} />
          </FormField>
          <FormField label={t("general.company.registrationNo")}>
            <Input value={company.registrationNo} onChange={e => updateCompany("registrationNo", e.target.value)} className="h-9 text-sm font-mono" placeholder={t("general.company.registrationNoPlaceholder", { defaultValue: "e.g. UAE-LLC-2024-00000" })} />
          </FormField>
          <FormField label={t("general.company.phone")}>
            <Input value={company.phone} onChange={e => updateCompany("phone", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.phonePlaceholder", { defaultValue: "+971 4 000 0000" })} />
          </FormField>
          <FormField label={t("general.company.email")}>
            <Input value={company.email} onChange={e => updateCompany("email", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.emailPlaceholder", { defaultValue: "info@yourcompany.com" })} />
          </FormField>
          <FormField label={t("general.company.supportEmail")}>
            <Input value={company.supportEmail} onChange={e => updateCompany("supportEmail", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.supportEmailPlaceholder", { defaultValue: "support@yourcompany.com" })} />
          </FormField>
          <FormField label={t("general.company.poBox")}>
            <Input value={company.poBox} onChange={e => updateCompany("poBox", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.poBoxPlaceholder", { defaultValue: "P.O. Box, City" })} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label={t("general.company.address")}>
              <Input value={company.address} onChange={e => updateCompany("address", e.target.value)} className="h-9 text-sm" placeholder={t("general.company.addressPlaceholder", { defaultValue: "Street, building, city, country" })} />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── Regional Settings ── */}
      <SectionCard title={t("general.regional.title")} description={t("general.regional.description")} icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Country is the primary jurisdiction selector — drives POS receipts, reports, tax labels */}
          <FormField label={t("general.regional.country")} hint={t("general.regional.countryHint")}>
            <SelectField
              value={regional.country}
              onChange={v => {
                // Auto-fill currency + timezone when country changes
                const countryDefaults: Record<string, { currency: string; timezone: string; vatRate: string }> = {
                  ae: { currency: "AED", timezone: "Asia/Dubai",       vatRate: "5"  },
                  pk: { currency: "PKR", timezone: "Asia/Karachi",     vatRate: "17" },
                  sa: { currency: "SAR", timezone: "Asia/Riyadh",      vatRate: "15" },
                  om: { currency: "OMR", timezone: "Asia/Muscat",      vatRate: "5"  },
                  qa: { currency: "QAR", timezone: "Asia/Qatar",       vatRate: "0"  },
                  kw: { currency: "KWD", timezone: "Asia/Kuwait",      vatRate: "0"  },
                  bh: { currency: "BHD", timezone: "Asia/Bahrain",     vatRate: "10" },
                  in: { currency: "INR", timezone: "Asia/Kolkata",     vatRate: "18" },
                  gb: { currency: "GBP", timezone: "Europe/London",    vatRate: "20" },
                  us: { currency: "USD", timezone: "America/New_York", vatRate: "0"  },
                };
                const d = countryDefaults[v];
                updateRegional("country", v);
                if (d) {
                  updateRegional("currency", d.currency);
                  updateRegional("timezone", d.timezone);
                  updateRegional("vatRate",  d.vatRate);
                }
              }}
              options={COUNTRY_OPTIONS.map(({ value, flag }) => ({
                value, label: `${flag} ${t(`general.regional.countryOption.${value}`)}`,
              }))}
            />
          </FormField>
          <FormField label={t("general.regional.currency")}>
            <SelectField
              value={regional.currency}
              onChange={v => updateRegional("currency", v)}
              options={CURRENCY_VALUES.map(v => ({
                value: v, label: `${v} – ${t(`general.regional.currencyOption.${v}`)}`,
              }))}
            />
          </FormField>
          <FormField label={t("general.regional.timezone")}>
            <SelectField
              value={regional.timezone}
              onChange={v => updateRegional("timezone", v)}
              options={[
                { value: "Asia/Dubai",      label: "Asia/Dubai (UTC+4)" },
                { value: "Asia/Riyadh",     label: "Asia/Riyadh (UTC+3)" },
                { value: "Europe/London",   label: "Europe/London (UTC+1)" },
                { value: "America/New_York",label: "America/New_York (UTC-5)" },
                { value: "Asia/Kolkata",    label: "Asia/Kolkata (UTC+5:30)" },
              ]}
            />
          </FormField>
          <FormField label={t("general.regional.dateFormat")}>
            <SelectField
              value={regional.dateFormat}
              onChange={v => updateRegional("dateFormat", v)}
              options={[
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY (20/05/2026)" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY (05/20/2026)" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-05-20)" },
                { value: "D MMM YYYY", label: "D MMM YYYY (20 May 2026)" },
              ]}
            />
          </FormField>
          <FormField label={t("general.regional.language")}>
            <SelectField
              value={regional.language}
              onChange={v => updateRegional("language", v)}
              options={LANGUAGE_VALUES.map(v => ({ value: v, label: t(`general.regional.languageOption.${v}`) }))}
            />
          </FormField>
          <FormField label={t("general.regional.numberFormat")}>
            <SelectField
              value={regional.numberFormat}
              onChange={v => updateRegional("numberFormat", v)}
              options={NUMBER_FORMATS.map(({ value, key }) => ({
                value, label: `${value} (${t(`general.regional.numberFormatOption.${key}`)})`,
              }))}
            />
          </FormField>
          <FormField label={t("general.regional.fiscalYearStart")}>
            <SelectField
              value={regional.fiscalYearStart}
              onChange={v => updateRegional("fiscalYearStart", v)}
              options={FISCAL_MONTHS.map(m => ({ value: m, label: t(`general.regional.month.${m}`) }))}
            />
          </FormField>
          <FormField label={t("general.regional.vatRate")} hint={t("general.regional.vatRateHint")}>
            <Input
              value={regional.vatRate}
              onChange={e => updateRegional("vatRate", e.target.value)}
              className="h-9 text-sm"
              type="number"
              min="0"
              max="100"
              step="0.5"
            />
          </FormField>
          <FormField label={t("general.regional.vatTrn")}>
            <Input
              value={regional.vatTrn}
              onChange={e => updateRegional("vatTrn", e.target.value)}
              className="h-9 text-sm font-mono"
              placeholder={t("general.regional.vatTrnPlaceholder")}
            />
          </FormField>
        </div>
      </SectionCard>

      {/* ── Appearance ── */}
      <SectionCard title={t("general.appearance.title")} description={t("general.appearance.description")} icon={Palette}>
        {/* Theme selector */}
        <div className="mb-5 pb-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("general.appearance.theme")}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "light",  label: t("general.appearance.light"),  icon: Sun },
              { value: "dark",   label: t("general.appearance.dark"),   icon: Moon },
              { value: "system", label: t("general.appearance.system"), icon: Monitor },
            ].map(opt => {
              const Icon = opt.icon;
              const active = appearance.theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateAppearance("theme", opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {opt.label}
                  </span>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles */}
        <div>
          <ToggleRow
            label={t("general.appearance.compactMode")}
            description={t("general.appearance.compactModeDesc")}
            checked={appearance.compactMode}
            onChange={v => updateAppearance("compactMode", v)}
          />
          <ToggleRow
            label={t("general.appearance.breadcrumbs")}
            description={t("general.appearance.breadcrumbsDesc")}
            checked={appearance.showBreadcrumbs}
            onChange={v => updateAppearance("showBreadcrumbs", v)}
          />
          <ToggleRow
            label={t("general.appearance.animations")}
            description={t("general.appearance.animationsDesc")}
            checked={appearance.animationsEnabled}
            onChange={v => updateAppearance("animationsEnabled", v)}
          />
          <ToggleRow
            label={t("general.appearance.rtl")}
            description={t("general.appearance.rtlDesc")}
            checked={appearance.rtlSupport}
            onChange={v => updateAppearance("rtlSupport", v)}
            badge={t("general.appearance.rtlBadge")}
          />
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title={t("general.notifications.title")} description={t("general.notifications.description")} icon={Bell}>
        {/* Email */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.notifications.emailHeading")}</p>
          </div>
          <ToggleRow label={t("general.notifications.emailApprovals")} description={t("general.notifications.emailApprovalsDesc")} checked={notifications.emailApprovals} onChange={v => updateNotifications("emailApprovals", v)} />
          <ToggleRow label={t("general.notifications.emailInvoices")} description={t("general.notifications.emailInvoicesDesc")} checked={notifications.emailInvoices} onChange={v => updateNotifications("emailInvoices", v)} />
          <ToggleRow label={t("general.notifications.emailLeaves")} description={t("general.notifications.emailLeavesDesc")} checked={notifications.emailLeaves} onChange={v => updateNotifications("emailLeaves", v)} />
          <ToggleRow label={t("general.notifications.emailSystem")} description={t("general.notifications.emailSystemDesc")} checked={notifications.emailSystem} onChange={v => updateNotifications("emailSystem", v)} />
        </div>

        {/* SMS */}
        <div className="mb-5 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.notifications.smsHeading")}</p>
          </div>
          <ToggleRow label={t("general.notifications.smsOtp")} description={t("general.notifications.smsOtpDesc")} checked={notifications.smsOtp} onChange={v => updateNotifications("smsOtp", v)} />
          <ToggleRow label={t("general.notifications.smsAlerts")} description={t("general.notifications.smsAlertsDesc")} checked={notifications.smsAlerts} onChange={v => updateNotifications("smsAlerts", v)} />
        </div>

        {/* In-App */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.notifications.inAppHeading")}</p>
          </div>
          <ToggleRow label={t("general.notifications.inAppAll")} description={t("general.notifications.inAppAllDesc")} checked={notifications.inAppAll} onChange={v => updateNotifications("inAppAll", v)} />
          <ToggleRow label={t("general.notifications.inAppMentions")} description={t("general.notifications.inAppMentionsDesc")} checked={notifications.inAppMentions} onChange={v => updateNotifications("inAppMentions", v)} />
          <ToggleRow label={t("general.notifications.inAppTasks")} description={t("general.notifications.inAppTasksDesc")} checked={notifications.inAppTasks} onChange={v => updateNotifications("inAppTasks", v)} />
          <ToggleRow label={t("general.notifications.inAppSystem")} description={t("general.notifications.inAppSystemDesc")} checked={notifications.inAppSystem} onChange={v => updateNotifications("inAppSystem", v)} />
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 items-end">
            <FormField label={t("general.notifications.digest")} hint={t("general.notifications.digestHint")}>
              <SelectField
                value={notifications.digestFrequency}
                onChange={v => updateNotifications("digestFrequency", v)}
                options={DIGEST_VALUES.map(v => ({ value: v, label: t(`general.notifications.digestOption.${v}`) }))}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard title={t("general.security.title")} description={t("general.security.description")} icon={Shield} badge={t("general.security.badge")}>
        <div className="space-y-6">
          {/* Authentication */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.security.authHeading")}</p>
            </div>
            <ToggleRow label={t("general.security.enforce2FA")} description={t("general.security.enforce2FADesc")} checked={security.enforce2FA} onChange={v => updateSecurity("enforce2FA", v)} />
            <ToggleRow label={t("general.security.singleSession")} description={t("general.security.singleSessionDesc")} checked={security.singleSession} onChange={v => updateSecurity("singleSession", v)} />
            <ToggleRow label={t("general.security.ipWhitelist")} description={t("general.security.ipWhitelistDesc")} checked={security.ipWhitelistEnabled} onChange={v => updateSecurity("ipWhitelistEnabled", v)} />
          </div>

          {/* Session */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.security.sessionHeading")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("general.security.sessionTimeout")} hint={t("general.security.sessionTimeoutHint")}>
                <SelectField
                  value={security.sessionTimeout}
                  onChange={v => updateSecurity("sessionTimeout", v)}
                  options={SESSION_TIMEOUTS.map(v => ({ value: v, label: t(`general.security.timeoutOption.${v}`) }))}
                />
              </FormField>
              <FormField label={t("general.security.maxAttempts")} hint={t("general.security.maxAttemptsHint")}>
                <SelectField
                  value={security.maxLoginAttempts}
                  onChange={v => updateSecurity("maxLoginAttempts", v)}
                  options={LOGIN_ATTEMPTS.map(v => ({ value: v, label: t("general.security.attemptsOption", { n: v }) }))}
                />
              </FormField>
            </div>
          </div>

          {/* Password Policy */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{t("general.security.passwordHeading")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField label={t("general.security.minLength")} hint={t("general.security.minLengthHint")}>
                <SelectField
                  value={security.passwordMinLength}
                  onChange={v => updateSecurity("passwordMinLength", v)}
                  options={PASSWORD_LENGTHS.map(n => ({ value: n, label: t("general.security.charactersOption", { n }) }))}
                />
              </FormField>
              <FormField label={t("general.security.expiry")} hint={t("general.security.expiryHint")}>
                <SelectField
                  value={security.passwordExpiry}
                  onChange={v => updateSecurity("passwordExpiry", v)}
                  options={PASSWORD_EXPIRY.map(v => ({ value: v, label: t(`general.security.expiryOption.${v}`) }))}
                />
              </FormField>
            </div>
            <ToggleRow label={t("general.security.requireUpper")} description={t("general.security.requireUpperDesc")} checked={security.passwordRequireUpper}   onChange={v => updateSecurity("passwordRequireUpper", v)} />
            <ToggleRow label={t("general.security.requireNumbers")} description={t("general.security.requireNumbersDesc")} checked={security.passwordRequireNumbers} onChange={v => updateSecurity("passwordRequireNumbers", v)} />
            <ToggleRow label={t("general.security.requireSymbols")} description={t("general.security.requireSymbolsDesc")} checked={security.passwordRequireSymbols} onChange={v => updateSecurity("passwordRequireSymbols", v)} />
          </div>
        </div>
      </SectionCard>

      {/* ── Module Access ── */}
      <SectionCard title={t("general.modules.title")} description={t("general.modules.description")} icon={ToggleLeft} badge={t("general.modules.badge")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {MODULE_KEYS.map(key => (
            <ToggleRow
              key={key}
              label={t(`general.modules.${key}`)}
              description={t(`general.modules.${key}Desc`)}
              checked={modules[key as keyof typeof modules]}
              onChange={v => updateModules(key, v)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Sticky save footer */}
      {isDirty && (
        <div className="sticky bottom-0 -mx-0 pb-2">
          <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center justify-between shadow-lg">
            <p className="text-sm text-muted-foreground">{t("general.unsaved")}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard} disabled={isSaving}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {t("general.discard")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5 mr-1.5" />}
                {t("general.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
