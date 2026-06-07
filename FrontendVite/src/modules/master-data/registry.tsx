/**
 * Master Data Registry
 *
 * Defines every master-data type in the system: columns, form fields,
 * and the data-access operations (fetch / create / update / remove).
 *
 * Two back-ends:
 *   • Real API — existing microservice CRUD endpoints
 *   • Settings list — JSON arrays stored in the AppSettings table
 *     (currencies, tax rates, payment terms — no dedicated service yet)
 */

import * as React from "react";
import {
  Layers, Tag, Ruler, Warehouse, DollarSign, Percent,
  ClipboardList, Users, Building2, Store, CreditCard,
  BadgeCheck, Star, MapPin, Phone, Mail,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// API imports
import { inventoryCategoriesApi } from "@/lib/inventory/categories.api";
import { brandsApi }               from "@/lib/inventory/brands.api";
import { uomApi }                  from "@/lib/inventory/uom.api";
import { warehousesApi }           from "@/lib/inventory/warehouses.api";
import { categoriesApi }           from "@/lib/pos/categories.api";
import { customersApi }            from "@/lib/pos/customers.api";
import { vendorsApi }              from "@/lib/pos/vendors.api";
import { branchesApi }             from "@/lib/identity/branches.api";
import {
  currenciesApi, taxRatesApi, paymentTermsApi, customerGroupsApi,
} from "@/lib/pos/master-data.api";

// ─── Core types ───────────────────────────────────────────────────────────────

export type FieldType =
  | "text" | "textarea" | "number" | "percent"
  | "toggle" | "select" | "email" | "phone";

export interface FormField {
  key:          string;
  label:        string;
  type:         FieldType;
  required?:    boolean;
  placeholder?: string;
  helpText?:    string;
  defaultValue?: unknown;
  options?:     { label: string; value: string }[];
  /** "full" = span all columns; "half" = half width (default) */
  span?:        "full" | "half";
}

export interface ColDef {
  key:    string;
  label:  string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface MasterDef {
  id:           string;
  label:        string;
  pluralLabel?: string;
  description:  string;
  icon:         LucideIcon;
  /** One of the category IDs below */
  category:     string;
  /** Frontend ModuleKey gating visibility — only shown if the tenant has this module. */
  module:       string;
  /** Tailwind color stem: "blue" | "emerald" | "violet" | "rose" | "orange" | "amber" */
  color:        string;
  columns:      ColDef[];
  formFields:   FormField[];
  /** Object keys to search when user types in the search box */
  searchKeys:   string[];
  /** Default name key for "record added/edited" toasts */
  nameKey?:     string;
  // ── Data ops ──────────────────────────────────────────────────────────────
  fetchAll:     () => Promise<Record<string, unknown>[]>;
  create?:      (data: Record<string, unknown>) => Promise<unknown>;
  update?:      (id: string, data: Record<string, unknown>) => Promise<unknown>;
  remove?:      (id: string) => Promise<void>;
  /** If set, the row links here instead of opening the form */
  externalHref?: string;
}

// ─── Category manifest ────────────────────────────────────────────────────────

export const MASTER_CATEGORIES = [
  { id: "inventory",     label: "Inventory",     color: "blue"    },
  { id: "finance",       label: "Finance",       color: "emerald" },
  { id: "commerce",      label: "Commerce",      color: "violet"  },
  { id: "pos",           label: "POS",           color: "rose"    },
  { id: "organization",  label: "Organization",  color: "orange"  },
] as const;

export type CategoryId = (typeof MASTER_CATEGORIES)[number]["id"];

// ─── Shared render helpers ────────────────────────────────────────────────────

export function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
      active
        ? "bg-success/10 text-success border border-success/20"
        : "bg-muted/60 text-muted-foreground border border-border",
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
      {label ?? (active ? "Active" : "Inactive")}
    </span>
  );
}

export function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px] font-semibold border border-border/50 min-w-[28px]">
      {count}
    </span>
  );
}

function dash(v: unknown) {
  return v == null || v === "" ? (
    <span className="text-muted-foreground/40">—</span>
  ) : (v as string);
}

// ─── Real API ops for DB-backed masters ──────────────────────────────────────

const currencyOps = {
  fetchAll: () => currenciesApi.getAll() as Promise<Record<string, unknown>[]>,
  create:   (d: Record<string, unknown>) => currenciesApi.upsert({ id: null, ...d } as any),
  update:   (id: string, d: Record<string, unknown>) => currenciesApi.upsert({ id, ...d } as any),
  remove:   (id: string) => currenciesApi.delete(id),
};

const taxOps = {
  fetchAll: () => taxRatesApi.getAll() as Promise<Record<string, unknown>[]>,
  create:   (d: Record<string, unknown>) => taxRatesApi.upsert({ id: null, ...d } as any),
  update:   (id: string, d: Record<string, unknown>) => taxRatesApi.upsert({ id, ...d } as any),
  remove:   (id: string) => taxRatesApi.delete(id),
};

const termsOps = {
  fetchAll: () => paymentTermsApi.getAll() as Promise<Record<string, unknown>[]>,
  create:   (d: Record<string, unknown>) => paymentTermsApi.upsert({ id: null, ...d } as any),
  update:   (id: string, d: Record<string, unknown>) => paymentTermsApi.upsert({ id, ...d } as any),
  remove:   (id: string) => paymentTermsApi.delete(id),
};

const custGroupOps = {
  fetchAll: () => customerGroupsApi.getAll() as Promise<Record<string, unknown>[]>,
  create:   (d: Record<string, unknown>) => customerGroupsApi.upsert({ id: null, ...d } as any),
  update:   (id: string, d: Record<string, unknown>) => customerGroupsApi.upsert({ id, ...d } as any),
  remove:   (id: string) => customerGroupsApi.delete(id),
};

export const MASTER_REGISTRY: MasterDef[] = [

  // ── Inventory ──────────────────────────────────────────────────────────────

  {
    id: "inv-categories",
    label: "Product Categories",
    description: "Hierarchical categories for organizing inventory products.",
    icon: Layers,
    category: "inventory",
    module: "inventory",
    color: "blue",
    searchKeys: ["name", "code"],
    nameKey: "name",
    columns: [
      { key: "name",       label: "Category Name" },
      { key: "code",       label: "Code",       render: v => dash(v) },
      { key: "parentId",   label: "Parent",     render: (_v, row) => dash(row.parentId ? "Has parent" : null) },
      { key: "productCount", label: "Products", align: "center", render: v => <CountPill count={v as number ?? 0} /> },
      { key: "isActive",   label: "Status",     render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",        label: "Category Name", type: "text",     required: true, placeholder: "e.g. Electronics",  span: "full" },
      { key: "code",        label: "Code",          type: "text",     placeholder: "e.g. ELEC-001" },
      { key: "description", label: "Description",   type: "textarea", span: "full"   },
      { key: "isActive",    label: "Active",        type: "toggle",   defaultValue: true },
    ],
    fetchAll: () => inventoryCategoriesApi.getAll() as Promise<Record<string, unknown>[]>,
    create:   d  => inventoryCategoriesApi.create(d as any),
    update:   (id, d) => inventoryCategoriesApi.update(id, d as any),
    remove:   id => inventoryCategoriesApi.delete(id),
  },

  {
    id: "inv-brands",
    label: "Brands",
    description: "Product brands and manufacturers tracked in inventory.",
    icon: BadgeCheck,
    category: "inventory",
    module: "inventory",
    color: "blue",
    searchKeys: ["name", "code"],
    columns: [
      { key: "name",         label: "Brand Name" },
      { key: "code",         label: "Code",     render: v => dash(v) },
      { key: "description",  label: "Description", render: v => dash(v), width: "280px" },
      { key: "productCount", label: "Products", align: "center", render: v => <CountPill count={v as number ?? 0} /> },
      { key: "isActive",     label: "Status",   render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",        label: "Brand Name",   type: "text",     required: true, placeholder: "e.g. Samsung", span: "full" },
      { key: "code",        label: "Code",         type: "text",     placeholder: "e.g. SAMS" },
      { key: "description", label: "Description",  type: "textarea", span: "full" },
      { key: "logoUrl",     label: "Logo URL",     type: "text",     placeholder: "https://...", span: "full" },
      { key: "isActive",    label: "Active",       type: "toggle",   defaultValue: true },
    ],
    fetchAll: () => brandsApi.getAll() as Promise<Record<string, unknown>[]>,
    create:   d  => brandsApi.create(d as any),
    update:   (id, d) => brandsApi.update(id, d as any),
    remove:   id => brandsApi.delete(id),
  },

  {
    id: "inv-uom",
    label: "Units of Measure",
    pluralLabel: "Units of Measure",
    description: "Measurement units used across products (kg, liter, pcs, etc.).",
    icon: Ruler,
    category: "inventory",
    module: "inventory",
    color: "blue",
    searchKeys: ["name", "symbol"],
    columns: [
      { key: "name",         label: "Unit Name" },
      { key: "symbol",       label: "Symbol",   render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs border border-border/50">{v as string}</code>
      )},
      { key: "description",  label: "Description", render: v => dash(v) },
      { key: "productCount", label: "Products", align: "center", render: v => <CountPill count={v as number ?? 0} /> },
      { key: "isActive",     label: "Status",   render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",        label: "Unit Name",  type: "text",    required: true, placeholder: "e.g. Kilogram" },
      { key: "symbol",      label: "Symbol",     type: "text",    required: true, placeholder: "e.g. kg" },
      { key: "description", label: "Description",type: "textarea",span: "full"  },
      { key: "isActive",    label: "Active",     type: "toggle",  defaultValue: true },
    ],
    fetchAll: () => uomApi.getAll() as Promise<Record<string, unknown>[]>,
    create:   d  => uomApi.create(d as any),
    update:   (id, d) => uomApi.update(id, d as any),
    remove:   id => uomApi.delete(id),
  },

  {
    id: "inv-warehouses",
    label: "Warehouses",
    description: "Physical storage locations for inventory management.",
    icon: Warehouse,
    category: "inventory",
    module: "inventory",
    color: "blue",
    searchKeys: ["name", "code", "address"],
    columns: [
      { key: "name",          label: "Warehouse" },
      { key: "code",          label: "Code",    render: v => dash(v) },
      { key: "address",       label: "Address", render: v => dash(v), width: "220px" },
      { key: "contactPerson", label: "Contact", render: v => dash(v) },
      { key: "isDefault",     label: "Default", align: "center", render: v => v
        ? <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">Default</span>
        : null },
      { key: "isActive",      label: "Status",  render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",          label: "Warehouse Name", type: "text",    required: true, placeholder: "e.g. Main Store", span: "full" },
      { key: "code",          label: "Code",           type: "text",    placeholder: "e.g. WH-001" },
      { key: "address",       label: "Address",        type: "textarea",span: "full"   },
      { key: "contactPerson", label: "Contact Person", type: "text",    placeholder: "Full name" },
      { key: "phone",         label: "Phone",          type: "phone",   placeholder: "+92 300 0000000" },
      { key: "isActive",      label: "Active",         type: "toggle",  defaultValue: true },
    ],
    fetchAll: () => warehousesApi.getAll() as Promise<Record<string, unknown>[]>,
    create:   d  => warehousesApi.create(d as any),
    update:   (id, d) => warehousesApi.update(id, d as any),
    remove:   id => warehousesApi.delete(id),
  },

  // ── Finance ────────────────────────────────────────────────────────────────

  {
    id: "fin-currencies",
    label: "Currencies",
    description: "Global currency list with exchange rates vs USD.",
    icon: DollarSign,
    category: "finance",
    module: "finance",
    color: "emerald",
    searchKeys: ["code", "name", "symbol"],
    columns: [
      { key: "code",   label: "Code",   render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs font-bold border border-border/50">{v as string}</code>
      )},
      { key: "name",         label: "Currency Name" },
      { key: "symbol",       label: "Symbol",   align: "center" },
      { key: "exchangeRate", label: "Rate (vs $)", align: "right",
        render: v => <span className="font-mono text-sm">{Number(v).toFixed(4)}</span> },
      { key: "isDefault", label: "Default", align: "center", render: v => v
        ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">Default</span>
        : null },
      { key: "isActive", label: "Status", render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "code",         label: "Currency Code", type: "text",   required: true, placeholder: "e.g. USD" },
      { key: "name",         label: "Currency Name", type: "text",   required: true, placeholder: "e.g. US Dollar" },
      { key: "symbol",       label: "Symbol",        type: "text",   required: true, placeholder: "e.g. $" },
      { key: "exchangeRate", label: "Exchange Rate (vs USD)", type: "number", required: true, placeholder: "1.0000" },
      { key: "isDefault",    label: "Set as Default", type: "toggle", defaultValue: false },
      { key: "isActive",     label: "Active",         type: "toggle", defaultValue: true  },
    ],
    ...currencyOps,
  },

  {
    id: "fin-tax-rates",
    label: "Tax Rates",
    description: "Tax configurations: GST, VAT, and country-specific rates.",
    icon: Percent,
    category: "finance",
    module: "finance",
    color: "emerald",
    searchKeys: ["name", "code", "appliesTo"],
    columns: [
      { key: "name",        label: "Tax Name" },
      { key: "code",        label: "Code", render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs border border-border/50">{v as string}</code>
      )},
      { key: "rate",        label: "Rate", align: "center",
        render: v => <span className="font-semibold text-sm">{v as number}%</span> },
      { key: "appliesTo",   label: "Applies To", render: v => dash(v) },
      { key: "isDefault",   label: "Default", align: "center", render: v => v
        ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">Default</span>
        : null },
      { key: "isActive",    label: "Status", render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",        label: "Tax Name",     type: "text",    required: true, placeholder: "e.g. Standard VAT", span: "full" },
      { key: "code",        label: "Code",         type: "text",    required: true, placeholder: "e.g. VAT20" },
      { key: "rate",        label: "Rate (%)",     type: "percent", required: true, placeholder: "0.00" },
      { key: "appliesTo",   label: "Applies To",   type: "select",  defaultValue: "all",
        options: [
          { label: "All",      value: "all"      },
          { label: "Goods",    value: "goods"    },
          { label: "Services", value: "services" },
        ],
      },
      { key: "description", label: "Description",  type: "textarea", span: "full" },
      { key: "isDefault",   label: "Set as Default", type: "toggle", defaultValue: false },
      { key: "isActive",    label: "Active",          type: "toggle", defaultValue: true  },
    ],
    ...taxOps,
  },

  {
    id: "fin-payment-terms",
    label: "Payment Terms",
    description: "Standard payment terms used in purchase orders and vendor invoices.",
    icon: ClipboardList,
    category: "finance",
    module: "finance",
    color: "emerald",
    searchKeys: ["name", "code"],
    columns: [
      { key: "name",            label: "Term Name" },
      { key: "code",            label: "Code", render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs border border-border/50">{v as string}</code>
      )},
      { key: "daysNet",         label: "Net Days", align: "center" },
      { key: "advancePercent",  label: "Advance %", align: "center",
        render: v => Number(v) > 0 ? <span>{v as number}%</span> : <span className="text-muted-foreground/40">—</span> },
      { key: "isDefault",       label: "Default", align: "center", render: v => v
        ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">Default</span>
        : null },
    ],
    formFields: [
      { key: "name",           label: "Term Name",      type: "text",    required: true, placeholder: "e.g. Net 30", span: "full" },
      { key: "code",           label: "Code",           type: "text",    required: true, placeholder: "e.g. NET30" },
      { key: "daysNet",        label: "Net Days",       type: "number",  required: true, placeholder: "30" },
      { key: "advancePercent", label: "Advance % Required", type: "percent", placeholder: "0" },
      { key: "description",    label: "Description",    type: "textarea",span: "full" },
      { key: "isDefault",      label: "Set as Default", type: "toggle",  defaultValue: false },
    ],
    ...termsOps,
  },

  // ── Commerce ───────────────────────────────────────────────────────────────

  {
    id: "com-customer-groups",
    label: "Customer Groups",
    description: "Segmentation tiers for pricing and loyalty programs.",
    icon: Users,
    category: "commerce",
    module: "crm",
    color: "violet",
    searchKeys: ["name", "code"],
    columns: [
      { key: "name",            label: "Group Name" },
      { key: "code",            label: "Code", render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs border border-border/50">{v as string}</code>
      )},
      { key: "discountPercent", label: "Discount", align: "center",
        render: v => Number(v) > 0
          ? <span className="font-semibold text-success">{v as number}% off</span>
          : <span className="text-muted-foreground/40">No discount</span> },
      { key: "minPurchase",     label: "Min. Purchase", align: "right",
        render: v => Number(v) > 0 ? Number(v).toLocaleString() : <span className="text-muted-foreground/40">None</span> },
      { key: "isDefault",       label: "Default", align: "center", render: v => v
        ? <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold border border-violet-200 dark:bg-violet-950/30 dark:text-violet-400">Default</span>
        : null },
      { key: "isActive",        label: "Status", render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",            label: "Group Name",       type: "text",    required: true, placeholder: "e.g. Gold Members", span: "full" },
      { key: "code",            label: "Code",             type: "text",    required: true, placeholder: "e.g. GOLD" },
      { key: "discountPercent", label: "Discount %",       type: "percent", placeholder: "0" },
      { key: "minPurchase",     label: "Min. Purchase",    type: "number",  placeholder: "0" },
      { key: "description",     label: "Description",      type: "textarea",span: "full" },
      { key: "isDefault",       label: "Set as Default",   type: "toggle",  defaultValue: false },
      { key: "isActive",        label: "Active",           type: "toggle",  defaultValue: true  },
    ],
    ...custGroupOps,
  },

  {
    id: "com-customers",
    label: "Customers",
    description: "Customer master records synced from POS transactions.",
    icon: Users,
    category: "commerce",
    module: "crm",
    color: "violet",
    searchKeys: ["name", "phone", "email"],
    columns: [
      { key: "name",          label: "Customer Name" },
      { key: "phone",         label: "Phone",         render: v => dash(v) },
      { key: "email",         label: "Email",         render: v => dash(v), width: "220px" },
      { key: "loyaltyPoints", label: "Loyalty Pts",   align: "right",
        render: v => <span className="font-mono text-sm">{(v as number ?? 0).toLocaleString()}</span> },
      { key: "isActive",      label: "Status",        render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",    label: "Full Name",    type: "text",     required: true, placeholder: "Customer name", span: "full" },
      { key: "phone",   label: "Phone",        type: "phone",    placeholder: "+92 300 0000000" },
      { key: "email",   label: "Email",        type: "email",    placeholder: "customer@email.com" },
      { key: "address", label: "Address",      type: "textarea", span: "full" },
      { key: "notes",   label: "Notes",        type: "textarea", span: "full" },
    ],
    fetchAll: () => customersApi.getAll({ pageSize: 500 }).then(r => r.items as Record<string, unknown>[]),
    create:   d  => customersApi.create(d as any),
    update:   (id, d) => customersApi.update(id, d as any),
    remove:   id => customersApi.delete(id),
  },

  {
    id: "com-vendors",
    label: "Vendors",
    description: "Supplier master records for purchase orders and procurement.",
    icon: Store,
    category: "commerce",
    module: "purchase",
    color: "violet",
    searchKeys: ["name", "code", "category", "email"],
    columns: [
      { key: "name",          label: "Vendor Name" },
      { key: "code",          label: "Code",     render: v => dash(v) },
      { key: "category",      label: "Category", render: v => dash(v) },
      { key: "phone",         label: "Phone",    render: v => dash(v) },
      { key: "paymentTerms",  label: "Terms",    render: v => dash(v) },
      { key: "status",        label: "Status",   render: v => (
        <StatusPill active={(v as string) === "Active" || (v as string) === "active"}
          label={v as string ?? "—"} />
      )},
    ],
    formFields: [
      { key: "name",          label: "Vendor Name",    type: "text",    required: true, placeholder: "Supplier Co.", span: "full" },
      { key: "code",          label: "Code",           type: "text",    placeholder: "e.g. VEND-001" },
      { key: "category",      label: "Category",       type: "text",    placeholder: "e.g. Electronics" },
      { key: "contactPerson", label: "Contact Person", type: "text",    placeholder: "Full name", span: "full" },
      { key: "email",         label: "Email",          type: "email",   placeholder: "vendor@email.com" },
      { key: "phone",         label: "Phone",          type: "phone",   placeholder: "+92 300 0000000" },
      { key: "address",       label: "Address",        type: "textarea",span: "full" },
      { key: "taxNumber",     label: "Tax / NTN #",    type: "text",    placeholder: "e.g. 1234567-8" },
      { key: "paymentTerms",  label: "Payment Terms",  type: "text",    placeholder: "e.g. Net 30" },
      { key: "currency",      label: "Currency",       type: "text",    placeholder: "e.g. PKR" },
      { key: "notes",         label: "Notes",          type: "textarea",span: "full" },
      { key: "status",        label: "Status",         type: "select",  defaultValue: "Active",
        options: [
          { label: "Active",    value: "Active"    },
          { label: "Inactive",  value: "Inactive"  },
          { label: "Suspended", value: "Suspended" },
        ],
      },
    ],
    fetchAll: () => vendorsApi.getAll({ pageSize: 500 }).then(r => r.items as Record<string, unknown>[]),
    create:   d  => vendorsApi.create(d as any),
    update:   (id, d) => vendorsApi.update(id, d as any),
    remove:   id => vendorsApi.delete(id),
  },

  // ── POS ────────────────────────────────────────────────────────────────────

  {
    id: "pos-categories",
    label: "POS Categories",
    description: "Product categories shown on the POS terminal product grid.",
    icon: Tag,
    category: "pos",
    module: "pos",
    color: "rose",
    searchKeys: ["name"],
    columns: [
      { key: "name",             label: "Category Name" },
      { key: "parentCategoryName", label: "Parent",    render: v => dash(v) },
      { key: "sortOrder",        label: "Sort Order",  align: "center" },
      { key: "productCount",     label: "Products",    align: "center",
        render: v => <CountPill count={v as number ?? 0} /> },
      { key: "isActive",         label: "Status",      render: v => <StatusPill active={v as boolean} /> },
    ],
    formFields: [
      { key: "name",        label: "Category Name",  type: "text",    required: true, placeholder: "e.g. Beverages", span: "full" },
      { key: "description", label: "Description",    type: "textarea",span: "full" },
      { key: "sortOrder",   label: "Sort Order",     type: "number",  placeholder: "0", defaultValue: 0 },
      { key: "isActive",    label: "Active",         type: "toggle",  defaultValue: true },
    ],
    fetchAll: () => categoriesApi.getAll({ pageSize: 500 }).then(r => r.items as Record<string, unknown>[]),
    create:   d  => categoriesApi.create(d as any),
    update:   (id, d) => categoriesApi.update(id, d as any),
    remove:   id => categoriesApi.delete(id),
  },

  {
    id: "pos-payment-methods",
    label: "Payment Methods",
    description: "Configure which payment methods appear on the POS charge screen.",
    icon: CreditCard,
    category: "pos",
    module: "pos",
    color: "rose",
    searchKeys: ["code", "label"],
    columns: [],
    formFields: [],
    fetchAll: async () => [],
    externalHref: "/settings/pos-payment-methods",
  },

  // ── Organization ───────────────────────────────────────────────────────────

  {
    id: "org-branches",
    label: "Branches",
    description: "Company branches, stores, and office locations worldwide.",
    icon: Building2,
    category: "organization",
    module: "settings",
    color: "orange",
    searchKeys: ["name", "code", "city", "country"],
    columns: [
      { key: "code",     label: "Code",    render: v => (
        <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-xs border border-border/50">{v as string}</code>
      )},
      { key: "name",     label: "Branch Name" },
      { key: "city",     label: "City",    render: v => dash(v) },
      { key: "country",  label: "Country", render: v => dash(v) },
      { key: "currency", label: "Currency",render: v => dash(v) },
      { key: "status",   label: "Status",  render: v => (
        <StatusPill active={(v as string) === "Active" || (v as string) === "active"}
          label={v as string ?? "—"} />
      )},
    ],
    formFields: [
      { key: "code",       label: "Branch Code",   type: "text",    required: true, placeholder: "e.g. LHR-01" },
      { key: "name",       label: "Branch Name",   type: "text",    required: true, placeholder: "Lahore Main Branch", span: "full" },
      { key: "type",       label: "Type",          type: "select",  defaultValue: "Branch",
        options: [
          { label: "HQ",          value: "HQ"          },
          { label: "Branch",      value: "Branch"      },
          { label: "Store",       value: "Store"       },
          { label: "Warehouse",   value: "Warehouse"   },
          { label: "Office",      value: "Office"      },
        ],
      },
      { key: "city",       label: "City",          type: "text",    placeholder: "Lahore" },
      { key: "country",    label: "Country",       type: "text",    placeholder: "Pakistan" },
      { key: "address",    label: "Address",       type: "textarea",span: "full" },
      { key: "phone",      label: "Phone",         type: "phone",   placeholder: "+92 42 0000000" },
      { key: "email",      label: "Email",         type: "email",   placeholder: "branch@company.com" },
      { key: "manager",    label: "Manager",       type: "text",    placeholder: "Manager name" },
      { key: "staff",      label: "Staff Count",   type: "number",  placeholder: "0", defaultValue: 0 },
      { key: "currency",   label: "Currency",      type: "text",    placeholder: "PKR" },
      { key: "timezone",   label: "Timezone",      type: "text",    placeholder: "Asia/Karachi" },
      { key: "status",     label: "Status",        type: "select",  defaultValue: "Active",
        options: [
          { label: "Active",   value: "Active"   },
          { label: "Inactive", value: "Inactive" },
          { label: "Closed",   value: "Closed"   },
        ],
      },
    ],
    fetchAll: () => branchesApi.getAll(1, 500).then(r => r.items as Record<string, unknown>[]),
    create:   d  => branchesApi.create(d as any),
    update:   (id, d) => branchesApi.update(id, d as any),
    remove:   id => branchesApi.delete(id),
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getMasterById(id: string): MasterDef | undefined {
  return MASTER_REGISTRY.find(m => m.id === id);
}

export function getMastersByCategory(categoryId: string): MasterDef[] {
  return MASTER_REGISTRY.filter(m => m.category === categoryId);
}
