import type { Feather } from "@expo/vector-icons";
import type { Tone } from "@/theme";
import { NEXT_STEPS, type NextStep } from "@/lib/vertical-forms";

/**
 * Library, Manufacturing, Trade, Recipe, Calendar and Support share one set of generic screens
 * (home -> list -> record). Each module is described here: what to fetch, how a row reads, and
 * which one-tap actions a row offers. Endpoint shapes mirror the web app's lib/<module>/*.api.ts.
 */

export type Rec = Record<string, any>;

export interface RowView {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  tone?: Tone;
}

export interface ListSpec {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  /** Any one of these permission keys opens the list. Empty = module access is the only gate. */
  permission: string[];
  path: () => string;
  shape: "array" | "items";
  searchKeys: string[];
  row: (r: Rec) => RowView;
  /** Value the status chips filter on (defaults to `status`). */
  status?: (r: Rec) => string;
  /** Key into VERTICAL_FORMS: adds a "New" button. */
  formKey?: string;
  /** Key into NEXT_STEPS: the one-tap actions shown on each row. */
  stepKey?: string;
}

export interface Tile { label: string; field: string; money?: boolean }

export interface ExtraEntry {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  permission: string[];
}

export interface ModuleSpec {
  key: string;
  title: string;
  /** The tenant module that must be subscribed; null = core, always available. */
  moduleKey: string | null;
  summary?: { path: () => string; tiles: Tile[] };
  lists: ListSpec[];
  extras?: ExtraEntry[];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const s = (v: unknown, fallback = "") => (v === null || v === undefined || v === "" ? fallback : String(v));
const join = (...parts: unknown[]) => parts.map((p) => s(p)).filter(Boolean).join(" · ");

function shortDate(iso: unknown): string {
  const v = s(iso);
  return v ? v.slice(0, 10) : "";
}

// ── Library ────────────────────────────────────────────────────────────────
const loanStatus = (r: Rec) => (r.isOverdue && r.status === "active" ? "overdue" : s(r.status));

// ── Spec table ──────────────────────────────────────────────────────────────
export const MODULES: Record<string, ModuleSpec> = {
  library: {
    key: "library", title: "Library", moduleKey: "library",
    summary: {
      path: () => `/api/library/dashboard?today=${localToday()}`,
      tiles: [
        { label: "On loan", field: "onLoan" }, { label: "Overdue", field: "overdue" }, { label: "Due today", field: "dueToday" },
        { label: "Ready to collect", field: "readyReservations" }, { label: "Unpaid fines", field: "unpaidFines", money: true }, { label: "Available", field: "available" },
      ],
    },
    lists: [
      {
        key: "library.loans", title: "Loans", subtitle: "Who has what, and when it is due", icon: "repeat", permission: ["library.circulation.view"],
        path: () => `/api/library/loans?today=${localToday()}&pageSize=200`, shape: "items", searchKeys: ["title", "memberName", "barcode"],
        status: loanStatus, stepKey: "library.loan",
        row: (r) => ({
          title: s(r.title), subtitle: join(r.memberName, r.barcode),
          meta: r.returnedOn ? `Returned ${shortDate(r.returnedOn)}` : `Due ${shortDate(r.dueDate)}${r.daysOverdue > 0 ? ` · ${r.daysOverdue}d late` : ""}`,
          badge: loanStatus(r), tone: loanStatus(r) === "overdue" || r.status === "lost" ? "destructive" : r.status === "returned" ? "neutral" : "success",
        }),
      },
      {
        key: "library.reservations", title: "Reservations", subtitle: "Holds waiting or ready for pickup", icon: "bookmark", permission: ["library.circulation.view"],
        path: () => `/api/library/reservations?today=${localToday()}`, shape: "array", searchKeys: ["title", "memberName"], stepKey: "library.reservation",
        row: (r) => ({
          title: s(r.title), subtitle: s(r.memberName), meta: `Pickup: ${s(r.pickupBranchName)}`,
          badge: s(r.status), tone: r.status === "ready" ? "success" : r.status === "waiting" ? "warning" : "neutral",
        }),
      },
      {
        key: "library.titles", title: "Catalogue", subtitle: "Search books and availability", icon: "book", permission: ["library.catalog.view"],
        path: () => "/api/library/titles?pageSize=200", shape: "items", searchKeys: ["title", "authors", "isbn", "category"],
        status: () => "",
        row: (r) => ({
          title: s(r.title), subtitle: s(r.authors), meta: `${num(r.availableCopies)} of ${num(r.totalCopies)} available${r.waitingReservations ? ` · ${r.waitingReservations} waiting` : ""}`,
          badge: num(r.availableCopies) > 0 ? "available" : "all out", tone: num(r.availableCopies) > 0 ? "success" : "warning",
        }),
      },
      {
        key: "library.members", title: "Members", subtitle: "Borrowers and their loans", icon: "users", permission: ["library.members.view"],
        path: () => `/api/library/members?today=${localToday()}&pageSize=200`, shape: "items", searchKeys: ["fullName", "memberNumber", "phone", "email"],
        status: (r) => (r.isExpired ? "expired" : s(r.status)),
        row: (r) => ({
          title: s(r.fullName), subtitle: join(r.memberNumber, r.membershipTypeName),
          meta: `${num(r.activeLoans)} out${num(r.overdueLoans) ? `, ${r.overdueLoans} overdue` : ""}${num(r.unpaidFines) ? ` · fines ${r.unpaidFines}` : ""}`,
          badge: r.isExpired ? "expired" : s(r.status), tone: r.isExpired || r.status === "suspended" ? "destructive" : "success",
        }),
      },
      {
        key: "library.fines", title: "Fines", subtitle: "Overdue and lost-book charges", icon: "dollar-sign", permission: ["library.fines.view"],
        path: () => "/api/library/fines", shape: "array", searchKeys: ["memberName", "title", "reason"], stepKey: "library.fine",
        row: (r) => ({
          title: s(r.memberName), subtitle: join(r.type, r.title ?? r.reason), meta: `Balance ${num(r.balance)} of ${num(r.amount)}`,
          badge: s(r.status), tone: r.status === "unpaid" ? "destructive" : r.status === "paid" ? "success" : "neutral",
        }),
      },
    ],
    extras: [{ title: "Issue / return desk", subtitle: "Scan a book to lend or take it back", icon: "maximize", route: "LibraryDesk", permission: ["library.circulation.create", "library.circulation.edit"] }],
  },

  manufacturing: {
    key: "manufacturing", title: "Manufacturing", moduleKey: "manufacturing",
    summary: {
      path: () => "/api/manufacturing/orders/summary",
      tiles: [
        { label: "Planned", field: "planned" }, { label: "Released", field: "released" }, { label: "In progress", field: "inProgress" },
        { label: "Overdue", field: "overdue" }, { label: "Completed", field: "completed" }, { label: "Active BOMs", field: "activeBoms" },
      ],
    },
    lists: [
      {
        key: "mfg.orders", title: "Production orders", subtitle: "Plan, release and complete", icon: "tool", permission: ["manufacturing.orders.view"],
        path: () => "/api/manufacturing/orders", shape: "array", searchKeys: ["orderNumber", "productName", "reference"], stepKey: "mfg.order",
        row: (r) => ({
          title: join(r.orderNumber, r.productName), subtitle: `${num(r.producedQuantity)} of ${num(r.plannedQuantity)} ${s(r.unit)}`,
          meta: r.dueDate ? `Due ${shortDate(r.dueDate)}` : undefined, badge: s(r.status),
          tone: r.status === "completed" ? "success" : r.status === "cancelled" ? "neutral" : r.status === "in_progress" ? "warning" : "info",
        }),
      },
      {
        key: "mfg.boms", title: "Bills of materials", subtitle: "Recipes for each product", icon: "layers", permission: ["manufacturing.boms.view"],
        path: () => "/api/manufacturing/boms", shape: "array", searchKeys: ["bomNumber", "name", "productName"],
        row: (r) => ({
          title: join(r.bomNumber, r.name), subtitle: s(r.productName), meta: `${num(r.lineCount)} components · cost/unit ${num(r.costPerUnit)}`,
          badge: s(r.status), tone: r.status === "active" ? "success" : "warning",
        }),
      },
    ],
  },

  trade: {
    key: "trade", title: "Import / Export", moduleKey: "trade",
    summary: {
      path: () => `/api/trade/dashboard?today=${localToday()}`,
      tiles: [
        { label: "Open imports", field: "openImports" }, { label: "Open exports", field: "openExports" }, { label: "Arriving soon", field: "arrivingSoon" },
        { label: "Delayed", field: "delayed" }, { label: "At customs", field: "atCustoms" }, { label: "Open goods value", field: "openGoodsValue", money: true },
      ],
    },
    lists: [
      {
        key: "trade.shipments", title: "Shipments", subtitle: "Track cargo from booking to delivery", icon: "package", permission: ["trade.shipments.view"],
        path: () => "/api/trade/shipments?pageSize=200", shape: "items", searchKeys: ["shipmentNumber", "partnerName", "blNumber", "orderReference"], stepKey: "trade.shipment",
        row: (r) => ({
          title: join(r.shipmentNumber, r.direction), subtitle: join(r.partnerName, `${s(r.originCountry, "?")} → ${s(r.destinationCountry, "?")}`),
          meta: r.eta ? `ETA ${shortDate(r.eta)}` : undefined, badge: s(r.status),
          tone: r.status === "delivered" || r.status === "closed" ? "success" : r.status === "customs" ? "warning" : r.status === "cancelled" ? "neutral" : "info",
        }),
      },
      {
        key: "trade.parties", title: "Suppliers & buyers", subtitle: "Parties you ship with", icon: "users", permission: ["trade.parties.view"],
        path: () => "/api/trade/parties", shape: "array", searchKeys: ["name", "country", "contactName"], status: (r) => s(r.kind),
        row: (r) => ({ title: s(r.name), subtitle: join(r.kind, r.country), meta: join(r.contactName, r.phone), badge: `${num(r.shipments)} shipments`, tone: "neutral" }),
      },
    ],
  },

  recipe: {
    key: "recipe", title: "Recipes", moduleKey: "recipe",
    summary: { path: () => "/api/recipes/summary", tiles: [{ label: "Recipes", field: "total" }, { label: "Active", field: "active" }, { label: "Draft", field: "draft" }, { label: "Avg cost / serving", field: "avgCostPerServing", money: true }] },
    lists: [
      {
        key: "recipe.recipes", title: "Recipes", subtitle: "Ingredients, cost per serving", icon: "book-open", permission: [],
        path: () => "/api/recipes", shape: "array", searchKeys: ["menuItemName", "recipeNumber"], stepKey: "recipe.recipe",
        row: (r) => ({
          title: s(r.menuItemName), subtitle: join(r.recipeNumber, `${num(r.servings)} servings`), meta: `Cost / serving ${num(r.costPerServing)}`,
          badge: s(r.status), tone: r.status === "active" ? "success" : r.status === "draft" ? "warning" : "neutral",
        }),
      },
    ],
  },

  calendar: {
    key: "calendar", title: "Calendar", moduleKey: null,
    lists: [
      {
        key: "calendar.events", title: "Upcoming events", subtitle: "Next 30 days", icon: "calendar", permission: [],
        path: () => {
          const from = new Date();
          from.setHours(0, 0, 0, 0);
          const to = new Date(from.getTime() + 30 * 86_400_000);
          return `/api/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
        },
        shape: "array", searchKeys: ["title", "location", "description"], status: () => "",
        row: (r) => {
          const start = new Date(s(r.startUtc));
          const when = Number.isNaN(start.getTime()) ? "" : r.isAllDay ? start.toLocaleDateString() : `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
          return { title: s(r.title), subtitle: s(r.location), meta: when, badge: r.isAllDay ? "all day" : s(r.source), tone: "info" };
        },
      },
    ],
    extras: [{ title: "New event", subtitle: "Add a meeting or reminder", icon: "plus-circle", route: "NewEvent", permission: [] }],
  },

  support: {
    key: "support", title: "Help & Support", moduleKey: null,
    lists: [
      {
        key: "support.tickets", title: "My requests", subtitle: "Tickets you have sent to support", icon: "life-buoy", permission: [],
        path: () => "/api/support/my-tickets", shape: "array", searchKeys: ["subject", "ticketNumber"], formKey: "support.ticket",
        row: (r) => ({
          title: s(r.subject), subtitle: join(r.ticketNumber, r.category), meta: `${s(r.priority)} · ${num(r.messageCount)} messages`,
          badge: s(r.status), tone: r.status === "resolved" || r.status === "closed" ? "success" : r.status === "waiting_on_customer" ? "warning" : "info",
        }),
      },
    ],
  },
};

export const LIST_BY_KEY: Record<string, { module: ModuleSpec; list: ListSpec }> = Object.fromEntries(
  Object.values(MODULES).flatMap((m) => m.lists.map((l) => [l.key, { module: m, list: l }] as const)),
);

// ── One-tap actions (registered into the same table the industry packs use) ──
const today = () => ({ today: localToday() });
const step = (s2: Omit<NextStep, "method"> & { method?: NextStep["method"] }): NextStep => ({ method: "POST", ...s2 });

NEXT_STEPS["library.loan"] = [
  step({ from: ["active", "overdue"], label: "Return", path: (id) => `/api/library/loans/${id}/return`, body: () => ({ returnBranchId: null, damaged: false, notes: null, ...today() }), permission: "library.circulation.edit", queryKey: "module-list" }),
  step({ from: ["active"], label: "Renew", path: (id) => `/api/library/loans/${id}/renew`, body: () => today(), permission: "library.circulation.edit", queryKey: "module-list" }),
  step({ from: ["active", "overdue"], label: "Mark lost", path: (id) => `/api/library/loans/${id}/lost`, body: () => today(), permission: "library.circulation.edit", queryKey: "module-list", confirm: "The member will be charged for the lost book." }),
];
NEXT_STEPS["library.reservation"] = [
  step({ from: ["waiting", "ready"], label: "Cancel hold", path: (id) => `/api/library/reservations/${id}/cancel`, body: () => today(), permission: "library.circulation.edit", queryKey: "module-list", confirm: "Cancel this reservation?" }),
];
NEXT_STEPS["library.fine"] = [
  step({ from: ["unpaid", "partial"], label: "Collect in cash", path: (id) => `/api/library/fines/${id}/pay`, body: (r) => ({ amount: Number(r.balance ?? 0), method: "cash", ...today() }), permission: "library.fines.edit", queryKey: "module-list", confirm: "Record the full balance as paid in cash?" }),
];
NEXT_STEPS["mfg.order"] = [
  step({ from: ["planned"], label: "Release", path: (id) => `/api/manufacturing/orders/${id}/release`, body: () => ({}), permission: "manufacturing.orders.edit", queryKey: "module-list" }),
  step({
    from: ["released", "in_progress"], label: "Complete", path: (id) => `/api/manufacturing/orders/${id}/complete`,
    body: (r) => ({ producedQuantity: Math.max(0, Number(r.plannedQuantity ?? 0) - Number(r.producedQuantity ?? 0)), issueRemaining: true, scrappedQuantity: 0 }),
    permission: "manufacturing.orders.edit", queryKey: "module-list",
    confirm: "Records the remaining planned quantity as produced, issues any materials not yet issued, and receives the goods into stock.",
  }),
];

const SHIPMENT_NEXT: [string, string, string][] = [
  ["booked", "in_transit", "Mark in transit"], ["in_transit", "arrived", "Mark arrived"], ["arrived", "customs", "Into customs"],
  ["customs", "cleared", "Mark cleared"], ["cleared", "delivered", "Mark delivered"],
];
NEXT_STEPS["trade.shipment"] = SHIPMENT_NEXT.map(([from, to, label]) =>
  step({ from: [from], label, method: "PATCH", path: (id) => `/api/trade/shipments/${id}/status`, body: () => ({ status: to, note: null, date: localToday() }), permission: "trade.shipments.edit", queryKey: "module-list" }));

NEXT_STEPS["recipe.recipe"] = [
  step({ from: ["draft"], label: "Activate", method: "PATCH", path: (id) => `/api/recipes/${id}/activate`, body: () => ({}), permission: "", queryKey: "module-list" }),
  step({ from: ["active"], label: "Archive", method: "PATCH", path: (id) => `/api/recipes/${id}/archive`, body: () => ({}), permission: "", queryKey: "module-list", confirm: "Archive this recipe?" }),
];
