/**
 * PaymentMethodsSettings
 *
 * Payment methods filtered by the tenant's country / currency.
 * Country is auto-detected from the tenant profile but can be overridden.
 *
 * - Universal methods (* countries) → always shown
 * - Country-specific methods → shown only for the selected country
 * - Other-country methods → collapsed "Other regions" section
 * - Custom methods → always shown
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Plus, RotateCcw, Save, Loader2,
  ChevronUp, ChevronDown, Trash2, GripVertical,
  CheckCircle2, Globe, X, ChevronRight, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePaymentMethodsManager } from "@/hooks/pos/use-payment-methods";
import {
  PAYMENT_METHOD_REGISTRY,
  buildCustomDef,
  type PaymentMethodDef,
} from "@/lib/pos/payment-methods.config";
import type { PaymentMethodDto, PaymentMethodSaveItem } from "@/lib/pos/payment-methods.api";

// ─── Country options ──────────────────────────────────────────────────────────

const COUNTRY_OPTIONS: { code: string; flag: string; name: string }[] = [
  { code: "pk", flag: "🇵🇰", name: "Pakistan"       },
  { code: "ae", flag: "🇦🇪", name: "UAE"            },
  { code: "sa", flag: "🇸🇦", name: "Saudi Arabia"   },
  { code: "in", flag: "🇮🇳", name: "India"          },
  { code: "gb", flag: "🇬🇧", name: "United Kingdom" },
  { code: "us", flag: "🇺🇸", name: "United States"  },
  { code: "om", flag: "🇴🇲", name: "Oman"           },
  { code: "qa", flag: "🇶🇦", name: "Qatar"          },
  { code: "kw", flag: "🇰🇼", name: "Kuwait"         },
  { code: "bh", flag: "🇧🇭", name: "Bahrain"        },
];

function countryInfo(code: string) {
  return COUNTRY_OPTIONS.find(c => c.code === code)
    ?? { code, flag: "🌐", name: code.toUpperCase() };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Does this method's countries string cover the given country code? */
function matchesCountry(countries: string, code: string): boolean {
  if (!countries || countries === "*") return true;
  return countries.split(",").map(s => s.trim().toLowerCase()).includes(code.toLowerCase());
}

/** DTO → PaymentMethodDef (looks up registry by code; falls back to custom def) */
function dtoToDef(dto: PaymentMethodDto): PaymentMethodDef {
  const reg = PAYMENT_METHOD_REGISTRY.find(
    m => m.id.toLowerCase() === dto.code.toLowerCase(),
  );
  return reg ?? buildCustomDef({ id: dto.code, label: dto.label });
}

// ─── LocalMethod shape ────────────────────────────────────────────────────────

interface LocalMethod {
  code:      string;
  label:     string;
  isEnabled: boolean;
  sortOrder: number;
  isSystem:  boolean;
  /** Comma-separated country codes from the backend (e.g. "pk" | "ae,sa" | "*") */
  countries: string;
  isNew?:    boolean;
  backendId?: string;
}

// ─── Country Picker ───────────────────────────────────────────────────────────

function CountryPicker({
  value,
  autoDetected,
  onChange,
}: {
  value:         string;
  autoDetected:  string;
  onChange:      (code: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = countryInfo(value);
  const isOverridden = value !== autoDetected;

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all",
          open
            ? "bg-primary/5 border-primary/30 text-foreground"
            : "bg-muted/50 border-border text-foreground hover:border-primary/20",
        )}
      >
        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-semibold">{current.name}</span>
        {isOverridden ? (
          <span className="text-primary text-[10px] font-medium">overridden</span>
        ) : (
          <span className="text-muted-foreground text-[10px]">auto-detected</span>
        )}
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {/* Auto-detect option */}
            {isOverridden && (
              <button
                onClick={() => { onChange(autoDetected); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b border-border"
              >
                <span className="text-sm">{countryInfo(autoDetected).flag}</span>
                <span className="flex-1 text-left font-medium">{countryInfo(autoDetected).name}</span>
                <span className="text-[10px] text-primary font-semibold">auto</span>
              </button>
            )}
            {COUNTRY_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onClick={() => { onChange(opt.code); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors",
                  opt.code === value && "bg-primary/5 text-primary font-semibold",
                )}
              >
                <span className="text-sm">{opt.flag}</span>
                <span className="flex-1 text-left">{opt.name}</span>
                {opt.code === value && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MethodRow ────────────────────────────────────────────────────────────────

function MethodRow({
  method, def, canMoveUp, canMoveDown, dim,
  onToggle, onMoveUp, onMoveDown, onDelete,
}: {
  method:      LocalMethod;
  def:         PaymentMethodDef;
  canMoveUp:   boolean;
  canMoveDown: boolean;
  dim?:        boolean;
  onToggle:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
  onDelete:    () => void;
}) {
  const Icon = def.icon;
  const isUniversal = !method.countries || method.countries === "*";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
        method.isEnabled
          ? "bg-card border-border shadow-sm"
          : "bg-muted/20 border-dashed border-border/50 opacity-60",
        dim && "opacity-40",
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
        method.isEnabled ? def.bg : "bg-muted/30 border-border/40",
      )}>
        <Icon className={cn("h-4 w-4", method.isEnabled ? def.color : "text-muted-foreground")} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{def.label}</p>
        {def.description && (
          <p className="text-[11px] text-muted-foreground truncate">{def.description}</p>
        )}
      </div>

      {/* Country scope badge */}
      {isUniversal ? (
        <span className="hidden sm:flex items-center gap-1 text-[9px] font-bold text-muted-foreground shrink-0">
          <Globe className="h-2.5 w-2.5" />Universal
        </span>
      ) : (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {method.countries.split(",").slice(0, 3).map(c => (
            <span key={c}
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">
              {c.trim()}
            </span>
          ))}
          {method.countries.split(",").length > 3 && (
            <span className="text-[9px] text-muted-foreground">
              +{method.countries.split(",").length - 3}
            </span>
          )}
        </div>
      )}

      {method.isEnabled && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={!canMoveUp}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted/60 disabled:opacity-25 transition-colors">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted/60 disabled:opacity-25 transition-colors">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {!method.isSystem && (
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete custom method">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors shrink-0",
            method.isEnabled ? "bg-primary" : "bg-muted border border-border",
          )}
          title={method.isEnabled ? "Disable" : "Enable"}
        >
          <span className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
            method.isEnabled ? "translate-x-5" : "translate-x-0.5",
          )} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── AddCustomForm ────────────────────────────────────────────────────────────

function AddCustomForm({ onAdd, onCancel, existingCodes }: {
  onAdd:         (label: string) => void;
  onCancel:      () => void;
  existingCodes: string[];
}) {
  const [label, setLabel] = React.useState("");
  const code = `custom_${label.trim().toLowerCase().replace(/\s+/g, "_")}`;
  const alreadyExists = existingCodes.includes(code);

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed || alreadyExists) return;
    onAdd(trimmed);
    setLabel("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 mt-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <CreditCard className="h-4 w-4 text-primary" />
        </div>
        <Input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder="Custom method name, e.g. Gift Card"
          className="h-8 text-sm flex-1"
        />
        {alreadyExists && (
          <span className="text-[11px] text-destructive shrink-0">Already exists</span>
        )}
        <Button size="sm" onClick={submit} disabled={!label.trim() || alreadyExists} className="h-8 gap-1">
          <Plus className="h-3 w-3" />Add
        </Button>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaymentMethodsSettings() {
  const {
    isLoading, isSaving,
    countryCode,
    methods,
    seedIds,
    save, reset, deleteCustom,
  } = usePaymentMethodsManager();

  // Country override: starts from auto-detected, user can change
  const [selectedCountry, setSelectedCountry] = React.useState<string>(countryCode);
  React.useEffect(() => { setSelectedCountry(countryCode); }, [countryCode]);

  const [localMethods,  setLocalMethods] = React.useState<LocalMethod[]>([]);
  const [showAddForm,   setShowAddForm]  = React.useState(false);
  const [dirty,         setDirty]        = React.useState(false);
  const [showOther,     setShowOther]    = React.useState(false);

  // Sync backend data → local state (includes countries field)
  React.useEffect(() => {
    if (!isLoading && methods.length > 0) {
      setLocalMethods(
        [...methods]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(d => ({
            code:      d.code,
            label:     d.label,
            isEnabled: d.isEnabled,
            sortOrder: d.sortOrder,
            isSystem:  d.isSystem,
            countries: d.countries ?? "*",
            backendId: d.id,
          })),
      );
      setDirty(false);
    }
  }, [isLoading, methods]);

  const markDirty = () => setDirty(true);

  // ── Split by country relevance ────────────────────────────────────────────
  // Relevant: universal (*), matches selected country, or custom (isNew)
  const isRelevant = (m: LocalMethod) =>
    !m.isSystem || m.isNew || matchesCountry(m.countries, selectedCountry);

  const relevantMethods = localMethods.filter(isRelevant);
  const otherMethods    = localMethods.filter(m => !isRelevant(m));

  const enabledRelevant  = relevantMethods.filter(m => m.isEnabled);
  const disabledRelevant = relevantMethods.filter(m => !m.isEnabled);

  // ── Operations ────────────────────────────────────────────────────────────
  const toggle = (code: string) => {
    setLocalMethods(prev => prev.map(m => m.code === code ? { ...m, isEnabled: !m.isEnabled } : m));
    markDirty();
  };

  const moveUp = (code: string) => {
    setLocalMethods(prev => {
      const idx = prev.findIndex(m => m.code === code);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    markDirty();
  };

  const moveDown = (code: string) => {
    setLocalMethods(prev => {
      const idx = prev.findIndex(m => m.code === code);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    markDirty();
  };

  const addCustom = (label: string) => {
    const code = `custom_${label.trim().toLowerCase().replace(/\s+/g, "_")}`;
    setLocalMethods(prev => [...prev, {
      code, label, isEnabled: true, sortOrder: prev.length,
      isSystem: false, countries: "*", isNew: true,
    }]);
    setShowAddForm(false);
    markDirty();
  };

  const deleteMethod = async (m: LocalMethod) => {
    if (m.isNew) {
      setLocalMethods(prev => prev.filter(x => x.code !== m.code));
      return;
    }
    try {
      if (m.backendId) await deleteCustom(m.backendId);
      setLocalMethods(prev => prev.filter(x => x.code !== m.code));
      toast.success(`"${m.label}" removed`);
    } catch {
      toast.error("Failed to delete method");
    }
  };

  const handleSave = async () => {
    const items: PaymentMethodSaveItem[] = localMethods.map((m, idx) => ({
      code:      m.code,
      label:     m.label,
      isEnabled: m.isEnabled,
      sortOrder: idx,
      isCustom:  !m.isSystem,
    }));
    await save(items);
    toast.success("Payment methods saved");
    setDirty(false);
  };

  const handleReset = async () => {
    await reset();
    toast.success("Reset to country defaults");
    setDirty(false);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Payment Methods</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose which payment methods appear on the POS charge screen.
            Showing methods available in your region.
          </p>
        </div>
        <CountryPicker
          value={selectedCountry}
          autoDetected={countryCode}
          onChange={setSelectedCountry}
        />
      </div>

      {/* ── Enabled (relevant) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Enabled ({enabledRelevant.length})
          </p>
          <p className="text-[11px] text-muted-foreground">Use arrows to reorder</p>
        </div>

        {enabledRelevant.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            No methods enabled — enable at least one below.
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {enabledRelevant.map((m, idx) => (
                <MethodRow
                  key={m.code}
                  method={m}
                  def={dtoToDef({ id: m.backendId ?? m.code, code: m.code, label: m.label, iconKey: "", countries: m.countries, description: null, sortOrder: m.sortOrder, isEnabled: m.isEnabled, isSystem: m.isSystem })}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < enabledRelevant.length - 1}
                  onToggle={() => toggle(m.code)}
                  onMoveUp={() => moveUp(m.code)}
                  onMoveDown={() => moveDown(m.code)}
                  onDelete={() => deleteMethod(m)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Available but disabled (relevant) ── */}
      {disabledRelevant.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Available — not enabled ({disabledRelevant.length})
          </p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {disabledRelevant.map(m => (
                <MethodRow
                  key={m.code}
                  method={m}
                  def={dtoToDef({ id: m.backendId ?? m.code, code: m.code, label: m.label, iconKey: "", countries: m.countries, description: null, sortOrder: m.sortOrder, isEnabled: m.isEnabled, isSystem: m.isSystem })}
                  canMoveUp={false}
                  canMoveDown={false}
                  onToggle={() => toggle(m.code)}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  onDelete={() => deleteMethod(m)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Other regions (collapsible) ── */}
      {otherMethods.length > 0 && (
        <div>
          <button
            onClick={() => setShowOther(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-2"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showOther && "rotate-90")} />
            Other Regions ({otherMethods.length})
            <span className="text-[10px] normal-case font-normal text-muted-foreground/60 ml-1">
              — not available in {countryInfo(selectedCountry).name}
            </span>
          </button>

          <AnimatePresence>
            {showOther && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1.5"
              >
                {otherMethods.map(m => (
                  <MethodRow
                    key={m.code}
                    method={m}
                    def={dtoToDef({ id: m.backendId ?? m.code, code: m.code, label: m.label, iconKey: "", countries: m.countries, description: null, sortOrder: m.sortOrder, isEnabled: m.isEnabled, isSystem: m.isSystem })}
                    dim
                    canMoveUp={false}
                    canMoveDown={false}
                    onToggle={() => toggle(m.code)}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    onDelete={() => deleteMethod(m)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Add custom ── */}
      <div>
        <AnimatePresence>
          {showAddForm && (
            <AddCustomForm
              onAdd={addCustom}
              onCancel={() => setShowAddForm(false)}
              existingCodes={localMethods.map(m => m.code)}
            />
          )}
        </AnimatePresence>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors mt-1">
            <Plus className="h-4 w-4" />
            Add Custom Method
          </button>
        )}
      </div>

      {/* ── Save / Reset ── */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={handleReset}
          disabled={isSaving}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Defaults
        </button>

        <div className="flex items-center gap-3">
          {dirty && (
            <p className="text-xs text-warning font-medium">Unsaved changes</p>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !dirty}
            className="gap-2 min-w-[120px]">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              : <><Save className="h-4 w-4" />Save Methods</>
            }
          </Button>
        </div>
      </div>

      {/* ── POS Preview ── */}
      {enabledRelevant.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              POS Preview — charge screen
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledRelevant.map(m => {
              const def = dtoToDef({ id: m.backendId ?? m.code, code: m.code, label: m.label, iconKey: "", countries: m.countries, description: null, sortOrder: m.sortOrder, isEnabled: m.isEnabled, isSystem: m.isSystem });
              const Icon = def.icon;
              return (
                <div key={m.code} className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold",
                  def.bg, def.color,
                )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {def.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
