import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/restaurant`;

// ── Types (mirror the Restaurant service DTOs) ─────────────────────────────────

export type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
export type OrderStatus = "open" | "sent" | "ready" | "served" | "paid" | "cancelled" | "split" | "held";

export type TableShape = "round" | "square" | "rect";

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  section: string;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  currentWaiter: string | null;
  occupiedSince: string | null;
  branchId: string | null;
  diningAreaId: string | null;
  posX: number | null;
  posY: number | null;
  shape: TableShape;
  rotation: number;
  mergedIntoTableId: string | null;
}

export interface Floor {
  id: string;
  branchId: string | null;
  name: string;
  sortOrder: number;
}

export type DiningAreaType = "indoor" | "outdoor" | "vip" | "bar" | "rooftop";

export interface DiningArea {
  id: string;
  floorId: string;
  name: string;
  type: DiningAreaType;
  sortOrder: number;
}

export interface DiningAreaLayout extends DiningArea {
  tables: RestaurantTable[];
}

export interface FloorLayout extends Floor {
  diningAreas: DiningAreaLayout[];
}

export type WaitlistStatus = "waiting" | "seated" | "no_show" | "cancelled";

export interface WaitlistEntry {
  id: string;
  branchId: string | null;
  guestName: string;
  guestPhone: string;
  partySize: number;
  quotedWaitMinutes: number;
  status: WaitlistStatus;
  arrivedAt: string;
  seatedAt: string | null;
  tableId: string | null;
  notes: string | null;
  waitedMinutes: number;
}

export interface WaitlistSummary {
  total: number; waiting: number; seated: number; noShow: number; cancelled: number;
  averageQuotedWaitMinutes: number;
}

export type ReservationStatus = "confirmed" | "seated" | "completed" | "cancelled" | "no_show";

export interface Reservation {
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
  status: ReservationStatus;
  specialRequests: string | null;
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  noShowAt: string | null;
}

export interface ReservationsSummary {
  total: number; confirmed: number; seated: number; completed: number;
  cancelled: number; noShow: number; today: number; todayCovers: number;
}

export interface ReservationRule {
  id: string;
  branchId: string | null;
  slotDurationMinutes: number;
  maxCoversPerSlot: number;
  maxAdvanceDays: number;
  minNoticeMinutes: number;
  autoNoShowMinutes: number;
  depositRequired: boolean;
  depositAmount: number;
}

export interface TablesSummary {
  total: number; available: number; occupied: number; reserved: number;
  cleaning: number; occupancyRate: number; totalCovers: number;
}

export interface Modifier {
  id: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number; // 0 = optional
  maxSelect: number;
  modifiers: Modifier[];
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
  modifierGroups: ModifierGroup[];
  kitchenStationId: string | null;
  isOnlineOrderable: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
  kitchenStationId: string | null;
}

export interface MenuSummary {
  totalCategories: number;
  totalItems: number;
  availableItems: number;
  unavailableItems: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

export interface OrderItemModifierDto {
  id: string;
  name: string;
  priceDelta: number;
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
  courseNumber: number;
  comboOrderItemId: string | null;
  selectedModifiers: OrderItemModifierDto[];
}

export interface OrderPaymentDto {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  createdAt: string;
}

export type DiscountType = "flat" | "percentage" | "voucher";

export interface OrderDiscountDto {
  id: string;
  type: DiscountType;
  amount: number;
  reason: string;
  appliedByUserId: string;
  approvedByUserId: string | null;
  isVoided: boolean;
  voidedByUserId: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface OrderVoidLogDto {
  id: string;
  orderItemId: string | null; // null = whole-order void
  reason: string;
  voidedByUserId: string;
  createdAt: string;
}

export interface OrderRefundDto {
  id: string;
  amount: number;
  reason: string;
  method: string;
  refundedByUserId: string;
  createdAt: string;
}

export interface OrderSplitSummaryDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  amountPaid: number;
  outstanding: number;
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
  orderChannel: string; // pos/qr_table/kiosk
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
  items: OrderItem[];
  payments: OrderPaymentDto[];
  branchId: string | null;
  sessionId: string | null;
  cashierId: string | null;
  discounts: OrderDiscountDto[];
  voidLogs: OrderVoidLogDto[];
  refunds: OrderRefundDto[];
  parentOrderId: string | null;
  splits: OrderSplitSummaryDto[];
  customerId: string | null;
}

export interface OrdersSummary {
  total: number; open: number; sent: number; ready: number; served: number;
  paid: number; cancelled: number; split: number; held: number;
  todayOrders: number; todayRevenue: number; totalRevenue: number; totalTips: number;
}

export interface KitchenTicketItem {
  id: string; itemName: string; quantity: number; modifiers: string | null; status: string;
  courseNumber: number; comboOrderItemId: string | null; kitchenStationId: string | null;
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
  currentCourse: number;
  items: KitchenTicketItem[];
}

export interface KitchenSummary {
  activeOrders: number; sentToKitchen: number; ready: number; pendingItems: number; preparingItems: number;
}

export interface OrderLineInput {
  menuItemId: string; quantity: number; modifiers?: string | null; selectedModifierIds?: string[]; courseNumber?: number;
}

export interface SplitGroupInput { itemIds: string[] }

// ── Kitchen stations / printers / combos / happy hour (Epic 5) ─────────────────

export interface PrinterProfile {
  id: string; branchId: string | null; name: string;
  type: "receipt" | "kitchen"; connectionType: "network" | "usb" | "bluetooth";
  ipAddress: string | null; port: number | null; isDefault: boolean;
}

export interface KitchenStation {
  id: string; branchId: string | null; name: string; displayName: string | null;
  colorTag: string | null; sortOrder: number; printerProfileId: string | null;
}

export interface ComboItemDto {
  id: string; menuItemId: string | null; menuItemName: string | null;
  categoryId: string | null; categoryName: string | null; quantity: number; sortOrder: number;
}

export interface ComboItemInput { menuItemId?: string | null; categoryId?: string | null; quantity: number; sortOrder: number }

export interface Combo {
  id: string; name: string; price: number; isActive: boolean; items: ComboItemDto[];
}

export interface ComboSelectionInput { comboItemId: string; menuItemId: string }

export type DaysOfWeekMask = number; // bit (1 << DayOfWeek), Sunday=1, Monday=2, ... Saturday=64

export interface HappyHourRule {
  id: string; branchId: string | null; name: string; daysOfWeekMask: DaysOfWeekMask;
  startTime: string; endTime: string; discountType: "percentage" | "flat"; discountValue: number;
  categoryId: string | null; isActive: boolean;
}

// ── Delivery / QR-kiosk ordering / digital receipts (Epic 6) ───────────────────

export interface DeliveryZone {
  id: string; branchId: string | null; name: string; postalCodesJson: string | null;
  deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; isActive: boolean;
}

export interface Driver {
  id: string; branchId: string | null; linkedUserId: string | null; name: string; phone: string;
  vehicleInfo: string | null; isActive: boolean;
}

export type DeliveryStatus = "assigned" | "picked_up" | "enroute" | "delivered" | "failed";

export interface DeliveryOrder {
  id: string; orderId: string; orderNumber: string; orderTotal: number;
  deliveryZoneId: string | null; deliveryZoneName: string | null;
  driverId: string | null; driverName: string | null;
  status: DeliveryStatus; address: string; phone: string;
  estimatedDeliveryAt: string | null; deliveredAt: string | null; deliveryFee: number;
  thirdPartyProvider: string | null; thirdPartyOrderRef: string | null;
  trackingToken: string; createdAt: string;
}

export interface DeliverySummary {
  total: number; assigned: number; pickedUp: number; enroute: number; delivered: number; failed: number;
}

export interface DeliveryProvider { key: string; displayName: string; isAvailable: boolean }

export interface DeliveryTracking {
  orderNumber: string; status: DeliveryStatus; driverName: string | null;
  estimatedDeliveryAt: string | null; deliveredAt: string | null; address: string;
}

export interface TableQrCode { qrCode: string; url: string; qrImageDataUri: string }

export interface PublicMenuItem { id: string; name: string; description: string | null; price: number; allergens: string | null }
export interface PublicMenuCategory { id: string; name: string; description: string | null; items: PublicMenuItem[] }
export interface PublicMenu { tableId: string; tableNumber: string; categories: PublicMenuCategory[] }
export interface PublicOrderLine { menuItemId: string; quantity: number; modifiers?: string | null }
export interface PublicOrderPlaced { orderId: string; orderNumber: string; total: number }

export interface SendReceiptResult { success: boolean; channel: "email" | "whatsapp"; recipientAddress: string }

// ── API ────────────────────────────────────────────────────────────────────────

export const restaurantApi = {
  // Tables
  getTables:       (): Promise<RestaurantTable[]> => rawApiClient.get(`${BASE}/tables`),
  getTablesSummary:(): Promise<TablesSummary>     => rawApiClient.get(`${BASE}/tables/summary`),
  createTable:     (p: { tableNumber: string; section: string; capacity: number; branchId?: string | null; diningAreaId?: string | null }): Promise<RestaurantTable> =>
    rawApiClient.post(`${BASE}/tables`, p),
  updateTable:     (id: string, p: { tableNumber: string; section: string; capacity: number; diningAreaId?: string | null }): Promise<RestaurantTable> =>
    rawApiClient.put(`${BASE}/tables/${id}`, p),
  deleteTable:     (id: string): Promise<void> => rawApiClient.delete(`${BASE}/tables/${id}`),
  setTableStatus:  (id: string, status: TableStatus): Promise<{ id: string; status: string }> =>
    rawApiClient.patch(`${BASE}/tables/${id}/status`, { status }),
  repositionTable: (id: string, p: { posX: number; posY: number; shape: TableShape; rotation: number }): Promise<RestaurantTable> =>
    rawApiClient.patch(`${BASE}/tables/${id}/position`, p),
  saveTableLayout: (tables: { id: string; posX: number; posY: number; shape: TableShape; rotation: number }[]): Promise<void> =>
    rawApiClient.put(`${BASE}/tables/layout`, { tables }),
  mergeTable:      (id: string, targetTableId: string): Promise<RestaurantTable> =>
    rawApiClient.post(`${BASE}/tables/${id}/merge`, { targetTableId }),
  unmergeTable:    (id: string): Promise<RestaurantTable> => rawApiClient.post(`${BASE}/tables/${id}/unmerge`),

  // Floors / Dining Areas
  getFloors:       (): Promise<Floor[]> => rawApiClient.get(`${BASE}/floors`),
  getFloorLayout:  (): Promise<FloorLayout[]> => rawApiClient.get(`${BASE}/floors/layout`),
  createFloor:     (p: { name: string; sortOrder: number; branchId?: string | null }): Promise<Floor> =>
    rawApiClient.post(`${BASE}/floors`, p),
  updateFloor:     (id: string, p: { name: string; sortOrder: number }): Promise<Floor> =>
    rawApiClient.put(`${BASE}/floors/${id}`, p),
  deleteFloor:     (id: string): Promise<void> => rawApiClient.delete(`${BASE}/floors/${id}`),
  getDiningAreas:  (floorId: string): Promise<DiningArea[]> => rawApiClient.get(`${BASE}/floors/${floorId}/dining-areas`),
  createDiningArea:(floorId: string, p: { name: string; type: DiningAreaType; sortOrder: number }): Promise<DiningArea> =>
    rawApiClient.post(`${BASE}/floors/${floorId}/dining-areas`, p),
  updateDiningArea:(floorId: string, id: string, p: { name: string; type: DiningAreaType; sortOrder: number }): Promise<DiningArea> =>
    rawApiClient.put(`${BASE}/floors/${floorId}/dining-areas/${id}`, p),
  deleteDiningArea:(floorId: string, id: string): Promise<void> =>
    rawApiClient.delete(`${BASE}/floors/${floorId}/dining-areas/${id}`),

  // Waitlist
  getWaitlist:        (status?: string): Promise<WaitlistEntry[]> =>
    rawApiClient.get(`${BASE}/waitlist${status ? `?status=${status}` : ""}`),
  getWaitlistSummary: (): Promise<WaitlistSummary> => rawApiClient.get(`${BASE}/waitlist/summary`),
  addToWaitlist:      (p: { guestName: string; guestPhone: string; partySize: number; quotedWaitMinutes: number; notes?: string | null }): Promise<WaitlistEntry> =>
    rawApiClient.post(`${BASE}/waitlist`, p),
  seatWaitlistEntry:  (id: string, tableId: string): Promise<WaitlistEntry> =>
    rawApiClient.patch(`${BASE}/waitlist/${id}/seat`, { tableId }),
  cancelWaitlistEntry:(id: string): Promise<WaitlistEntry> => rawApiClient.patch(`${BASE}/waitlist/${id}/cancel`),
  noShowWaitlistEntry:(id: string): Promise<WaitlistEntry> => rawApiClient.patch(`${BASE}/waitlist/${id}/no-show`),

  // Reservations
  getReservations:       (date?: string): Promise<Reservation[]> =>
    rawApiClient.get(`${BASE}/reservations${date ? `?date=${date}` : ""}`),
  getReservationsSummary:(): Promise<ReservationsSummary> => rawApiClient.get(`${BASE}/reservations/summary`),
  createReservation:     (p: { guestName: string; guestPhone: string; guestEmail?: string | null; covers: number; reservationDate: string; reservationTime: string; specialRequests?: string | null; tableId?: string | null; arrivalWindowStart?: string | null; arrivalWindowEnd?: string | null }): Promise<{ id: string; reservationNumber: string; status: string }> =>
    rawApiClient.post(`${BASE}/reservations`, p),
  seatReservation:       (id: string): Promise<{ id: string; status: string }> => rawApiClient.patch(`${BASE}/reservations/${id}/seat`),
  cancelReservation:     (id: string): Promise<{ id: string; status: string }> => rawApiClient.patch(`${BASE}/reservations/${id}/cancel`),
  getReservationRule:    (branchId?: string | null): Promise<ReservationRule | null> =>
    rawApiClient.get(`${BASE}/reservations/rules${branchId ? `?branchId=${branchId}` : ""}`),
  saveReservationRule:   (p: Omit<ReservationRule, "id">): Promise<ReservationRule> =>
    rawApiClient.put(`${BASE}/reservations/rules`, p),

  // Menu
  getMenu:         (): Promise<MenuCategory[]> => rawApiClient.get(`${BASE}/menu`),
  getMenuItems:    (): Promise<MenuItem[]>     => rawApiClient.get(`${BASE}/menu/items`),
  getMenuSummary:  (): Promise<MenuSummary>    => rawApiClient.get(`${BASE}/menu/summary`),
  setItemAvailability: (id: string, isAvailable: boolean): Promise<{ id: string; isAvailable: boolean }> =>
    rawApiClient.patch(`${BASE}/menu/items/${id}/availability`, { isAvailable }),
  createCategory:  (p: { name: string; description?: string | null; sortOrder: number; kitchenStationId?: string | null }) =>
    rawApiClient.post(`${BASE}/menu/categories`, p),
  updateCategory:  (id: string, p: { name: string; description?: string | null; sortOrder: number }): Promise<MenuCategory> =>
    rawApiClient.put(`${BASE}/menu/categories/${id}`, p),
  deleteCategory:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/menu/categories/${id}`),
  createItem:      (p: { categoryId: string; name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; kitchenStationId?: string | null }) =>
    rawApiClient.post(`${BASE}/menu/items`, p),
  updateItem:      (id: string, p: { name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; isOnlineOrderable: boolean }): Promise<MenuItem> =>
    rawApiClient.put(`${BASE}/menu/items/${id}`, p),
  deleteItem:      (id: string): Promise<void> => rawApiClient.delete(`${BASE}/menu/items/${id}`),
  setItemStation:     (id: string, kitchenStationId: string | null): Promise<MenuItem> =>
    rawApiClient.patch(`${BASE}/menu/items/${id}/kitchen-station`, { kitchenStationId }),
  setCategoryStation: (id: string, kitchenStationId: string | null): Promise<MenuCategory> =>
    rawApiClient.patch(`${BASE}/menu/categories/${id}/kitchen-station`, { kitchenStationId }),
  getItemModifierGroups:    (itemId: string): Promise<string[]> =>
    rawApiClient.get(`${BASE}/menu/items/${itemId}/modifier-groups`),
  assignItemModifierGroups:(itemId: string, modifierGroupIds: string[]): Promise<void> =>
    rawApiClient.put(`${BASE}/menu/items/${itemId}/modifier-groups`, { modifierGroupIds }),

  // Modifier groups
  getModifierGroups:    (): Promise<ModifierGroup[]> => rawApiClient.get(`${BASE}/modifier-groups`),
  createModifierGroup:  (p: { name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }): Promise<ModifierGroup> =>
    rawApiClient.post(`${BASE}/modifier-groups`, p),
  updateModifierGroup:  (id: string, p: { name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }): Promise<ModifierGroup> =>
    rawApiClient.put(`${BASE}/modifier-groups/${id}`, p),
  deleteModifierGroup:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/modifier-groups/${id}`),

  // Orders
  getOrders:        (status?: string): Promise<RestaurantOrder[]> =>
    rawApiClient.get(`${BASE}/orders${status ? `?status=${status}` : ""}`),
  getOrdersSummary: (): Promise<OrdersSummary> => rawApiClient.get(`${BASE}/orders/summary`),
  getOrder:         (id: string): Promise<RestaurantOrder> => rawApiClient.get(`${BASE}/orders/${id}`),
  createOrder:      (p: { tableId: string | null; waiter: string; covers: number; orderType: string; notes?: string | null; items: OrderLineInput[]; branchId?: string | null; sessionId?: string | null; customerId?: string | null }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders`, p),
  setCustomer:      (id: string, customerId: string | null): Promise<RestaurantOrder> =>
    rawApiClient.patch(`${BASE}/orders/${id}/customer`, { customerId }),
  addItems:         (id: string, items: OrderLineInput[]): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/items`, { items }),
  voidItem:         (id: string, itemId: string, reason: string): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/items/${itemId}/void`, { reason }),
  applyDiscount:    (id: string, p: { type: DiscountType; amount: number; reason: string }): Promise<RestaurantOrder> =>
    rawApiClient.patch(`${BASE}/orders/${id}/discount`, p),
  removeDiscount:   (id: string, reason: string): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/discount/remove`, { reason }),
  sendToKitchen:    (id: string) => rawApiClient.patch(`${BASE}/orders/${id}/send`),
  serve:            (id: string) => rawApiClient.patch(`${BASE}/orders/${id}/serve`),
  pay:              (id: string, method: string): Promise<RestaurantOrder> => rawApiClient.patch(`${BASE}/orders/${id}/pay`, { method }),
  addPayment:       (id: string, p: { method: string; amount: number; reference?: string | null }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/payments`, p),
  cancel:           (id: string, reason: string): Promise<RestaurantOrder> =>
    rawApiClient.patch(`${BASE}/orders/${id}/cancel`, { reason }),
  refund:           (id: string, p: { amount: number; reason: string; method: string }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/refund`, p),
  splitOrder:       (id: string, groups: SplitGroupInput[]): Promise<RestaurantOrder[]> =>
    rawApiClient.post(`${BASE}/orders/${id}/split`, { groups }),
  setTip:           (id: string, amount: number): Promise<RestaurantOrder> =>
    rawApiClient.patch(`${BASE}/orders/${id}/tip`, { amount }),
  hold:             (id: string): Promise<{ id: string; status: string }> => rawApiClient.patch(`${BASE}/orders/${id}/hold`),
  recall:           (id: string): Promise<{ id: string; status: string }> => rawApiClient.patch(`${BASE}/orders/${id}/recall`),
  transferTable:    (id: string, toTableId: string): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/transfer-table`, { toTableId }),
  fireNextCourse:   (id: string): Promise<RestaurantOrder> => rawApiClient.patch(`${BASE}/orders/${id}/fire-next-course`),
  addCombo:         (id: string, p: { comboId: string; selections: ComboSelectionInput[] }): Promise<RestaurantOrder> =>
    rawApiClient.post(`${BASE}/orders/${id}/combo-items`, p),

  // Kitchen
  getKitchenTickets: (stationId?: string): Promise<KitchenTicket[]> =>
    rawApiClient.get(`${BASE}/kitchen/tickets${stationId ? `?stationId=${stationId}` : ""}`),
  getKitchenSummary: (): Promise<KitchenSummary>  => rawApiClient.get(`${BASE}/kitchen/summary`),
  markOrderReady:    (id: string) => rawApiClient.patch(`${BASE}/kitchen/orders/${id}/ready`),
  updateItemStatus:  (id: string, status: string) => rawApiClient.patch(`${BASE}/kitchen/items/${id}/status`, { status }),

  // Printer profiles
  getPrinterProfiles:  (): Promise<PrinterProfile[]> => rawApiClient.get(`${BASE}/printer-profiles`),
  createPrinterProfile:(p: { name: string; type: string; connectionType: string; ipAddress?: string | null; port?: number | null; isDefault: boolean; branchId?: string | null }): Promise<PrinterProfile> =>
    rawApiClient.post(`${BASE}/printer-profiles`, p),
  updatePrinterProfile:(id: string, p: { name: string; type: string; connectionType: string; ipAddress?: string | null; port?: number | null; isDefault: boolean }): Promise<PrinterProfile> =>
    rawApiClient.put(`${BASE}/printer-profiles/${id}`, p),
  deletePrinterProfile:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/printer-profiles/${id}`),

  // Kitchen stations
  getKitchenStations:  (): Promise<KitchenStation[]> => rawApiClient.get(`${BASE}/kitchen-stations`),
  createKitchenStation:(p: { name: string; displayName?: string | null; colorTag?: string | null; sortOrder: number; printerProfileId?: string | null; branchId?: string | null }): Promise<KitchenStation> =>
    rawApiClient.post(`${BASE}/kitchen-stations`, p),
  updateKitchenStation:(id: string, p: { name: string; displayName?: string | null; colorTag?: string | null; sortOrder: number; printerProfileId?: string | null }): Promise<KitchenStation> =>
    rawApiClient.put(`${BASE}/kitchen-stations/${id}`, p),
  deleteKitchenStation:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/kitchen-stations/${id}`),

  // Combos
  getCombos:    (activeOnly?: boolean): Promise<Combo[]> =>
    rawApiClient.get(`${BASE}/combos${activeOnly ? "?activeOnly=true" : ""}`),
  createCombo:  (p: { name: string; price: number; items: ComboItemInput[] }): Promise<Combo> =>
    rawApiClient.post(`${BASE}/combos`, p),
  updateCombo:  (id: string, p: { name: string; price: number; isActive: boolean; items: ComboItemInput[] }): Promise<Combo> =>
    rawApiClient.put(`${BASE}/combos/${id}`, p),
  deleteCombo:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/combos/${id}`),

  // Happy hour rules
  getHappyHourRules:  (): Promise<HappyHourRule[]> => rawApiClient.get(`${BASE}/happy-hour-rules`),
  createHappyHourRule:(p: Omit<HappyHourRule, "id">): Promise<HappyHourRule> =>
    rawApiClient.post(`${BASE}/happy-hour-rules`, p),
  updateHappyHourRule:(id: string, p: Omit<HappyHourRule, "id">): Promise<HappyHourRule> =>
    rawApiClient.put(`${BASE}/happy-hour-rules/${id}`, p),
  deleteHappyHourRule:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/happy-hour-rules/${id}`),

  // Delivery zones
  getDeliveryZones:  (): Promise<DeliveryZone[]> => rawApiClient.get(`${BASE}/delivery-zones`),
  createDeliveryZone:(p: { name: string; postalCodesJson?: string | null; deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; branchId?: string | null }): Promise<DeliveryZone> =>
    rawApiClient.post(`${BASE}/delivery-zones`, p),
  updateDeliveryZone:(id: string, p: { name: string; postalCodesJson?: string | null; deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; isActive: boolean }): Promise<DeliveryZone> =>
    rawApiClient.put(`${BASE}/delivery-zones/${id}`, p),
  deleteDeliveryZone:(id: string): Promise<void> => rawApiClient.delete(`${BASE}/delivery-zones/${id}`),

  // Drivers
  getDrivers:   (activeOnly?: boolean): Promise<Driver[]> =>
    rawApiClient.get(`${BASE}/drivers${activeOnly ? "?activeOnly=true" : ""}`),
  createDriver: (p: { name: string; phone: string; vehicleInfo?: string | null; linkedUserId?: string | null; branchId?: string | null }): Promise<Driver> =>
    rawApiClient.post(`${BASE}/drivers`, p),
  updateDriver: (id: string, p: { name: string; phone: string; vehicleInfo?: string | null; isActive: boolean }): Promise<Driver> =>
    rawApiClient.put(`${BASE}/drivers/${id}`, p),
  deleteDriver: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/drivers/${id}`),

  // Delivery orders
  getDeliveryProviders:(): Promise<DeliveryProvider[]> => rawApiClient.get(`${BASE}/delivery/providers`),
  getDeliverySummary:  (): Promise<DeliverySummary> => rawApiClient.get(`${BASE}/delivery/summary`),
  getDeliveryOrders:   (status?: string): Promise<DeliveryOrder[]> =>
    rawApiClient.get(`${BASE}/delivery${status ? `?status=${status}` : ""}`),
  getDeliveryOrder:    (id: string): Promise<DeliveryOrder> => rawApiClient.get(`${BASE}/delivery/${id}`),
  createDeliveryOrder: (p: { orderId: string; address: string; phone: string; deliveryZoneId?: string | null; providerKey?: string }): Promise<DeliveryOrder> =>
    rawApiClient.post(`${BASE}/delivery`, p),
  assignDriverToDelivery: (id: string, driverId: string): Promise<DeliveryOrder> =>
    rawApiClient.patch(`${BASE}/delivery/${id}/driver`, { driverId }),
  changeDeliveryStatus:   (id: string, status: DeliveryStatus): Promise<DeliveryOrder> =>
    rawApiClient.patch(`${BASE}/delivery/${id}/status`, { status }),
  // No auth header needed — anonymous customer tracking page.
  trackDelivery: (token: string): Promise<DeliveryTracking> => rawApiClient.get(`${BASE}/delivery/track/${token}`),

  // QR code + digital receipts
  getTableQrCode: (id: string): Promise<TableQrCode> => rawApiClient.get(`${BASE}/tables/${id}/qr-code`),
  sendReceipt:    (orderId: string, p: { channel: "email" | "sms" | "whatsapp"; recipientAddress: string }): Promise<SendReceiptResult> =>
    rawApiClient.post(`${BASE}/orders/${orderId}/send-receipt`, p),
};

export const RESTAURANT_HUB_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/hubs/restaurant`;
