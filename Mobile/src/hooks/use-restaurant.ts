import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restaurantApi, type CreateOrderBody, type OrderLineBody } from "@/lib/restaurant.api";

const QK = "restaurant" as const;

/** Every order mutation invalidates the same three query groups: the order itself (so the detail
 *  screen reflects the change), the order list/summary (status/total may have changed), and the
 *  table board (an order's existence/status drives table occupancy). One helper so the thirteen
 *  order-mutating hooks below can't drift on this. */
function invalidateOrder(qc: ReturnType<typeof useQueryClient>, orderId?: string) {
  if (orderId) qc.invalidateQueries({ queryKey: [QK, "order", orderId] });
  qc.invalidateQueries({ queryKey: [QK, "orders"] });
  qc.invalidateQueries({ queryKey: [QK, "tables"] });
}

// ── Dashboards ─────────────────────────────────────────────────────────────────────────────────

export function useOwnerDashboard(enabled = true) {
  return useQuery({
    queryKey: [QK, "dashboard", "owner"],
    queryFn: () => restaurantApi.getOwnerDashboard(),
    enabled,
  });
}

export function useBranchDashboard(enabled = true) {
  return useQuery({
    queryKey: [QK, "dashboard", "branch"],
    queryFn: () => restaurantApi.getBranchDashboard(),
    enabled,
    refetchInterval: 60_000, // table counts are worth keeping fresh without a manual pull
  });
}

export function useKitchenDashboard(enabled = true) {
  return useQuery({
    queryKey: [QK, "dashboard", "kitchen"],
    queryFn: () => restaurantApi.getKitchenDashboard(),
    enabled,
    refetchInterval: 30_000,
  });
}

// ── Tables ───────────────────────────────────────────────────────────────────────────────────

export function useTablesSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "tables", "summary"],
    queryFn: restaurantApi.getTablesSummary,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useTables(enabled = true) {
  return useQuery({
    queryKey: [QK, "tables"],
    queryFn: restaurantApi.getTables,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useUpdateTableStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => restaurantApi.updateTableStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "tables"] }),
  });
}

// ── Menu (read-only -- order-taking's own picker) ───────────────────────────────────────────

export function useMenu(enabled = true) {
  return useQuery({
    queryKey: [QK, "menu"],
    queryFn: restaurantApi.getMenu,
    enabled,
    staleTime: 60_000, // the menu doesn't change mid-service; no need to refetch on every focus
  });
}

// ── Orders ───────────────────────────────────────────────────────────────────────────────────

export function useOrdersSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", "summary"],
    queryFn: restaurantApi.getOrdersSummary,
    enabled,
  });
}

/** Is a till open for floor staff to order under right now? Waiters never open their own
 *  session -- they ride the cashier's (GetOpenShiftQuery's own doc comment). */
export function useOpenShift(enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", "open-shift"],
    queryFn: restaurantApi.getOpenShift,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useOrders(status: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", status],
    queryFn: () => restaurantApi.getOrders(status),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useOrder(id: string, refetchInterval: number | false = 15_000) {
  return useQuery({
    queryKey: [QK, "order", id],
    queryFn: () => restaurantApi.getOrder(id),
    enabled: Boolean(id),
    refetchInterval, // an order being actively worked (kitchen, payment) should feel close to live
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderBody) => restaurantApi.createOrder(body),
    onSuccess: () => invalidateOrder(qc),
  });
}

export function useAddOrderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: OrderLineBody[] }) => restaurantApi.addItems(id, items),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useFireNextCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.fireNextCourse(id),
    onSuccess: (_, id) => invalidateOrder(qc, id),
  });
}

export function useSendOrderToKitchen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.sendToKitchen(id),
    onSuccess: (_, id) => {
      invalidateOrder(qc, id);
      qc.invalidateQueries({ queryKey: [QK, "kitchen"] });
    },
  });
}

export function useServeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.serve(id),
    onSuccess: (_, id) => invalidateOrder(qc, id),
  });
}

export function useVoidOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, reason }: { id: string; itemId: string; reason: string }) =>
      restaurantApi.voidItem(id, itemId, reason),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useApplyOrderDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, amount, reason }: { id: string; type: string; amount: number; reason: string }) =>
      restaurantApi.applyDiscount(id, type, amount, reason),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useRemoveOrderDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => restaurantApi.removeDiscount(id, reason),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useRedeemOrderLoyalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, points }: { id: string; points: number }) => restaurantApi.redeemLoyalty(id, points),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function usePayOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => restaurantApi.pay(id, method),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useAddOrderPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, method, amount, reference }: { id: string; method: string; amount: number; reference?: string }) =>
      restaurantApi.addPayment(id, method, amount, reference),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useSetOrderTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => restaurantApi.setTip(id, amount),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useSetOrderCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, customerId }: { id: string; customerId: string | null }) => restaurantApi.setCustomer(id, customerId),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useSetOrderWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, waiter }: { id: string; waiter: string }) => restaurantApi.setWaiter(id, waiter),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useHoldOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.hold(id),
    onSuccess: (_, id) => invalidateOrder(qc, id),
  });
}

export function useRecallOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.recall(id),
    onSuccess: (_, id) => invalidateOrder(qc, id),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => restaurantApi.cancelOrder(id, reason),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, reason, method }: { id: string; amount: number; reason: string; method: string }) =>
      restaurantApi.refund(id, amount, reason, method),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

export function useSplitOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, groups }: { id: string; groups: { itemIds: string[] }[] }) => restaurantApi.split(id, groups),
    onSuccess: (_, { id }) => invalidateOrder(qc, id),
  });
}

// ── Customer lookup ──────────────────────────────────────────────────────────────────────────

export function useCustomerSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "customer-search", search],
    queryFn: () => restaurantApi.searchCustomers(search),
    enabled: enabled && search.trim().length >= 2,
  });
}

export function useCustomerById(id: string | null) {
  return useQuery({
    queryKey: [QK, "customer", id],
    queryFn: () => restaurantApi.getCustomer(id!),
    enabled: Boolean(id),
  });
}

// ── Kitchen (KDS) ────────────────────────────────────────────────────────────────────────────

export function useKitchenSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "kitchen", "summary"],
    queryFn: restaurantApi.getKitchenSummary,
    enabled,
    refetchInterval: 20_000,
  });
}

export function useKitchenTickets(enabled = true) {
  return useQuery({
    queryKey: [QK, "kitchen", "tickets"],
    queryFn: () => restaurantApi.getKitchenTickets(),
    enabled,
    refetchInterval: 20_000, // an active KDS screen should feel close to live
  });
}

export function useUpdateKitchenItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) => restaurantApi.updateItemStatus(itemId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "kitchen"] });
      qc.invalidateQueries({ queryKey: [QK, "orders"] });
    },
  });
}

export function useMarkOrderReady() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => restaurantApi.markOrderReady(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "kitchen"] });
      qc.invalidateQueries({ queryKey: [QK, "orders"] });
    },
  });
}

// ── Reservations ─────────────────────────────────────────────────────────────────────────────

export function useReservationsSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "reservations", "summary"],
    queryFn: restaurantApi.getReservationsSummary,
    enabled,
  });
}

export function useReservations(date: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QK, "reservations", date ?? "all"],
    queryFn: () => restaurantApi.getReservations(date),
    enabled,
  });
}

export function useSeatReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.seatReservation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "reservations"] });
      qc.invalidateQueries({ queryKey: [QK, "tables"] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.cancelReservation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "reservations"] }),
  });
}

// ── Waitlist ─────────────────────────────────────────────────────────────────────────────────

export function useWaitlistSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "waitlist", "summary"],
    queryFn: restaurantApi.getWaitlistSummary,
    enabled,
  });
}

export function useWaitlist(status: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "waitlist", status],
    queryFn: () => restaurantApi.getWaitlist(status),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useSeatWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) => restaurantApi.seatWaitlist(id, tableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, "waitlist"] });
      qc.invalidateQueries({ queryKey: [QK, "tables"] });
    },
  });
}

export function useCancelWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.cancelWaitlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "waitlist"] }),
  });
}

export function useNoShowWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.noShowWaitlist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "waitlist"] }),
  });
}

// ── Delivery ─────────────────────────────────────────────────────────────────────────────────

export function useDeliveryProviders(enabled = true) {
  return useQuery({ queryKey: [QK, "delivery", "providers"], queryFn: restaurantApi.getDeliveryProviders, enabled });
}

export function useDeliverySummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "delivery", "summary"],
    queryFn: restaurantApi.getDeliverySummary,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useDeliveryOrders(status: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "delivery", "orders", status],
    queryFn: () => restaurantApi.getDeliveryOrders(status),
    enabled,
    refetchInterval: 20_000, // a driver's status should feel close to live, same cadence as the KDS
  });
}

export function useDeliveryOrder(id: string) {
  return useQuery({
    queryKey: [QK, "delivery", "order", id],
    queryFn: () => restaurantApi.getDeliveryOrder(id),
    enabled: Boolean(id),
    refetchInterval: 20_000,
  });
}

function invalidateDelivery(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: [QK, "delivery", "order", id] });
  qc.invalidateQueries({ queryKey: [QK, "delivery", "orders"] });
  qc.invalidateQueries({ queryKey: [QK, "delivery", "summary"] });
}

export function useCreateDeliveryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { orderId: string; address: string; phone: string; deliveryZoneId?: string | null; providerKey?: string }) =>
      restaurantApi.createDeliveryOrder(body),
    onSuccess: (_, { orderId }) => {
      invalidateDelivery(qc);
      qc.invalidateQueries({ queryKey: [QK, "order", orderId] });
    },
  });
}

export function useAssignDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) => restaurantApi.assignDriver(id, driverId),
    onSuccess: (_, { id }) => invalidateDelivery(qc, id),
  });
}

export function useChangeDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => restaurantApi.changeDeliveryStatus(id, status),
    onSuccess: (_, { id }) => invalidateDelivery(qc, id),
  });
}

export function useDrivers(activeOnly = false, enabled = true) {
  return useQuery({ queryKey: [QK, "drivers", activeOnly], queryFn: () => restaurantApi.getDrivers(activeOnly), enabled });
}
