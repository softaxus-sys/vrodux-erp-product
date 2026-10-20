import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/trade`;

/** Today as the user sees it (yyyy-MM-dd). The server clock is UTC, so the client says which day it is. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Whole days from today to a yyyy-MM-dd date; negative when it is in the past. */
export const daysFromToday = (date: string | null | undefined) => {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const a = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = localToday().split("-").map(Number);
  return Math.round((a - Date.UTC(ty, tm - 1, td)) / 86_400_000);
};

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface Paged<T> { items: T[]; total: number; }

export type Direction = "import" | "export";
export type ShipmentStatus = "booked" | "in_transit" | "arrived" | "customs" | "cleared" | "delivered" | "closed" | "cancelled";

/** The normal journey, in order. A shipment only moves forward through it. */
export const JOURNEY: ShipmentStatus[] = ["booked", "in_transit", "arrived", "customs", "cleared", "delivered", "closed"];

export const MODES = ["sea", "air", "road", "rail", "courier"] as const;
export const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export const PARTY_KINDS = ["supplier", "buyer", "forwarder", "clearing_agent", "carrier", "bank", "other"] as const;
export const COST_TYPES = ["freight", "insurance", "customs_duty", "clearing", "port_charges", "inland_transport", "demurrage", "inspection", "other"] as const;
export const ALLOCATION_BASES = ["value", "weight", "volume", "quantity"] as const;
export const PAYMENT_KINDS = ["advance", "balance", "lc", "tt", "other"] as const;
export const DOCUMENT_TYPES = [
  "commercial_invoice", "proforma_invoice", "packing_list", "bill_of_lading", "airway_bill", "certificate_of_origin",
  "customs_declaration", "insurance", "letter_of_credit", "inspection_certificate", "import_permit", "export_permit",
  "delivery_order", "other",
] as const;
export const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "20RF", "40RF", "20OT", "40OT", "LCL", "Other"] as const;

/** Whether the shipment can still take a status change that is not a cancellation. */
export const isOpenStatus = (s: string) => !["delivered", "closed", "cancelled"].includes(s);

/** The statuses a shipment may move to from here: later steps of the journey, or cancel while it is early. */
export function nextStatuses(from: string): ShipmentStatus[] {
  if (from === "closed" || from === "cancelled") return [];
  const i = JOURNEY.indexOf(from as ShipmentStatus);
  const forward = i >= 0 ? JOURNEY.slice(i + 1) : [];
  const canCancel = ["booked", "in_transit", "arrived", "customs"].includes(from);
  return canCancel ? [...forward, "cancelled"] : forward;
}

const FALLBACK_META = { color: "text-muted-foreground", bg: "bg-muted" };

/** Styling only — labels come from i18n: t(`status.${status}`) in the `trade` namespace. */
const STATUS_META: Record<string, { color: string; bg: string }> = {
  booked:     { color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800" },
  in_transit: { color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  arrived:    { color: "text-violet-600",       bg: "bg-violet-50 dark:bg-violet-900/20" },
  customs:    { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  cleared:    { color: "text-teal-600",         bg: "bg-teal-50 dark:bg-teal-900/20" },
  delivered:  { color: "text-success",          bg: "bg-success/10" },
  closed:     { color: "text-muted-foreground", bg: "bg-muted" },
  cancelled:  { color: "text-destructive",      bg: "bg-destructive/10" },
  pending:    { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  paid:       { color: "text-success",          bg: "bg-success/10" },
};
export const statusMeta = (s: string) => STATUS_META[s] ?? FALLBACK_META;

export interface PartyDto {
  id: string; kind: string; name: string; country: string | null; contactName: string | null; email: string | null;
  phone: string | null; address: string | null; taxNumber: string | null; notes: string | null; isActive: boolean;
  shipments: number;
}

export interface PartyRequest {
  kind: string; name: string; country?: string | null; contactName?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; taxNumber?: string | null; notes?: string | null; isActive?: boolean;
}

export interface ShipmentSummaryDto {
  id: string; shipmentNumber: string; direction: Direction; status: ShipmentStatus; mode: string;
  partnerId: string | null; partnerName: string | null; orderReference: string | null; incoterm: string | null;
  blNumber: string | null; originCountry: string | null; originPort: string | null; destinationCountry: string | null;
  destinationPort: string | null; etd: string | null; eta: string | null; freeTimeEnds: string | null;
  currency: string; goodsValue: number; itemCount: number; containerCount: number; createdAt: string;
}

export interface ItemDto {
  id: string; description: string; hsCode: string | null; originCountry: string | null; quantity: number; unit: string;
  unitPrice: number; lineValue: number; weightKg: number | null; volumeCbm: number | null; packages: number | null;
  productId: string | null; sku: string | null;
  goodsValueBase: number | null; allocatedCost: number | null; landedTotal: number | null; landedUnitCost: number | null;
}

export interface ContainerDto { id: string; number: string; type: string | null; sealNumber: string | null; grossWeightKg: number | null; }
export interface MilestoneDto { id: string; status: string; occurredOn: string; note: string | null; recordedBy: string | null; recordedAt: string; }
export interface CostDto {
  id: string; type: string; description: string | null; amount: number; basis: string; vendorName: string | null;
  invoiceReference: string | null; paidOn: string | null;
}
export interface PaymentDto {
  id: string; kind: string; amount: number; dueDate: string | null; paidOn: string | null; status: string;
  reference: string | null; lcNumber: string | null; bankName: string | null; lcExpiry: string | null; notes: string | null;
}
export interface DocumentDto {
  id: string; shipmentId: string; shipmentNumber: string | null; type: string; number: string | null;
  issueDate: string | null; expiryDate: string | null; notes: string | null; fileName: string | null;
  contentType: string | null; sizeBytes: number; hasFile: boolean; createdAt: string;
}

/** `costs`, `payments` and the cost fields are null when the caller may not see costs / payments. */
export interface ShipmentDto {
  id: string; shipmentNumber: string; direction: Direction; status: ShipmentStatus; mode: string;
  partnerId: string | null; partnerName: string | null; forwarderId: string | null; forwarderName: string | null;
  agentId: string | null; agentName: string | null; orderReference: string | null; incoterm: string | null;
  blNumber: string | null; carrierName: string | null; vesselOrFlight: string | null;
  originCountry: string | null; originPort: string | null; destinationCountry: string | null; destinationPort: string | null;
  etd: string | null; eta: string | null; departedOn: string | null; arrivedOn: string | null; clearedOn: string | null;
  deliveredOn: string | null; freeDays: number | null; freeTimeEnds: string | null; currency: string; exchangeRate: number;
  notes: string | null; linkedOrderType: "purchase" | "sales" | null; linkedOrderId: string | null; goodsValue: number; goodsValueBase: number; totalCosts: number | null; landedTotal: number | null;
  paymentsPaid: number | null; paymentsPending: number | null;
  items: ItemDto[]; containers: ContainerDto[]; milestones: MilestoneDto[];
  costs: CostDto[] | null; payments: PaymentDto[] | null; documents: DocumentDto[];
  createdAt: string; updatedAt: string | null;
}

export interface ItemRequest {
  description: string; hsCode?: string | null; originCountry?: string | null; quantity: number; unit?: string | null;
  unitPrice: number; weightKg?: number | null; volumeCbm?: number | null; packages?: number | null;
  productId?: string | null; sku?: string | null;
}
export interface ContainerRequest { number: string; type?: string | null; sealNumber?: string | null; grossWeightKg?: number | null; }

export interface ShipmentRequest {
  direction: Direction; mode: string; partnerId?: string | null; forwarderId?: string | null; agentId?: string | null;
  orderReference?: string | null; incoterm?: string | null; blNumber?: string | null; carrierName?: string | null;
  vesselOrFlight?: string | null; originCountry?: string | null; originPort?: string | null;
  destinationCountry?: string | null; destinationPort?: string | null; etd?: string | null; eta?: string | null;
  freeDays?: number | null; currency: string; exchangeRate: number; notes?: string | null;
  items: ItemRequest[]; containers: ContainerRequest[];
  linkedOrderType?: "purchase" | "sales" | null; linkedOrderId?: string | null;
}

export interface CostRequest {
  type: string; description?: string | null; amount: number; basis?: string | null; vendorName?: string | null;
  invoiceReference?: string | null; paidOn?: string | null;
}
export interface PaymentRequest {
  kind: string; amount: number; dueDate?: string | null; paidOn?: string | null; reference?: string | null;
  lcNumber?: string | null; bankName?: string | null; lcExpiry?: string | null; notes?: string | null;
}
export interface DocumentRequest {
  type: string; number?: string | null; issueDate?: string | null; expiryDate?: string | null; notes?: string | null;
  fileName?: string | null; contentType?: string | null; contentBase64?: string | null;
}

export interface ShipmentFilter {
  search?: string; direction?: string; status?: string; partnerId?: string; openOnly?: boolean; page?: number; pageSize?: number;
}

export interface AttentionDto {
  kind: string; shipmentId: string; shipmentNumber: string; direction: Direction; label: string; date: string | null; days: number | null;
}
export interface TradeDashboardDto {
  openImports: number; openExports: number; arrivingSoon: number; delayed: number; atCustoms: number;
  openGoodsValue: number; paymentsDue: number; paymentsOverdue: number; documentsExpiring: number; documentsExpired: number;
  byStatus: { status: string; count: number }[]; attention: AttentionDto[]; recent: ShipmentSummaryDto[]; canSeePayments: boolean;
}

export interface InTransitShipmentDto {
  shipmentId: string; shipmentNumber: string; direction: Direction; status: string; quantity: number; eta: string | null;
}
export interface InTransitProductDto {
  productId: string | null; sku: string | null; description: string; unit: string; incoming: number; outgoing: number;
  shipments: number; nextEta: string | null; delayed: boolean; lines: InTransitShipmentDto[];
}

export interface DutyRateDto { id: string; hsCode: string; description: string | null; dutyPercent: number; notes: string | null; }
export interface DutyRateRequest { hsCode: string; description?: string | null; dutyPercent: number; notes?: string | null; }
export interface DutyLineDto {
  itemId: string; description: string; hsCode: string | null; customsValue: number; matchedCode: string | null; rate: number | null; duty: number;
}
export interface DutyEstimateDto {
  lines: DutyLineDto[]; totalDuty: number; customsValue: number; unmatched: number; includesFreightAndInsurance: boolean;
}

/** Reads a File as base64 (no data-URI prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// ── API ─────────────────────────────────────────────────────────────────────

export const tradeApi = {
  getDashboard: () => rawApiClient.get<TradeDashboardDto>(`${BASE}/dashboard${qs({ today: localToday() })}`),

  getParties: (p: { search?: string; kind?: string; activeOnly?: boolean } = {}) =>
    rawApiClient.get<PartyDto[]>(`${BASE}/parties${qs(p)}`),
  createParty: (r: PartyRequest) => rawApiClient.post<PartyDto>(`${BASE}/parties`, r),
  updateParty: (id: string, r: PartyRequest) => rawApiClient.put<PartyDto>(`${BASE}/parties/${id}`, r),
  deleteParty: (id: string) => rawApiClient.delete<void>(`${BASE}/parties/${id}`),

  getShipments: (f: ShipmentFilter = {}) => rawApiClient.get<Paged<ShipmentSummaryDto>>(`${BASE}/shipments${qs({ ...f })}`),
  getShipment: (id: string) => rawApiClient.get<ShipmentDto>(`${BASE}/shipments/${id}`),
  createShipment: (r: ShipmentRequest) => rawApiClient.post<ShipmentDto>(`${BASE}/shipments${qs({ today: localToday() })}`, r),
  updateShipment: (id: string, r: ShipmentRequest) => rawApiClient.put<ShipmentDto>(`${BASE}/shipments/${id}`, r),
  changeStatus: (id: string, status: string, note?: string | null, date?: string | null) =>
    rawApiClient.patch<ShipmentDto>(`${BASE}/shipments/${id}/status`, { status, note: note ?? null, date: date ?? localToday() }),
  deleteShipment: (id: string) => rawApiClient.delete<void>(`${BASE}/shipments/${id}`),

  addCost: (id: string, r: CostRequest) => rawApiClient.post<ShipmentDto>(`${BASE}/shipments/${id}/costs`, r),
  updateCost: (id: string, costId: string, r: CostRequest) => rawApiClient.put<ShipmentDto>(`${BASE}/shipments/${id}/costs/${costId}`, r),
  removeCost: (id: string, costId: string) => rawApiClient.delete<ShipmentDto>(`${BASE}/shipments/${id}/costs/${costId}`),

  addPayment: (id: string, r: PaymentRequest) => rawApiClient.post<ShipmentDto>(`${BASE}/shipments/${id}/payments`, r),
  updatePayment: (id: string, paymentId: string, r: PaymentRequest) =>
    rawApiClient.put<ShipmentDto>(`${BASE}/shipments/${id}/payments/${paymentId}`, r),
  removePayment: (id: string, paymentId: string) => rawApiClient.delete<ShipmentDto>(`${BASE}/shipments/${id}/payments/${paymentId}`),

  getInTransit: (p: { productId?: string; search?: string } = {}) =>
    rawApiClient.get<InTransitProductDto[]>(`${BASE}/in-transit${qs({ ...p, today: localToday() })}`),

  getDutyRates: (search?: string) => rawApiClient.get<DutyRateDto[]>(`${BASE}/duty-rates${qs({ search })}`),
  createDutyRate: (r: DutyRateRequest) => rawApiClient.post<DutyRateDto>(`${BASE}/duty-rates`, r),
  updateDutyRate: (id: string, r: DutyRateRequest) => rawApiClient.put<DutyRateDto>(`${BASE}/duty-rates/${id}`, r),
  deleteDutyRate: (id: string) => rawApiClient.delete<void>(`${BASE}/duty-rates/${id}`),
  getDutyEstimate: (shipmentId: string, includeFreightInsurance: boolean) =>
    rawApiClient.get<DutyEstimateDto>(`${BASE}/shipments/${shipmentId}/duty-estimate${qs({ includeFreightInsurance })}`),

  addDocument: (id: string, r: DocumentRequest) => rawApiClient.post<DocumentDto>(`${BASE}/shipments/${id}/documents`, r),
  updateDocument: (docId: string, r: DocumentRequest) => rawApiClient.put<DocumentDto>(`${BASE}/documents/${docId}`, r),
  deleteDocument: (docId: string) => rawApiClient.delete<void>(`${BASE}/documents/${docId}`),
  downloadDocument: async (doc: DocumentDto) => {
    const { blob, fileName } = await rawApiClient.getBlob(`${BASE}/documents/${doc.id}/file`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName ?? doc.fileName ?? "document";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  },
};
