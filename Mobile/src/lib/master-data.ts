import type { Feather } from "@expo/vector-icons";
import { apiClient } from "@/lib/api-client";
import type { Tone } from "@/theme";

/**
 * Master Data -- the shared reference lists every module draws from (categories, brands, units, warehouses,
 * currencies, tax rates, payment terms, customer groups, POS customers, vendors, branches). Mirrors the
 * web registry (`FrontendVite/src/modules/master-data/registry.tsx`): one definition per list gives its
 * fields, how a row reads, and the calls that load / create / update / delete it, so a single set of
 * screens serves all of them.
 *
 * Visibility is the web's rule: the tenant must own the module AND the user must hold one of the view
 * keys. Writes need one of the write keys; with none the lists open read-only.
 */

export type MasterFieldType = "text" | "textarea" | "number" | "percent" | "toggle" | "select" | "email" | "phone";

export interface MasterField {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
}

export type MasterRecord = Record<string, any>;

export interface MasterRow {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  tone?: Tone;
}

export type MasterGroup = "inventory" | "finance" | "commerce" | "organization";

export const MASTER_GROUP_LABELS: Record<MasterGroup, string> = {
  inventory: "Inventory",
  finance: "Finance",
  commerce: "Commerce",
  organization: "Organization",
};
export const MASTER_GROUP_ORDER: MasterGroup[] = ["inventory", "finance", "commerce", "organization"];

export interface MasterDef {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  group: MasterGroup;
  /** Tenant module that must be present (mobile module key). */
  module: string;
  viewPermission?: string[];
  writePermission?: string[];
  searchKeys: string[];
  nameKey: string;
  row: (r: MasterRecord) => MasterRow;
  fields: MasterField[];
  fetchAll: () => Promise<MasterRecord[]>;
  create?: (d: MasterRecord) => Promise<unknown>;
  update?: (id: string, d: MasterRecord) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const join = (...parts: unknown[]) => parts.map(s).filter(Boolean).join(" · ");
const activeBadge = (r: MasterRecord): Pick<MasterRow, "badge" | "tone"> =>
  r.isActive === false ? { badge: "Inactive", tone: "neutral" } : { badge: "Active", tone: "success" };

const ACTIVE: MasterField = { key: "isActive", label: "Active", type: "toggle", default: true };
const DEFAULT_FLAG: MasterField = { key: "isDefault", label: "Set as default", type: "toggle", default: false };

const INVENTORY_WRITE = ["inventory.stock.create", "inventory.stock.edit"];
const POS_CONFIG_WRITE = ["pos.sessions.approve"];

// ── Generic REST helpers ───────────────────────────────────────────────────────────────────────────
const list = (path: string) => () => apiClient.get<MasterRecord[]>(path);
const paged = (path: string) => () =>
  apiClient.get<{ items: MasterRecord[] }>(`${path}${path.includes("?") ? "&" : "?"}pageSize=500`).then((r) => r.items ?? []);

/** POS master lists upsert through a single PUT; the id is null for a new record. */
const upsertOps = (path: string) => ({
  create: (d: MasterRecord) => apiClient.put(path, { id: null, ...d }),
  update: (id: string, d: MasterRecord) => apiClient.put(path, { id, ...d }),
  remove: (id: string) => apiClient.delete(`${path}/${id}`),
});

const restOps = (path: string) => ({
  create: (d: MasterRecord) => apiClient.post(path, d),
  update: (id: string, d: MasterRecord) => apiClient.put(`${path}/${id}`, d),
  remove: (id: string) => apiClient.delete(`${path}/${id}`),
});

export const MASTER_REGISTRY: MasterDef[] = [
  // ── Inventory ────────────────────────────────────────────────────────────────────────────────────
  {
    id: "inv-categories",
    label: "Product Categories",
    description: "Categories that organise your products.",
    icon: "layers",
    group: "inventory",
    module: "inventory",
    writePermission: INVENTORY_WRITE,
    searchKeys: ["name", "code"],
    nameKey: "name",
    row: (r) => ({ title: s(r.name), subtitle: join(r.code, `${r.productCount ?? 0} products`), ...activeBadge(r) }),
    fields: [
      { key: "name", label: "Category name", type: "text", required: true, placeholder: "e.g. Electronics" },
      { key: "code", label: "Code", type: "text", placeholder: "e.g. ELEC-001" },
      { key: "description", label: "Description", type: "textarea" },
      ACTIVE,
    ],
    fetchAll: list("/api/inventory/categories"),
    ...restOps("/api/inventory/categories"),
  },
  {
    id: "inv-brands",
    label: "Brands",
    description: "Product brands.",
    icon: "tag",
    group: "inventory",
    module: "inventory",
    writePermission: INVENTORY_WRITE,
    searchKeys: ["name", "code"],
    nameKey: "name",
    row: (r) => ({ title: s(r.name), subtitle: join(r.code, `${r.productCount ?? 0} products`), ...activeBadge(r) }),
    fields: [
      { key: "name", label: "Brand name", type: "text", required: true, placeholder: "e.g. Samsung" },
      { key: "code", label: "Code", type: "text", placeholder: "e.g. SAMS" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logoUrl", label: "Logo URL", type: "text", placeholder: "https://…" },
      ACTIVE,
    ],
    fetchAll: list("/api/inventory/brands"),
    ...restOps("/api/inventory/brands"),
  },
  {
    id: "inv-uom",
    label: "Units of Measure",
    description: "Units products are counted and sold in.",
    icon: "maximize-2",
    group: "inventory",
    module: "inventory",
    writePermission: INVENTORY_WRITE,
    searchKeys: ["name", "symbol"],
    nameKey: "name",
    row: (r) => ({ title: s(r.name), subtitle: join(r.symbol, `${r.productCount ?? 0} products`), ...activeBadge(r) }),
    fields: [
      { key: "name", label: "Unit name", type: "text", required: true, placeholder: "e.g. Kilogram" },
      { key: "symbol", label: "Symbol", type: "text", required: true, placeholder: "e.g. kg" },
      { key: "description", label: "Description", type: "textarea" },
      ACTIVE,
    ],
    fetchAll: list("/api/inventory/units-of-measure"),
    ...restOps("/api/inventory/units-of-measure"),
  },
  {
    id: "inv-warehouses",
    label: "Warehouses",
    description: "Stock locations.",
    icon: "package",
    group: "inventory",
    module: "inventory",
    writePermission: ["inventory.warehouses.create", "inventory.warehouses.edit"],
    searchKeys: ["name", "code", "address"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.code, r.contactPerson, r.address),
      ...(r.isDefault ? { badge: "Default", tone: "primary" as Tone } : activeBadge(r)),
    }),
    fields: [
      { key: "name", label: "Warehouse name", type: "text", required: true, placeholder: "e.g. Main Store" },
      { key: "code", label: "Code", type: "text", placeholder: "e.g. WH-001" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "contactPerson", label: "Contact person", type: "text" },
      { key: "phone", label: "Phone", type: "phone" },
      ACTIVE,
    ],
    fetchAll: list("/api/inventory/warehouses"),
    ...restOps("/api/inventory/warehouses"),
  },

  // ── Finance ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: "fin-currencies",
    label: "Currencies",
    description: "Currency list with exchange rates against USD.",
    icon: "dollar-sign",
    group: "finance",
    module: "finance",
    writePermission: POS_CONFIG_WRITE,
    searchKeys: ["code", "name", "symbol"],
    nameKey: "name",
    row: (r) => ({
      title: join(r.code, r.name),
      subtitle: `Rate vs USD: ${Number(r.exchangeRate ?? 0).toFixed(4)}${r.symbol ? ` · ${r.symbol}` : ""}`,
      ...(r.isDefault ? { badge: "Default", tone: "primary" as Tone } : activeBadge(r)),
    }),
    fields: [
      { key: "code", label: "Currency code", type: "text", required: true, placeholder: "e.g. USD" },
      { key: "name", label: "Currency name", type: "text", required: true, placeholder: "e.g. US Dollar" },
      { key: "symbol", label: "Symbol", type: "text", required: true, placeholder: "e.g. $" },
      { key: "exchangeRate", label: "Exchange rate (vs USD)", type: "number", required: true, placeholder: "1.0000" },
      DEFAULT_FLAG,
      ACTIVE,
    ],
    fetchAll: list("/api/currencies"),
    ...upsertOps("/api/currencies"),
  },
  {
    id: "fin-tax-rates",
    label: "Tax Rates",
    description: "Sales tax and VAT rates.",
    icon: "percent",
    group: "finance",
    module: "finance",
    writePermission: POS_CONFIG_WRITE,
    searchKeys: ["name", "code"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.code, `${Number(r.rate ?? 0)}%`, r.appliesTo),
      ...(r.isDefault ? { badge: "Default", tone: "primary" as Tone } : activeBadge(r)),
    }),
    fields: [
      { key: "name", label: "Tax name", type: "text", required: true, placeholder: "e.g. Standard VAT" },
      { key: "code", label: "Code", type: "text", required: true, placeholder: "e.g. VAT5" },
      { key: "rate", label: "Rate (%)", type: "percent", required: true, placeholder: "0.00" },
      {
        key: "appliesTo",
        label: "Applies to",
        type: "select",
        default: "all",
        options: [
          { value: "all", label: "All" },
          { value: "goods", label: "Goods" },
          { value: "services", label: "Services" },
        ],
      },
      { key: "description", label: "Description", type: "textarea" },
      DEFAULT_FLAG,
      ACTIVE,
    ],
    fetchAll: list("/api/tax-rates"),
    ...upsertOps("/api/tax-rates"),
  },
  {
    id: "fin-payment-terms",
    label: "Payment Terms",
    description: "When customers and suppliers pay.",
    icon: "clipboard",
    group: "finance",
    module: "finance",
    writePermission: POS_CONFIG_WRITE,
    searchKeys: ["name", "code"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.code, `Net ${r.daysNet ?? 0} days`, r.advancePercent ? `${r.advancePercent}% advance` : ""),
      ...(r.isDefault ? { badge: "Default", tone: "primary" as Tone } : {}),
    }),
    fields: [
      { key: "name", label: "Term name", type: "text", required: true, placeholder: "e.g. Net 30" },
      { key: "code", label: "Code", type: "text", required: true, placeholder: "e.g. NET30" },
      { key: "daysNet", label: "Net days", type: "number", required: true, placeholder: "30" },
      { key: "advancePercent", label: "Advance % required", type: "percent", placeholder: "0" },
      { key: "description", label: "Description", type: "textarea" },
      DEFAULT_FLAG,
    ],
    fetchAll: list("/api/payment-terms"),
    ...upsertOps("/api/payment-terms"),
  },

  // ── Commerce ─────────────────────────────────────────────────────────────────────────────────────
  {
    id: "com-customer-groups",
    label: "Customer Groups",
    description: "Groups with their own discount.",
    icon: "users",
    group: "commerce",
    module: "crm",
    viewPermission: ["pos.customers.view", "pos.transactions.create"],
    writePermission: POS_CONFIG_WRITE,
    searchKeys: ["name", "code"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.code, r.discountPercent ? `${r.discountPercent}% off` : "", r.minPurchase ? `min ${r.minPurchase}` : ""),
      ...(r.isDefault ? { badge: "Default", tone: "primary" as Tone } : activeBadge(r)),
    }),
    fields: [
      { key: "name", label: "Group name", type: "text", required: true, placeholder: "e.g. Gold members" },
      { key: "code", label: "Code", type: "text", required: true, placeholder: "e.g. GOLD" },
      { key: "discountPercent", label: "Discount %", type: "percent", placeholder: "0" },
      { key: "minPurchase", label: "Minimum purchase", type: "number", placeholder: "0" },
      { key: "description", label: "Description", type: "textarea" },
      DEFAULT_FLAG,
      ACTIVE,
    ],
    fetchAll: list("/api/customer-groups"),
    ...upsertOps("/api/customer-groups"),
  },
  {
    id: "com-customers",
    label: "Customers",
    description: "People you sell to at the till.",
    icon: "user",
    group: "commerce",
    module: "crm",
    viewPermission: ["pos.customers.view", "pos.transactions.create"],
    writePermission: ["pos.customers.edit"],
    searchKeys: ["name", "phone", "email"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.phone, r.email),
      meta: r.loyaltyPoints ? `${r.loyaltyPoints} loyalty points` : undefined,
      ...activeBadge(r),
    }),
    fields: [
      { key: "name", label: "Full name", type: "text", required: true, placeholder: "Customer name" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "email", label: "Email", type: "email" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    fetchAll: paged("/api/customers"),
    create: (d) => apiClient.post("/api/customers", d),
    update: (id, d) => apiClient.put(`/api/customers/${id}`, { id, ...d }),
    remove: (id) => apiClient.delete(`/api/customers/${id}`),
  },
  {
    id: "com-vendors",
    label: "Vendors",
    description: "Suppliers you buy from.",
    icon: "truck",
    group: "commerce",
    module: "purchase",
    viewPermission: ["pos.products.view"],
    writePermission: ["pos.products.create", "pos.products.edit"],
    searchKeys: ["name", "code", "category", "phone"],
    nameKey: "name",
    row: (r) => ({
      title: s(r.name),
      subtitle: join(r.code, r.category, r.phone),
      meta: r.paymentTerms ? `Terms: ${r.paymentTerms}` : undefined,
      badge: s(r.status) || undefined,
      tone: String(r.status ?? "").toLowerCase() === "active" ? "success" : "neutral",
    }),
    fields: [
      { key: "name", label: "Vendor name", type: "text", required: true, placeholder: "Supplier Co." },
      { key: "code", label: "Code", type: "text", placeholder: "e.g. VEND-001" },
      { key: "category", label: "Category", type: "text" },
      { key: "contactPerson", label: "Contact person", type: "text" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "taxNumber", label: "Tax number", type: "text" },
      { key: "paymentTerms", label: "Payment terms", type: "text", placeholder: "e.g. Net 30" },
      { key: "currency", label: "Currency", type: "text", placeholder: "e.g. PKR" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    fetchAll: paged("/api/vendors"),
    ...restOps("/api/vendors"),
  },

  // ── Organization ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "org-branches",
    label: "Branches",
    description: "Stores, offices and locations.",
    icon: "map-pin",
    group: "organization",
    module: "settings",
    searchKeys: ["name", "code", "city", "country"],
    nameKey: "name",
    row: (r) => ({
      title: join(r.code, r.name),
      subtitle: join(r.type, r.city, r.country),
      badge: s(r.status) || undefined,
      tone: String(r.status ?? "").toLowerCase() === "active" ? "success" : "neutral",
    }),
    fields: [
      { key: "code", label: "Branch code", type: "text", required: true, placeholder: "e.g. LHR-01" },
      { key: "name", label: "Branch name", type: "text", required: true, placeholder: "Lahore Main Branch" },
      {
        key: "type",
        label: "Type",
        type: "select",
        default: "Branch",
        options: ["HQ", "Branch", "Store", "Warehouse", "Office"].map((v) => ({ value: v, label: v })),
      },
      { key: "city", label: "City", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "phone", label: "Phone", type: "phone" },
      { key: "email", label: "Email", type: "email" },
      { key: "manager", label: "Manager", type: "text" },
      { key: "staff", label: "Staff count", type: "number", default: 0 },
      { key: "currency", label: "Currency", type: "text", placeholder: "e.g. USD" },
      { key: "timezone", label: "Time zone", type: "text", placeholder: "e.g. Asia/Dubai" },
      {
        key: "status",
        label: "Status",
        type: "select",
        default: "Active",
        options: ["Active", "Inactive", "Closed"].map((v) => ({ value: v, label: v })),
      },
    ],
    fetchAll: () => apiClient.get<{ items: MasterRecord[] }>("/api/branches?page=1&pageSize=500").then((r) => r.items ?? []),
    ...restOps("/api/branches"),
  },
];

export const masterById = (id: string) => MASTER_REGISTRY.find((m) => m.id === id);

/** Search across the master's declared keys, case-insensitively. */
export function matchesMaster(m: MasterDef, r: MasterRecord, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return m.searchKeys.some((k) => s(r[k]).toLowerCase().includes(needle));
}
