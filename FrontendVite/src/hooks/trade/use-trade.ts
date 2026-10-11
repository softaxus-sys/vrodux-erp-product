import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  tradeApi, type CostRequest, type DutyRateRequest, type DocumentRequest, type PartyRequest, type PaymentRequest, type ShipmentFilter,
  type ShipmentRequest,
} from "@/lib/trade/trade.api";

const QK = "trade";
const msg = (key: string) => i18n.t(`toast.${key}`, { ns: "trade" });

// ── Queries ─────────────────────────────────────────────────────────────────

export function useTradeDashboard(enabled = true) {
  return useQuery({ queryKey: [QK, "dashboard"], queryFn: tradeApi.getDashboard, enabled, staleTime: 30 * 1000 });
}

export function useParties(p: { search?: string; kind?: string; activeOnly?: boolean } = {}, enabled = true) {
  return useQuery({
    queryKey: [QK, "parties", p.search ?? "", p.kind ?? "", !!p.activeOnly],
    queryFn: () => tradeApi.getParties(p), enabled, staleTime: 60 * 1000,
  });
}

export function useShipments(f: ShipmentFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "shipments", f.search ?? "", f.direction ?? "", f.status ?? "", f.partnerId ?? "", !!f.openOnly, f.page ?? 1, f.pageSize ?? 25],
    queryFn: () => tradeApi.getShipments(f), enabled, staleTime: 30 * 1000, placeholderData: keepPreviousData,
  });
}

export function useShipment(id: string | null) {
  return useQuery({ queryKey: [QK, "shipment", id], queryFn: () => tradeApi.getShipment(id!), enabled: !!id });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Anything that changes a shipment can change the dashboard, the lists and the open drawer, so
 * every mutation refreshes the whole `trade` cache rather than guessing which parts are stale.
 */
function useTradeMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>, successKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK] }); toast.success(msg(successKey)); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateParty = () => useTradeMutation((r: PartyRequest) => tradeApi.createParty(r), "partySaved");
export const useUpdateParty = () => useTradeMutation((a: { id: string; r: PartyRequest }) => tradeApi.updateParty(a.id, a.r), "partySaved");
export const useDeleteParty = () => useTradeMutation((id: string) => tradeApi.deleteParty(id), "partyDeleted");

export const useCreateShipment = () => useTradeMutation((r: ShipmentRequest) => tradeApi.createShipment(r), "shipmentCreated");
export const useUpdateShipment = () => useTradeMutation((a: { id: string; r: ShipmentRequest }) => tradeApi.updateShipment(a.id, a.r), "shipmentSaved");
export const useChangeShipmentStatus = () =>
  useTradeMutation((a: { id: string; status: string; note?: string | null; date?: string | null }) =>
    tradeApi.changeStatus(a.id, a.status, a.note, a.date), "statusChanged");
export const useDeleteShipment = () => useTradeMutation((id: string) => tradeApi.deleteShipment(id), "shipmentDeleted");

export const useAddCost = () => useTradeMutation((a: { id: string; r: CostRequest }) => tradeApi.addCost(a.id, a.r), "costSaved");
export const useUpdateCost = () => useTradeMutation((a: { id: string; costId: string; r: CostRequest }) => tradeApi.updateCost(a.id, a.costId, a.r), "costSaved");
export const useRemoveCost = () => useTradeMutation((a: { id: string; costId: string }) => tradeApi.removeCost(a.id, a.costId), "costDeleted");

export const useAddPayment = () => useTradeMutation((a: { id: string; r: PaymentRequest }) => tradeApi.addPayment(a.id, a.r), "paymentSaved");
export const useUpdatePayment = () => useTradeMutation((a: { id: string; paymentId: string; r: PaymentRequest }) => tradeApi.updatePayment(a.id, a.paymentId, a.r), "paymentSaved");
export const useRemovePayment = () => useTradeMutation((a: { id: string; paymentId: string }) => tradeApi.removePayment(a.id, a.paymentId), "paymentDeleted");

export const useAddDocument = () => useTradeMutation((a: { id: string; r: DocumentRequest }) => tradeApi.addDocument(a.id, a.r), "documentSaved");
export const useUpdateDocument = () => useTradeMutation((a: { docId: string; r: DocumentRequest }) => tradeApi.updateDocument(a.docId, a.r), "documentSaved");
export const useDeleteDocument = () => useTradeMutation((docId: string) => tradeApi.deleteDocument(docId), "documentDeleted");

export function useInTransit(p: { productId?: string; search?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: [QK, "in-transit", p.productId ?? "", p.search ?? ""],
    queryFn: () => tradeApi.getInTransit(p), enabled, staleTime: 60 * 1000, placeholderData: keepPreviousData,
  });
}

export function useDutyRates(search = "", enabled = true) {
  return useQuery({ queryKey: [QK, "duty-rates", search], queryFn: () => tradeApi.getDutyRates(search), enabled, staleTime: 60 * 1000 });
}

/** Fetched on demand (the dialog opens it), so the figures are never a stale snapshot of costs that have since changed. */
export function useDutyEstimate(shipmentId: string | null, includeFreightInsurance: boolean) {
  return useQuery({
    queryKey: [QK, "duty-estimate", shipmentId, includeFreightInsurance],
    queryFn: () => tradeApi.getDutyEstimate(shipmentId!, includeFreightInsurance), enabled: !!shipmentId, staleTime: 0,
  });
}

export const useCreateDutyRate = () => useTradeMutation((r: DutyRateRequest) => tradeApi.createDutyRate(r), "dutyRateSaved");
export const useUpdateDutyRate = () => useTradeMutation((a: { id: string; r: DutyRateRequest }) => tradeApi.updateDutyRate(a.id, a.r), "dutyRateSaved");
export const useDeleteDutyRate = () => useTradeMutation((id: string) => tradeApi.deleteDutyRate(id), "dutyRateDeleted");
