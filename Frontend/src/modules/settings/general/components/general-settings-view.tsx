"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2, Globe, MapPin, Bell, Shield, Palette,
  CheckCircle, Camera, ChevronRight, Moon, Sun, Monitor,
  Mail, MessageSquare, Smartphone, Lock, Clock, KeyRound,
  ToggleLeft, Save, RotateCcw, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";

const SETTINGS_KEY = "softaxis-app-settings";

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
function UnsavedBanner({ onSave, onDiscard }: { onSave: () => void; onDiscard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl mb-4"
    >
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
      <p className="text-sm text-warning font-medium flex-1">You have unsaved changes</p>
      <Button size="sm" variant="outline" onClick={onDiscard}>
        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Discard
      </Button>
      <Button size="sm" onClick={onSave}>
        <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
      </Button>
    </motion.div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function GeneralSettingsView() {
  // Company Profile state
  const [company, setCompany] = React.useState({
    name: "Softaxis Technologies LLC",
    legalName: "Softaxis Technologies LLC",
    industry: "IT Services / SaaS",
    website: "www.softaxis.io",
    companySize: "50-200",
    registrationNo: "UAE-LLC-2019-84721",
    phone: "+971 4 123 4567",
    email: "info@softaxis.io",
    supportEmail: "support@softaxis.io",
    address: "Dubai Internet City, Building 10, Office 402, Dubai, UAE",
    poBox: "73912, Dubai, UAE",
  });

  // Regional state
  const [regional, setRegional] = React.useState({
    currency: "AED",
    timezone: "Asia/Dubai",
    dateFormat: "DD/MM/YYYY",
    language: "en-US",
    numberFormat: "1,234,567.89",
    vatRate: "5",
    fiscalYearStart: "January",
    vatTrn: "100254876300003",
  });

  // Appearance state
  const [appearance, setAppearance] = React.useState({
    theme: "system" as "light" | "dark" | "system",
    sidebarCollapsed: false,
    compactMode: false,
    showBreadcrumbs: true,
    animationsEnabled: true,
    rtlSupport: false,
  });

  // Notifications state
  const [notifications, setNotifications] = React.useState({
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
  });

  // Security state
  const [security, setSecurity] = React.useState({
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
  });

  // Modules state
  const [modules, setModules] = React.useState({
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
  });

  const [isDirty, setIsDirty] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const updatePreferences = useAuthStore(s => s.updatePreferences);

  const markDirty = () => setIsDirty(true);

  // Load persisted settings on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.company)       setCompany(c => ({ ...c, ...saved.company }));
      if (saved.regional)      setRegional(r => ({ ...r, ...saved.regional }));
      if (saved.appearance)    setAppearance(a => ({ ...a, ...saved.appearance }));
      if (saved.notifications) setNotifications(n => ({ ...n, ...saved.notifications }));
      if (saved.security)      setSecurity(s => ({ ...s, ...saved.security }));
      if (saved.modules)       setModules(m => ({ ...m, ...saved.modules }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    // Persist full settings to localStorage
    const snapshot = { company, regional, appearance, notifications, security, modules };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }

    // Sync user-level preferences to auth store (theme, language, currency, dateFormat, timezone)
    updatePreferences({
      theme: appearance.theme,
      language: regional.language.startsWith("ar") ? "ar" : "en",
      currency: regional.currency as any,
      dateFormat: regional.dateFormat,
      timezone: regional.timezone,
      sidebarCollapsed: appearance.sidebarCollapsed ?? false,
    });

    setIsDirty(false);
    setSaveSuccess(true);
    toast.success("Settings saved successfully.");
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDiscard = () => {
    // Revert from saved snapshot
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.company)       setCompany(saved.company);
        if (saved.regional)      setRegional(saved.regional);
        if (saved.appearance)    setAppearance(saved.appearance);
        if (saved.notifications) setNotifications(saved.notifications);
        if (saved.security)      setSecurity(saved.security);
        if (saved.modules)       setModules(saved.modules);
      }
    } catch { /* ignore */ }
    setIsDirty(false);
  };

  const updateCompany = (key: string, value: string) => {
    setCompany(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateRegional = (key: string, value: string) => {
    setRegional(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateAppearance = (key: string, value: boolean | string) => {
    setAppearance(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateNotifications = (key: string, value: boolean | string) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateSecurity = (key: string, value: boolean | string) => {
    setSecurity(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateModules = (key: string, value: boolean) => {
    setModules(prev => ({ ...prev, [key]: value }));
    markDirty();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company profile, regional preferences, and system-wide configuration.
          </p>
        </div>
        {saveSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
      </div>

      {/* Unsaved Banner */}
      {isDirty && <UnsavedBanner onSave={handleSave} onDiscard={handleDiscard} />}

      {/* ── Company Profile ── */}
      <SectionCard title="Company Profile" description="Legal name, industry, and contact details" icon={Building2}>
        {/* Logo */}
        <div className="flex items-start gap-5 mb-6 pb-6 border-b border-border">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <span className="text-3xl font-bold text-primary">S</span>
            </div>
            <button className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-muted/40 transition-colors">
              <Camera className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{company.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{company.industry}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
              <span className="text-xs text-muted-foreground">ID: SXT-2019-001</span>
            </div>
            <Button variant="outline" size="sm" className="mt-3 h-7 text-xs">Upload Logo</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Company Name">
            <Input
              value={company.name}
              onChange={e => updateCompany("name", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <FormField label="Legal Name">
            <Input
              value={company.legalName}
              onChange={e => updateCompany("legalName", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <FormField label="Industry">
            <SelectField
              value={company.industry}
              onChange={v => updateCompany("industry", v)}
              options={[
                { value: "IT Services / SaaS", label: "IT Services / SaaS" },
                { value: "Real Estate", label: "Real Estate" },
                { value: "Construction", label: "Construction" },
                { value: "Hospitality", label: "Hospitality" },
                { value: "Retail", label: "Retail" },
                { value: "Manufacturing", label: "Manufacturing" },
                { value: "Healthcare", label: "Healthcare" },
                { value: "Finance", label: "Finance" },
              ]}
            />
          </FormField>
          <FormField label="Company Size">
            <SelectField
              value={company.companySize}
              onChange={v => updateCompany("companySize", v)}
              options={[
                { value: "1-10", label: "1–10 employees" },
                { value: "11-50", label: "11–50 employees" },
                { value: "50-200", label: "50–200 employees" },
                { value: "201-500", label: "201–500 employees" },
                { value: "500+", label: "500+ employees" },
              ]}
            />
          </FormField>
          <FormField label="Website">
            <Input
              value={company.website}
              onChange={e => updateCompany("website", e.target.value)}
              className="h-9 text-sm"
              placeholder="www.example.com"
            />
          </FormField>
          <FormField label="Registration Number">
            <Input
              value={company.registrationNo}
              onChange={e => updateCompany("registrationNo", e.target.value)}
              className="h-9 text-sm font-mono"
            />
          </FormField>
          <FormField label="Primary Phone">
            <Input
              value={company.phone}
              onChange={e => updateCompany("phone", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <FormField label="Primary Email">
            <Input
              value={company.email}
              onChange={e => updateCompany("email", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <FormField label="Support Email">
            <Input
              value={company.supportEmail}
              onChange={e => updateCompany("supportEmail", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <FormField label="P.O. Box">
            <Input
              value={company.poBox}
              onChange={e => updateCompany("poBox", e.target.value)}
              className="h-9 text-sm"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Headquarters Address">
              <Input
                value={company.address}
                onChange={e => updateCompany("address", e.target.value)}
                className="h-9 text-sm"
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── Regional Settings ── */}
      <SectionCard title="Regional & Locale" description="Currency, timezone, date formats, and fiscal year" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Default Currency">
            <SelectField
              value={regional.currency}
              onChange={v => updateRegional("currency", v)}
              options={[
                { value: "AED", label: "AED – UAE Dirham" },
                { value: "SAR", label: "SAR – Saudi Riyal" },
                { value: "USD", label: "USD – US Dollar" },
                { value: "EUR", label: "EUR – Euro" },
                { value: "GBP", label: "GBP – British Pound" },
                { value: "INR", label: "INR – Indian Rupee" },
              ]}
            />
          </FormField>
          <FormField label="Timezone">
            <SelectField
              value={regional.timezone}
              onChange={v => updateRegional("timezone", v)}
              options={[
                { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
                { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
                { value: "Europe/London", label: "Europe/London (UTC+1)" },
                { value: "America/New_York", label: "America/New_York (UTC-5)" },
                { value: "Asia/Kolkata", label: "Asia/Kolkata (UTC+5:30)" },
              ]}
            />
          </FormField>
          <FormField label="Date Format">
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
          <FormField label="Language">
            <SelectField
              value={regional.language}
              onChange={v => updateRegional("language", v)}
              options={[
                { value: "en-US", label: "English (US)" },
                { value: "en-GB", label: "English (UK)" },
                { value: "ar-AE", label: "Arabic (UAE)" },
                { value: "fr-FR", label: "French" },
                { value: "hi-IN", label: "Hindi" },
              ]}
            />
          </FormField>
          <FormField label="Number Format">
            <SelectField
              value={regional.numberFormat}
              onChange={v => updateRegional("numberFormat", v)}
              options={[
                { value: "1,234,567.89", label: "1,234,567.89 (comma thousands)" },
                { value: "1.234.567,89", label: "1.234.567,89 (dot thousands)" },
                { value: "1 234 567.89", label: "1 234 567.89 (space thousands)" },
              ]}
            />
          </FormField>
          <FormField label="Fiscal Year Start">
            <SelectField
              value={regional.fiscalYearStart}
              onChange={v => updateRegional("fiscalYearStart", v)}
              options={["January","February","March","April","July","October"].map(m => ({ value: m, label: m }))}
            />
          </FormField>
          <FormField label="VAT Rate (%)" hint="Applied to all taxable transactions">
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
          <FormField label="VAT / TRN Number">
            <Input
              value={regional.vatTrn}
              onChange={e => updateRegional("vatTrn", e.target.value)}
              className="h-9 text-sm font-mono"
              placeholder="TRN number"
            />
          </FormField>
        </div>
      </SectionCard>

      {/* ── Appearance ── */}
      <SectionCard title="Appearance" description="Theme, layout density, and UI preferences" icon={Palette}>
        {/* Theme selector */}
        <div className="mb-5 pb-5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark",  label: "Dark",  icon: Moon },
              { value: "system",label: "System",icon: Monitor },
            ].map(opt => {
              const Icon = opt.icon;
              const active = appearance.theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { updateAppearance("theme", opt.value); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
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
            label="Compact Mode"
            description="Reduce spacing and padding for denser information display"
            checked={appearance.compactMode}
            onChange={v => updateAppearance("compactMode", v)}
          />
          <ToggleRow
            label="Show Breadcrumbs"
            description="Display navigation breadcrumbs in the topbar"
            checked={appearance.showBreadcrumbs}
            onChange={v => updateAppearance("showBreadcrumbs", v)}
          />
          <ToggleRow
            label="Enable Animations"
            description="Page transitions and micro-interaction animations"
            checked={appearance.animationsEnabled}
            onChange={v => updateAppearance("animationsEnabled", v)}
          />
          <ToggleRow
            label="RTL Support"
            description="Enable right-to-left layout for Arabic interface"
            checked={appearance.rtlSupport}
            onChange={v => updateAppearance("rtlSupport", v)}
            badge="Arabic"
          />
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notification Preferences" description="Control how and when you receive system alerts" icon={Bell}>
        {/* Email */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Email Notifications</p>
          </div>
          <ToggleRow label="Approval Requests" description="Receive email when items require your approval" checked={notifications.emailApprovals} onChange={v => updateNotifications("emailApprovals", v)} />
          <ToggleRow label="Invoice & Payment Alerts" description="New invoices raised and payment confirmations" checked={notifications.emailInvoices} onChange={v => updateNotifications("emailInvoices", v)} />
          <ToggleRow label="Leave & HR Notifications" description="Leave approvals, rejections, and HR actions" checked={notifications.emailLeaves} onChange={v => updateNotifications("emailLeaves", v)} />
          <ToggleRow label="System Announcements" description="Platform updates, maintenance windows, and news" checked={notifications.emailSystem} onChange={v => updateNotifications("emailSystem", v)} />
        </div>

        {/* SMS */}
        <div className="mb-5 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">SMS / WhatsApp</p>
          </div>
          <ToggleRow label="OTP & 2FA Codes" description="One-time passwords for login verification" checked={notifications.smsOtp} onChange={v => updateNotifications("smsOtp", v)} />
          <ToggleRow label="Critical Alerts" description="Urgent system alerts and security warnings via SMS" checked={notifications.smsAlerts} onChange={v => updateNotifications("smsAlerts", v)} />
        </div>

        {/* In-App */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">In-App Notifications</p>
          </div>
          <ToggleRow label="All Notifications" description="Master toggle for in-app notification panel" checked={notifications.inAppAll} onChange={v => updateNotifications("inAppAll", v)} />
          <ToggleRow label="Mentions & Tags" description="When someone mentions you in a comment or note" checked={notifications.inAppMentions} onChange={v => updateNotifications("inAppMentions", v)} />
          <ToggleRow label="Task Assignments" description="New tasks assigned to you or your team" checked={notifications.inAppTasks} onChange={v => updateNotifications("inAppTasks", v)} />
          <ToggleRow label="System Events" description="Background jobs, imports, and system events" checked={notifications.inAppSystem} onChange={v => updateNotifications("inAppSystem", v)} />
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 items-end">
            <FormField label="Email Digest Frequency" hint="Summary of all notifications sent together">
              <SelectField
                value={notifications.digestFrequency}
                onChange={v => updateNotifications("digestFrequency", v)}
                options={[
                  { value: "realtime", label: "Real-time (immediately)" },
                  { value: "hourly", label: "Hourly digest" },
                  { value: "daily", label: "Daily digest (08:00 UAE)" },
                  { value: "weekly", label: "Weekly digest (Monday)" },
                ]}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard title="Security & Access" description="Authentication, password policies, and session management" icon={Shield} badge="Admin Only">
        <div className="space-y-6">
          {/* Authentication */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Authentication</p>
            </div>
            <ToggleRow label="Enforce Two-Factor Authentication" description="Require all users to set up 2FA to access the system" checked={security.enforce2FA} onChange={v => updateSecurity("enforce2FA", v)} />
            <ToggleRow label="Single Active Session" description="Prevent users from being logged in on multiple devices simultaneously" checked={security.singleSession} onChange={v => updateSecurity("singleSession", v)} />
            <ToggleRow label="IP Whitelist" description="Restrict access to specific IP addresses or ranges" checked={security.ipWhitelistEnabled} onChange={v => updateSecurity("ipWhitelistEnabled", v)} />
          </div>

          {/* Session */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Session</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Session Timeout (minutes)" hint="Auto-logout after inactivity">
                <SelectField
                  value={security.sessionTimeout}
                  onChange={v => updateSecurity("sessionTimeout", v)}
                  options={[
                    { value: "30", label: "30 minutes" },
                    { value: "60", label: "1 hour" },
                    { value: "240", label: "4 hours" },
                    { value: "480", label: "8 hours" },
                    { value: "1440", label: "24 hours" },
                  ]}
                />
              </FormField>
              <FormField label="Max Login Attempts" hint="Account lock after failed attempts">
                <SelectField
                  value={security.maxLoginAttempts}
                  onChange={v => updateSecurity("maxLoginAttempts", v)}
                  options={[
                    { value: "3", label: "3 attempts" },
                    { value: "5", label: "5 attempts" },
                    { value: "10", label: "10 attempts" },
                  ]}
                />
              </FormField>
            </div>
          </div>

          {/* Password Policy */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Password Policy</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField label="Minimum Length" hint="Minimum character requirement">
                <SelectField
                  value={security.passwordMinLength}
                  onChange={v => updateSecurity("passwordMinLength", v)}
                  options={["8","10","12","14","16"].map(n => ({ value: n, label: `${n} characters` }))}
                />
              </FormField>
              <FormField label="Password Expiry" hint="Force reset after N days">
                <SelectField
                  value={security.passwordExpiry}
                  onChange={v => updateSecurity("passwordExpiry", v)}
                  options={[
                    { value: "30", label: "30 days" },
                    { value: "60", label: "60 days" },
                    { value: "90", label: "90 days" },
                    { value: "180", label: "180 days" },
                    { value: "never", label: "Never expire" },
                  ]}
                />
              </FormField>
            </div>
            <ToggleRow label="Require Uppercase Letters" description="Password must contain at least one uppercase letter (A–Z)" checked={security.passwordRequireUpper} onChange={v => updateSecurity("passwordRequireUpper", v)} />
            <ToggleRow label="Require Numbers" description="Password must contain at least one number (0–9)" checked={security.passwordRequireNumbers} onChange={v => updateSecurity("passwordRequireNumbers", v)} />
            <ToggleRow label="Require Special Characters" description="Password must contain !@#$%^&* or similar symbols" checked={security.passwordRequireSymbols} onChange={v => updateSecurity("passwordRequireSymbols", v)} />
          </div>
        </div>
      </SectionCard>

      {/* ── Module Access ── */}
      <SectionCard title="Module Access" description="Enable or disable system modules across the organisation" icon={ToggleLeft} badge="Enterprise">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {[
            { key: "crm",          label: "CRM",             description: "Leads, pipeline, and customers" },
            { key: "finance",      label: "Finance",          description: "Accounting, invoicing, and banking" },
            { key: "hr",           label: "HR & Payroll",     description: "Employees, leaves, and payroll" },
            { key: "sales",        label: "Sales",            description: "Quotations and sales orders" },
            { key: "purchase",     label: "Purchase",         description: "Vendors and purchase orders" },
            { key: "inventory",    label: "Inventory",        description: "Stock, warehouses, and transfers" },
            { key: "realEstate",   label: "Real Estate",      description: "Properties, tenants, and contracts" },
            { key: "construction", label: "Construction",     description: "Projects, BOQ, and contractors" },
            { key: "hospitality",  label: "Hospitality",      description: "Bookings, rooms, and housekeeping" },
            { key: "pos",          label: "Point of Sale",    description: "Retail, restaurant, and kitchen" },
            { key: "aiAssistant",  label: "AI Assistant",     description: "Conversational AI and automation" },
            { key: "fileManager",  label: "File Manager",     description: "Document storage and sharing" },
          ].map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
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
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Discard
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
