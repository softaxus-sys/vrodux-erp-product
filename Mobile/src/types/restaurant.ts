import type { Tone } from "@/theme";

/**
 * Restaurant POS -- full order-taking + front-of-house + kitchen coordination.
 *
 * This used to be scoped to "not an order-taking terminal" (the same line types/pos.ts's retail
 * module still draws, and kept there deliberately -- see that file's own note). Reversed here on
 * an explicit decision: waiters take orders under the CASHIER's open shift rather than opening
 * their own till (GetOpenShiftQuery/OpenShiftDto below), so ordering on a phone never touches cash
 * or a physical drawer the way checking out at a retail register does -- the thing that made
 * retail POS "not a card machine" was never actually true of a waiter's phone here.
 *
 * Deliberately still NOT built here (desktop/admin, same judgment call as RealEstate's "real
 * multi-field forms stay desktop-appropriate"): table layout/merge/QR-code/create, menu item
 * CRUD/photo management/bulk import, modifier-group CRUD, driver CRUD, delivery zones, happy
 * hour campaigns, combos (ordering a combo needs its own component-selection picker -- flagged as
 * a follow-up, same as the web app's own "Modifier Groups admin page" gap), printer profiles,
 * device registration, notification config, and the deeper Reports analytics screen (the
 * dashboards on RestaurantHomeScreen already cover the at-a-glance numbers).
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
  branchId: string | null;
  /** The cashier shift this order rides under -- see OpenShiftDto. Null on a legacy order or a
   *  register with no shift tracking. */
  sessionId: string | null;
  cashierId: string | null;
  discounts: OrderDiscountDto[];
  voidLogs: OrderVoidLogDto[];
  refunds: OrderRefundDto[];
  parentOrderId: string | null;
  splits: OrderSplitSummaryDto[];
  /** The linked POS customer, if any -- what SetCustomer/RedeemLoyalty act on. */
  customerId: string | null;
}

/** "dine_in" | "takeaway" | "delivery" -- OrderType. */
export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

export const ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const;

/** Whether a till is open for floor staff to order under right now -- GET /orders/open-shift.
 *  Waiters never open their own session; they ride the cashier's. */
export interface OpenShiftDto {
  isOpen: boolean;
  sessionId: string | null;
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

// ── Menu (read-only -- order-taking's own picker; no CRUD/import/photo management here) ────────

export interface ModifierDto {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierGroupDto {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: ModifierDto[];
}

export interface MenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  prepTimeMinutes: number;
  allergens: string | null;
  isAvailable: boolean;
  modifierGroups: ModifierGroupDto[];
  isOnlineOrderable: boolean;
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  items: MenuItemDto[];
}

export interface MenuSummaryDto {
  totalCategories: number;
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

/** One modifier-group selection made while building a cart line, before the order exists. */
export interface CartLineSelection {
  menuItem: MenuItemDto;
  quantity: number;
  selectedModifierIds: string[];
  /** Resolved display text for the selected modifiers, e.g. "Large, Extra cheese" -- built once at
   *  selection time so the cart never has to re-walk modifierGroups to render a line. */
  modifierSummary: string | null;
  /** Per-unit price including modifier deltas -- what LineTotal = quantity * this on the backend. */
  unitPriceWithModifiers: number;
}

// ── Delivery ─────────────────────────────────────────────────────────────────────────────────

export interface DriverDto {
  id: string;
  branchId: string | null;
  linkedUserId: string | null;
  name: string;
  phone: string;
  vehicleInfo: string | null;
  isActive: boolean;
  /** Runs not yet delivered or failed -- what "available" means when picking a rider. */
  activeDeliveries: number;
}

export interface DeliveryItemDto {
  name: string;
  quantity: number;
  notes: string | null;
}

export interface DeliveryOrderDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  deliveryZoneId: string | null;
  deliveryZoneName: string | null;
  driverId: string | null;
  driverName: string | null;
  status: string;
  address: string;
  phone: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveryFee: number;
  thirdPartyProvider: string | null;
  thirdPartyOrderRef: string | null;
  trackingToken: string;
  createdAt: string;
  customerName: string | null;
  orderNotes: string | null;
  amountToCollect: number;
  items: DeliveryItemDto[] | null;
}

export interface DeliverySummaryDto {
  total: number;
  assigned: number;
  pickedUp: number;
  enroute: number;
  delivered: number;
  failed: number;
}

export interface DeliveryProviderDto {
  key: string;
  displayName: string;
  isAvailable: boolean;
}

/** picked_up -> enroute -> delivered, or failed at any point (ChangeDeliveryStatusValidator's own
 *  allowed list -- "assigned" isn't in it; that's what AssignDriver sets instead). */
export const DELIVERY_STATUSES = ["assigned", "picked_up", "enroute", "delivered", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  picked_up: "Picked up",
  enroute: "En route",
  delivered: "Delivered",
  failed: "Failed",
};

export const DELIVERY_STATUS_TONE: Record<string, Tone> = {
  assigned: "neutral",
  picked_up: "info",
  enroute: "warning",
  delivered: "success",
  failed: "destructive",
};

/** The next status a tap should move a delivery to -- null once delivered/failed (terminal). */
export function nextDeliveryStatus(current: string): DeliveryStatus | null {
  const i = DELIVERY_STATUSES.indexOf(current as DeliveryStatus);
  if (i < 0 || i >= DELIVERY_STATUSES.length - 1) return null;
  return DELIVERY_STATUSES[i + 1];
}

// ── Lightweight customer lookup (link-to-order + loyalty) ───────────────────────────────────────

/** Trimmed view of POS's CustomerDto (/api/customers) -- just enough to link a customer to an
 *  order and show/spend their loyalty balance. Not duplicating the full POS customer module. */
export interface CustomerLiteDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
}
