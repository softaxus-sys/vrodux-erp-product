/**
 * Offline POS engine — local-first, day-end sync.
 *
 * Everything a till does while offline mode is on (open/close shift, sale, refund, void, cash in/out)
 * is written to IndexedDB as an ordered event. Nothing reaches the server until the cashier presses
 * "Sync to Cloud", which uploads the events and the server replays them through the same handlers
 * the online till uses. The server is authoritative for prices, tax and totals; the figures computed
 * here only drive the receipt and the on-screen history until then.
 *
 * Idempotency: every shift and event has a client-generated `clientRef`. A retried sync (lost
 * response, double click) is recognised by the server and reported as a duplicate, never re-applied.
 */

import { apiClient } from "@/lib/api-client";
import { inventoryProductsApi } from "@/lib/inventory/products.api";
import { paymentMethodsApi, type PaymentMethodDto } from "@/lib/pos/payment-methods.api";
import type { ProductSummaryDto as InvProductSummaryDto } from "@/lib/inventory/types";
import type {
  CashMovementDto, CreateSaleRequest, LineItemRequest, OrderDiscountRequest, POSLineItemDto,
  POSSessionDto, POSSessionSummaryDto, POSTransactionDto, POSTransactionSummaryDto,
  PaymentRequest, RefundRequest,
} from "@/lib/pos/types";
import { idbAll, idbGet, idbWrite, openOfflineDb } from "./offline-db";

const API = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogueSnapshot {
  products:       InvProductSummaryDto[];
  paymentMethods: PaymentMethodDto[];
  takenAt:        string;
}

export interface LocalSession {
  clientRef:   string;
  registerId:  string;
  cashierId:   string;
  openingCash: number;
  openedAt:    string;
  notes:       string | null;
  status:      "open" | "closed";
  close?:      { closingCash: number; closedAt: string; notes: string | null };
  /** "open-on-server" = uploaded while still trading; the shift exists server-side but isn't closed. */
  syncState:   "local" | "open-on-server";
  lastError?:  string | null;
  totalTransactions: number;
  totalSales:        number;
  totalRefunds:      number;
  expectedCash:      number;
}

type EventKind = "sale" | "refund" | "void" | "cash";

export interface LocalEvent {
  clientRef:     string;
  sessionRef:    string;
  seq:           number;
  kind:          EventKind;
  occurredAt:    string;
  receiptNumber: string | null;
  /** Mirrors the server's OfflineEventPayload. */
  payload: {
    customerId?:      string | null;
    lineItems?:       LineItemRequest[];
    payments?:        PaymentRequest[];
    orderDiscount?:   OrderDiscountRequest | null;
    notes?:           string | null;
    targetClientRef?: string | null;
    cashType?:        "payin" | "payout";
    amount?:          number;
    reason?:          string | null;
  };
  /** Local projection for the history tab and receipts (sale/refund only). */
  txn?:     POSTransactionDto;
  movement?: CashMovementDto;
  status:   "pending" | "synced" | "rejected";
  error?:   string | null;
}

export interface OfflineSyncResult {
  batchId:    string;
  applied:    number;
  duplicates: number;
  rejected:   number;
  sessions: { clientRef: string; serverSessionId: string | null; status: "synced" | "open" | "rejected"; error: string | null }[];
  events:   { clientRef: string; sessionClientRef: string; status: "applied" | "duplicate" | "rejected"; serverId: string | null; transactionNumber: string | null; error: string | null }[];
  negativeStock: { productId: string; name: string; stockQuantity: number }[];
}

export interface OfflineStatus {
  unsyncedShifts:  number;
  pendingRecords:  number;
  rejected:        LocalEvent[];
  sessionErrors:   { clientRef: string; registerId: string; error: string }[];
  catalogueTakenAt: string | null;
  catalogueProducts: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

export function newClientRef(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Fallback for non-secure contexts: 122 random bits formatted as a v4 UUID.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Local calendar day at the till — a receipt printed at 11 pm belongs to that day, not UTC's. */
function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function toSummary(txn: POSTransactionDto): POSTransactionSummaryDto {
  return {
    id:                   txn.id,
    transactionNumber:    txn.transactionNumber,
    customerName:         txn.customerName,
    type:                 txn.type,
    status:               txn.status,
    totalAmount:          txn.totalAmount,
    primaryPaymentMethod: txn.payments[0]?.method ?? "—",
    completedAt:          txn.completedAt,
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export interface OfflineScope {
  /** Tenant + user — two workspaces or two cashiers on one machine must never share a queue. */
  tenantKey: string;
  userId:    string;
}

export class OfflinePos {
  private readonly db: Promise<IDBDatabase>;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private seqCounter = 0;

  constructor(readonly scope: OfflineScope) {
    this.db = openOfflineDb(`vrodux-pos-offline:${scope.tenantKey}:${scope.userId}`);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() { this.listeners.forEach(fn => fn()); }

  /**
   * Serialise every write in this tab. Reads-then-writes (receipt counters, stock decrements) are
   * otherwise racy when a cashier double-taps Charge.
   */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private nextSeq(): number { return Date.now() * 1000 + (this.seqCounter++ % 1000); }

  // ── Catalogue snapshot ──────────────────────────────────────────────────────

  async getSnapshot(): Promise<CatalogueSnapshot | undefined> {
    return idbGet<CatalogueSnapshot>(await this.db, "kv", "snapshot");
  }

  /**
   * Pull every active product and the payment-method config while online. Offline sales can only use
   * what this captured, so it runs on entering the POS and again after every sync.
   */
  async refreshSnapshot(): Promise<CatalogueSnapshot> {
    const products: InvProductSummaryDto[] = [];
    for (let page = 1; page <= 100; page++) {
      const r = await inventoryProductsApi.getAll({ isActive: true, page, pageSize: 500 });
      products.push(...r.items);
      if (!r.hasNext) break;
    }
    const paymentMethods = await paymentMethodsApi.getAll().catch(() => [] as PaymentMethodDto[]);

    return this.serial(async () => {
      // Keep local stock deductions for sales not yet uploaded: the server figure doesn't include them.
      const pendingQty = await this.pendingSoldQuantities();
      for (const p of products) {
        const sold = pendingQty.get(p.id);
        if (sold && p.trackInventory) p.stockQuantity -= sold;
      }
      const snapshot: CatalogueSnapshot = { products, paymentMethods, takenAt: new Date().toISOString() };
      await idbWrite(await this.db, ["kv"], [{ store: "kv", put: snapshot, key: "snapshot" }]);
      this.emit();
      return snapshot;
    });
  }

  private async pendingSoldQuantities(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const e of await idbAll<LocalEvent>(await this.db, "events")) {
      if (e.status === "synced") continue;
      const sign = e.kind === "sale" ? 1 : e.kind === "refund" ? -1 : 0;
      if (!sign) continue;
      for (const li of e.payload.lineItems ?? []) map.set(li.productId, (map.get(li.productId) ?? 0) + sign * li.quantity);
    }
    return map;
  }

  // ── Shifts ──────────────────────────────────────────────────────────────────

  async getSession(clientRef: string): Promise<LocalSession | undefined> {
    return idbGet<LocalSession>(await this.db, "sessions", clientRef);
  }

  async getOpenSession(): Promise<LocalSession | undefined> {
    const all = await idbAll<LocalSession>(await this.db, "sessions");
    return all.filter(s => s.status === "open").sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
  }

  openSession(registerId: string, openingCash: number, notes: string | null): Promise<POSSessionDto> {
    return this.serial(async () => {
      if (await this.getOpenSession())
        throw new Error("A shift is already open on this till. Close it before opening another.");
      if (!registerId.trim()) throw new Error("Register ID is required.");
      if (openingCash < 0) throw new Error("Opening cash cannot be negative.");

      const s: LocalSession = {
        clientRef: newClientRef(), registerId: registerId.trim(), cashierId: this.scope.userId,
        openingCash, openedAt: new Date().toISOString(), notes, status: "open", syncState: "local",
        totalTransactions: 0, totalSales: 0, totalRefunds: 0, expectedCash: openingCash,
      };
      await idbWrite(await this.db, ["sessions"], [{ store: "sessions", put: s }]);
      this.emit();
      return this.toSessionDto(s);
    });
  }

  closeSession(clientRef: string, closingCash: number, notes: string | null): Promise<POSSessionDto> {
    return this.serial(async () => {
      const s = await this.getSession(clientRef);
      if (!s) throw new Error("Shift not found on this till.");
      if (s.status === "closed") throw new Error("This shift is already closed.");
      if (closingCash < 0) throw new Error("Closing cash cannot be negative.");

      s.status = "closed";
      s.close  = { closingCash, closedAt: new Date().toISOString(), notes };
      await idbWrite(await this.db, ["sessions"], [{ store: "sessions", put: s }]);
      this.emit();
      return this.toSessionDto(s);
    });
  }

  toSessionSummary(s: LocalSession): POSSessionSummaryDto {
    return {
      id: s.clientRef, registerId: s.registerId, status: s.status === "open" ? "Open" : "Closed",
      openedAt: s.openedAt, totalTransactions: s.totalTransactions, netSales: round2(s.totalSales - s.totalRefunds),
    };
  }

  private toSessionDto(s: LocalSession): POSSessionDto {
    const closing = s.close?.closingCash ?? 0;
    return {
      ...this.toSessionSummary(s),
      cashierId: s.cashierId, closedAt: s.close?.closedAt ?? null,
      openingCash: s.openingCash, closingCash: closing, expectedCash: round2(s.expectedCash),
      cashVariance: s.close ? round2(closing - s.expectedCash) : 0,
      totalSales: round2(s.totalSales), totalRefunds: round2(s.totalRefunds), notes: s.notes,
    };
  }

  async getSessionDto(clientRef: string): Promise<POSSessionDto> {
    const s = await this.getSession(clientRef);
    if (!s) throw new Error("Shift not found on this till.");
    return this.toSessionDto(s);
  }

  private async requireOpen(clientRef: string): Promise<LocalSession> {
    const s = await this.getSession(clientRef);
    if (!s) throw new Error("Shift not found on this till.");
    if (s.status !== "open") throw new Error("This shift is closed. Open a new shift to keep selling.");
    return s;
  }

  private async nextReceiptNumber(registerId: string): Promise<string> {
    const day = localDayKey();
    const key = `receipt:${registerId}:${day}`;
    const n = ((await idbGet<number>(await this.db, "kv", key)) ?? 0) + 1;
    await idbWrite(await this.db, ["kv"], [{ store: "kv", put: n, key }]);
    const reg = registerId.replace(/[^A-Za-z0-9]/g, "").slice(0, 10) || "TILL";
    return `OFF-${reg}-${day}-${String(n).padStart(4, "0")}`;
  }

  // ── Sales ───────────────────────────────────────────────────────────────────

  recordSale(req: CreateSaleRequest): Promise<POSTransactionDto> {
    return this.serial(async () => {
      const session = await this.requireOpen(req.sessionId);

      const discount = req.orderDiscount ?? { type: "none" as const };
      if (discount.type === "voucher" || discount.type === "loyalty")
        throw new Error("Vouchers and loyalty points need a live connection, so they can't be used while this till is offline.");

      const snapshot = await this.getSnapshot();
      if (!snapshot) throw new Error("This till has no offline catalogue yet. Connect once so it can download products.");
      const byId = new Map(snapshot.products.map(p => [p.id, p]));

      // Mirrors CreateSaleCommandHandler so the receipt matches what the server will record.
      const drafts = req.lineItems.map(li => {
        const p = byId.get(li.productId);
        if (!p) throw new Error("A product in the cart isn't in this till's offline catalogue. Refresh the catalogue while online.");
        const unitPrice = li.unitPriceOverride ?? p.salePrice;
        const gross     = round2(unitPrice * li.quantity);
        const perLine   = Math.min(li.discountPercent > 0 ? round2(gross * li.discountPercent / 100) : round2(li.discountAmount), gross);
        return { li, p, unitPrice, base: gross - perLine, perLine };
      });

      const grossSubtotal = drafts.reduce((s, d) => s + d.base, 0);
      let orderDiscount = 0;
      if (discount.type === "percentage") orderDiscount = round2(grossSubtotal * (discount.value ?? 0) / 100);
      if (discount.type === "fixed")      orderDiscount = Math.min(discount.value ?? 0, grossSubtotal);

      let allocated = 0;
      const lineItems: POSLineItemDto[] = drafts.map((d, i) => {
        let share = 0;
        if (orderDiscount > 0 && grossSubtotal > 0) {
          share = i === drafts.length - 1 ? round2(orderDiscount - allocated) : round2(orderDiscount * d.base / grossSubtotal);
          allocated += share;
        }
        const lineDiscount = round2(d.perLine + share);
        const net = round2(d.unitPrice * d.li.quantity - lineDiscount);
        const tax = round2(net * d.p.taxRate / 100);
        return {
          id: newClientRef(), productId: d.p.id, productName: d.p.name, productSKU: d.p.sku, productBarcode: d.p.barcode,
          unitPrice: d.unitPrice, quantity: d.li.quantity, discountPercent: 0, discountAmount: lineDiscount,
          taxRate: d.p.taxRate, taxAmount: tax, lineTotal: round2(net + tax), unit: d.p.unit,
        };
      });

      const total = round2(lineItems.reduce((s, l) => s + l.lineTotal, 0));
      const paid  = round2(req.payments.reduce((s, p) => s + p.amount, 0));
      if (paid < total - 0.01) throw new Error(`Payment (${paid.toFixed(2)}) is less than the total (${total.toFixed(2)}).`);

      const clientRef = newClientRef();
      const receipt   = await this.nextReceiptNumber(session.registerId);
      const now       = new Date().toISOString();
      const txn: POSTransactionDto = {
        id: clientRef, transactionNumber: receipt, sessionId: session.clientRef, cashierId: this.scope.userId,
        customerId: req.customerId ?? null, customerName: null, type: "Sale", status: "Completed", originalTxnId: null,
        subTotal: round2(lineItems.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
        taxAmount: round2(lineItems.reduce((s, l) => s + l.taxAmount, 0)),
        discountAmount: round2(lineItems.reduce((s, l) => s + l.discountAmount, 0)),
        totalAmount: total, amountPaid: paid, changeGiven: round2(Math.max(0, paid - total)),
        notes: req.notes ?? null, completedAt: now, lineItems,
        payments: req.payments.map(p => ({ id: newClientRef(), method: p.method, amount: p.amount, reference: p.reference ?? null })),
      };

      const event: LocalEvent = {
        clientRef, sessionRef: session.clientRef, seq: this.nextSeq(), kind: "sale", occurredAt: now, receiptNumber: receipt,
        payload: { customerId: req.customerId ?? null, lineItems: req.lineItems, payments: req.payments, orderDiscount: req.orderDiscount ?? null, notes: req.notes ?? null },
        txn, status: "pending",
      };

      session.totalTransactions++;
      session.totalSales   = round2(session.totalSales + total);
      session.expectedCash = round2(session.expectedCash + total);

      await this.commit(event, session, snapshot, req.lineItems.map(li => [li.productId, -li.quantity]));
      return txn;
    });
  }

  refund(originalId: string, req: RefundRequest): Promise<POSTransactionDto> {
    return this.serial(async () => {
      const session  = await this.requireOpen(req.sessionId);
      const original = await idbGet<LocalEvent>(await this.db, "events", originalId);
      if (!original?.txn) throw new Error("Only sales made on this till can be refunded while offline.");
      if (original.txn.status !== "Completed") throw new Error("Only completed sales can be refunded.");

      const lineItems: POSLineItemDto[] = req.lineItems.map(li => {
        const o = original.txn!.lineItems.find(l => l.productId === li.productId);
        if (!o) throw new Error("A refunded item wasn't in the original sale.");
        if (li.quantity > o.quantity) throw new Error(`Refund quantity for '${o.productName}' exceeds what was sold.`);
        const net = round2(o.unitPrice * li.quantity);
        const tax = round2(net * o.taxRate / 100);
        return { ...o, id: newClientRef(), quantity: li.quantity, discountAmount: 0, taxAmount: tax, lineTotal: round2(net + tax) };
      });
      const amount = round2(req.payments.reduce((s, p) => s + p.amount, 0));

      const clientRef = newClientRef();
      const receipt   = await this.nextReceiptNumber(session.registerId);
      const now       = new Date().toISOString();
      const txn: POSTransactionDto = {
        ...original.txn, id: clientRef, transactionNumber: receipt, sessionId: session.clientRef, type: "Refund",
        originalTxnId: original.clientRef, lineItems, subTotal: round2(lineItems.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
        taxAmount: round2(lineItems.reduce((s, l) => s + l.taxAmount, 0)), discountAmount: 0,
        totalAmount: amount, amountPaid: amount, changeGiven: 0, notes: req.reason ?? null, completedAt: now,
        payments: req.payments.map(p => ({ id: newClientRef(), method: p.method, amount: p.amount, reference: p.reference ?? null })),
      };

      // Match the server, which marks the original sale as no longer refundable.
      original.txn = { ...original.txn, status: "Refunded" };

      const event: LocalEvent = {
        clientRef, sessionRef: session.clientRef, seq: this.nextSeq(), kind: "refund", occurredAt: now, receiptNumber: receipt,
        payload: { lineItems: req.lineItems, payments: req.payments, reason: req.reason ?? null, targetClientRef: original.clientRef },
        txn, status: "pending",
      };

      session.totalTransactions++;
      session.totalRefunds = round2(session.totalRefunds + amount);

      const snapshot = await this.getSnapshot();
      await this.commit(event, session, snapshot, req.lineItems.map(li => [li.productId, li.quantity]), [original]);
      return txn;
    });
  }

  voidTransaction(id: string, reason: string | null): Promise<POSTransactionDto> {
    return this.serial(async () => {
      const original = await idbGet<LocalEvent>(await this.db, "events", id);
      if (!original?.txn) throw new Error("Only sales made on this till can be voided while offline.");
      if (original.txn.status !== "Completed" || original.txn.type !== "Sale") throw new Error("Only completed sales can be voided.");
      const session = await this.requireOpen(original.sessionRef);

      original.txn = { ...original.txn, status: "Voided", notes: reason };
      const event: LocalEvent = {
        clientRef: newClientRef(), sessionRef: session.clientRef, seq: this.nextSeq(), kind: "void",
        occurredAt: new Date().toISOString(), receiptNumber: null,
        payload: { reason, targetClientRef: original.clientRef }, status: "pending",
      };

      const snapshot = await this.getSnapshot();
      await this.commit(event, session, snapshot, original.txn.lineItems.map(l => [l.productId, l.quantity]), [original]);
      return original.txn;
    });
  }

  recordCashMovement(sessionRef: string, type: "payin" | "payout", amount: number, reason: string): Promise<CashMovementDto> {
    return this.serial(async () => {
      const session = await this.requireOpen(sessionRef);
      if (amount <= 0) throw new Error("Amount must be greater than zero.");
      if (!reason.trim()) throw new Error("A reason is required for cash in/out.");

      const clientRef = newClientRef();
      const now = new Date().toISOString();
      const movement: CashMovementDto = {
        id: clientRef, sessionId: session.clientRef, cashierId: this.scope.userId,
        type: type === "payin" ? "PayIn" : "PayOut", amount, reason: reason.trim(), createdAt: now,
      };
      session.expectedCash = round2(session.expectedCash + (type === "payin" ? amount : -amount));

      const event: LocalEvent = {
        clientRef, sessionRef: session.clientRef, seq: this.nextSeq(), kind: "cash", occurredAt: now, receiptNumber: null,
        payload: { cashType: type, amount, reason: reason.trim() }, movement, status: "pending",
      };
      await this.commit(event, session, undefined, []);
      return movement;
    });
  }

  /** One atomic write: the event, the shift totals, any touched events, and the stock snapshot. */
  private async commit(
    event: LocalEvent, session: LocalSession, snapshot: CatalogueSnapshot | undefined,
    stockDeltas: [string, number][], touched: LocalEvent[] = [],
  ) {
    const ops: Parameters<typeof idbWrite>[2] = [
      { store: "events", put: event },
      { store: "sessions", put: session },
      ...touched.map(t => ({ store: "events" as const, put: t })),
    ];
    if (snapshot && stockDeltas.length) {
      const byId = new Map(snapshot.products.map(p => [p.id, p]));
      for (const [id, delta] of stockDeltas) {
        const p = byId.get(id);
        // Stock may go negative on purpose: the sale happened, the sync report flags it.
        if (p?.trackInventory) p.stockQuantity = round2(p.stockQuantity + delta);
      }
      ops.push({ store: "kv", put: snapshot, key: "snapshot" });
    }
    await idbWrite(await this.db, ["events", "sessions", "kv"], ops);
    this.emit();
  }

  // ── Reads for the history tab / refund dialog ───────────────────────────────

  async listTransactions(sessionRef?: string): Promise<POSTransactionSummaryDto[]> {
    const events = await idbAll<LocalEvent>(await this.db, "events");
    return events
      .filter(e => e.txn && (!sessionRef || e.sessionRef === sessionRef))
      .sort((a, b) => b.seq - a.seq)
      .map(e => toSummary(e.txn!));
  }

  async getTransaction(id: string): Promise<POSTransactionDto> {
    const e = await idbGet<LocalEvent>(await this.db, "events", id);
    if (!e?.txn) throw new Error("Transaction not found on this till.");
    return e.txn;
  }

  async listCashMovements(sessionRef: string): Promise<CashMovementDto[]> {
    const events = await idbAll<LocalEvent>(await this.db, "events");
    return events.filter(e => e.sessionRef === sessionRef && e.movement).sort((a, b) => b.seq - a.seq).map(e => e.movement!);
  }

  async getStatus(): Promise<OfflineStatus> {
    const db = await this.db;
    const [sessions, events, snapshot] = await Promise.all([
      idbAll<LocalSession>(db, "sessions"), idbAll<LocalEvent>(db, "events"), this.getSnapshot(),
    ]);
    return {
      // Every stored shift still has something to upload: synced + closed shifts are purged.
      unsyncedShifts: sessions.length,
      pendingRecords: events.filter(e => e.status !== "synced").length,
      rejected:       events.filter(e => e.status === "rejected").sort((a, b) => a.seq - b.seq),
      sessionErrors:  sessions.filter(s => s.lastError).map(s => ({ clientRef: s.clientRef, registerId: s.registerId, error: s.lastError! })),
      catalogueTakenAt:  snapshot?.takenAt ?? null,
      catalogueProducts: snapshot?.products.length ?? 0,
    };
  }

  // ── Mode switching ──────────────────────────────────────────────────────────

  /** Stable id for this install. The server tracks each till's backlog against it. */
  static deviceId(): string {
    const key = "vrodux:pos-device-id";
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = newClientRef(); localStorage.setItem(key, id); }
      return id;
    } catch {
      return "no-storage";
    }
  }

  /**
   * Tell the server how much this till still has to upload. The server refuses to switch the tenant
   * to online mode while any till reports a backlog — it can't see local storage any other way.
   */
  async reportStatus(): Promise<void> {
    const [status, sessions] = await Promise.all([
      this.getStatus(), idbAll<LocalSession>(await this.db, "sessions"),
    ]);
    await apiClient.post(`${API}/pos-offline/till-status`, {
      deviceId:       OfflinePos.deviceId(),
      registerId:     sessions[0]?.registerId ?? null,
      pendingRecords: status.pendingRecords,
      unsyncedShifts: status.unsyncedShifts,
    });
  }

  /**
   * The tenant was switched to online mode while this till still had an open shift. Close it at the
   * expected cash so it can be uploaded; the note makes the uncounted close visible in the Z-report.
   */
  closeOpenSessionsForSwitch(): Promise<number> {
    return this.serial(async () => {
      const open = (await idbAll<LocalSession>(await this.db, "sessions")).filter(s => s.status === "open");
      if (!open.length) return 0;
      const closedAt = new Date().toISOString();
      for (const s of open) {
        s.status = "closed";
        s.close = {
          closingCash: Math.max(0, round2(s.expectedCash)), closedAt,
          notes: "Closed automatically when the workspace switched to online mode — cash was not counted.",
        };
      }
      await idbWrite(await this.db, ["sessions"], open.map(s => ({ store: "sessions" as const, put: s })));
      this.emit();
      return open.length;
    });
  }

  // ── Day-end sync ────────────────────────────────────────────────────────────

  sync(forceClose = false): Promise<OfflineSyncResult | null> {
    return this.serial(async () => {
      const db = await this.db;
      const [sessions, events] = await Promise.all([idbAll<LocalSession>(db, "sessions"), idbAll<LocalEvent>(db, "events")]);

      const payloadSessions = sessions
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
        .map(s => ({
          s,
          evs: events.filter(e => e.sessionRef === s.clientRef && e.status !== "synced").sort((a, b) => a.seq - b.seq),
        }))
        // An open shift already on the server with nothing new has nothing to say.
        .filter(x => x.evs.length > 0 || x.s.status === "closed" || x.s.syncState === "local");

      if (payloadSessions.length === 0) return null;

      const body = {
        batchId:    newClientRef(),
        registerId: payloadSessions[0].s.registerId,
        forceClose,
        sessions: payloadSessions.map(({ s, evs }) => ({
          clientRef: s.clientRef, registerId: s.registerId, openingCash: s.openingCash, openedAt: s.openedAt, notes: s.notes,
          close: s.close ? { closingCash: s.close.closingCash, closedAt: s.close.closedAt, notes: s.close.notes } : null,
          events: evs.map(e => ({
            clientRef: e.clientRef, kind: e.kind, occurredAt: e.occurredAt, receiptNumber: e.receiptNumber,
            customerId: e.payload.customerId ?? null, lineItems: e.payload.lineItems ?? null, payments: e.payload.payments ?? null,
            orderDiscount: e.payload.orderDiscount ?? null, notes: e.payload.notes ?? null,
            targetClientRef: e.payload.targetClientRef ?? null, cashType: e.payload.cashType ?? null,
            amount: e.payload.amount ?? null, reason: e.payload.reason ?? null,
          })),
        })),
      };

      const result = await apiClient.post<OfflineSyncResult>(`${API}/pos-offline/sync`, body);

      // Apply the verdicts. Nothing is deleted unless the server confirmed it has the record.
      const ops: Parameters<typeof idbWrite>[2] = [];
      const eventById = new Map(events.map(e => [e.clientRef, e]));
      for (const r of result.events) {
        const e = eventById.get(r.clientRef);
        if (!e) continue;
        if (r.status === "rejected") { e.status = "rejected"; e.error = r.error; }
        else { e.status = "synced"; e.error = null; }
        ops.push({ store: "events", put: e });
      }
      for (const r of result.sessions) {
        const s = sessions.find(x => x.clientRef === r.clientRef);
        if (!s) continue;
        if (r.status === "synced" && s.status === "closed") {
          ops.push({ store: "sessions", del: s.clientRef });
          for (const e of events.filter(x => x.sessionRef === s.clientRef)) ops.push({ store: "events", del: e.clientRef });
        } else {
          if (r.serverSessionId) s.syncState = "open-on-server";
          s.lastError = r.error;
          ops.push({ store: "sessions", put: s });
        }
      }
      if (ops.length) await idbWrite(db, ["events", "sessions"], ops);
      this.emit();
      return result;
    });
  }
}
