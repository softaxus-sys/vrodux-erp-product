/**
 * Shared building blocks for the permission matrix UI — used by both the role
 * permission editor (roles-permissions-view.tsx) and the per-user override editor
 * (user-permissions-tab.tsx) so the two screens stay visually and behaviourally identical.
 */
import i18n from "@/i18n";
import type { PermissionDto } from "@/lib/identity/types";

/**
 * Every action a seeded permission can use. A key whose action is missing here renders no
 * column at all, so it cannot be granted or revoked through the UI — keep this in lockstep
 * with PermissionSeedData.
 */
export const ACTION_ORDER = [
  "view", "create", "edit", "delete", "approve", "export", "print",
  "void", "refund", "discount", "adjust", "create-login",
  // Employee self-service verbs — these are actions, not modules.
  "leave-request", "attendance", "payslip",
] as const;

export type Action = typeof ACTION_ORDER[number];

/** Full action label, translated. */
export const actionLabel = (action: string) =>
  i18n.t(`settings:permMatrix.action.${action}`, { defaultValue: action });

/**
 * Short label for the matrix column headers (~3 chars wide).
 * The old code did `ACTION_LABELS[a].slice(0, 3)`, which only produces a sensible
 * abbreviation in English — Arabic needs its own short forms, so they live in the
 * locale files rather than being derived.
 */
export const actionShortLabel = (action: string) =>
  i18n.t(`settings:permMatrix.actionShort.${action}`, { defaultValue: action.slice(0, 3).toUpperCase() });

export const MODULE_GROUPS: Record<string, string> = {
  inventory: "Inventory", pos: "POS", finance: "Finance", hr: "HR",
  crm: "CRM", sales: "Sales", purchase: "Purchase", settings: "Settings",
  "project-management": "Project Management",
  b2b: "B2B", education: "Education", healthcare: "Healthcare", insurance: "Insurance",
  visa: "Visa Services", restaurant: "Restaurant", reports: "Reports",
  "file-manager": "File Manager",
};

export const GROUP_ORDER = [
  "POS", "Restaurant", "Inventory", "Finance", "Sales", "Purchase", "CRM",
  "B2B", "Education", "Healthcare", "Insurance", "Visa Services", "HR",
  "Project Management", "Reports", "File Manager", "Settings",
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

/**
 * Human label for a module id, e.g. "finance.invoicing" → "Invoicing".
 * Translated via `permMatrix.module.<id>`; the title-cased suffix is the fallback so a
 * permission group added on the backend still renders before its key is translated.
 */
export function moduleLabel(moduleId: string) {
  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const parts = moduleId.split(".");
  // Single-segment ids (e.g. "reports" — a module that is its own feature) were returned verbatim
  // and rendered lowercase next to every other title-cased row.
  const derived = parts.length < 2
    ? titleCase(moduleId)
    : parts.slice(1).map(titleCase).join(" ");
  return i18n.t(`settings:permMatrix.module.${moduleId}`, { defaultValue: derived });
}

/**
 * Display label for a top-level module prefix (e.g. "pos" → "POS",
 * "project-management" → "Project Management"). Used to show which module(s)
 * a role is linked to. Falls back to a title-cased prefix for unknown modules.
 */
export function moduleGroupLabel(prefix: string) {
  const key = prefix.toLowerCase();
  const derived =
    MODULE_GROUPS[key] ??
    prefix
      .split("-")
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  return i18n.t(`settings:permMatrix.group.${key}`, { defaultValue: derived });
}

/**
 * Translated label for a matrix group heading. `groupPermissions` buckets modules under
 * the ENGLISH group name (it is also the key used by GROUP_ORDER and the expand/collapse
 * state), so the display label is resolved back through MODULE_GROUPS here rather than
 * translating the bucket key itself.
 */
const GROUP_PREFIX_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_GROUPS).map(([prefix, name]) => [name, prefix]),
);
export function groupLabel(groupName: string) {
  const prefix = GROUP_PREFIX_BY_NAME[groupName];
  return prefix ? moduleGroupLabel(prefix) : groupName;
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
