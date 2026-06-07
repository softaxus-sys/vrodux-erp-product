// ─── Permission keys ──────────────────────────────────────────────────────────

export type PermissionKey =
  | "view"     // Read/list
  | "create"   // Add new records
  | "edit"     // Modify existing records
  | "delete"   // Remove records
  | "approve"  // Approve/reject workflows
  | "export"   // Export to CSV/PDF
  | "print"    // Print receipts/reports
  | "void"     // Void a POS transaction
  | "refund"   // Issue a refund
  | "discount" // Apply discounts above cashier limit
  | "adjust";  // Adjust stock quantities

// ─── Module definitions ───────────────────────────────────────────────────────

export interface ModulePermission {
  module: string;
  label: string;
  group: string;
  available: PermissionKey[];
}

export const modulePermissions: ModulePermission[] = [
  // Inventory
  { module: "inventory.stock",      label: "Stock Items",       group: "Inventory", available: ["view","create","edit","delete","adjust","export"] },
  { module: "inventory.movements",  label: "Stock Movements",   group: "Inventory", available: ["view","create","adjust","export"] },
  { module: "inventory.warehouses", label: "Warehouses",        group: "Inventory", available: ["view","create","edit","delete"] },
  { module: "inventory.transfers",  label: "Stock Transfers",   group: "Inventory", available: ["view","create","approve","delete"] },
  // POS
  { module: "pos.retail",           label: "Retail POS",        group: "POS", available: ["view","create","void","refund","discount","print"] },
  { module: "pos.restaurant",       label: "Restaurant POS",    group: "POS", available: ["view","create","void","refund","discount","print"] },
  { module: "pos.shifts",           label: "Shift Management",  group: "POS", available: ["view","create","approve"] },
  { module: "pos.reports",          label: "POS Reports",       group: "POS", available: ["view","export"] },
  // Finance
  { module: "finance.invoicing",    label: "Invoicing",         group: "Finance", available: ["view","create","edit","delete","approve","export","print"] },
  { module: "finance.expenses",     label: "Expenses",          group: "Finance", available: ["view","create","edit","delete","approve","export"] },
  { module: "finance.journals",     label: "Journal Entries",   group: "Finance", available: ["view","create","edit","approve"] },
  { module: "finance.banking",      label: "Banking",           group: "Finance", available: ["view","create","edit","delete","export"] },
  { module: "finance.tax",          label: "Tax & VAT",         group: "Finance", available: ["view","create","edit","approve","export"] },
  { module: "finance.reports",      label: "Financial Reports", group: "Finance", available: ["view","export"] },
  // HR
  { module: "hr.employees",         label: "Employees",         group: "HR", available: ["view","create","edit","delete","export"] },
  { module: "hr.payroll",           label: "Payroll",           group: "HR", available: ["view","create","approve","export"] },
  { module: "hr.leaves",            label: "Leave Management",  group: "HR", available: ["view","create","edit","approve"] },
  { module: "hr.recruitment",       label: "Recruitment",       group: "HR", available: ["view","create","edit","delete"] },
  // Sales
  { module: "sales.orders",         label: "Sales Orders",      group: "Sales", available: ["view","create","edit","delete","approve","export"] },
  { module: "sales.quotations",     label: "Quotations",        group: "Sales", available: ["view","create","edit","delete","approve","export"] },
  { module: "sales.returns",        label: "Returns",           group: "Sales", available: ["view","create","approve"] },
  // Purchase
  { module: "purchase.orders",      label: "Purchase Orders",   group: "Purchase", available: ["view","create","edit","delete","approve","export"] },
  { module: "purchase.vendors",     label: "Vendors",           group: "Purchase", available: ["view","create","edit","delete"] },
  { module: "purchase.approvals",   label: "PO Approvals",      group: "Purchase", available: ["view","approve"] },
  // CRM
  { module: "crm.customers",        label: "Customers",         group: "CRM", available: ["view","create","edit","delete","export"] },
  { module: "crm.leads",            label: "Leads",             group: "CRM", available: ["view","create","edit","delete"] },
  { module: "crm.deals",            label: "Deals",             group: "CRM", available: ["view","create","edit","delete","export"] },
  // Recipe
  { module: "recipe.recipes",       label: "Recipes",           group: "Recipe", available: ["view","create","edit","delete","export"] },
  { module: "recipe.ingredients",   label: "Ingredients",       group: "Recipe", available: ["view","create","edit","delete"] },
  // Hospitality
  { module: "hospitality.rooms",        label: "Rooms",         group: "Hospitality", available: ["view","create","edit","delete"] },
  { module: "hospitality.bookings",     label: "Bookings",      group: "Hospitality", available: ["view","create","edit","approve","export"] },
  { module: "hospitality.housekeeping", label: "Housekeeping",  group: "Hospitality", available: ["view","create","edit","approve"] },
  // Real Estate
  { module: "realestate.properties", label: "Properties",       group: "Real Estate", available: ["view","create","edit","delete","export"] },
  { module: "realestate.units",      label: "Property Units",   group: "Real Estate", available: ["view","create","edit","delete"] },
  { module: "realestate.tenants",    label: "Tenants",          group: "Real Estate", available: ["view","create","edit","delete","export"] },
  { module: "realestate.leases",     label: "Lease Contracts",  group: "Real Estate", available: ["view","create","edit","approve","export"] },
  { module: "realestate.brokers",    label: "Brokers",          group: "Real Estate", available: ["view","create","edit","delete"] },
  // Construction
  { module: "construction.projects",    label: "Projects",         group: "Construction", available: ["view","create","edit","delete","export"] },
  { module: "construction.sites",       label: "Sites",            group: "Construction", available: ["view","create","edit","delete"] },
  { module: "construction.contractors", label: "Contractors",      group: "Construction", available: ["view","create","edit","delete"] },
  { module: "construction.boq",         label: "Bill of Quantities",group: "Construction", available: ["view","create","edit","approve","export"] },
  // Settings
  { module: "settings.users",       label: "Users",             group: "Settings", available: ["view","create","edit","delete"] },
  { module: "settings.roles",       label: "Roles & Permissions",group: "Settings", available: ["view","create","edit","delete"] },
  { module: "settings.general",     label: "General Settings",  group: "Settings", available: ["view","edit"] },
  { module: "settings.audit",       label: "Audit Logs",        group: "Settings", available: ["view","export"] },
];

// ─── Role type ────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string;
  colorClass: string;   // Tailwind classes for badge
  icon: string;         // Emoji
  isSystem: boolean;    // System roles cannot be deleted
  permissions: Record<string, PermissionKey[]>; // moduleId → granted permissions
  userCount: number;
  createdAt: string;
}

// ─── Permission helpers ───────────────────────────────────────────────────────

const ALL: Record<string, PermissionKey[]> = Object.fromEntries(
  modulePermissions.map(m => [m.module, [...m.available]])
);

const VIEW_ONLY: Record<string, PermissionKey[]> = Object.fromEntries(
  modulePermissions
    .filter(m => m.available.includes("view"))
    .map(m => [m.module, ["view"]])
);

// ─── Role definitions ─────────────────────────────────────────────────────────

export const roles: Role[] = [
  // ── 1. Super Admin ──────────────────────────────────────────────────────────
  {
    id: "role-001",
    name: "Super Admin",
    description: "Unrestricted access to every module, setting, and action",
    colorClass: "bg-destructive/10 text-destructive border-destructive/20",
    icon: "🔑",
    isSystem: true,
    permissions: ALL,
    userCount: 2,
    createdAt: "2024-01-01",
  },

  // ── 2. Inventory Manager ────────────────────────────────────────────────────
  {
    id: "role-002",
    name: "Inventory Manager",
    description: "Full inventory control, limited view of purchase, sales and finance",
    colorClass: "bg-warning/10 text-warning border-warning/20",
    icon: "📦",
    isSystem: true,
    permissions: {
      "inventory.stock":      ["view","create","edit","delete","adjust","export"],
      "inventory.movements":  ["view","create","adjust","export"],
      "inventory.warehouses": ["view","create","edit"],
      "inventory.transfers":  ["view","create","approve"],
      "purchase.orders":      ["view"],
      "purchase.vendors":     ["view"],
      "sales.orders":         ["view"],
      "finance.reports":      ["view"],
      "pos.retail":           ["view"],
      "settings.audit":       ["view"],
    },
    userCount: 3,
    createdAt: "2024-01-01",
  },

  // ── 3. Warehouse Staff ──────────────────────────────────────────────────────
  {
    id: "role-003",
    name: "Warehouse Staff",
    description: "Receive stock, create transfers, view items — no deletions or approvals",
    colorClass: "bg-primary/10 text-primary border-primary/20",
    icon: "🏭",
    isSystem: false,
    permissions: {
      "inventory.stock":      ["view","adjust"],
      "inventory.movements":  ["view","create"],
      "inventory.warehouses": ["view"],
      "inventory.transfers":  ["view","create"],
    },
    userCount: 8,
    createdAt: "2024-01-15",
  },

  // ── 4. POS Supervisor ───────────────────────────────────────────────────────
  {
    id: "role-004",
    name: "POS Supervisor",
    description: "Full POS access including voids, refunds, discounts, and shift management",
    colorClass: "bg-blue-500/10 text-blue-600 border-blue-200",
    icon: "🖥️",
    isSystem: false,
    permissions: {
      "pos.retail":           ["view","create","void","refund","discount","print"],
      "pos.restaurant":       ["view","create","void","refund","discount","print"],
      "pos.shifts":           ["view","create","approve"],
      "pos.reports":          ["view","export"],
      "inventory.stock":      ["view"],
      "settings.audit":       ["view"],
    },
    userCount: 4,
    createdAt: "2024-02-01",
  },

  // ── 5. POS Cashier ──────────────────────────────────────────────────────────
  {
    id: "role-005",
    name: "POS Cashier",
    description: "Operate Retail & Restaurant POS, process sales — no voids, refunds, or discounts",
    colorClass: "bg-success/10 text-success border-success/20",
    icon: "💳",
    isSystem: false,
    permissions: {
      "pos.retail":           ["view","create","print"],
      "pos.restaurant":       ["view","create","print"],
      "pos.shifts":           ["view","create"],
    },
    userCount: 12,
    createdAt: "2024-02-01",
  },

  // ── 6. Finance Manager ──────────────────────────────────────────────────────
  {
    id: "role-006",
    name: "Finance Manager",
    description: "Full finance module access; view-only on HR, inventory, sales and purchase",
    colorClass: "bg-purple-500/10 text-purple-600 border-purple-200",
    icon: "💰",
    isSystem: false,
    permissions: {
      "finance.invoicing":    ["view","create","edit","delete","approve","export","print"],
      "finance.expenses":     ["view","create","edit","delete","approve","export"],
      "finance.journals":     ["view","create","edit","approve"],
      "finance.banking":      ["view","create","edit","delete","export"],
      "finance.tax":          ["view","create","edit","approve","export"],
      "finance.reports":      ["view","export"],
      "purchase.orders":      ["view","approve"],
      "purchase.approvals":   ["view","approve"],
      "sales.orders":         ["view"],
      "hr.payroll":           ["view","approve"],
      "inventory.stock":      ["view","export"],
      "settings.audit":       ["view","export"],
    },
    userCount: 2,
    createdAt: "2024-01-01",
  },

  // ── 7. HR Manager ───────────────────────────────────────────────────────────
  {
    id: "role-007",
    name: "HR Manager",
    description: "Full HR and recruitment access; payroll approval; view users",
    colorClass: "bg-pink-500/10 text-pink-600 border-pink-200",
    icon: "👥",
    isSystem: false,
    permissions: {
      "hr.employees":         ["view","create","edit","delete","export"],
      "hr.payroll":           ["view","create","approve","export"],
      "hr.leaves":            ["view","create","edit","approve"],
      "hr.recruitment":       ["view","create","edit","delete"],
      "settings.users":       ["view"],
    },
    userCount: 2,
    createdAt: "2024-01-01",
  },

  // ── 8. Auditor ──────────────────────────────────────────────────────────────
  {
    id: "role-008",
    name: "Auditor",
    description: "Read-only access to all modules for compliance and audit purposes",
    colorClass: "bg-slate-500/10 text-slate-600 border-slate-200",
    icon: "🔍",
    isSystem: false,
    permissions: VIEW_ONLY,
    userCount: 1,
    createdAt: "2024-03-01",
  },

  // ── 9. Store Manager ────────────────────────────────────────────────────────
  {
    id: "role-009",
    name: "Store Manager",
    description: "Manage retail POS operations and view inventory — ideal for branch managers",
    colorClass: "bg-orange-500/10 text-orange-600 border-orange-200",
    icon: "🏪",
    isSystem: false,
    permissions: {
      "pos.retail":           ["view","create","void","refund","discount","print"],
      "pos.shifts":           ["view","create","approve"],
      "pos.reports":          ["view","export"],
      "inventory.stock":      ["view","adjust"],
      "inventory.movements":  ["view","create"],
      "inventory.transfers":  ["view","create"],
      "crm.customers":        ["view","create","edit"],
    },
    userCount: 5,
    createdAt: "2024-04-01",
  },
];

// ─── Summaries ────────────────────────────────────────────────────────────────

export const rolesSummary = {
  totalRoles:  roles.length,
  systemRoles: roles.filter(r => r.isSystem).length,
  customRoles: roles.filter(r => !r.isSystem).length,
  totalUsers:  roles.reduce((s, r) => s + r.userCount, 0),
};

// Helper — unique permission groups
export const permissionGroups = [...new Set(modulePermissions.map(m => m.group))];

// Helper — all permissions labels
export const permissionLabels: Record<PermissionKey, string> = {
  view:     "View",
  create:   "Create",
  edit:     "Edit",
  delete:   "Delete",
  approve:  "Approve",
  export:   "Export",
  print:    "Print",
  void:     "Void",
  refund:   "Refund",
  discount: "Discount",
  adjust:   "Adjust Stock",
};
