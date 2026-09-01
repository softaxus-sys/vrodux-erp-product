import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { insuranceApi, type CreatePolicyReq, type RenewReq, type CreateClaimReq, type VerticalPageParams } from "@/lib/insurance/insurance.api";

const QK = "insurance";

export function useInsuranceSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: insuranceApi.getSummary }); }
export function usePolicies(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "policies"], params],
    queryFn: () => insuranceApi.getPolicies(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useRenewals(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "renewals"], params],
    queryFn: () => insuranceApi.getRenewals(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}
export function useClaims(params: VerticalPageParams = {}) {
  return useQuery({
    queryKey: [...[QK, "claims"], params],
    queryFn: () => insuranceApi.getClaims(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the table.
    placeholderData: (prev) => prev,
  });
}

function useM<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["policies"], ["renewals"], ["claims"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreatePolicy()    { return useM((d: CreatePolicyReq) => insuranceApi.createPolicy(d), "Policy created."); }
export function useSetPolicyStatus() { return useM(({ id, status }: { id: string; status: string }) => insuranceApi.setPolicyStatus(id, status), "Policy updated."); }
export function useRenewPolicy()     { return useM(({ id, data }: { id: string; data: RenewReq }) => insuranceApi.renewPolicy(id, data), "Renewal raised."); }
export function useDeletePolicy()    { return useM((id: string) => insuranceApi.deletePolicy(id), "Policy removed."); }

export function useCompleteRenewal() { return useM((id: string) => insuranceApi.completeRenewal(id), "Renewal completed."); }
export function useSetRenewalStatus(){ return useM(({ id, status }: { id: string; status: string }) => insuranceApi.setRenewalStatus(id, status), "Renewal updated."); }
export function useDeleteRenewal()   { return useM((id: string) => insuranceApi.deleteRenewal(id), "Renewal removed."); }

export function useCreateClaim()  { return useM((d: CreateClaimReq) => insuranceApi.createClaim(d), "Claim filed."); }
export function useApproveClaim() { return useM(({ id, amount }: { id: string; amount: number }) => insuranceApi.approveClaim(id, amount), "Claim approved."); }
export function useSetClaimStatus(){ return useM(({ id, status }: { id: string; status: string }) => insuranceApi.setClaimStatus(id, status), "Claim updated."); }
export function useDeleteClaim()  { return useM((id: string) => insuranceApi.deleteClaim(id), "Claim removed."); }
