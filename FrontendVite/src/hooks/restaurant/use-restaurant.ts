import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { restaurantApi, type OrderLineInput, type TableStatus } from "@/lib/restaurant/restaurant.api";
import { toast } from "sonner";

export const rKeys = {
  all:           ["restaurant"] as const,
  tables:        () => [...rKeys.all, "tables"] as const,
  tablesSummary: () => [...rKeys.all, "tables-summary"] as const,
  menu:          () => [...rKeys.all, "menu"] as const,
  orders:        () => [...rKeys.all, "orders"] as const,
  ordersSummary: () => [...rKeys.all, "orders-summary"] as const,
  kitchen:       () => [...rKeys.all, "kitchen"] as const,
  kitchenSummary:() => [...rKeys.all, "kitchen-summary"] as const,
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
export function useOrders(status?: string) {
  return useQuery({ queryKey: [...rKeys.orders(), status ?? "all"], queryFn: () => restaurantApi.getOrders(status), refetchInterval: 15_000 });
}
export function useOrdersSummary() {
  return useQuery({ queryKey: rKeys.ordersSummary(), queryFn: restaurantApi.getOrdersSummary, refetchInterval: 15_000 });
}
export function useKitchenTickets() {
  return useQuery({ queryKey: rKeys.kitchen(), queryFn: restaurantApi.getKitchenTickets, refetchInterval: 10_000 });
}
export function useKitchenSummary() {
  return useQuery({ queryKey: rKeys.kitchenSummary(), queryFn: restaurantApi.getKitchenSummary, refetchInterval: 10_000 });
}

// ── Mutations ────────────────────────────────────────────────────────────────────

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: rKeys.all });
}

export function useCreateTable() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: { tableNumber: string; section: string; capacity: number }) => restaurantApi.createTable(p),
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
    mutationFn: (p: { tableId: string; waiter: string; covers: number; orderType: string; notes?: string | null; items: OrderLineInput[] }) =>
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

export function useRemoveItem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, itemId }: { id: string; itemId: string }) => restaurantApi.removeItem(id, itemId),
    onSuccess: () => invalidate(),
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
    mutationFn: (id: string) => restaurantApi.cancel(id),
    onSuccess: () => { invalidate(); toast.success("Order cancelled."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyOrderDiscount() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => restaurantApi.applyDiscount(id, amount),
    onSuccess: () => invalidate(),
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
