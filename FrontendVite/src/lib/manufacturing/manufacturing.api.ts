import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/manufacturing`;

// ── Types ───────────────────────────────────────────────────────────────────

export type BomStatus = "draft" | "active" | "archived";
export type ProductionOrderStatus = "planned" | "released" | "in_progress" | "completed" | "cancelled";

/** Styling only — labels come from i18n: t(`bomStatus.${status}`) in the `manufacturing` namespace. */
export const BOM_STATUS_META: Record<BomStatus, { color: string; bg: string }> = {
  draft:    { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  active:   { color: "text-success",          bg: "bg-success/10" },
  archived: { color: "text-muted-foreground", bg: "bg-muted" },
};

/** Styling only — labels come from i18n: t(`orderStatus.${status}`). */
export const ORDER_STATUS_META: Record<ProductionOrderStatus, { color: string; bg: string }> = {
  planned:     { color: "text-slate-600",        bg: "bg-slate-100 dark:bg-slate-800/50" },
  released:    { color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  in_progress: { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  completed:   { color: "text-success",          bg: "bg-success/10" },
  cancelled:   { color: "text-muted-foreground", bg: "bg-muted" },
};

const FALLBACK_META = { color: "text-muted-foreground", bg: "bg-muted" };
export const bomStatusMeta   = (s: string) => BOM_STATUS_META[s as BomStatus] ?? FALLBACK_META;
export const orderStatusMeta = (s: string) => ORDER_STATUS_META[s as ProductionOrderStatus] ?? FALLBACK_META;

export const ORDER_STATUSES: ProductionOrderStatus[] = ["planned", "released", "in_progress", "completed", "cancelled"];

/** A product as the Manufacturing pickers see it (read from Inventory). */
export interface StockItemDto {
  id: string; name: string; sku: string | null; unit: string; costPrice: number; stockQuantity: number;
}
export interface StockWarehouseDto { id: string; name: string; isDefault: boolean; }

export interface WorkCentreDto {
  id: string; name: string; code: string | null; labourRatePerHour: number; overheadRatePerHour: number; isActive: boolean;
  capacityHoursPerDay: number;
}
export interface UpsertWorkCentreRequest {
  name: string; code?: string | null; labourRatePerHour: number; overheadRatePerHour: number; isActive?: boolean;
  capacityHoursPerDay?: number;
}

export interface BomSummaryDto {
  id: string; bomNumber: string; name: string; productId: string; productName: string; productSku: string | null;
  outputQuantity: number; unit: string; status: BomStatus; lineCount: number; operationCount: number;
  materialCost: number; operationCost: number; costPerUnit: number; createdAt: string;
}
export interface BomLineDto {
  id: string; componentProductId: string; componentName: string; componentSku: string | null;
  quantity: number; unit: string; scrapPercent: number; unitCost: number;
  effectiveQuantity: number; lineCost: number; sortOrder: number;
}
export interface BomOperationDto {
  id: string; sequence: number; name: string; workCentreId: string; workCentreName: string;
  setupMinutes: number; runMinutesPerBatch: number; labourRate: number; overheadRate: number; batchCost: number;
}
export interface BomByProductDto {
  id: string; productId: string; productName: string; productSku: string | null; quantity: number; unit: string;
}
export interface BomDto extends Omit<BomSummaryDto, "lineCount" | "operationCount"> {
  notes: string | null; lines: BomLineDto[]; operations: BomOperationDto[]; byProducts: BomByProductDto[];
  updatedAt: string | null;
}
export interface UpsertBomRequest {
  name: string; productId: string; outputQuantity: number; unit?: string | null; notes?: string | null;
  lines: { componentProductId: string; quantity: number; unit?: string | null; scrapPercent: number }[];
  operations: { name: string; workCentreId: string; setupMinutes: number; runMinutesPerBatch: number }[];
  byProducts?: { productId: string; quantity: number }[];
}

export interface ProductionOrderSummaryDto {
  id: string; orderNumber: string; bomNumber: string; productId: string; productName: string;
  productSku: string | null; plannedQuantity: number; producedQuantity: number; scrappedQuantity: number;
  unit: string; status: ProductionOrderStatus; warehouseName: string | null; plannedStartDate: string | null;
  dueDate: string | null; reference: string | null;
  materialCost: number; labourCost: number; overheadCost: number; totalCost: number; unitCost: number;
  /** Set on an order that makes a sub-assembly for another order. */
  parentOrderNumber: string | null;
  /** True once the order's cost has a Finance journal entry. */
  isPosted: boolean;
  createdAt: string; completedAt: string | null;
}
export interface ProductionOrderComponentDto {
  id: string; productId: string; name: string; sku: string | null; requiredQuantity: number;
  issuedQuantity: number; remainingQuantity: number; unit: string; unitCost: number;
  /** On hand in Inventory now; null once the order is closed or the product is gone. */
  stockOnHand: number | null; sortOrder: number;
}
export interface ProductionOrderOperationDto {
  id: string; sequence: number; name: string; workCentreName: string; plannedMinutes: number;
  actualMinutes: number; isDone: boolean; labourCost: number; overheadCost: number;
}
export interface ProductionOrderOutputDto {
  id: string; productId: string; name: string; sku: string | null; unit: string; plannedQuantity: number; receivedQuantity: number;
}
/** One issue (positive) or return (negative) of a component. */
export interface MaterialIssueDto { id: string; productName: string; quantity: number; batchNumber: string | null; createdAt: string; }
export interface SubOrderDto { id: string; orderNumber: string; productName: string; plannedQuantity: number; unit: string; status: ProductionOrderStatus; }

export interface ProductionOrderDto extends ProductionOrderSummaryDto {
  bomId: string; warehouseId: string | null; notes: string | null; qualityNotes: string | null;
  scrapCost: number; batchNumber: string | null; expiryDate: string | null; requisitionNumber: string | null;
  parentOrderId: string | null;
  journalEntryId: string | null; journalEntryNumber: string | null;
  releasedAt: string | null; startedAt: string | null;
  components: ProductionOrderComponentDto[]; operations: ProductionOrderOperationDto[];
  outputs: ProductionOrderOutputDto[]; issues: MaterialIssueDto[]; subOrders: SubOrderDto[];
}
export interface IssueLine { componentId: string; quantity: number; batchNumber?: string | null; }
export interface ProductionSummaryDto {
  planned: number; released: number; inProgress: number; completed: number; cancelled: number;
  overdue: number; activeBoms: number; completedMaterialCost: number;
}
export interface PlanOrderRequest {
  bomId: string; plannedQuantity: number; warehouseId?: string | null; plannedStartDate?: string | null;
  dueDate?: string | null; reference?: string | null; notes?: string | null;
  /** Also plan orders for manufactured components that stock does not cover. */
  planSubAssemblies?: boolean;
}
export interface CompleteOrderRequest {
  producedQuantity: number; issueRemaining: boolean; scrappedQuantity?: number; qualityNotes?: string | null;
  costScrapSeparately?: boolean; batchNumber?: string | null; expiryDate?: string | null;
}

/** One component across every open order: still to issue, on hand, and the gap. */
export interface MaterialRequirementDto {
  productId: string; name: string; sku: string | null; unit: string; required: number;
  onHand: number | null; shortage: number; unitCost: number; openOrders: number;
}
export interface ProductionYieldDto {
  productId: string; productName: string; unit: string; orders: number; planned: number; produced: number;
  scrapped: number; yieldPercent: number; materialCost: number; labourCost: number; overheadCost: number;
  averageUnitCost: number; scrapCost: number;
}
/** An open order and the cost put into it so far. */
export interface WipRowDto {
  orderId: string; orderNumber: string; productName: string; status: ProductionOrderStatus; plannedQuantity: number;
  unit: string; materialCost: number; labourCost: number; overheadCost: number; totalCost: number; dueDate: string | null;
}
export interface WorkCentreLoadDto {
  workCentreId: string; name: string; openOperations: number; openOrders: number; remainingMinutes: number;
  capacityHoursPerDay: number; daysQueued: number; earliestDueDate: string | null; latePressure: boolean;
}
export interface ScheduleRowDto {
  orderId: string; orderNumber: string; productName: string; operationName: string; workCentreName: string;
  plannedMinutes: number; plannedStartDate: string | null; dueDate: string | null; status: ProductionOrderStatus;
}

// ── Client ──────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const manufacturingApi = {
  // Lookups (served by Manufacturing, so no Inventory permission is needed)
  getProducts:   (search?: string): Promise<StockItemDto[]> => rawApiClient.get(`${BASE}/lookups/products${qs({ search })}`),
  getWarehouses: (): Promise<StockWarehouseDto[]> => rawApiClient.get(`${BASE}/lookups/warehouses`),

  // Work centres
  getWorkCentres:   (activeOnly = false): Promise<WorkCentreDto[]> =>
    rawApiClient.get(`${BASE}/work-centres${activeOnly ? "?activeOnly=true" : ""}`),
  createWorkCentre: (body: UpsertWorkCentreRequest): Promise<WorkCentreDto> => rawApiClient.post(`${BASE}/work-centres`, body),
  updateWorkCentre: (id: string, body: UpsertWorkCentreRequest): Promise<WorkCentreDto> => rawApiClient.put(`${BASE}/work-centres/${id}`, body),
  deleteWorkCentre: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/work-centres/${id}`),

  // Bills of materials
  getBoms:      (params?: { status?: string; search?: string; productId?: string }): Promise<BomSummaryDto[]> =>
    rawApiClient.get(`${BASE}/boms${qs({ status: params?.status, search: params?.search, productId: params?.productId })}`),
  getBom:       (id: string): Promise<BomDto> => rawApiClient.get(`${BASE}/boms/${id}`),
  createBom:    (body: UpsertBomRequest): Promise<BomDto> => rawApiClient.post(`${BASE}/boms`, body),
  updateBom:    (id: string, body: UpsertBomRequest): Promise<BomDto> => rawApiClient.put(`${BASE}/boms/${id}`, body),
  setBomStatus: (id: string, status: BomStatus): Promise<void> => rawApiClient.patch(`${BASE}/boms/${id}/status`, { status }),
  deleteBom:    (id: string): Promise<void> => rawApiClient.delete(`${BASE}/boms/${id}`),

  // Production orders
  getOrders:     (params?: { status?: string; reference?: string }): Promise<ProductionOrderSummaryDto[]> =>
    rawApiClient.get(`${BASE}/orders${qs({ status: params?.status, reference: params?.reference })}`),
  getSummary:    (): Promise<ProductionSummaryDto> => rawApiClient.get(`${BASE}/orders/summary`),
  getOrder:      (id: string): Promise<ProductionOrderDto> => rawApiClient.get(`${BASE}/orders/${id}`),
  createOrder:   (body: PlanOrderRequest): Promise<ProductionOrderDto> => rawApiClient.post(`${BASE}/orders`, body),
  updateOrder:   (id: string, body: PlanOrderRequest): Promise<ProductionOrderDto> => rawApiClient.put(`${BASE}/orders/${id}`, body),
  releaseOrder:  (id: string): Promise<ProductionOrderDto> => rawApiClient.post(`${BASE}/orders/${id}/release`),
  /** No lines = issue everything still outstanding. */
  issueMaterials: (id: string, lines?: IssueLine[]): Promise<ProductionOrderDto> =>
    rawApiClient.post(`${BASE}/orders/${id}/issue`, { lines: lines ?? null }),
  returnMaterials: (id: string, lines: IssueLine[]): Promise<ProductionOrderDto> =>
    rawApiClient.post(`${BASE}/orders/${id}/return`, { lines }),
  linkRequisition: (id: string, requisitionNumber: string): Promise<void> =>
    rawApiClient.patch(`${BASE}/orders/${id}/requisition`, { requisitionNumber }),
  recordOperation: (id: string, operationId: string, actualMinutes: number): Promise<ProductionOrderDto> =>
    rawApiClient.post(`${BASE}/orders/${id}/operations/${operationId}/record`, { actualMinutes }),
  completeOrder: (id: string, body: CompleteOrderRequest): Promise<ProductionOrderDto> =>
    rawApiClient.post(`${BASE}/orders/${id}/complete`, body),
  linkJournal:   (id: string, body: { journalEntryId: string; journalEntryNumber?: string | null }): Promise<void> =>
    rawApiClient.patch(`${BASE}/orders/${id}/journal`, body),
  cancelOrder:   (id: string): Promise<ProductionOrderDto> => rawApiClient.post(`${BASE}/orders/${id}/cancel`),
  deleteOrder:   (id: string): Promise<void> => rawApiClient.delete(`${BASE}/orders/${id}`),

  // Planning
  getMaterialRequirements: (): Promise<MaterialRequirementDto[]> => rawApiClient.get(`${BASE}/planning/material-requirements`),
  getYield: (params?: { from?: string; to?: string }): Promise<ProductionYieldDto[]> =>
    rawApiClient.get(`${BASE}/planning/yield${qs({ from: params?.from, to: params?.to })}`),
  getWip:            (): Promise<WipRowDto[]>         => rawApiClient.get(`${BASE}/planning/wip`),
  getWorkCentreLoad: (): Promise<WorkCentreLoadDto[]> => rawApiClient.get(`${BASE}/planning/work-centre-load`),
  getSchedule:       (): Promise<ScheduleRowDto[]>    => rawApiClient.get(`${BASE}/planning/schedule`),
};

/** Quantities carry up to 4 decimals (grams of a kilo, millilitres of a litre) — never show trailing zeros. */
export const fmtQty = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Minutes as "45 min" or "2 h 15 min". */
export function fmtMinutes(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
