import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant`;

// ── Types (mirror the Restaurant service DTOs) ─────────────────────────────────

export type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
export type OrderStatus = "open" | "sent" | "ready" | "served" | "paid" | "cancelled";

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  section: string;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  currentWaiter: string | null;
  occupiedSince: string | null;
}

export interface TablesSummary {
  total: number; available: number; occupied: number; reserved: number;
  cleaning: number; occupancyRate: number; totalCovers: number;
}

export interface MenuItem {
  id: string;
  categoryId?: string;
  name: string;
  description: string | null;
  price: number;
  prepTimeMinutes: number;
  allergens: string | null;
  isAvailable: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: string | null;
  status: string;
}

export interface OrderPaymentDto {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  createdAt: string;
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string;
  tableId: string;
  tableNumber: string;
  waiter: string;
  covers: number;
  status: OrderStatus;
  orderType: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: OrderPaymentDto[];
}

export interface OrdersSummary {
  total: number; open: number; sent: number; ready: number; served: number;
  paid: number; cancelled: number; todayOrders: number; todayRevenue: number; totalRevenue: number;
}

export interface KitchenTicket {
  id: string;
  orderNumber: string;
  tableNumber: string;
  waiter: string;
  covers: number;
  status: "sent" | "ready";
  createdAt: string;
  waitMinutes: number;
  items: { id: string; itemName: string; quantity: number; modifiers: string | null; status: string }[];
}

export interface KitchenSummary {
  activeOrders: number; sentToKitchen: number; ready: number; pendingItems: number; preparingItems: number;
}

export interface OrderLineInput { menuItemId: string; quantity: number; modifiers?: string | null }

// ── API ────────────────────────────────────────────────────────────────────────

export const restaurantApi = {
  // Tables
  getTables:       (): Promise<RestaurantTable[]> => rawApiClient.get(`${BASE}/tables`),
  getTablesSummary:(): Promise<TablesSummary>     => rawApiClient.get(`${BASE}/tables/summary`),
  createTable:     (p: { tableNumber: string; section: string; capacity: number }): Promise<RestaurantTable> =>
    rawApiClient.post(`${BASE}/tables`, p),
  setTableStatus:  (id: string, status: TableStatus): Promise<{ id: string; status: string }> =>
    rawApiClient.patch(`${BASE}/tables/${id}/status`, { status }),

  // Menu
  getMenu:         (): Promise<MenuCategory[]> => rawApiClient.get(`${BASE}/menu`),
  getMenuItems:    (): Promise<MenuItem[]>     => rawApiClient.get(`${BASE}/menu/items`),
  setItemAvailability: (id: string, isAvailable: boolean): Promise<{ id: string; isAvailable: boolean }> =>
    rawApiClient.patch(`${BASE}/menu/items/${id}/availability`, { isAvailable }),
  createCategory:  (p: { name: string; description?: string | null; sortOrder: number }) =>
    rawApiClient.post(`${BASE}/menu/categories`, p),
  createItem:      (p: { categoryId: string; name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null }) =>
    rawApiClient.post(`${BASE}/menu/items`, p),

  // Orders
  getOrders:        (status?: string): Promise<RestaurantOrder[]> =>
    rawApiClient.get(`${BASE}/orders${status ? `?status=${status}` : ""}`),
  getOrdersSummary: (): Promise<OrdersSummary> => rawApiClient.get(`${BASE}/orders/summary`),
  getOrder:         (id: string): Promise<RestaurantOrder> => rawApiClient.get(`${BASE}/orders/${id}`),
  createOrder:      (p: { tableId: string | null; waiter: string; covers: number; orderType: string; notes?: string | null; items: OrderLineInput[] }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders`, p),
  addItems:         (id: string, items: OrderLineInput[]): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/items`, { items }),
  removeItem:       (id: string, itemId: string): Promise<RestaurantOrder> =>
    rawApiClient.delete(`${BASE}/orders/${id}/items/${itemId}`),
  applyDiscount:    (id: string, amount: number): Promise<RestaurantOrder> =>
    rawApiClient.patch(`${BASE}/orders/${id}/discount`, { amount }),
  sendToKitchen:    (id: string) => rawApiClient.patch(`${BASE}/orders/${id}/send`),
  serve:            (id: string) => rawApiClient.patch(`${BASE}/orders/${id}/serve`),
  pay:              (id: string, method: string): Promise<RestaurantOrder> => rawApiClient.patch(`${BASE}/orders/${id}/pay`, { method }),
  addPayment:       (id: string, p: { method: string; amount: number; reference?: string | null }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/payments`, p),
  cancel:           (id: string) => rawApiClient.patch(`${BASE}/orders/${id}/cancel`),

  // Kitchen
  getKitchenTickets: (): Promise<KitchenTicket[]> => rawApiClient.get(`${BASE}/kitchen/tickets`),
  getKitchenSummary: (): Promise<KitchenSummary>  => rawApiClient.get(`${BASE}/kitchen/summary`),
  markOrderReady:    (id: string) => rawApiClient.patch(`${BASE}/kitchen/orders/${id}/ready`),
};
