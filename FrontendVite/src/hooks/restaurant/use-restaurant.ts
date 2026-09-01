import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  restaurantApi, type DiscountType, type OrderLineInput, type SplitGroupInput, type TableStatus,
  type TableShape, type DiningAreaType, type ReservationRule, type ComboItemInput, type ComboSelectionInput,
  type HappyHourRule, type DeliveryStatus,
} from "@/lib/restaurant/restaurant.api";
import { toast } from "sonner";

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
  return useQuery({ queryKey: rKeys.tables(), queryFn: restaurantApi.getTables, refetchInterval: 15_000 });
}
export function useTablesSummary() {
  return useQuery({ queryKey: rKeys.tablesSummary(), queryFn: restaurantApi.getTablesSummary, refetchInterval: 15_000 });
}
export function useMenu() {
  return useQuery({ queryKey: rKeys.menu(), queryFn: restaurantApi.getMenu, staleTime: 120_000 });
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
  return useQuery({
    queryKey: [...rKeys.orders(), params],
    queryFn: () => restaurantApi.getOrders(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });
}
export function useOrdersSummary() {
  return useQuery({ queryKey: rKeys.ordersSummary(), queryFn: restaurantApi.getOrdersSummary, refetchInterval: 15_000 });
}
export function useKitchenTickets(stationId?: string) {
  return useQuery({
    queryKey: [...rKeys.kitchen(), stationId ?? "all"],
    queryFn: () => restaurantApi.getKitchenTickets(stationId),
    refetchInterval: 10_000,
  });
}
export function useKitchenSummary() {
  return useQuery({ queryKey: rKeys.kitchenSummary(), queryFn: restaurantApi.getKitchenSummary, refetchInterval: 10_000 });
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
  const invalidate = useInvalidateAll();
  return useMutation({
    // Mirrors restaurantApi.createTable / backend CreateTableCommand — branchId + diningAreaId
    // are both optional and are persisted by CreateTableHandler.
    mutationFn: (p: { tableNumber: string; section: string; capacity: number; branchId?: string | null; diningAreaId?: string | null }) => restaurantApi.createTable(p),
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
  return useMutation({
    mutationFn: (p: { tableId: string | null; waiter: string; covers: number; orderType: string; notes?: string | null; items: OrderLineInput[]; branchId?: string | null; sessionId?: string | null; customerId?: string | null }) =>
      restaurantApi.createOrder(p),
    onSuccess: () => { invalidate(); toast.success("Order opened."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddItems() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: OrderLineInput[] }) => restaurantApi.addItems(id, items),
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
  return useMutation({
    mutationFn: (id: string) => restaurantApi.sendToKitchen(id),
    onSuccess: () => { invalidate(); toast.success("Sent to kitchen."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useServeOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.serve(id),
    onSuccess: () => { invalidate(); toast.success("Order served."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePayOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => restaurantApi.pay(id, method),
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

export function useSetOrderCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, customerId }: { id: string; customerId: string | null }) => restaurantApi.setCustomer(id, customerId),
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
  return useMutation({
    mutationFn: ({ id, method, amount, reference }: { id: string; method: string; amount: number; reference?: string | null }) =>
      restaurantApi.addPayment(id, { method, amount, reference }),
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
  return useQuery({ queryKey: rKeys.floors(), queryFn: restaurantApi.getFloors, staleTime: 60_000 });
}

export function useFloorLayout() {
  return useQuery({ queryKey: rKeys.floorLayout(), queryFn: restaurantApi.getFloorLayout, refetchInterval: 15_000 });
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
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; sortOrder: number; branchId?: string | null }) => restaurantApi.createFloor(p),
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
  return useQuery({ queryKey: [...rKeys.waitlist(), status ?? "all"], queryFn: () => restaurantApi.getWaitlist(status), refetchInterval: 15_000 });
}

export function useWaitlistSummary() {
  return useQuery({ queryKey: rKeys.waitlistSummary(), queryFn: restaurantApi.getWaitlistSummary, refetchInterval: 15_000 });
}

export function useAddToWaitlist() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { guestName: string; guestPhone: string; partySize: number; quotedWaitMinutes: number; notes?: string | null }) =>
      restaurantApi.addToWaitlist(p),
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
  return useQuery({ queryKey: [...rKeys.reservations(), date ?? "all"], queryFn: () => restaurantApi.getReservations(date), refetchInterval: 30_000 });
}

export function useReservationsSummary() {
  return useQuery({ queryKey: rKeys.reservationsSummary(), queryFn: restaurantApi.getReservationsSummary, refetchInterval: 30_000 });
}

export function useReservationRule(branchId?: string | null) {
  return useQuery({ queryKey: rKeys.reservationRule(branchId), queryFn: () => restaurantApi.getReservationRule(branchId), staleTime: 60_000 });
}

export function useCreateReservation() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { guestName: string; guestPhone: string; guestEmail?: string | null; covers: number; reservationDate: string; reservationTime: string; specialRequests?: string | null; tableId?: string | null; arrivalWindowStart?: string | null; arrivalWindowEnd?: string | null }) =>
      restaurantApi.createReservation(p),
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
  return useQuery({ queryKey: rKeys.drivers(activeOnly), queryFn: () => restaurantApi.getDrivers(activeOnly), staleTime: 30_000 });
}

export function useCreateDriver() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { name: string; phone: string; vehicleInfo?: string | null; linkedUserId?: string | null; branchId?: string | null }) =>
      restaurantApi.createDriver(p),
    onSuccess: () => { invalidate(); toast.success("Driver added."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDriver() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; name: string; phone: string; vehicleInfo?: string | null; isActive: boolean }) =>
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
  return useQuery({ queryKey: rKeys.deliverySummary(), queryFn: restaurantApi.getDeliverySummary, refetchInterval: 15_000 });
}

export function useDeliveryOrders(status?: string) {
  return useQuery({ queryKey: rKeys.deliveryOrders(status), queryFn: () => restaurantApi.getDeliveryOrders(status), refetchInterval: 15_000 });
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
    mutationFn: ({ orderId, channel, recipientAddress }: { orderId: string; channel: "email" | "whatsapp"; recipientAddress: string }) =>
      restaurantApi.sendReceipt(orderId, { channel, recipientAddress }),
    onSuccess: (res) => { if (res.success) toast.success(`Receipt sent via ${res.channel}.`); else toast.error(`Couldn't send via ${res.channel} — check configuration.`); },
    onError: (e: Error) => toast.error(e.message),
  });
}
