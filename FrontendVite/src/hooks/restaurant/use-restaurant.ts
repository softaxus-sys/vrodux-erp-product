import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  restaurantApi, type DiscountType, type OrderLineInput, type SplitGroupInput, type TableStatus,
  type TableShape, type DiningAreaType, type ReservationRule, type ComboItemInput, type ComboSelectionInput,
  type HappyHourRule, type DeliveryStatus, type ImportMenuRow,
} from "@/lib/restaurant/restaurant.api";
import { toast } from "sonner";
import { taxApi } from "@/lib/restaurant/tax-platforms.api";
import { useBranchStore } from "@/store/branch.store";
import { useRestaurantOffline, isNetworkError, type RestaurantOfflineValue } from "@/contexts/restaurant-offline-context";
import { isLocalOrderId, type RestaurantOffline } from "@/lib/restaurant/offline/restaurant-offline";
import type { PagedOrders, RestaurantOrder } from "@/lib/restaurant/restaurant.api";

// ── Offline-aware reads and writes (restaurant till only) ─────────────────────────
// Outside the till there is no offline provider and these behave exactly like plain API calls.

/** Read from the server and keep the till's copy fresh; read the copy when the server can't be reached. */
function offlineRead<T>(
  off: RestaurantOfflineValue | null,
  live: () => Promise<T>,
  local: (e: RestaurantOffline) => Promise<T>,
  remember?: (e: RestaurantOffline, data: T) => Promise<void> | void,
): () => Promise<T> {
  return async () => {
    if (off?.offline) return local(off.engine);
    try {
      const data = await live();
      if (off && remember) Promise.resolve(remember(off.engine, data)).catch(() => undefined);
      return data;
    } catch (e) {
      if (off && isNetworkError(e)) { off.markUnreachable(); return local(off.engine); }
      throw e;
    }
  };
}

/** Saves to the server, or to the till's queue while offline. A bill taken offline stays on the queue
 * until it has uploaded — the server does not know its id yet. */
async function offlineWrite<T>(
  off: RestaurantOfflineValue | null,
  orderId: string | null,
  live: () => Promise<T>,
  local: (e: RestaurantOffline) => Promise<T>,
): Promise<T> {
  if (off && (off.offline || (orderId !== null && isLocalOrderId(orderId)))) return local(off.engine);
  try {
    return await live();
  } catch (e) {
    if (off && isNetworkError(e)) {
      off.markUnreachable();
      // The request may or may not have reached the server, so retrying blind could charge twice.
      throw new Error("The connection dropped while saving. Check the bill before trying again — it may already have been saved.");
    }
    throw e;
  }
}

function offlineKey(off: RestaurantOfflineValue | null) { return off?.offline ? "offline" : "online"; }

/** The restaurant branch selected in the switcher; null = "All Branches". Every branch-scoped read
 * sends it and keys its cache on it, so switching branch refetches instead of showing the last one. */
export function useActiveBranchId(): string | null {
  return useBranchStore(s => s.currentBranchId);
}

export const rKeys = {
  all:            ["restaurant"] as const,
  tables:         () => [...rKeys.all, "tables"] as const,
  tablesSummary:  () => [...rKeys.all, "tables-summary"] as const,
  menu:           () => [...rKeys.all, "menu"] as const,
  menuSummary:    () => [...rKeys.all, "menu-summary"] as const,
  modifierGroups: () => [...rKeys.all, "modifier-groups"] as const,
  itemModifierGroups: (itemId: string) => [...rKeys.all, "item-modifier-groups", itemId] as const,
  orders:         () => [...rKeys.all, "orders"] as const,
  ordersSummary:  () => [...rKeys.all, "orders-summary"] as const,
  kitchen:        () => [...rKeys.all, "kitchen"] as const,
  kitchenSummary: () => [...rKeys.all, "kitchen-summary"] as const,
  floors:         () => [...rKeys.all, "floors"] as const,
  floorLayout:    () => [...rKeys.all, "floor-layout"] as const,
  diningAreas:    (floorId: string) => [...rKeys.all, "dining-areas", floorId] as const,
  waitlist:       () => [...rKeys.all, "waitlist"] as const,
  waitlistSummary:() => [...rKeys.all, "waitlist-summary"] as const,
  reservations:       () => [...rKeys.all, "reservations"] as const,
  reservationsSummary:() => [...rKeys.all, "reservations-summary"] as const,
  reservationRule:    (branchId?: string | null) => [...rKeys.all, "reservation-rule", branchId ?? "default"] as const,
  printerProfiles:    () => [...rKeys.all, "printer-profiles"] as const,
  kitchenStations:    () => [...rKeys.all, "kitchen-stations"] as const,
  combos:             (activeOnly?: boolean) => [...rKeys.all, "combos", activeOnly ? "active" : "all"] as const,
  happyHourRules:     () => [...rKeys.all, "happy-hour-rules"] as const,
  deliveryZones:      () => [...rKeys.all, "delivery-zones"] as const,
  drivers:            (activeOnly?: boolean) => [...rKeys.all, "drivers", activeOnly ? "active" : "all"] as const,
  deliveryProviders:  () => [...rKeys.all, "delivery-providers"] as const,
  deliverySummary:    () => [...rKeys.all, "delivery-summary"] as const,
  deliveryOrders:     (status?: string) => [...rKeys.all, "delivery-orders", status ?? "all"] as const,
  deliveryOrder:      (id: string) => [...rKeys.all, "delivery-order", id] as const,
  tableQrCode:        (id: string) => [...rKeys.all, "table-qr-code", id] as const,
};

// ── Queries ────────────────────────────────────────────────────────────────────

export function useTables() {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  return useQuery({ queryKey: [...rKeys.tables(), b, offlineKey(off)],
    queryFn: offlineRead(off, () => restaurantApi.getTables(b), e => e.getTables(b), (e, d) => e.remember(b, { tables: d })), refetchInterval: 15_000 });
}
export function useTablesSummary() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.tablesSummary(), b], queryFn: () => restaurantApi.getTablesSummary(b), refetchInterval: 15_000 });
}
/** The tax a new bill at the active branch is charged. Kept on the till so offline bills match. */
export function useCurrentTax() {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  return useQuery({ queryKey: [...rKeys.all, "current-tax", b],
    queryFn: offlineRead(off, () => taxApi.current(b), e => e.getTax(b), (e, d) => e.remember(b, { tax: d })), staleTime: 300_000 });
}

/** Pass forBranch=false for menu management, which edits the shared menu rather than one branch's view. */
export function useMenu(forBranch = true) {
  const active = useActiveBranchId();
  const b = forBranch ? active : null;
  const off = useRestaurantOffline();
  // Only the till's branch view is kept offline; menu management edits the shared menu online.
  const o = forBranch ? off : null;
  return useQuery({ queryKey: [...rKeys.menu(), b, offlineKey(o)],
    queryFn: offlineRead(o, () => restaurantApi.getMenu(b), e => e.getMenu(b), (e, d) => e.remember(b, { menu: d })), staleTime: 120_000 });
}
export function useMenuSummary() {
  return useQuery({ queryKey: rKeys.menuSummary(), queryFn: restaurantApi.getMenuSummary, staleTime: 60_000 });
}
export function useModifierGroups() {
  return useQuery({ queryKey: rKeys.modifierGroups(), queryFn: restaurantApi.getModifierGroups, staleTime: 60_000 });
}
export function useItemModifierGroups(itemId: string | null) {
  return useQuery({
    queryKey: rKeys.itemModifierGroups(itemId ?? ""),
    queryFn: () => restaurantApi.getItemModifierGroups(itemId!),
    enabled: !!itemId,
  });
}
/**
 * Orders, paged in SQL.
 *
 * The floor plan should pass status "open" — it only ever needs the order currently on each table,
 * which is bounded by table count. Without that it was reading every order the restaurant had ever
 * taken, with items and modifiers, every 15 seconds.
 */
export function useOrders(params: { status?: string; page?: number; pageSize?: number } = {}) {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  return useQuery({
    queryKey: [...rKeys.orders(), params, b, offlineKey(off)],
    queryFn: offlineRead<PagedOrders>(off,
      () => restaurantApi.getOrders({ ...params, branchId: b }),
      async e => pageOf(await e.getOpenOrders(b), params),
      // Only the "open" list is the till's working set of bills.
      (e, d) => (params.status === "open" ? e.remember(b, {}, d.items) : undefined)),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });
}
export function useOrdersSummary() {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  return useQuery({ queryKey: [...rKeys.ordersSummary(), b, offlineKey(off)],
    queryFn: offlineRead(off, () => restaurantApi.getOrdersSummary(b), async e => summaryOf(await e.getOpenOrders(b))), refetchInterval: 15_000 });
}
export function useKitchenTickets(stationId?: string) {
  const b = useActiveBranchId();
  return useQuery({
    queryKey: [...rKeys.kitchen(), stationId ?? "all", b],
    queryFn: () => restaurantApi.getKitchenTickets(stationId, b),
    refetchInterval: 10_000,
  });
}
export function useKitchenSummary() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.kitchenSummary(), b], queryFn: () => restaurantApi.getKitchenSummary(b), refetchInterval: 10_000 });
}
export function usePrinterProfiles() {
  return useQuery({ queryKey: rKeys.printerProfiles(), queryFn: restaurantApi.getPrinterProfiles, staleTime: 60_000 });
}
export function useKitchenStations() {
  return useQuery({ queryKey: rKeys.kitchenStations(), queryFn: restaurantApi.getKitchenStations, staleTime: 60_000 });
}
export function useCombos(activeOnly?: boolean) {
  return useQuery({ queryKey: rKeys.combos(activeOnly), queryFn: () => restaurantApi.getCombos(activeOnly), staleTime: 60_000 });
}
export function useHappyHourRules() {
  return useQuery({ queryKey: rKeys.happyHourRules(), queryFn: restaurantApi.getHappyHourRules, staleTime: 60_000 });
}

// ── Mutations ────────────────────────────────────────────────────────────────────

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: rKeys.all });
}

export function useCreateTable() {
  // New records belong to the branch selected in the switcher unless the form names one.
  const branch = useActiveBranchId();
  const invalidate = useInvalidateAll();
  return useMutation({
    // Mirrors restaurantApi.createTable / backend CreateTableCommand — branchId + diningAreaId
    // are both optional and are persisted by CreateTableHandler.
    mutationFn: (p: { tableNumber: string; section: string; capacity: number; branchId?: string | null; diningAreaId?: string | null }) => restaurantApi.createTable({ ...p, branchId: (p as { branchId?: string | null }).branchId ?? branch }),
    onSuccess: () => { invalidate(); toast.success("Table added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetTableStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) => restaurantApi.setTableStatus(id, status),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateOrder() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  return useMutation({
    mutationFn: (p: { tableId: string | null; waiter: string; covers: number; orderType: string; notes?: string | null; items: OrderLineInput[]; branchId?: string | null; sessionId?: string | null; customerId?: string | null }) =>
      offlineWrite(off, null, () => restaurantApi.createOrder(p), e => e.createOrder(p)),
    onSuccess: () => { invalidate(); toast.success("Order opened."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddItems() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  const b = useActiveBranchId();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: OrderLineInput[] }) =>
      offlineWrite(off, id, () => restaurantApi.addItems(id, items), e => e.addItems(b, id, items)),
    onSuccess: () => { invalidate(); toast.success("Items added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVoidItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, itemId, reason }: { id: string; itemId: string; reason: string }) =>
      restaurantApi.voidItem(id, itemId, reason),
    onSuccess: () => { invalidate(); toast.success("Item voided."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendToKitchen() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  const b = useActiveBranchId();
  return useMutation({
    mutationFn: (id: string) => offlineWrite(off, id, () => restaurantApi.sendToKitchen(id), e => e.send(b, id)),
    onSuccess: () => { invalidate(); toast.success("Sent to kitchen."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useServeOrder() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  const b = useActiveBranchId();
  return useMutation({
    mutationFn: (id: string) => offlineWrite(off, id, () => restaurantApi.serve(id), e => e.serve(b, id)),
    onSuccess: () => { invalidate(); toast.success("Order served."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePayOrder() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  const b = useActiveBranchId();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) =>
      offlineWrite(off, id, () => restaurantApi.pay(id, method), e => e.payInFull(b, id, method)),
    onSuccess: () => { invalidate(); toast.success("Payment recorded."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => restaurantApi.cancel(id, reason),
    onSuccess: () => { invalidate(); toast.success("Order cancelled."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyOrderDiscount() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, type, amount, reason }: { id: string; type: DiscountType; amount: number; reason: string }) =>
      restaurantApi.applyDiscount(id, { type, amount, reason }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveOrderDiscount() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => restaurantApi.removeDiscount(id, reason),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRefundOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, amount, reason, method }: { id: string; amount: number; reason: string; method: string }) =>
      restaurantApi.refund(id, { amount, reason, method }),
    onSuccess: () => { invalidate(); toast.success("Refund recorded."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSplitOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, groups }: { id: string; groups: SplitGroupInput[] }) => restaurantApi.splitOrder(id, groups),
    onSuccess: () => { invalidate(); toast.success("Bill split."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetOrderTip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => restaurantApi.setTip(id, amount),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** For floor staff only — polled, so the banner clears soon after the cashier opens the till. */
export function useOpenShift(enabled = true) {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  // Offline the till cannot know whether the cashier's shift is still open; it does not warn.
  return useQuery({ queryKey: [...rKeys.all, "open-shift", b, offlineKey(off)],
    queryFn: offlineRead(off, () => restaurantApi.getOpenShift(b), async () => ({ isOpen: true, sessionId: null })), enabled, refetchInterval: 30_000 });
}

export function useRedeemOrderLoyalty() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, points }: { id: string; points: number }) => restaurantApi.redeemLoyalty(id, points),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetOrderCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, customerId }: { id: string; customerId: string | null }) => restaurantApi.setCustomer(id, customerId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Refreshes every restaurant query — for flows that write through the API client directly. */
export function useInvalidateRestaurant() {
  return useInvalidateAll();
}

/** No success toast: the import dialog shows its own summary. */
export function useImportMenu() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (rows: ImportMenuRow[]) => restaurantApi.importMenu(rows),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddItemImages() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ itemId, images }: { itemId: string; images: { data: string; fileName?: string }[] }) =>
      restaurantApi.addItemImages(itemId, images),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteItemImage() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ itemId, imageId }: { itemId: string; imageId: string }) => restaurantApi.deleteItemImage(itemId, imageId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetPrimaryItemImage() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ itemId, imageId }: { itemId: string; imageId: string }) => restaurantApi.setPrimaryItemImage(itemId, imageId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetOrderWaiter() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, waiter }: { id: string; waiter: string }) => restaurantApi.setWaiter(id, waiter),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useHoldOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.hold(id),
    onSuccess: () => { invalidate(); toast.success("Order held."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecallOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.recall(id),
    onSuccess: () => { invalidate(); toast.success("Order recalled."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddOrderPayment() {
  const invalidate = useInvalidateAll();
  const off = useRestaurantOffline();
  const b = useActiveBranchId();
  return useMutation({
    mutationFn: ({ id, method, amount, reference }: { id: string; method: string; amount: number; reference?: string | null }) =>
      offlineWrite(off, id, () => restaurantApi.addPayment(id, { method, amount, reference }),
        e => e.addPayment(b, id, { method, amount, reference })),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetItemAvailability() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => restaurantApi.setItemAvailability(id, isAvailable),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkOrderReady() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.markOrderReady(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTransferOrderTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, toTableId }: { id: string; toTableId: string }) => restaurantApi.transferTable(id, toTableId),
    onSuccess: () => { invalidate(); toast.success("Order transferred."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Floors / Dining Areas / Table layout ──────────────────────────────────────

export function useFloors() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.floors(), b], queryFn: () => restaurantApi.getFloors(b), staleTime: 60_000 });
}

export function useFloorLayout() {
  const b = useActiveBranchId();
  const off = useRestaurantOffline();
  return useQuery({ queryKey: [...rKeys.floorLayout(), b, offlineKey(off)],
    queryFn: offlineRead(off, () => restaurantApi.getFloorLayout(b), e => e.getLayout(b), (e, d) => e.remember(b, { layout: d })), refetchInterval: 15_000 });
}

export function useDiningAreas(floorId: string, enabled = true) {
  return useQuery({
    queryKey: rKeys.diningAreas(floorId),
    queryFn: () => restaurantApi.getDiningAreas(floorId),
    enabled: enabled && !!floorId,
    staleTime: 60_000,
  });
}

export function useCreateFloor() {
  // New records belong to the branch selected in the switcher unless the form names one.
  const branch = useActiveBranchId();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; sortOrder: number; branchId?: string | null }) => restaurantApi.createFloor({ ...p, branchId: (p as { branchId?: string | null }).branchId ?? branch }),
    onSuccess: () => { invalidate(); toast.success("Floor added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFloor() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: string; name: string; sortOrder: number }) => restaurantApi.updateFloor(id, { name, sortOrder }),
    onSuccess: () => { invalidate(); toast.success("Floor updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFloor() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteFloor(id),
    onSuccess: () => { invalidate(); toast.success("Floor deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateDiningArea() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ floorId, name, type, sortOrder }: { floorId: string; name: string; type: DiningAreaType; sortOrder: number }) =>
      restaurantApi.createDiningArea(floorId, { name, type, sortOrder }),
    onSuccess: () => { invalidate(); toast.success("Dining area added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDiningArea() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ floorId, id, name, type, sortOrder }: { floorId: string; id: string; name: string; type: DiningAreaType; sortOrder: number }) =>
      restaurantApi.updateDiningArea(floorId, id, { name, type, sortOrder }),
    onSuccess: () => { invalidate(); toast.success("Dining area updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDiningArea() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ floorId, id }: { floorId: string; id: string }) => restaurantApi.deleteDiningArea(floorId, id),
    onSuccess: () => { invalidate(); toast.success("Dining area deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, tableNumber, section, capacity, diningAreaId }: { id: string; tableNumber: string; section: string; capacity: number; diningAreaId?: string | null }) =>
      restaurantApi.updateTable(id, { tableNumber, section, capacity, diningAreaId }),
    onSuccess: () => { invalidate(); toast.success("Table updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteTable(id),
    onSuccess: () => { invalidate(); toast.success("Table deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRepositionTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, posX, posY, shape, rotation }: { id: string; posX: number; posY: number; shape: TableShape; rotation: number }) =>
      restaurantApi.repositionTable(id, { posX, posY, shape, rotation }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveTableLayout() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (tables: { id: string; posX: number; posY: number; shape: TableShape; rotation: number }[]) =>
      restaurantApi.saveTableLayout(tables),
    onSuccess: () => { invalidate(); toast.success("Layout saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMergeTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, targetTableId }: { id: string; targetTableId: string }) => restaurantApi.mergeTable(id, targetTableId),
    onSuccess: () => { invalidate(); toast.success("Tables merged."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnmergeTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.unmergeTable(id),
    onSuccess: () => { invalidate(); toast.success("Tables unmerged."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Waitlist ───────────────────────────────────────────────────────────────────

export function useWaitlist(status?: string) {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.waitlist(), status ?? "all", b], queryFn: () => restaurantApi.getWaitlist(status, b), refetchInterval: 15_000 });
}

export function useWaitlistSummary() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.waitlistSummary(), b], queryFn: () => restaurantApi.getWaitlistSummary(b), refetchInterval: 15_000 });
}

export function useAddToWaitlist() {
  // New records belong to the branch selected in the switcher unless the form names one.
  const branch = useActiveBranchId();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { guestName: string; guestPhone: string; partySize: number; quotedWaitMinutes: number; notes?: string | null }) =>
      restaurantApi.addToWaitlist({ ...p, branchId: (p as { branchId?: string | null }).branchId ?? branch }),
    onSuccess: () => { invalidate(); toast.success("Added to waitlist."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSeatWaitlistEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) => restaurantApi.seatWaitlistEntry(id, tableId),
    onSuccess: () => { invalidate(); toast.success("Guest seated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelWaitlistEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.cancelWaitlistEntry(id),
    onSuccess: () => { invalidate(); toast.success("Removed from waitlist."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useNoShowWaitlistEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.noShowWaitlistEntry(id),
    onSuccess: () => { invalidate(); toast.success("Marked as no-show."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Reservations ───────────────────────────────────────────────────────────────

export function useReservations(date?: string) {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.reservations(), date ?? "all", b], queryFn: () => restaurantApi.getReservations(date, b), refetchInterval: 30_000 });
}

export function useReservationsSummary() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.reservationsSummary(), b], queryFn: () => restaurantApi.getReservationsSummary(b), refetchInterval: 30_000 });
}

export function useReservationRule(branchId?: string | null) {
  return useQuery({ queryKey: rKeys.reservationRule(branchId), queryFn: () => restaurantApi.getReservationRule(branchId), staleTime: 60_000 });
}

export function useCreateReservation() {
  // New records belong to the branch selected in the switcher unless the form names one.
  const branch = useActiveBranchId();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { guestName: string; guestPhone: string; guestEmail?: string | null; covers: number; reservationDate: string; reservationTime: string; specialRequests?: string | null; tableId?: string | null; arrivalWindowStart?: string | null; arrivalWindowEnd?: string | null }) =>
      restaurantApi.createReservation({ ...p, branchId: (p as { branchId?: string | null }).branchId ?? branch }),
    onSuccess: () => { invalidate(); toast.success("Reservation created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSeatReservation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.seatReservation(id),
    onSuccess: () => { invalidate(); toast.success("Guest seated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelReservation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.cancelReservation(id),
    onSuccess: () => { invalidate(); toast.success("Reservation cancelled."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveReservationRule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: Omit<ReservationRule, "id">) => restaurantApi.saveReservationRule(p),
    onSuccess: () => { invalidate(); toast.success("Reservation policy saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Kitchen item status / course firing / combos (Epic 5) ─────────────────────

export function useUpdateOrderItemStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => restaurantApi.updateItemStatus(id, status),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFireNextCourse() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.fireNextCourse(id),
    onSuccess: () => { invalidate(); toast.success("Next course fired."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddCombo() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, comboId, selections }: { id: string; comboId: string; selections: ComboSelectionInput[] }) =>
      restaurantApi.addCombo(id, { comboId, selections }),
    onSuccess: () => { invalidate(); toast.success("Combo added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Printer profiles ───────────────────────────────────────────────────────────

export function useCreatePrinterProfile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; type: string; connectionType: string; ipAddress?: string | null; port?: number | null; isDefault: boolean; branchId?: string | null }) =>
      restaurantApi.createPrinterProfile(p),
    onSuccess: () => { invalidate(); toast.success("Printer added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePrinterProfile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; type: string; connectionType: string; ipAddress?: string | null; port?: number | null; isDefault: boolean }) =>
      restaurantApi.updatePrinterProfile(id, p),
    onSuccess: () => { invalidate(); toast.success("Printer updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePrinterProfile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deletePrinterProfile(id),
    onSuccess: () => { invalidate(); toast.success("Printer deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Kitchen stations ───────────────────────────────────────────────────────────

export function useCreateKitchenStation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; displayName?: string | null; colorTag?: string | null; sortOrder: number; printerProfileId?: string | null; branchId?: string | null }) =>
      restaurantApi.createKitchenStation(p),
    onSuccess: () => { invalidate(); toast.success("Station added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateKitchenStation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; displayName?: string | null; colorTag?: string | null; sortOrder: number; printerProfileId?: string | null }) =>
      restaurantApi.updateKitchenStation(id, p),
    onSuccess: () => { invalidate(); toast.success("Station updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteKitchenStation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteKitchenStation(id),
    onSuccess: () => { invalidate(); toast.success("Station deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetItemStation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, kitchenStationId }: { id: string; kitchenStationId: string | null }) =>
      restaurantApi.setItemStation(id, kitchenStationId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetCategoryStation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, kitchenStationId }: { id: string; kitchenStationId: string | null }) =>
      restaurantApi.setCategoryStation(id, kitchenStationId),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Menu management (categories / items / modifier groups) ─────────────────────

export function useCreateCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; description?: string | null; sortOrder: number; kitchenStationId?: string | null }) =>
      restaurantApi.createCategory(p),
    onSuccess: () => { invalidate(); toast.success("Category added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; description?: string | null; sortOrder: number }) =>
      restaurantApi.updateCategory(id, p),
    onSuccess: () => { invalidate(); toast.success("Category updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteCategory(id),
    onSuccess: () => { invalidate(); toast.success("Category deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateMenuItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { categoryId: string; name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; kitchenStationId?: string | null }) =>
      restaurantApi.createItem(p),
    onSuccess: () => { invalidate(); toast.success("Menu item added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMenuItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; isOnlineOrderable: boolean }) =>
      restaurantApi.updateItem(id, p),
    onSuccess: () => { invalidate(); toast.success("Menu item updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteItem(id),
    onSuccess: () => { invalidate(); toast.success("Menu item deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignItemModifierGroups() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ itemId, modifierGroupIds }: { itemId: string; modifierGroupIds: string[] }) =>
      restaurantApi.assignItemModifierGroups(itemId, modifierGroupIds),
    onSuccess: () => { invalidate(); toast.success("Modifier groups updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateModifierGroup() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }) =>
      restaurantApi.createModifierGroup(p),
    onSuccess: () => { invalidate(); toast.success("Modifier group added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateModifierGroup() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }) =>
      restaurantApi.updateModifierGroup(id, p),
    onSuccess: () => { invalidate(); toast.success("Modifier group updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteModifierGroup() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteModifierGroup(id),
    onSuccess: () => { invalidate(); toast.success("Modifier group deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Combos ─────────────────────────────────────────────────────────────────────

export function useCreateCombo() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; price: number; items: ComboItemInput[] }) => restaurantApi.createCombo(p),
    onSuccess: () => { invalidate(); toast.success("Combo created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCombo() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; price: number; isActive: boolean; items: ComboItemInput[] }) =>
      restaurantApi.updateCombo(id, p),
    onSuccess: () => { invalidate(); toast.success("Combo updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCombo() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteCombo(id),
    onSuccess: () => { invalidate(); toast.success("Combo deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Happy hour rules ───────────────────────────────────────────────────────────

export function useCreateHappyHourRule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: Omit<HappyHourRule, "id">) => restaurantApi.createHappyHourRule(p),
    onSuccess: () => { invalidate(); toast.success("Happy hour rule created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHappyHourRule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Omit<HappyHourRule, "id">) => restaurantApi.updateHappyHourRule(id, p),
    onSuccess: () => { invalidate(); toast.success("Happy hour rule updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHappyHourRule() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteHappyHourRule(id),
    onSuccess: () => { invalidate(); toast.success("Happy hour rule deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Delivery zones ─────────────────────────────────────────────────────────────

export function useDeliveryZones() {
  return useQuery({ queryKey: rKeys.deliveryZones(), queryFn: restaurantApi.getDeliveryZones, staleTime: 60_000 });
}

export function useCreateDeliveryZone() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; postalCodesJson?: string | null; deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; branchId?: string | null }) =>
      restaurantApi.createDeliveryZone(p),
    onSuccess: () => { invalidate(); toast.success("Delivery zone added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDeliveryZone() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; postalCodesJson?: string | null; deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; isActive: boolean }) =>
      restaurantApi.updateDeliveryZone(id, p),
    onSuccess: () => { invalidate(); toast.success("Delivery zone updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDeliveryZone() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteDeliveryZone(id),
    onSuccess: () => { invalidate(); toast.success("Delivery zone deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Drivers ────────────────────────────────────────────────────────────────────

export function useDrivers(activeOnly?: boolean) {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.drivers(activeOnly), b], queryFn: () => restaurantApi.getDrivers(activeOnly, b), staleTime: 30_000 });
}

export function useCreateDriver() {
  // New records belong to the branch selected in the switcher unless the form names one.
  const branch = useActiveBranchId();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; phone: string; vehicleInfo?: string | null; linkedUserId?: string | null; branchId?: string | null }) =>
      restaurantApi.createDriver({ ...p, branchId: (p as { branchId?: string | null }).branchId ?? branch }),
    onSuccess: () => { invalidate(); toast.success("Driver added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDriver() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; phone: string; vehicleInfo?: string | null; isActive: boolean; linkedUserId?: string | null }) =>
      restaurantApi.updateDriver(id, p),
    onSuccess: () => { invalidate(); toast.success("Driver updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDriver() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteDriver(id),
    onSuccess: () => { invalidate(); toast.success("Driver deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Delivery orders ────────────────────────────────────────────────────────────

export function useDeliveryProviders() {
  return useQuery({ queryKey: rKeys.deliveryProviders(), queryFn: restaurantApi.getDeliveryProviders, staleTime: 300_000 });
}

export function useDeliverySummary() {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.deliverySummary(), b], queryFn: () => restaurantApi.getDeliverySummary(b), refetchInterval: 15_000 });
}

export function useDeliveryOrders(status?: string, enabled = true) {
  const b = useActiveBranchId();
  return useQuery({ queryKey: [...rKeys.deliveryOrders(status), b], queryFn: () => restaurantApi.getDeliveryOrders(status, b), refetchInterval: 15_000, enabled });
}

export function useDeliveryOrder(id: string, enabled = true) {
  return useQuery({ queryKey: rKeys.deliveryOrder(id), queryFn: () => restaurantApi.getDeliveryOrder(id), enabled: enabled && !!id });
}

export function useCreateDeliveryOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { orderId: string; address: string; phone: string; deliveryZoneId?: string | null; providerKey?: string }) =>
      restaurantApi.createDeliveryOrder(p),
    onSuccess: () => { invalidate(); toast.success("Delivery created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignDriverToDelivery() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) => restaurantApi.assignDriverToDelivery(id, driverId),
    onSuccess: () => { invalidate(); toast.success("Driver assigned."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeDeliveryStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeliveryStatus }) => restaurantApi.changeDeliveryStatus(id, status),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTrackDelivery(token: string, enabled = true) {
  return useQuery({
    queryKey: ["delivery-tracking", token], queryFn: () => restaurantApi.trackDelivery(token),
    enabled: enabled && !!token, refetchInterval: 20_000, retry: false,
  });
}

// ── QR code + digital receipts ──────────────────────────────────────────────────

export function useTableQrCode(id: string, enabled = true) {
  return useQuery({ queryKey: rKeys.tableQrCode(id), queryFn: () => restaurantApi.getTableQrCode(id), enabled: enabled && !!id });
}

export function useSendReceipt() {
  return useMutation({
    // sms belongs here: the API accepts it and the receipt dialog offers it as a choice. Leaving it
    // out made picking SMS a type error at the only call site.
    mutationFn: ({ orderId, channel, recipientAddress }: { orderId: string; channel: "email" | "sms" | "whatsapp"; recipientAddress: string }) =>
      restaurantApi.sendReceipt(orderId, { channel, recipientAddress }),
    onSuccess: (res) => { if (res.success) toast.success(`Receipt sent via ${res.channel}.`); else toast.error(`Couldn't send via ${res.channel} — check configuration.`); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Per-branch menu (price / not sold here) ─────────────────────────────────────

export function useMenuBranchSettings(branchId: string | null) {
  return useQuery({
    queryKey: [...rKeys.menu(), "branch-settings", branchId],
    queryFn: () => restaurantApi.getMenuBranchSettings(branchId!),
    enabled: !!branchId,
  });
}

export function useSetMenuItemBranchSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { itemId: string; branchId: string; priceOverride: number | null; isAvailable: boolean }) =>
      restaurantApi.setMenuItemBranchSetting(p.itemId, p.branchId, { priceOverride: p.priceOverride, isAvailable: p.isAvailable }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: rKeys.menu() }); toast.success("Branch menu updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Offline: the till's bills as one page, newest first, filtered the way the server would. */
function pageOf(orders: RestaurantOrder[], params: { status?: string; page?: number; pageSize?: number }): PagedOrders {
  const live = (o: RestaurantOrder) => o.status !== "paid" && o.status !== "cancelled";
  const rows = orders
    .filter(o => !params.status || (params.status === "open" ? live(o) : o.status === params.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = params.page ?? 1, pageSize = params.pageSize ?? 30;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
           totalCount: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) };
}

/** Offline: the status counts the till can know from its own bills (no takings history). */
function summaryOf(orders: RestaurantOrder[]) {
  const n = (st: string) => orders.filter(o => o.status === st).length;
  const paidRevenue = orders.filter(o => o.status === "paid").reduce((t, o) => t + o.total, 0);
  return { total: orders.length, open: n("open"), sent: n("sent"), ready: n("ready"), served: n("served"),
           paid: n("paid"), cancelled: n("cancelled"), split: n("split"), held: n("held"),
           todayOrders: orders.length, todayRevenue: paidRevenue, totalRevenue: paidRevenue, totalTips: 0 };
}
