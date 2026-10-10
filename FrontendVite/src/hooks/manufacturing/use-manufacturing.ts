import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  manufacturingApi, type BomStatus, type CompleteOrderRequest, type IssueLine, type PlanOrderRequest,
  type UpsertBomRequest, type UpsertWorkCentreRequest,
} from "@/lib/manufacturing/manufacturing.api";

const QK = "manufacturing";
const msg = (key: string) => i18n.t(`toast.${key}`, { ns: "manufacturing" });

// ── Lookups ─────────────────────────────────────────────────────────────────

export function useStockItems(search: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "products", search],
    queryFn: () => manufacturingApi.getProducts(search || undefined),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useStockWarehouses(enabled = true) {
  return useQuery({
    queryKey: [QK, "warehouses"], queryFn: manufacturingApi.getWarehouses, enabled, staleTime: 5 * 60 * 1000,
  });
}

export function useWorkCentres(activeOnly = false, enabled = true) {
  return useQuery({
    queryKey: [QK, "work-centres", activeOnly], queryFn: () => manufacturingApi.getWorkCentres(activeOnly),
    enabled, staleTime: 60 * 1000,
  });
}

export function useMaterialRequirements(enabled = true) {
  return useQuery({ queryKey: [QK, "material-requirements"], queryFn: manufacturingApi.getMaterialRequirements, enabled, staleTime: 30 * 1000 });
}

export function useProductionYield(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "yield", from ?? "", to ?? ""], queryFn: () => manufacturingApi.getYield({ from, to }), enabled, staleTime: 60 * 1000,
  });
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useBoms(status?: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "boms", status ?? "all"], queryFn: () => manufacturingApi.getBoms({ status }), enabled, staleTime: 60 * 1000,
  });
}

export function useBom(id: string | null) {
  return useQuery({ queryKey: [QK, "bom", id], queryFn: () => manufacturingApi.getBom(id!), enabled: !!id });
}

export function useProductionOrders(status?: string, enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", status ?? "all"], queryFn: () => manufacturingApi.getOrders({ status }), enabled, staleTime: 30 * 1000,
  });
}

/** Production orders planned for one reference — how a sales order finds its own. */
export function useProductionOrdersByReference(reference: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [QK, "orders", "reference", reference],
    queryFn: () => manufacturingApi.getOrders({ reference: reference! }),
    enabled: !!reference && enabled, staleTime: 30 * 1000,
  });
}

export function useWip(enabled = true) {
  return useQuery({ queryKey: [QK, "wip"], queryFn: manufacturingApi.getWip, enabled, staleTime: 30 * 1000 });
}
export function useWorkCentreLoad(enabled = true) {
  return useQuery({ queryKey: [QK, "work-centre-load"], queryFn: manufacturingApi.getWorkCentreLoad, enabled, staleTime: 30 * 1000 });
}
export function useSchedule(enabled = true) {
  return useQuery({ queryKey: [QK, "schedule"], queryFn: manufacturingApi.getSchedule, enabled, staleTime: 30 * 1000 });
}

export function useProductionSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "summary"], queryFn: manufacturingApi.getSummary, enabled, staleTime: 30 * 1000 });
}

export function useProductionOrder(id: string | null) {
  return useQuery({ queryKey: [QK, "order", id], queryFn: () => manufacturingApi.getOrder(id!), enabled: !!id });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/** Every Manufacturing write refreshes the whole module: orders, the summary tiles and stock on hand all move together. */
function useManufacturingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, successKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success(msg(successKey));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateBom = () =>
  useManufacturingMutation((body: UpsertBomRequest) => manufacturingApi.createBom(body), "bomCreated");
export const useUpdateBom = () =>
  useManufacturingMutation(({ id, body }: { id: string; body: UpsertBomRequest }) => manufacturingApi.updateBom(id, body), "bomUpdated");
export const useSetBomStatus = () =>
  useManufacturingMutation(({ id, status }: { id: string; status: BomStatus }) => manufacturingApi.setBomStatus(id, status), "bomStatusChanged");
export const useDeleteBom = () =>
  useManufacturingMutation((id: string) => manufacturingApi.deleteBom(id), "bomDeleted");

export const useCreateProductionOrder = () =>
  useManufacturingMutation((body: PlanOrderRequest) => manufacturingApi.createOrder(body), "orderCreated");
export const useUpdateProductionOrder = () =>
  useManufacturingMutation(({ id, body }: { id: string; body: PlanOrderRequest }) => manufacturingApi.updateOrder(id, body), "orderUpdated");
export const useReleaseProductionOrder = () =>
  useManufacturingMutation((id: string) => manufacturingApi.releaseOrder(id), "orderReleased");
export const useIssueMaterials = () =>
  useManufacturingMutation(({ id, lines }: { id: string; lines?: IssueLine[] }) =>
    manufacturingApi.issueMaterials(id, lines), "materialsIssued");
export const useReturnMaterials = () =>
  useManufacturingMutation(({ id, lines }: { id: string; lines: IssueLine[] }) =>
    manufacturingApi.returnMaterials(id, lines), "materialsReturned");
export const useCompleteProductionOrder = () =>
  useManufacturingMutation(({ id, ...body }: { id: string } & CompleteOrderRequest) =>
    manufacturingApi.completeOrder(id, body), "orderCompleted");
export const useRecordOperation = () =>
  useManufacturingMutation(({ id, operationId, actualMinutes }: { id: string; operationId: string; actualMinutes: number }) =>
    manufacturingApi.recordOperation(id, operationId, actualMinutes), "operationRecorded");

export const useCreateWorkCentre = () =>
  useManufacturingMutation((body: UpsertWorkCentreRequest) => manufacturingApi.createWorkCentre(body), "workCentreSaved");
export const useUpdateWorkCentre = () =>
  useManufacturingMutation(({ id, body }: { id: string; body: UpsertWorkCentreRequest }) => manufacturingApi.updateWorkCentre(id, body), "workCentreSaved");
export const useDeleteWorkCentre = () =>
  useManufacturingMutation((id: string) => manufacturingApi.deleteWorkCentre(id), "workCentreDeleted");
export const useCancelProductionOrder = () =>
  useManufacturingMutation((id: string) => manufacturingApi.cancelOrder(id), "orderCancelled");
export const useDeleteProductionOrder = () =>
  useManufacturingMutation((id: string) => manufacturingApi.deleteOrder(id), "orderDeleted");
