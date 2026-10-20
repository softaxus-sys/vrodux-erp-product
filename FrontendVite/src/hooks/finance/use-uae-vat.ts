import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uaeVatApi, type UpsertUaeVatProfileRequest, type VatReturnDto } from "@/lib/finance/uae-vat.api";

const QK = ["finance", "uae-vat"] as const;

export const useUaeVatProfile = () =>
  useQuery({ queryKey: [...QK, "profile"], queryFn: uaeVatApi.getProfile, staleTime: 5 * 60_000 });

export const useUaeVatIntegration = () =>
  useQuery({ queryKey: [...QK, "integration"], queryFn: uaeVatApi.getIntegration, staleTime: 5 * 60_000 });

export const useVatReturns = (taxPeriodId?: string) =>
  useQuery({ queryKey: [...QK, "returns", taxPeriodId ?? "all"], queryFn: () => uaeVatApi.getReturns(taxPeriodId), enabled: !!taxPeriodId });

export function useSaveUaeVatProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertUaeVatProfileRequest) => uaeVatApi.saveProfile(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("VAT registration saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Shared mutation shape for every workflow step: refresh returns + tax periods, report errors. */
function useStep<TArgs>(fn: (a: TArgs) => Promise<VatReturnDto>, success?: (r: VatReturnDto) => string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["finance", "tax-periods"] });
      const msg = success?.(r);
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const usePrepareVatReturn = () => useStep((periodId: string) => uaeVatApi.prepare(periodId), () => "Return prepared from the ledger.");
export const useApproveVatReturn = () => useStep((id: string) => uaeVatApi.approve(id), () => "Return approved.");
export const useMarkVatReturnReady = () => useStep((id: string) => uaeVatApi.markReady(id), () => "Files generated — return is ready to submit.");
export const useRecordVatPortalFiling = () =>
  useStep((a: { id: string; reference: string }) => uaeVatApi.recordPortalFiling(a.id, a.reference), () => "EmaraTax filing recorded.");

/** Reports the gateway's real outcome; a "not available" attempt is shown as a warning, not success. */
export function useSubmitVatReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => uaeVatApi.submit(id),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: QK });
      const last = r.attempts[0];
      if (r.status === "submitted" || r.status === "acknowledged") toast.success(`Submitted — reference ${r.submissionReference ?? "pending"}.`);
      else if (r.status === "rejected") toast.error(`Rejected: ${r.rejectionReason ?? "see submission history"}`);
      else toast.warning(last?.message ?? "The return was not transmitted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
