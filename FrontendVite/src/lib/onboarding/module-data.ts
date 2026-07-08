import type { LucideIcon } from "lucide-react";
import {
  ShoppingCart, Package, DollarSign, Users, BarChart3,
  Truck, Building2, Home, Utensils, BedDouble, Briefcase,
  TrendingUp, HeartPulse, GraduationCap, Stamp,
} from "lucide-react";

// ── Module definitions ────────────────────────────────────────────────────────

export type ModuleId =
  | "pos" | "inventory" | "sales" | "purchase"
  | "finance" | "hr" | "crm"
  | "hospitality" | "real-estate" | "construction"
  | "healthcare" | "education" | "visa";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;         // tailwind bg color class for the icon bg
  iconColor: string;     // tailwind text color class
  /** Modules that are automatically co-selected (hard dependency) */
  requires: ModuleId[];
  /** Modules shown as recommended when this is selected */
  recommends: ModuleId[];
  /** Whether selecting this triggers the business-type step */
  triggersBusinessType: boolean;
  /** Module category for grouping in UI */
  category: "commerce" | "finance" | "operations" | "industry";
  popular?: boolean;
}

export const MODULES: ModuleDef[] = [
  // ── Commerce ─────────────────────────────────────────────────────────────
  {
    id: "pos",
    label: "Point of Sale",
    description: "Retail & restaurant sales, cash register, sessions",
    icon: ShoppingCart,
    color: "bg-violet-500/10",
    iconColor: "text-violet-500",
    requires: ["inventory"],
    recommends: ["sales", "finance"],
    triggersBusinessType: true,
    category: "commerce",
    popular: true,
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock management, warehouses, transfers & alerts",
    icon: Package,
    color: "bg-orange-500/10",
    iconColor: "text-orange-500",
    requires: [],
    recommends: ["purchase", "sales", "pos"],
    triggersBusinessType: true,
    category: "commerce",
    popular: true,
  },
  {
    id: "sales",
    label: "Sales",
    description: "Quotations, sales orders, returns & customer pricing",
    icon: TrendingUp,
    color: "bg-blue-500/10",
    iconColor: "text-blue-500",
    requires: [],
    recommends: ["inventory", "crm", "finance"],
    triggersBusinessType: true,
    category: "commerce",
    popular: true,
  },
  {
    id: "purchase",
    label: "Purchase",
    description: "Purchase orders, vendor management & approvals",
    icon: Truck,
    color: "bg-lime-500/10",
    iconColor: "text-lime-600",
    requires: [],
    recommends: ["inventory", "finance"],
    triggersBusinessType: true,
    category: "commerce",
  },
  {
    id: "crm",
    label: "CRM",
    description: "Leads, pipeline, customers & sales activities",
    icon: Briefcase,
    color: "bg-pink-500/10",
    iconColor: "text-pink-500",
    requires: [],
    recommends: ["sales", "finance"],
    triggersBusinessType: false,
    category: "commerce",
  },
  // ── Finance & Operations ──────────────────────────────────────────────────
  {
    id: "finance",
    label: "Finance",
    description: "Invoicing, journals, GL, tax & banking",
    icon: DollarSign,
    color: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    requires: [],
    recommends: ["hr", "sales", "purchase"],
    triggersBusinessType: false,
    category: "finance",
    popular: true,
  },
  {
    id: "hr",
    label: "HR & Payroll",
    description: "Employees, attendance, leaves & payroll",
    icon: Users,
    color: "bg-teal-500/10",
    iconColor: "text-teal-500",
    requires: [],
    recommends: ["finance"],
    triggersBusinessType: false,
    category: "operations",
  },
  // ── Industry Packs ────────────────────────────────────────────────────────
  {
    id: "hospitality",
    label: "Hospitality",
    description: "Room bookings, housekeeping & hotel operations",
    icon: BedDouble,
    color: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
    requires: [],
    recommends: ["pos", "hr", "finance"],
    triggersBusinessType: false,
    category: "industry",
  },
  {
    id: "real-estate",
    label: "Real Estate",
    description: "Properties, units, tenants, contracts & brokers",
    icon: Home,
    color: "bg-amber-500/10",
    iconColor: "text-amber-500",
    requires: [],
    recommends: ["crm", "finance"],
    triggersBusinessType: false,
    category: "industry",
  },
  {
    id: "construction",
    label: "Construction",
    description: "Projects, BOQ, contractors & site management",
    icon: Building2,
    color: "bg-stone-500/10",
    iconColor: "text-stone-500",
    requires: [],
    recommends: ["purchase", "hr", "finance"],
    triggersBusinessType: false,
    category: "industry",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Patients, appointments, billing & clinical ops",
    icon: HeartPulse,
    color: "bg-red-500/10",
    iconColor: "text-red-500",
    requires: [],
    recommends: ["finance", "hr"],
    triggersBusinessType: false,
    category: "industry",
  },
  {
    id: "education",
    label: "Education",
    description: "Students, courses, fees & academic management",
    icon: GraduationCap,
    color: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    requires: [],
    recommends: ["finance", "hr"],
    triggersBusinessType: false,
    category: "industry",
  },
  {
    id: "visa",
    label: "Visa Services",
    description: "UAE visa cases, applicants, documents & tracking",
    icon: Stamp,
    color: "bg-sky-500/10",
    iconColor: "text-sky-500",
    requires: [],
    recommends: ["crm", "finance"],
    triggersBusinessType: false,
    category: "industry",
  },
];

export const MODULE_CATEGORIES: { id: ModuleDef["category"]; label: string }[] = [
  { id: "commerce",    label: "Commerce & Retail"       },
  { id: "finance",     label: "Finance & Accounting"    },
  { id: "operations",  label: "HR & Operations"         },
  { id: "industry",    label: "Industry Packs"          },
];

// ── Business types ────────────────────────────────────────────────────────────

export interface BusinessType {
  id: string;
  label: string;
  emoji: string;
  /** Which modules this business type especially benefits from */
  suggests: ModuleId[];
}

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "apparel",          label: "Apparel, Footwear & Accessories",         emoji: "👗", suggests: ["pos", "inventory", "sales"]             },
  { id: "arts",             label: "Arts & Entertainment",                    emoji: "🎨", suggests: ["pos", "sales"]                           },
  { id: "baby",             label: "Baby & Toddler",                          emoji: "🍼", suggests: ["pos", "inventory", "sales"]              },
  { id: "beauty",           label: "Beauty & Cosmetics",                      emoji: "💄", suggests: ["pos", "inventory", "sales"]              },
  { id: "salon",            label: "Beauty Parlour, SPA & Salon",             emoji: "💇", suggests: ["pos", "hr"]                              },
  { id: "books",            label: "Books, Toys & Other Hobbies",             emoji: "📚", suggests: ["pos", "inventory", "sales"]             },
  { id: "electronics",      label: "Electronics & Appliances",                emoji: "📱", suggests: ["pos", "inventory", "sales", "purchase"]  },
  { id: "fnb",              label: "Food & Beverage",                         emoji: "🍔", suggests: ["pos", "inventory", "purchase"]           },
  { id: "hardware",         label: "Hardware / DIY & Garden Supplies",        emoji: "🔧", suggests: ["pos", "inventory", "purchase", "sales"]  },
  { id: "home-decor",       label: "Home Décor & Furniture",                  emoji: "🛋️", suggests: ["pos", "inventory", "sales"]             },
  { id: "hypermarket",      label: "Hypermarket & Departmental Stores",       emoji: "🏬", suggests: ["pos", "inventory", "sales", "purchase"]  },
  { id: "pet",              label: "Pet",                                     emoji: "🐾", suggests: ["pos", "inventory", "sales"]              },
  { id: "pharma",           label: "Pharma & Healthcare",                     emoji: "💊", suggests: ["pos", "inventory", "purchase"]           },
  { id: "services",         label: "Services",                                emoji: "🛎️", suggests: ["pos", "crm", "finance"]                 },
  { id: "sports",           label: "Sports",                                  emoji: "⚽", suggests: ["pos", "inventory", "sales"]              },
  { id: "supermarket",      label: "Supermarket & Groceries",                 emoji: "🛒", suggests: ["pos", "inventory", "purchase", "sales"]  },
  { id: "vehicle",          label: "Vehicle & Parts",                         emoji: "🚗", suggests: ["pos", "inventory", "purchase", "sales"]  },
  { id: "restaurant",       label: "Restaurant & Café",                       emoji: "🍽️", suggests: ["pos", "inventory", "purchase", "hr"]    },
  { id: "pharmacy",         label: "Pharmacy & Drugstore",                    emoji: "🏥", suggests: ["pos", "inventory", "purchase"]           },
  { id: "mobile-telecom",   label: "Mobile & Telecom",                        emoji: "📡", suggests: ["pos", "inventory", "sales"]              },
  { id: "optical",          label: "Optical & Eyewear",                       emoji: "👓", suggests: ["pos", "inventory", "sales"]              },
  { id: "office-supplies",  label: "Office Supplies & Stationery",            emoji: "📎", suggests: ["pos", "inventory", "sales", "purchase"]  },
  { id: "others",           label: "Others",                                  emoji: "📦", suggests: []                                         },
];

// ── Helper: resolve all selected modules including auto-required ones ──────────

export function resolveModules(selected: Set<ModuleId>): Set<ModuleId> {
  const resolved = new Set<ModuleId>(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of resolved) {
      const def = MODULES.find(m => m.id === id);
      if (!def) continue;
      for (const req of def.requires) {
        if (!resolved.has(req)) {
          resolved.add(req);
          changed = true;
        }
      }
    }
  }
  return resolved;
}

/** Returns true if any selected module triggers the business-type step */
export function needsBusinessType(selected: Set<ModuleId>): boolean {
  return [...selected].some(id => {
    const def = MODULES.find(m => m.id === id);
    return def?.triggersBusinessType ?? false;
  });
}
