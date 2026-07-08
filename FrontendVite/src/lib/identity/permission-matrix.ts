/**
 * Shared building blocks for the permission matrix UI — used by both the role
 * permission editor (roles-permissions-view.tsx) and the per-user override editor
 * (user-permissions-tab.tsx) so the two screens stay visually and behaviourally identical.
 */
import type { PermissionDto } from "@/lib/identity/types";

export const ACTION_ORDER = [
  "view", "create", "edit", "delete", "approve", "export", "print",
  "void", "refund", "discount", "adjust",
] as const;

export type Action = typeof ACTION_ORDER[number];

export const ACTION_LABELS: Record<Action, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  approve: "Approve", export: "Export", print: "Print",
  void: "Void", refund: "Refund", discount: "Discount", adjust: "Adjust",
};

export const MODULE_GROUPS: Record<string, string> = {
  inventory: "Inventory", pos: "POS", finance: "Finance", hr: "HR",
  crm: "CRM", sales: "Sales", purchase: "Purchase", settings: "Settings",
  "project-management": "Project Management",
  b2b: "B2B", education: "Education", healthcare: "Healthcare", insurance: "Insurance",
};

export const GROUP_ORDER = [
  "POS", "Inventory", "Finance", "Sales", "Purchase", "CRM",
  "B2B", "Education", "Healthcare", "Insurance", "HR",
  "Project Management", "Settings",
];

/** Group permissions by module id, then bucket module ids under their display group. */
export function groupPermissions(perms: PermissionDto[]) {
  const byModule: Record<string, PermissionDto[]> = {};
  for (const p of perms) {
    if (!byModule[p.moduleId]) byModule[p.moduleId] = [];
    byModule[p.moduleId].push(p);
  }
  const byGroup: Record<string, string[]> = {};
  for (const moduleId of Object.keys(byModule)) {
    const prefix = moduleId.split(".")[0];
    const group = MODULE_GROUPS[prefix] ?? prefix;
    if (!byGroup[group]) byGroup[group] = [];
    if (!byGroup[group].includes(moduleId)) byGroup[group].push(moduleId);
  }
  for (const g of Object.keys(byGroup)) byGroup[g].sort();
  return { byModule, byGroup };
}

/** Friendlier labels for module ids whose auto-derived name reads awkwardly. */
const MODULE_LABEL_OVERRIDES: Record<string, string> = {
  "crm.leads-assigned": "Leads (Assigned only)",
};

/** Human label for a module id, e.g. "finance.invoicing" → "Invoicing". */
export function moduleLabel(moduleId: string) {
  if (MODULE_LABEL_OVERRIDES[moduleId]) return MODULE_LABEL_OVERRIDES[moduleId];
  const parts = moduleId.split(".");
  if (parts.length < 2) return moduleId;
  return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

/**
 * Display label for a top-level module prefix (e.g. "pos" → "POS",
 * "project-management" → "Project Management"). Used to show which module(s)
 * a role is linked to. Falls back to a title-cased prefix for unknown modules.
 */
export function moduleGroupLabel(prefix: string) {
  return (
    MODULE_GROUPS[prefix.toLowerCase()] ??
    prefix
      .split("-")
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ")
  );
}

/**
 * Modules that every role touches regardless of its domain (cross-cutting).
 * Excluded when summarising "which module is this role for" so the chips
 * highlight the role's actual purpose.
 */
export const UBIQUITOUS_MODULES = new Set([
  "settings", "reports", "dashboard", "notifications", "file-manager", "ai-assistant",
]);

/** Build a moduleId → action → PermissionDto lookup from grouped permissions. */
export function buildPermActionMap(byModule: Record<string, PermissionDto[]>) {
  const map: Record<string, Record<string, PermissionDto>> = {};
  for (const [moduleId, perms] of Object.entries(byModule)) {
    map[moduleId] = {};
    for (const perm of perms) map[moduleId][perm.action] = perm;
  }
  return map;
}
