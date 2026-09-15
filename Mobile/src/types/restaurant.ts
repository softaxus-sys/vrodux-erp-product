import type { Tone } from "@/theme";

/**
 * Restaurant POS -- front-of-house + kitchen coordination, not an order-taking terminal. Mirrors
 * the scoping call already made for retail POS (types/pos.ts's own note): a phone isn't a card
 * machine, and the web app's order-taking screen (structured modifiers, combos, courses,
 * split-bill) is real desktop-appropriate complexity, not something to port here. What genuinely
 * belongs on a phone: checking the floor/kitchen/reservations status, and the handful of
 * workflow actions that don't touch cash or a physical drawer (seat a party, mark a kitchen item
 * ready) -- the same "workflow, not cash" line CLAUDE.md's Module 49 draws for the AI assistant.
 */

// ── Dashboards (GET /api/restaurant/dashboard/*) ────────────────────────────────────────────────

export interface SalesByCategoryRow {
  category: string;
  total: number;
}

export interface OwnerDashboardDto {
  todaySales: number;
  todayOrders: number;
  todayNetSales: number;
  weekSales: number;
  weekNetSales: number;
  weekDiscounts: number;
  weekVoidValue: number;
  topCategoriesWeek: SalesByCategoryRow[];
}

export interface BranchDashboardDto {
  branchId: string | null;
  todaySales: number;
  todayOrders: number;
  todayNetSales: number;
  tablesAvailable: number;
  tablesOccupied: number;
  tablesReserved: number;
  tablesCleaning: number;
  activeOrders: number;
}

export interface KitchenPrepTimeRow {
  itemName: string;
  avgMinutes: number;
}

export interface KitchenDashboardDto {
  activeTickets: number;
  pendingItems: number;
  preparingItems: number;
  readyItems: number;
  avgPrepMinutesToday: number;
  slowestItemsToday: KitchenPrepTimeRow[];
}

// ── Tables ───────────────────────────────────────────────────────────────────────────────────

export interface TableDto {
  id: string;
  tableNumber: string;
  section: string;
  capacity: number;
  status: string;
  currentOrderId: string | null;
  currentWaiter: string | null;
  occupiedSince: string | null;
  branchId: string | null;
  diningAreaId: string | null;
  mergedIntoTableId: string | null;
}

export interface TablesSummaryDto {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  occupancyRate: number;
  totalCovers: number;
}

export const TABLE_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
};

export const TABLE_STATUS_TONE: Record<string, Tone> = {
  available: "success",
  occupied: "warning",
  reserved: "info",
  cleaning: "neutral",
};

// ── Orders (read-only -- see the top-of-file note) ──────────────────────────────────────────────

export interface OrderItemModifierDto {
  id: string;
  name: string;
  priceDelta: number;
}

export interface OrderItemDto {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: string | null;
  status: string;
  courseNumber: number;
  selectedModifiers: OrderItemModifierDto[];
}

export interface OrderPaymentDto {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  createdAt: string;
}

export interface OrderDiscountDto {
  id: string;
  type: string;
  amount: number;
  reason: string;
  isVoided: boolean;
  createdAt: string;
}

export interface OrderVoidLogDto {
  id: string;
  orderItemId: string | null;
  reason: string;
  createdAt: string;
}

export interface OrderRefundDto {
  id: string;
  amount: number;
  reason: string;
  method: string;
  createdAt: string;
}

export interface OrderSplitSummaryDto {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  amountPaid: number;
  outstanding: number;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  tableId: string;
  tableNumber: string;
  waiter: string;
  covers: number;
  status: string;
  orderType: string;
  orderChannel: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  tipAmount: number;
  outstanding: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  currentCourse: number;
  items: OrderItemDto[];
  payments: OrderPaymentDto[];
  discounts: OrderDiscountDto[];
  voidLogs: OrderVoidLogDto[];
  refunds: OrderRefundDto[];
  parentOrderId: string | null;
  splits: OrderSplitSummaryDto[];
}

export interface OrdersSummaryDto {
  total: number;
  open: number;
  sent: number;
  ready: number;
  served: number;
  paid: number;
  cancelled: number;
  split: number;
  held: number;
  todayOrders: number;
  todayRevenue: number;
  totalRevenue: number;
  totalTips: number;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  sent: "Sent to kitchen",
  ready: "Ready",
  served: "Served",
  paid: "Paid",
  cancelled: "Cancelled",
  split: "Split",
  held: "Held",
};

export const ORDER_STATUS_TONE: Record<string, Tone> = {
  open: "neutral",
  sent: "info",
  ready: "warning",
  served: "info",
  paid: "success",
  cancelled: "destructive",
  split: "neutral",
  held: "warning",
};

// ── Kitchen (KDS) ────────────────────────────────────────────────────────────────────────────

export interface KitchenTicketItemDto {
  id: string;
  itemName: string;
  quantity: number;
  modifiers: string | null;
  status: string;
  courseNumber: number;
  kitchenStationId: string | null;
}

export interface KitchenTicketDto {
  id: string;
  orderNumber: string;
  tableNumber: string;
  waiter: string;
  covers: number;
  status: string;
  createdAt: string;
  waitMinutes: number;
  currentCourse: number;
  items: KitchenTicketItemDto[];
}

export interface KitchenSummaryDto {
  activeTickets: number;
  pendingItems: number;
  preparingItems: number;
  readyItems: number;
}

/** pending -> preparing -> ready -> served (UpdateOrderItemStatusValidator's own allowed list). */
export const KITCHEN_ITEM_STATUSES = ["pending", "preparing", "ready", "served"] as const;
export type KitchenItemStatus = (typeof KITCHEN_ITEM_STATUSES)[number];

export const KITCHEN_ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

export const KITCHEN_ITEM_STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  preparing: "warning",
  ready: "success",
  served: "info",
};

/** The next status a tap on a ticket item should move it to -- null once it's already served
 *  (nothing left to advance; a mistaken advance is walked back from the item's own status chips
 *  on web, not built here to keep this a one-tap action). */
export function nextKitchenItemStatus(current: string): KitchenItemStatus | null {
  const i = KITCHEN_ITEM_STATUSES.indexOf(current as KitchenItemStatus);
  if (i < 0 || i === KITCHEN_ITEM_STATUSES.length - 1) return null;
  return KITCHEN_ITEM_STATUSES[i + 1];
}

// ── Reservations ─────────────────────────────────────────────────────────────────────────────

export interface ReservationDto {
  id: string;
  reservationNumber: string;
  branchId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  covers: number;
  reservationDate: string;
  reservationTime: string;
  status: string;
  specialRequests: string | null;
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  noShowAt: string | null;
}

/** Small projection returned by the seat/cancel state-transition endpoints. */
export interface ReservationStatusDto {
  id: string;
  status: string;
}

export interface ReservationsSummaryDto {
  total: number;
  confirmed: number;
  seated: number;
  completed: number;
  cancelled: number;
  noShow: number;
  today: number;
  todayCovers: number;
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const RESERVATION_STATUS_TONE: Record<string, Tone> = {
  confirmed: "info",
  seated: "success",
  completed: "neutral",
  cancelled: "destructive",
  no_show: "warning",
};

// ── Waitlist ─────────────────────────────────────────────────────────────────────────────────

export interface WaitlistEntryDto {
  id: string;
  branchId: string | null;
  guestName: string;
  guestPhone: string;
  partySize: number;
  quotedWaitMinutes: number;
  status: string;
  arrivedAt: string;
  seatedAt: string | null;
  tableId: string | null;
  notes: string | null;
  waitedMinutes: number;
}

export interface WaitlistSummaryDto {
  total: number;
  waiting: number;
  seated: number;
  noShow: number;
  cancelled: number;
  averageQuotedWaitMinutes: number;
}

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  waiting: "Waiting",
  seated: "Seated",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export const WAITLIST_STATUS_TONE: Record<string, Tone> = {
  waiting: "warning",
  seated: "success",
  no_show: "destructive",
  cancelled: "neutral",
};
