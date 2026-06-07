import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { conBiddingApi, type CreateRfqReq, type CreateEstimateReq, type CreateContractReq } from "@/lib/construction/bidding.api";

const QK = "con-bidding";

export function useConBiddingSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: conBiddingApi.getSummary }); }
export function useRfqs()       { return useQuery({ queryKey: [QK, "rfqs"], queryFn: conBiddingApi.getRfqs }); }
export function useEstimates()  { return useQuery({ queryKey: [QK, "estimates"], queryFn: conBiddingApi.getEstimates }); }
export function useConContracts() { return useQuery({ queryKey: [QK, "contracts"], queryFn: conBiddingApi.getContracts }); }

function useM<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["rfqs"], ["estimates"], ["contracts"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateRfq()       { return useM((d: CreateRfqReq) => conBiddingApi.createRfq(d), "RFQ created."); }
export function useSetRfqStatus()    { return useM(({ id, status }: { id: string; status: string }) => conBiddingApi.setRfqStatus(id, status), "RFQ updated."); }
export function useDeleteRfq()       { return useM((id: string) => conBiddingApi.deleteRfq(id), "RFQ removed."); }

export function useCreateEstimate()    { return useM((d: CreateEstimateReq) => conBiddingApi.createEstimate(d), "Estimate created."); }
export function useSetEstimateStatus() { return useM(({ id, status }: { id: string; status: string }) => conBiddingApi.setEstimateStatus(id, status), "Estimate updated."); }
export function useDeleteEstimate()    { return useM((id: string) => conBiddingApi.deleteEstimate(id), "Estimate removed."); }

export function useCreateConContract()    { return useM((d: CreateContractReq) => conBiddingApi.createContract(d), "Contract created."); }
export function useSetConContractStatus() { return useM(({ id, status }: { id: string; status: string }) => conBiddingApi.setContractStatus(id, status), "Contract updated."); }
export function useDeleteConContract()    { return useM((id: string) => conBiddingApi.deleteContract(id), "Contract removed."); }
