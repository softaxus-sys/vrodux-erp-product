import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restaurantApi } from "@/lib/restaurant.api";

const QK = "restaurant" as const;

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

// ── Orders (read-only) ───────────────────────────────────────────────────────────────────────

export function useOrdersSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", "summary"],
    queryFn: restaurantApi.getOrdersSummary,
    enabled,
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

export function useOrder(id: string) {
  return useQuery({
    queryKey: [QK, "order", id],
    queryFn: () => restaurantApi.getOrder(id),
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
