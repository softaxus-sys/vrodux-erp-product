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

// Codes here MUST match the frontend `ModuleKey` union (src/types/global.ts) — that's what
// hasModuleAccess()/the sidebar nav (config/navigation.ts) actually gate on via
// tenant.enabledModules.includes(module). This catalog previously used stale/legacy codes
// (e.g. "purchasing", "inventory.basic", "manufacturing") that didn't match any real ModuleKey,
// so selecting them here never actually unlocked anything — and several real modules
// (Restaurant, Visa, Project Management, the CRM industry verticals, Recipe…) had no chip at all.
export const ALL_MODULES: ModuleInfo[] = [
  { code: "pos",                 label: "Point of Sale",       desc: "POS terminal, transactions, cash drawer, receipts"     },
  { code: "restaurant",          label: "Restaurant POS",      desc: "Tables, kitchen display, reservations, delivery"       },
  { code: "recipe",              label: "Recipe / Food Cost",  desc: "Recipes, ingredients, food-cost reporting"              },
  { code: "inventory",           label: "Inventory",           desc: "Warehouses, transfers, adjustments, stock reporting"    },
  { code: "purchase",            label: "Purchase",            desc: "Purchase orders, vendors, GRN, purchase returns"        },
  { code: "sales",               label: "Sales",                desc: "Quotations, sales orders, delivery challans, returns"   },
  { code: "crm",                 label: "CRM",                  desc: "Leads, pipeline, deals, customers, integrations"        },
  { code: "finance",             label: "Finance",              desc: "Accounting, GL, invoicing, budgets, banking"            },
  { code: "hr",                  label: "HR",                   desc: "Employees, attendance, leaves, payroll, recruitment"    },
  { code: "reports",             label: "Reports",              desc: "Advanced analytics, custom date ranges, exports"        },
  { code: "project-management",  label: "Project Management",  desc: "Projects, boards, sprints, issues"                      },
  { code: "real-estate",         label: "Real Estate",          desc: "Real estate industry pack"                              },
  { code: "construction",        label: "Construction",         desc: "Construction industry pack"                             },
  { code: "hospitality",         label: "Hospitality",          desc: "Rooms, bookings, hospitality industry pack"             },
  { code: "healthcare",          label: "Healthcare",           desc: "Patients, appointments, treatment plans"                },
  { code: "education",           label: "Education",            desc: "Admissions, students, enrollments"                      },
  { code: "insurance",           label: "Insurance",            desc: "Policies, renewals, claims"                             },
  { code: "b2b",                 label: "B2B",                   desc: "Proposals, contracts, support tickets"                  },
  { code: "visa",                label: "Visa Services",         desc: "Visa case management, document checklists"              },
  { code: "settings",            label: "Settings",              desc: "App config, branches, tax rates, payment methods"       },
  { code: "users",               label: "Users",                 desc: "User & role management"                                 },
];

/**
 * Plan default module codes — real ModuleKey values (src/types/global.ts).
 * Mirrors the backend `PlanDefinitions`: Micro and Starter share the core set (they differ only
 * by seat count), Professional adds the POS / food-service family, Enterprise gets everything.
 */
const CORE_MODULE_CODES = [
  "inventory", "purchase", "sales", "crm", "finance", "hr",
  "reports", "project-management", "settings", "users",
];

export const PLAN_DEFAULTS: Record<PlanType, string[]> = {
  Micro:        CORE_MODULE_CODES,
  Starter:      CORE_MODULE_CODES,
  Professional: [...CORE_MODULE_CODES, "pos", "restaurant", "recipe", "hospitality"],
  Enterprise:   ALL_MODULES_CODES(),

  // Legacy alias — pre-rename tenant rows still report "Business".
  Business:     [...CORE_MODULE_CODES, "pos", "restaurant", "recipe", "hospitality"],
};

function ALL_MODULES_CODES(): string[] {
  return [
    "pos", "restaurant", "recipe", "inventory", "purchase", "sales", "crm", "finance", "hr",
    "reports", "project-management", "real-estate", "construction", "hospitality", "healthcare",
    "education", "insurance", "b2b", "visa", "settings", "users",
  ];
}

/** Returns true if two module lists represent the same set. */
export function moduleSetsEqual(a: string[], b: string[]): boolean {
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every(x => sb.has(x));
}

// ── Per-module colour tokens ──────────────────────────────────────────────────

const CHIP_STYLE: Record<string, string> = {
  "pos":                "bg-blue-100    border-blue-400    text-blue-800    dark:bg-blue-900/40    dark:border-blue-600    dark:text-blue-300",
  "restaurant":         "bg-orange-100  border-orange-400  text-orange-800  dark:bg-orange-900/40  dark:border-orange-600  dark:text-orange-300",
  "recipe":             "bg-lime-100    border-lime-400    text-lime-800    dark:bg-lime-900/40    dark:border-lime-600    dark:text-lime-300",
  "inventory":          "bg-teal-100    border-teal-400    text-teal-800    dark:bg-teal-900/40    dark:border-teal-600    dark:text-teal-300",
  "purchase":           "bg-amber-100   border-amber-400   text-amber-800   dark:bg-amber-900/40   dark:border-amber-600   dark:text-amber-300",
  "sales":              "bg-red-100     border-red-400     text-red-800     dark:bg-red-900/40     dark:border-red-600     dark:text-red-300",
  "crm":                "bg-rose-100    border-rose-400    text-rose-800    dark:bg-rose-900/40    dark:border-rose-600    dark:text-rose-300",
  "finance":            "bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300",
  "hr":                 "bg-sky-100     border-sky-400     text-sky-800     dark:bg-sky-900/40     dark:border-sky-600     dark:text-sky-300",
  "reports":            "bg-violet-100  border-violet-400  text-violet-800  dark:bg-violet-900/40  dark:border-violet-600  dark:text-violet-300",
  "project-management": "bg-indigo-100  border-indigo-400  text-indigo-800  dark:bg-indigo-900/40  dark:border-indigo-600  dark:text-indigo-300",
  "real-estate":        "bg-cyan-100    border-cyan-400    text-cyan-800    dark:bg-cyan-900/40    dark:border-cyan-600    dark:text-cyan-300",
  "construction":       "bg-yellow-100  border-yellow-400  text-yellow-800  dark:bg-yellow-900/40  dark:border-yellow-600  dark:text-yellow-300",
  "hospitality":        "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:border-fuchsia-600 dark:text-fuchsia-300",
  "healthcare":         "bg-pink-100    border-pink-400    text-pink-800    dark:bg-pink-900/40    dark:border-pink-600    dark:text-pink-300",
  "education":          "bg-purple-100  border-purple-400  text-purple-800  dark:bg-purple-900/40  dark:border-purple-600  dark:text-purple-300",
  "insurance":          "bg-blue-100    border-blue-400    text-blue-800    dark:bg-blue-900/40    dark:border-blue-600    dark:text-blue-300",
  "b2b":                "bg-slate-100   border-slate-400   text-slate-700   dark:bg-slate-900/40   dark:border-slate-500   dark:text-slate-300",
  "visa":               "bg-green-100   border-green-400   text-green-800   dark:bg-green-900/40   dark:border-green-600   dark:text-green-300",
  "settings":           "bg-gray-100    border-gray-400    text-gray-700    dark:bg-gray-900/40    dark:border-gray-500    dark:text-gray-300",
  "users":              "bg-gray-100    border-gray-400    text-gray-700    dark:bg-gray-900/40    dark:border-gray-500    dark:text-gray-300",
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
