/**
 * RestaurantOffline — keeps a restaurant till trading when it cannot reach the server.
 *
 * While the server is reachable the till works exactly as before; this engine only keeps a copy of
 * what the till needs for its branch (menu, floor plan, open bills, the open shift). When the server
 * cannot be reached, the till reads that copy and the supported actions — take an order, add items,
 * send to kitchen, serve, take payment — are applied to it locally and queued. When the server is
 * back the queue is uploaded (POST /api/restaurant/offline/sync), oldest first. Every queued action
 * carries its own id and the server records the ids it has applied, so an upload that is
 * interrupted and repeated applies nothing twice.
 *
 * Totals are computed the way the server computes them (items + modifiers, 5% tax, minus any
 * discount already on the bill), and an item is uploaded at the price the customer was shown, so the
 * bill the guest paid is the bill the server records.
 *
 * Storage: IndexedDB through the same zero-dependency helper as the retail offline till, in a
 * database of its own per workspace and user.
 */

import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { idbAll, idbGet, idbWrite, openOfflineDb } from "@/lib/pos/offline/offline-db";
import type { CurrentTax } from "@/lib/restaurant/tax-platforms.api";
import type {
  FloorLayout, MenuCategory, MenuItem, OrderItem, OrderLineInput, RestaurantOrder, RestaurantTable,
} from "@/lib/restaurant/restaurant.api";

export type OfflineOpKind = "create" | "addItems" | "send" | "serve" | "pay";

export interface QueuedOp {
  /** IndexedDB key (the store is keyed on clientRef) — always equal to opId. */
  clientRef: string;
  opId: string;
  seq: number;
  kind: OfflineOpKind;
  occurredAtUtc: string;
  branchKey: string;
  orderId: string | null;
  orderClientRef: string | null;
  /** What the till shows in the "waiting to upload" list. */
  label: string;
  create?: {
    tableId: string | null; waiter: string; covers: number; orderType: string; notes: string | null;
    branchId: string | null; sessionId: string | null; customerId: string | null; items: ServerLine[];
  };
  items?: ServerLine[];
  payment?: { method: string; amount: number; reference: string | null };
  /** Why the server refused it on the last upload; null until then. */
  error?: string | null;
}

interface ServerLine {
  menuItemId: string; quantity: number; modifiers: string | null; selectedModifierIds: string[];
  courseNumber: number | null; offlineUnitPrice: number;
}

interface Snapshot {
  menu?: MenuCategory[];
  /** The branch's tax, so a bill taken offline is charged what the server would charge. */
  tax?: CurrentTax;
  tables?: RestaurantTable[];
  layout?: FloorLayout[];
  savedAt?: string;
}

export interface OfflineQueueStatus {
  pending: number;
  rejected: QueuedOp[];
  lastSyncAt: string | null;
}

export interface SyncOutcome { applied: number; already: number; rejected: number; }

/** Used only if this till never saw the branch's tax setting (it was 5% before tax became configurable). */
const FALLBACK_TAX: CurrentTax = { rate: 5, label: "Tax", serviceFee: 0, reportToFbr: false };
const LOCAL_PREFIX = "off-";      // ids of orders taken offline, until the server gives them one
const round2 = (n: number) => Math.round(n * 100) / 100;
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const isLocalOrderId = (id: string) => id.startsWith(LOCAL_PREFIX);

export class RestaurantOffline {
  private dbPromise: Promise<IDBDatabase>;
  private listeners = new Set<() => void>();
  /** Serialises writes: two taps in a row must not interleave their read-modify-write. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(opts: { tenantKey: string; userId: string }) {
    this.dbPromise = openOfflineDb(`vrodux-restaurant-offline:${opts.tenantKey}:${opts.userId}`);
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(fn => { try { fn(); } catch { /* listener errors are not ours */ } }); }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private static key(branchId: string | null) { return branchId ?? "all"; }

  // ── Copy of the server, refreshed while online ────────────────────────────────

  /** Called by the live hooks after each successful read, so the copy is never older than the screen. */
  async remember(branchId: string | null, part: Snapshot, openOrders?: RestaurantOrder[]): Promise<void> {
    const db = await this.dbPromise;
    const k = RestaurantOffline.key(branchId);
    await this.run(async () => {
      const snap = (await idbGet<Snapshot>(db, "kv", `snap:${k}`)) ?? {};
      const ops: Parameters<typeof idbWrite>[2] = [
        { store: "kv", key: `snap:${k}`, put: { ...snap, ...part, savedAt: new Date().toISOString() } },
      ];
      // The server's open bills replace the local working copy — but never while this branch still
      // has actions waiting to upload, or the waiting work would vanish from the screen.
      if (openOrders && !(await this.hasPending(db, k)))
        ops.push({ store: "kv", key: `orders:${k}`, put: openOrders });
      await idbWrite(db, ["kv"], ops);
    });
  }

  async getTax(branchId: string | null): Promise<CurrentTax> {
    const db = await this.dbPromise;
    return (await idbGet<Snapshot>(db, "kv", `snap:${RestaurantOffline.key(branchId)}`))?.tax ?? FALLBACK_TAX;
  }

  async snapshotAge(branchId: string | null): Promise<string | null> {
    const db = await this.dbPromise;
    return (await idbGet<Snapshot>(db, "kv", `snap:${RestaurantOffline.key(branchId)}`))?.savedAt ?? null;
  }

  // ── Reads while offline ─────────────────────────────────────────────────────────

  async getMenu(branchId: string | null): Promise<MenuCategory[]> {
    const db = await this.dbPromise;
    const snap = await idbGet<Snapshot>(db, "kv", `snap:${RestaurantOffline.key(branchId)}`);
    if (!snap?.menu) throw new Error("This till has no copy of the menu yet. Open the till once while online.");
    return snap.menu;
  }

  async getOpenOrders(branchId: string | null): Promise<RestaurantOrder[]> {
    const db = await this.dbPromise;
    return (await idbGet<RestaurantOrder[]>(db, "kv", `orders:${RestaurantOffline.key(branchId)}`)) ?? [];
  }

  async getOrder(branchId: string | null, id: string): Promise<RestaurantOrder> {
    const found = (await this.getOpenOrders(branchId)).find(o => o.id === id);
    if (!found) throw new Error("This bill is not on this till. It may have been closed on another device.");
    return found;
  }

  async getTables(branchId: string | null): Promise<RestaurantTable[]> {
    const db = await this.dbPromise;
    const snap = await idbGet<Snapshot>(db, "kv", `snap:${RestaurantOffline.key(branchId)}`);
    return this.withOccupancy(snap?.tables ?? [], await this.getOpenOrders(branchId));
  }

  async getLayout(branchId: string | null): Promise<FloorLayout[]> {
    const db = await this.dbPromise;
    const snap = await idbGet<Snapshot>(db, "kv", `snap:${RestaurantOffline.key(branchId)}`);
    const orders = await this.getOpenOrders(branchId);
    return (snap?.layout ?? []).map(f => ({
      ...f, diningAreas: f.diningAreas.map(a => ({ ...a, tables: this.withOccupancy(a.tables, orders) })),
    }));
  }

  /** A table's state follows the bills on this till: occupied while one is open, free once paid. */
  private withOccupancy(tables: RestaurantTable[], orders: RestaurantOrder[]): RestaurantTable[] {
    const live = new Map(orders.filter(o => o.status !== "paid" && o.status !== "cancelled" && o.tableId)
      .map(o => [o.tableId, o] as const));
    return tables.map(t => {
      const o = live.get(t.id);
      if (o) return { ...t, status: "occupied", currentOrderId: o.id, currentWaiter: o.waiter, occupiedSince: t.occupiedSince ?? o.createdAt };
      if (t.status === "occupied") return { ...t, status: "available", currentOrderId: null, currentWaiter: null, occupiedSince: null };
      return t;
    });
  }

  // ── Actions while offline ───────────────────────────────────────────────────────

  async createOrder(p: {
    tableId: string | null; waiter: string; covers: number; orderType: string; notes?: string | null;
    items: OrderLineInput[]; branchId?: string | null; sessionId?: string | null; customerId?: string | null;
  }): Promise<RestaurantOrder> {
    if (p.orderType === "delivery")
      throw new Error("Delivery orders need a connection — riders are dispatched from the server.");
    const branchId = p.branchId ?? null;
    const menu = await this.getMenu(branchId);
    const tax = await this.getTax(branchId);
    return this.mutate(branchId, async orders => {
      const ref = uuid();
      const now = new Date().toISOString();
      const table = p.tableId ? (await this.getTables(branchId)).find(t => t.id === p.tableId) : undefined;
      const lines = p.items.map(li => this.buildLine(menu, li));
      const order: RestaurantOrder = {
        id: LOCAL_PREFIX + ref, orderNumber: `OFF-${now.slice(11, 16).replace(":", "")}-${ref.slice(0, 4).toUpperCase()}`,
        tableId: p.tableId ?? "", tableNumber: table?.tableNumber ?? (p.orderType === "takeaway" ? "Takeaway" : ""),
        waiter: p.waiter, covers: p.covers, status: "open", orderType: p.orderType, orderChannel: "pos",
        subTotal: 0, taxAmount: 0, discountAmount: 0, total: 0, amountPaid: 0, tipAmount: 0, outstanding: 0,
        paymentMethod: null, notes: p.notes ?? null, createdAt: now, currentCourse: 1,
        items: lines.map(l => l.item), payments: [], branchId, sessionId: p.sessionId ?? null, cashierId: null,
        discounts: [], voidLogs: [], refunds: [], parentOrderId: null, splits: [], customerId: p.customerId ?? null,
        taxRate: tax.rate, taxLabel: tax.label, serviceFee: tax.serviceFee, fbrStatus: tax.reportToFbr ? "pending" : null,
      };
      recalc(order);
      orders.push(order);
      return {
        result: order,
        op: {
          kind: "create", orderId: null, orderClientRef: ref, label: `New bill ${order.orderNumber}`,
          create: {
            tableId: p.tableId, waiter: p.waiter, covers: p.covers, orderType: p.orderType, notes: p.notes ?? null,
            branchId, sessionId: p.sessionId ?? null, customerId: p.customerId ?? null, items: lines.map(l => l.server),
          },
        },
      };
    });
  }

  async addItems(branchId: string | null, id: string, items: OrderLineInput[]): Promise<RestaurantOrder> {
    const menu = await this.getMenu(branchId);
    return this.mutate(branchId, async orders => {
      const o = find(orders, id);
      if (["paid", "cancelled", "split", "held"].includes(o.status)) throw new Error("This bill is closed.");
      const lines = items.map(li => this.buildLine(menu, li));
      o.items.push(...lines.map(l => l.item));
      if (o.status === "served" || o.status === "ready") o.status = "sent";
      recalc(o);
      return { result: o, op: { kind: "addItems", ...ref(o), label: `Items added to ${o.orderNumber}`, items: lines.map(l => l.server) } };
    });
  }

  async send(branchId: string | null, id: string): Promise<RestaurantOrder> {
    return this.mutate(branchId, async orders => {
      const o = find(orders, id);
      if (o.status === "open") o.status = "sent";
      return { result: o, op: { kind: "send", ...ref(o), label: `${o.orderNumber} sent to kitchen` } };
    });
  }

  async serve(branchId: string | null, id: string): Promise<RestaurantOrder> {
    return this.mutate(branchId, async orders => {
      const o = find(orders, id);
      if (!["paid", "cancelled"].includes(o.status)) o.status = "served";
      o.items.forEach(i => { i.status = "served"; });
      return { result: o, op: { kind: "serve", ...ref(o), label: `${o.orderNumber} served` } };
    });
  }

  async addPayment(branchId: string | null, id: string, p: { method: string; amount: number; reference?: string | null }): Promise<RestaurantOrder> {
    return this.mutate(branchId, async orders => {
      const o = find(orders, id);
      if (["paid", "cancelled"].includes(o.status)) throw new Error("This bill is already settled.");
      const amount = round2(p.amount);
      if (amount <= 0) throw new Error("Amount must be greater than zero.");
      if (amount > o.outstanding + 0.005) throw new Error("That is more than is owed on this bill.");
      // Wallet and house account draw on a customer balance and credit limit only the server knows.
      if (CUSTOMER_FUNDED.has(p.method))
        throw new Error(`${p.method} payments need a connection — take cash or card for now.`);
      const method = p.method;
      o.payments.push({ id: uuid(), method, amount, reference: p.reference ?? null, createdAt: new Date().toISOString() });
      o.amountPaid = round2(o.amountPaid + amount);
      o.paymentMethod = method;
      recalc(o);
      if (o.outstanding <= 0.005) o.status = "paid";
      return {
        result: o,
        op: { kind: "pay", ...ref(o), label: `Payment ${amount.toFixed(2)} on ${o.orderNumber}`,
              payment: { method, amount, reference: p.reference ?? null } },
      };
    });
  }

  /** "Pay" with one method = settle whatever is still owed. */
  async payInFull(branchId: string | null, id: string, method: string): Promise<RestaurantOrder> {
    const o = await this.getOrder(branchId, id);
    return this.addPayment(branchId, id, { method, amount: o.outstanding });
  }

  private async mutate(
    branchId: string | null,
    fn: (orders: RestaurantOrder[]) => Promise<{
      result: RestaurantOrder;
      op: Omit<QueuedOp, "clientRef" | "opId" | "seq" | "occurredAtUtc" | "branchKey">;
    }>,
  ): Promise<RestaurantOrder> {
    const db = await this.dbPromise;
    const k = RestaurantOffline.key(branchId);
    const out = await this.run(async () => {
      const orders = (await idbGet<RestaurantOrder[]>(db, "kv", `orders:${k}`)) ?? [];
      const { result, op } = await fn(orders);
      const seq = ((await idbGet<number>(db, "kv", "seq")) ?? 0) + 1;
      const opId = uuid();
      const queued: QueuedOp = { ...op, clientRef: opId, opId, seq, occurredAtUtc: new Date().toISOString(), branchKey: k };
      // The bill and the action that changed it are written together or not at all.
      await idbWrite(db, ["kv", "events"], [
        { store: "kv", key: `orders:${k}`, put: orders },
        { store: "kv", key: "seq", put: seq },
        { store: "events", put: queued },
      ]);
      return structuredClone(result);
    });
    this.emit();
    return out;
  }

  private buildLine(menu: MenuCategory[], li: OrderLineInput): { item: OrderItem; server: ServerLine } {
    const mi = menu.flatMap(c => c.items).find(i => i.id === li.menuItemId) as MenuItem | undefined;
    if (!mi) throw new Error("That item is not on this till's copy of the menu.");
    const mods = (mi.modifierGroups ?? []).flatMap(g => g.modifiers).filter(m => li.selectedModifierIds?.includes(m.id));
    const unit = mi.price;
    const item: OrderItem = {
      id: uuid(), menuItemId: mi.id, itemName: mi.name, quantity: li.quantity, unitPrice: unit,
      lineTotal: round2(li.quantity * (unit + mods.reduce((s, m) => s + m.priceDelta, 0))),
      modifiers: li.modifiers ?? null, status: "pending", courseNumber: li.courseNumber ?? 1, comboOrderItemId: null,
      selectedModifiers: mods.map(m => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })),
    };
    return {
      item,
      server: {
        menuItemId: mi.id, quantity: li.quantity, modifiers: li.modifiers ?? null,
        selectedModifierIds: li.selectedModifierIds ?? [], courseNumber: li.courseNumber ?? null, offlineUnitPrice: unit,
      },
    };
  }

  // ── Queue + upload ──────────────────────────────────────────────────────────────

  private async hasPending(db: IDBDatabase, k: string): Promise<boolean> {
    return (await idbAll<QueuedOp>(db, "events")).some(o => o.branchKey === k);
  }

  async getStatus(): Promise<OfflineQueueStatus> {
    const db = await this.dbPromise;
    const all = await idbAll<QueuedOp>(db, "events");
    return {
      pending: all.length,
      rejected: all.filter(o => o.error).sort((a, b) => a.seq - b.seq),
      lastSyncAt: (await idbGet<string>(db, "kv", "lastSyncAt")) ?? null,
    };
  }

  /** Uploads everything queued, oldest first. Safe to call repeatedly and concurrently. */
  sync(): Promise<SyncOutcome> {
    return this.run(async () => {
      const db = await this.dbPromise;
      const ops = (await idbAll<QueuedOp>(db, "events")).sort((a, b) => a.seq - b.seq);
      if (ops.length === 0) return { applied: 0, already: 0, rejected: 0 };

      const outcome: SyncOutcome = { applied: 0, already: 0, rejected: 0 };
      for (let i = 0; i < ops.length; i += 200) {
        const batch = ops.slice(i, i + 200);
        const res = await rawApiClient.post<{ applied: number; alreadyApplied: number; rejected: number;
          results: { opId: string; status: string; error: string | null }[] }>(
          `${getApiBaseUrl()}/api/restaurant/offline/sync`,
          { ops: batch.map(toServerOp) },
        );
        outcome.applied += res.applied; outcome.already += res.alreadyApplied; outcome.rejected += res.rejected;

        const byId = new Map(res.results.map(r => [r.opId, r]));
        const writes: Parameters<typeof idbWrite>[2] = [];
        for (const op of batch) {
          const r = byId.get(op.opId);
          if (!r) continue;
          if (r.status === "rejected") writes.push({ store: "events", put: { ...op, error: r.error ?? "Refused by the server." } });
          else writes.push({ store: "events", del: op.clientRef });
        }
        await idbWrite(db, ["events"], writes);
      }

      // The server is now the truth for every branch that uploaded: drop the local working copies
      // so the next read comes from it. Rejected actions stay listed until someone deals with them.
      const branches = new Set(ops.map(o => o.branchKey));
      await idbWrite(db, ["kv"], [
        ...[...branches].map(b => ({ store: "kv" as const, del: `orders:${b}` })),
        { store: "kv", key: "lastSyncAt", put: new Date().toISOString() },
      ]);
      return outcome;
    }).finally(() => this.emit());
  }

  /** Throws away one refused action (after staff have dealt with it by hand). */
  async discard(opId: string): Promise<void> {
    const db = await this.dbPromise;
    await this.run(() => idbWrite(db, ["events"], [{ store: "events", del: opId }]));
    this.emit();
  }
}

function find(orders: RestaurantOrder[], id: string): RestaurantOrder {
  const o = orders.find(x => x.id === id);
  if (!o) throw new Error("This bill is not on this till. It may have been closed on another device.");
  return o;
}

function ref(o: RestaurantOrder): { orderId: string | null; orderClientRef: string | null } {
  return isLocalOrderId(o.id) ? { orderId: null, orderClientRef: o.id.slice(LOCAL_PREFIX.length) } : { orderId: o.id, orderClientRef: null };
}

function recalc(o: RestaurantOrder) {
  o.subTotal = round2(o.items.reduce((s, i) => s + i.lineTotal, 0));
  // Mirrors Order.Recalculate: tax after discount, plus the FBR fee on a non-empty bill.
  const discount = o.discountAmount ?? 0;
  o.taxAmount = round2(Math.max(0, o.subTotal - discount) * (o.taxRate ?? FALLBACK_TAX.rate) / 100);
  o.total = round2(o.subTotal + o.taxAmount - discount + (o.subTotal > 0 ? o.serviceFee ?? 0 : 0));
  o.outstanding = Math.max(0, round2(o.total + (o.tipAmount ?? 0) - o.amountPaid));
}

/** Payment methods that spend a customer's balance or credit — server-checked, so online only. */
const CUSTOMER_FUNDED = new Set(["Wallet", "House Account"]);

function toServerOp(o: QueuedOp) {
  return {
    opId: o.opId, kind: o.kind, occurredAtUtc: o.occurredAtUtc,
    orderId: o.orderId, orderClientRef: o.orderClientRef,
    create: o.create ?? null, items: o.items ?? null, payment: o.payment ?? null,
  };
}
