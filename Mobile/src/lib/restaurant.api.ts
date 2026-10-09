import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  BranchDashboardDto,
  CustomerLiteDto,
  DeliveryOrderDto,
  DeliveryProviderDto,
  DeliverySummaryDto,
  DriverDto,
  KitchenDashboardDto,
  KitchenSummaryDto,
  KitchenTicketDto,
  MenuCategoryDto,
  MenuSummaryDto,
  OpenShiftDto,
  OrderDto,
  OrdersSummaryDto,
  OwnerDashboardDto,
  ReservationDto,
  ReservationsSummaryDto,
  ReservationStatusDto,
  TableDto,
  TablesSummaryDto,
  WaitlistEntryDto,
  WaitlistSummaryDto,
} from "@/types/restaurant";

const BASE = "/api/restaurant";

// Full order-taking + delivery + loyalty keys -- see types/restaurant.ts's top-of-file note for
// exactly what is and isn't built here. `restaurant.tables.create/edit`'s layout/merge/QR actions
// and every `restaurant.menu.*`/`restaurant.delivery.create|edit`-on-drivers CRUD stay out of
// scope; only the keys below are ever sent from this module.
export const RESTAURANT_REPORTS_VIEW = "restaurant.reports.view"; // dashboards
export const RESTAURANT_TABLES_VIEW = "restaurant.tables.view";
export const RESTAURANT_TABLES_EDIT = "restaurant.tables.edit"; // table status only (not layout)
export const RESTAURANT_MENU_VIEW = "restaurant.menu.view";
export const RESTAURANT_ORDERS_VIEW = "restaurant.orders.view";
export const RESTAURANT_ORDERS_CREATE = "restaurant.orders.create";
export const RESTAURANT_ORDERS_EDIT = "restaurant.orders.edit";
export const RESTAURANT_ORDERS_VOID = "restaurant.orders.void";
export const RESTAURANT_ORDERS_DISCOUNT = "restaurant.orders.discount";
export const RESTAURANT_ORDERS_REFUND = "restaurant.orders.refund";
export const RESTAURANT_KITCHEN_VIEW = "restaurant.kitchen.view";
export const RESTAURANT_KITCHEN_EDIT = "restaurant.kitchen.edit";
export const RESTAURANT_RESERVATIONS_VIEW = "restaurant.reservations.view";
export const RESTAURANT_RESERVATIONS_EDIT = "restaurant.reservations.edit";
export const RESTAURANT_DELIVERY_VIEW = "restaurant.delivery.view";
export const RESTAURANT_DELIVERY_CREATE = "restaurant.delivery.create";
export const RESTAURANT_DELIVERY_EDIT = "restaurant.delivery.edit";
// No dedicated `restaurant.waitlist` permission group exists on the backend (WaitlistController's
// own code comment) -- walk-in waitlisting rides on the tables keys, same nearest-seeded-key
// convention used elsewhere in this codebase.
export const RESTAURANT_WAITLIST_VIEW = RESTAURANT_TABLES_VIEW;
export const RESTAURANT_WAITLIST_EDIT = RESTAURANT_TABLES_EDIT;

export interface CreateOrderBody {
  tableId?: string | null;
  waiter: string;
  covers: number;
  orderType: string;
  notes?: string | null;
  items: OrderLineBody[];
  branchId?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
}

export interface OrderLineBody {
  menuItemId: string;
  quantity: number;
  modifiers?: string | null;
  selectedModifierIds?: string[];
  courseNumber?: number | null;
}

export const restaurantApi = {
  // ── Dashboards ─────────────────────────────────────────────────────────────────────────────
  getOwnerDashboard: (branchId?: string): Promise<OwnerDashboardDto> =>
    apiClient.get(`${BASE}/dashboard/owner${branchId ? `?branchId=${branchId}` : ""}`),
  getBranchDashboard: (branchId?: string): Promise<BranchDashboardDto> =>
    apiClient.get(`${BASE}/dashboard/branch${branchId ? `?branchId=${branchId}` : ""}`),
  getKitchenDashboard: (branchId?: string): Promise<KitchenDashboardDto> =>
    apiClient.get(`${BASE}/dashboard/kitchen${branchId ? `?branchId=${branchId}` : ""}`),

  // ── Tables ─────────────────────────────────────────────────────────────────────────────────
  getTablesSummary: (): Promise<TablesSummaryDto> => apiClient.get(`${BASE}/tables/summary`),
  getTables: (): Promise<TableDto[]> => apiClient.get(`${BASE}/tables`),
  updateTableStatus: (id: string, status: string): Promise<TableDto> =>
    apiClient.patch(`${BASE}/tables/${id}/status`, { status }),

  // ── Menu (read-only) ───────────────────────────────────────────────────────────────────────
  getMenu: (): Promise<MenuCategoryDto[]> => apiClient.get(`${BASE}/menu`),
  getMenuSummary: (): Promise<MenuSummaryDto> => apiClient.get(`${BASE}/menu/summary`),

  // ── Orders ─────────────────────────────────────────────────────────────────────────────────
  getOrdersSummary: (): Promise<OrdersSummaryDto> => apiClient.get(`${BASE}/orders/summary`),
  getOpenShift: (): Promise<OpenShiftDto> => apiClient.get(`${BASE}/orders/open-shift`),
  getOrders: (status?: string): Promise<OrderDto[]> =>
    apiClient.get(`${BASE}/orders${status && status !== "all" ? `?status=${status}` : ""}`),
  getOrder: (id: string): Promise<OrderDto> => apiClient.get(`${BASE}/orders/${id}`),
  createOrder: (body: CreateOrderBody): Promise<OrderDto> => apiClient.post(`${BASE}/orders`, body),
  addItems: (id: string, items: OrderLineBody[]): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/items`, { items }),
  fireNextCourse: (id: string): Promise<OrderDto> => apiClient.patch(`${BASE}/orders/${id}/fire-next-course`, {}),
  sendToKitchen: (id: string): Promise<{ id: string; status: string }> =>
    apiClient.patch(`${BASE}/orders/${id}/send`, {}),
  serve: (id: string): Promise<{ id: string; status: string }> => apiClient.patch(`${BASE}/orders/${id}/serve`, {}),
  voidItem: (id: string, itemId: string, reason: string): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/items/${itemId}/void`, { reason }),
  applyDiscount: (id: string, type: string, amount: number, reason: string): Promise<OrderDto> =>
    apiClient.patch(`${BASE}/orders/${id}/discount`, { type, amount, reason }),
  removeDiscount: (id: string, reason: string): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/discount/remove`, { reason }),
  redeemLoyalty: (id: string, points: number): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/loyalty`, { points }),
  pay: (id: string, method: string): Promise<OrderDto> => apiClient.patch(`${BASE}/orders/${id}/pay`, { method }),
  addPayment: (id: string, method: string, amount: number, reference?: string): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/payments`, { method, amount, reference }),
  setTip: (id: string, amount: number): Promise<OrderDto> => apiClient.patch(`${BASE}/orders/${id}/tip`, { amount }),
  setCustomer: (id: string, customerId: string | null): Promise<OrderDto> =>
    apiClient.patch(`${BASE}/orders/${id}/customer`, { customerId }),
  setWaiter: (id: string, waiter: string): Promise<OrderDto> =>
    apiClient.patch(`${BASE}/orders/${id}/waiter`, { waiter }),
  hold: (id: string): Promise<OrderDto> => apiClient.patch(`${BASE}/orders/${id}/hold`, {}),
  recall: (id: string): Promise<OrderDto> => apiClient.patch(`${BASE}/orders/${id}/recall`, {}),
  cancelOrder: (id: string, reason: string): Promise<{ id: string; status: string }> =>
    apiClient.patch(`${BASE}/orders/${id}/cancel`, { reason }),
  refund: (id: string, amount: number, reason: string, method: string): Promise<OrderDto> =>
    apiClient.post(`${BASE}/orders/${id}/refund`, { amount, reason, method }),
  split: (id: string, groups: { itemIds: string[] }[]): Promise<OrderDto[]> =>
    apiClient.post(`${BASE}/orders/${id}/split`, { groups }),

  // ── Kitchen (KDS) ──────────────────────────────────────────────────────────────────────────
  getKitchenSummary: (): Promise<KitchenSummaryDto> => apiClient.get(`${BASE}/kitchen/summary`),
  getKitchenTickets: (stationId?: string): Promise<KitchenTicketDto[]> =>
    apiClient.get(`${BASE}/kitchen/tickets${stationId ? `?stationId=${stationId}` : ""}`),
  updateItemStatus: (itemId: string, status: string): Promise<{ id: string; status: string }> =>
    apiClient.patch(`${BASE}/kitchen/items/${itemId}/status`, { status }),
  markOrderReady: (orderId: string): Promise<{ id: string; status: string }> =>
    apiClient.patch(`${BASE}/kitchen/orders/${orderId}/ready`, {}),

  // ── Reservations ───────────────────────────────────────────────────────────────────────────
  getReservationsSummary: (): Promise<ReservationsSummaryDto> => apiClient.get(`${BASE}/reservations/summary`),
  getReservations: (date?: string): Promise<ReservationDto[]> =>
    apiClient.get(`${BASE}/reservations${date ? `?date=${date}` : ""}`),
  seatReservation: (id: string): Promise<ReservationStatusDto> => apiClient.patch(`${BASE}/reservations/${id}/seat`, {}),
  cancelReservation: (id: string): Promise<ReservationStatusDto> => apiClient.patch(`${BASE}/reservations/${id}/cancel`, {}),

  // ── Waitlist ───────────────────────────────────────────────────────────────────────────────
  getWaitlistSummary: (): Promise<WaitlistSummaryDto> => apiClient.get(`${BASE}/waitlist/summary`),
  getWaitlist: (status?: string): Promise<WaitlistEntryDto[]> =>
    apiClient.get(`${BASE}/waitlist${status && status !== "all" ? `?status=${status}` : ""}`),
  seatWaitlist: (id: string, tableId: string): Promise<WaitlistEntryDto> =>
    apiClient.patch(`${BASE}/waitlist/${id}/seat`, { tableId }),
  cancelWaitlist: (id: string): Promise<WaitlistEntryDto> => apiClient.patch(`${BASE}/waitlist/${id}/cancel`, {}),
  noShowWaitlist: (id: string): Promise<WaitlistEntryDto> => apiClient.patch(`${BASE}/waitlist/${id}/no-show`, {}),

  // ── Delivery ───────────────────────────────────────────────────────────────────────────────
  getDeliveryProviders: (): Promise<DeliveryProviderDto[]> => apiClient.get(`${BASE}/delivery/providers`),
  getDeliverySummary: (): Promise<DeliverySummaryDto> => apiClient.get(`${BASE}/delivery/summary`),
  getDeliveryOrders: (status?: string): Promise<DeliveryOrderDto[]> =>
    apiClient.get(`${BASE}/delivery${status && status !== "all" ? `?status=${status}` : ""}`),
  getDeliveryOrder: (id: string): Promise<DeliveryOrderDto> => apiClient.get(`${BASE}/delivery/${id}`),
  createDeliveryOrder: (body: {
    orderId: string;
    address: string;
    phone: string;
    deliveryZoneId?: string | null;
    providerKey?: string;
  }): Promise<DeliveryOrderDto> => apiClient.post(`${BASE}/delivery`, body),
  assignDriver: (id: string, driverId: string): Promise<DeliveryOrderDto> =>
    apiClient.patch(`${BASE}/delivery/${id}/driver`, { driverId }),
  changeDeliveryStatus: (id: string, status: string): Promise<DeliveryOrderDto> =>
    apiClient.patch(`${BASE}/delivery/${id}/status`, { status }),

  // ── Drivers (read-only picker -- CRUD stays desktop) ──────────────────────────────────────
  getDrivers: (activeOnly = false): Promise<DriverDto[]> =>
    apiClient.get(`${BASE}/drivers${activeOnly ? "?activeOnly=true" : ""}`),

  // ── Customer lookup (link-to-order + loyalty) ─────────────────────────────────────────────
  // Not under /api/restaurant -- POS's own customer register, shared with retail. The Cashier
  // tier's `pos.transactions.create` permission already opens this read (same rule the web pay
  // dialog relies on), so a waiter ordering under the open shift can look a customer up too.
  searchCustomers: (search: string): Promise<PagedResult<CustomerLiteDto>> =>
    apiClient.get(`/api/customers?page=1&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  getCustomer: (id: string): Promise<CustomerLiteDto> => apiClient.get(`/api/customers/${id}`),
};
