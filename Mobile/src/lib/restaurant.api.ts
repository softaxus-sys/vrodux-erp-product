import { apiClient } from "@/lib/api-client";
import type {
  BranchDashboardDto,
  KitchenDashboardDto,
  KitchenSummaryDto,
  KitchenTicketDto,
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

// Read/visibility + safe-workflow keys only. `restaurant.orders.create/edit/void/discount/refund`
// (order-taking, payment, split-bill) are deliberately not used anywhere on mobile -- the same
// "workflow, not cash" line drawn for retail POS (lib/pos.api.ts's own comment) and for the AI
// assistant (CLAUDE.md Module 49): a phone isn't a card machine, and the order-taking screen
// (structured modifiers, combos, courses) is real desktop-appropriate complexity. Marking a
// kitchen item ready and seating a reservation/walk-in don't touch cash, so those two areas do
// get their own `.edit` keys below.
export const RESTAURANT_REPORTS_VIEW = "restaurant.reports.view"; // dashboards
export const RESTAURANT_TABLES_VIEW = "restaurant.tables.view";
export const RESTAURANT_ORDERS_VIEW = "restaurant.orders.view";
export const RESTAURANT_KITCHEN_VIEW = "restaurant.kitchen.view";
export const RESTAURANT_KITCHEN_EDIT = "restaurant.kitchen.edit";
export const RESTAURANT_RESERVATIONS_VIEW = "restaurant.reservations.view";
export const RESTAURANT_RESERVATIONS_EDIT = "restaurant.reservations.edit";
// No dedicated `restaurant.waitlist` permission group exists on the backend (WaitlistController's
// own code comment) -- walk-in waitlisting rides on the tables keys, same nearest-seeded-key
// convention used elsewhere in this codebase.
export const RESTAURANT_WAITLIST_VIEW = RESTAURANT_TABLES_VIEW;
export const RESTAURANT_WAITLIST_EDIT = "restaurant.tables.edit";

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

  // ── Orders (read-only) ─────────────────────────────────────────────────────────────────────
  getOrdersSummary: (): Promise<OrdersSummaryDto> => apiClient.get(`${BASE}/orders/summary`),
  getOrders: (status?: string): Promise<OrderDto[]> =>
    apiClient.get(`${BASE}/orders${status && status !== "all" ? `?status=${status}` : ""}`),
  getOrder: (id: string): Promise<OrderDto> => apiClient.get(`${BASE}/orders/${id}`),

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
};
