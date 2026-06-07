import * as React from "react";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanType } from "@/lib/admin/tenants.api";

// ── Module catalogue ──────────────────────────────────────────────────────────

export interface ModuleInfo {
  code: string;
  label: string;
  desc: string;
}

export const ALL_MODULES: ModuleInfo[] = [
  { code: "pos",             label: "Point of Sale",     desc: "POS terminal, transactions, cash drawer, receipts"    },
  { code: "inventory.basic", label: "Inventory (Basic)", desc: "Product catalogue, stock levels, reorder alerts"      },
  { code: "inventory",       label: "Inventory (Full)",  desc: "Warehouses, transfers, adjustments, full reporting"   },
  { code: "purchasing",      label: "Purchasing",         desc: "Purchase orders, vendor management, approvals"        },
  { code: "reports.basic",   label: "Reports (Basic)",   desc: "Pre-built POS & stock dashboards"                     },
  { code: "reports",         label: "Reports (Full)",    desc: "Advanced analytics, custom date ranges, exports"      },
  { code: "settings",        label: "Settings",           desc: "App config, branches, tax rates, payment methods"     },
  { code: "hr.basic",        label: "HR (Basic)",         desc: "Employees, attendance tracking, leave requests"       },
  { code: "hr",              label: "HR (Full)",          desc: "Payroll, contracts, performance management"           },
  { code: "crm.basic",       label: "CRM (Basic)",        desc: "Leads pipeline, customer management"                  },
  { code: "crm",             label: "CRM (Full)",         desc: "Deals, forecasting, sales quotations"                 },
  { code: "sales",           label: "Sales",              desc: "Quotations, sales orders, returns"                    },
  { code: "finance",         label: "Finance",            desc: "Accounting, GL, invoicing, budgets, banking"          },
  { code: "manufacturing",   label: "Manufacturing",      desc: "Production planning, construction & project tracking" },
  { code: "api",             label: "API Access",         desc: "External API integrations & webhooks"                 },
  { code: "custom-reports",  label: "Custom Reports",    desc: "Build and share custom report templates"              },
];

/** Plan default module codes — must match backend PlanDefinitions.cs */
export const PLAN_DEFAULTS: Record<PlanType, string[]> = {
  Starter:    ["pos", "inventory.basic", "reports.basic", "settings"],
  Business:   ["pos", "inventory", "purchasing", "reports", "settings", "hr.basic", "crm.basic", "sales"],
  Enterprise: ["pos", "inventory", "purchasing", "reports", "settings", "hr", "crm", "finance", "manufacturing", "api", "custom-reports", "sales"],
};

/** Returns true if two module lists represent the same set. */
export function moduleSetsEqual(a: string[], b: string[]): boolean {
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every(x => sb.has(x));
}

// ── Per-module colour tokens ──────────────────────────────────────────────────

const CHIP_STYLE: Record<string, string> = {
  "pos":             "bg-blue-100   border-blue-400   text-blue-800   dark:bg-blue-900/40   dark:border-blue-600   dark:text-blue-300",
  "inventory.basic": "bg-green-100  border-green-400  text-green-800  dark:bg-green-900/40  dark:border-green-600  dark:text-green-300",
  "inventory":       "bg-teal-100   border-teal-400   text-teal-800   dark:bg-teal-900/40   dark:border-teal-600   dark:text-teal-300",
  "purchasing":      "bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300",
  "reports.basic":   "bg-purple-100 border-purple-400 text-purple-800 dark:bg-purple-900/40 dark:border-purple-600 dark:text-purple-300",
  "reports":         "bg-violet-100 border-violet-400 text-violet-800 dark:bg-violet-900/40 dark:border-violet-600 dark:text-violet-300",
  "settings":        "bg-slate-100  border-slate-400  text-slate-700  dark:bg-slate-900/40  dark:border-slate-500  dark:text-slate-300",
  "hr.basic":        "bg-indigo-100 border-indigo-400 text-indigo-800 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300",
  "hr":              "bg-sky-100    border-sky-400    text-sky-800    dark:bg-sky-900/40    dark:border-sky-600    dark:text-sky-300",
  "crm.basic":       "bg-pink-100   border-pink-400   text-pink-800   dark:bg-pink-900/40   dark:border-pink-600   dark:text-pink-300",
  "crm":             "bg-rose-100   border-rose-400   text-rose-800   dark:bg-rose-900/40   dark:border-rose-600   dark:text-rose-300",
  "sales":           "bg-red-100    border-red-400    text-red-800    dark:bg-red-900/40    dark:border-red-600    dark:text-red-300",
  "finance":         "bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300",
  "manufacturing":   "bg-amber-100  border-amber-400  text-amber-800  dark:bg-amber-900/40  dark:border-amber-600  dark:text-amber-300",
  "api":             "bg-cyan-100   border-cyan-400   text-cyan-800   dark:bg-cyan-900/40   dark:border-cyan-600   dark:text-cyan-300",
  "custom-reports":  "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:border-fuchsia-600 dark:text-fuchsia-300",
};

function chipStyle(code: string) {
  return CHIP_STYLE[code] ?? "bg-gray-100 border-gray-400 text-gray-700";
}

// ── ModuleSelector ────────────────────────────────────────────────────────────

interface ModuleSelectorProps {
  selected: string[];
  onChange: (modules: string[]) => void;
  /** Shown as hint + used by the "Reset" button. */
  planDefaults?: string[];
  /** When true, chips are visual-only (no click). */
  readOnly?: boolean;
  /** Show the "Reset to plan defaults" button (default true when planDefaults provided). */
  showReset?: boolean;
}

export function ModuleSelector({
  selected,
  onChange,
  planDefaults = [],
  readOnly = false,
  showReset = true,
}: ModuleSelectorProps) {
  const toggle = (code: string) => {
    if (readOnly) return;
    onChange(
      selected.includes(code) ? selected.filter(m => m !== code) : [...selected, code],
    );
  };

  const isDefault = React.useMemo(
    () => planDefaults.length > 0 && moduleSetsEqual(selected, planDefaults),
    [selected, planDefaults],
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {ALL_MODULES.map(m => {
          const active = selected.includes(m.code);
          return (
            <button
              key={m.code}
              type="button"
              title={m.desc}
              disabled={readOnly}
              onClick={() => toggle(m.code)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all select-none",
                active
                  ? cn(chipStyle(m.code), "border-2 shadow-sm")
                  : readOnly
                    ? "hidden"   // in read-only mode hide un-selected modules
                    : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {!readOnly && active && <Check className="h-2.5 w-2.5 shrink-0" />}
              {m.label}
            </button>
          );
        })}
      </div>

      {!readOnly && showReset && planDefaults.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {isDefault
              ? "Showing plan defaults. Toggle chips to customise."
              : `${selected.length} module${selected.length !== 1 ? "s" : ""} selected (custom override active).`}
          </p>
          {!isDefault && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-muted-foreground"
              onClick={() => onChange(planDefaults)}
            >
              <RotateCcw className="h-2.5 w-2.5 mr-1" />
              Reset to defaults
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
