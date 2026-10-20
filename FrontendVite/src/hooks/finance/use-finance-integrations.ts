import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  integrationsApi,
  type IntegrationMode, type PostingQueueParams, type PostResultDto, type SyncResultDto,
} from "@/lib/finance/integrations.api";

const QK = ["finance", "integrations"] as const;

export function useIntegrationOverview() {
  return useQuery({
    queryKey: [...QK, "overview"],
    queryFn: () => integrationsApi.getOverview(),
    staleTime: 30 * 1000,
  });
}

/** One module's integrations — the module's own "Post to Finance" panel. */
export function useModuleIntegrations(module: string, enabled: boolean) {
  return useQuery({
    queryKey: [...QK, "module", module],
    queryFn: () => integrationsApi.getOverview(module),
    enabled,
    staleTime: 30 * 1000,
  });
}

/** Never cached: a check is only true for the mappings, rates and periods at the moment it ran. */
export function usePostingCheck(ids: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...QK, "check", ids],
    queryFn: () => integrationsApi.check(ids),
    enabled: enabled && ids.length > 0,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useAutoReadiness(key: string, startDate: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...QK, "auto-readiness", key, startDate],
    queryFn: () => integrationsApi.getAutoReadiness(key, startDate),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

export function usePostingQueue(params: PostingQueueParams) {
  return useQuery({
    queryKey: [...QK, "queue", params],
    queryFn: () => integrationsApi.getQueue(params),
    // Paging and filtering should not blank the table between requests.
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });
}

export function usePostingPreview(id: string | null) {
  return useQuery({
    queryKey: [...QK, "preview", id],
    queryFn: () => integrationsApi.getPreview(id!),
    enabled: !!id,
    // A preview is only true for the mappings and period status at the moment it is read.
    staleTime: 0,
  });
}

/** Posting writes journal entries, so the ledger screens are refreshed along with the queue. */
function useInvalidate() {
  const qc = useQueryClient();
  return (ledger: boolean) => {
    qc.invalidateQueries({ queryKey: QK });
    if (ledger) {
      qc.invalidateQueries({ queryKey: ["finance", "journals"] });
      qc.invalidateQueries({ queryKey: ["finance", "gl"] });
    }
  };
}

export function useUpdateIntegrationSetting() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { key: string; mode: IntegrationMode; startDate?: string | null; acknowledgeAuto?: boolean }) =>
      integrationsApi.updateSetting(v.key, { mode: v.mode, startDate: v.startDate ?? null, acknowledgeAuto: v.acknowledgeAuto }),
    onSuccess: () => { invalidate(false); toast.success(t("integrations.toast.settingSaved")); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveAccountMappings() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { key: string; mappings: { role: string; accountId: string | null }[] }) =>
      integrationsApi.saveMappings(v.key, v.mappings),
    onSuccess: () => { invalidate(false); toast.success(t("integrations.toast.mappingSaved")); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncIntegrations() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (integrationKey?: string) => integrationsApi.sync(integrationKey),
    onSuccess: (r: SyncResultDto) => {
      invalidate(r.posted > 0);
      const failedSources = r.integrations.filter(i => i.error);
      if (failedSources.length > 0) {
        toast.error(t("integrations.toast.syncError", { error: failedSources[0].error }));
      } else if (r.integrations.length === 0) {
        toast.info(t("integrations.toast.syncNothingOn"));
      } else if (r.failed > 0) {
        toast.warning(t("integrations.toast.syncWithFailures", { collected: r.collected, posted: r.posted, failed: r.failed }));
      } else {
        toast.success(t("integrations.toast.synced", { collected: r.collected, posted: r.posted }));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function usePostResultToast() {
  const { t } = useTranslation("finance");
  return (r: PostResultDto) => {
    // The first reason is shown because "3 failed" on its own sends the user hunting for why.
    const firstError = r.items.find(i => i.status === "failed")?.error;
    // Documents this person's approval level does not cover are left alone, not failed — say so.
    const refused = r.items.filter(i => i.status === "refused");
    if (refused.length > 0)
      toast.warning(t("integrations.toast.refused", { count: refused.length }), { description: refused[0].error ?? undefined });
    if (r.failed > 0) {
      toast.error(t("integrations.toast.postedWithFailures", { posted: r.posted, failed: r.failed }), {
        description: firstError ?? undefined,
      });
    } else if (r.posted === 0) {
      toast.info(t("integrations.toast.nothingPosted"));
    } else {
      toast.success(t("integrations.toast.posted", { count: r.posted }));
    }
  };
}

export function usePostItems() {
  const invalidate = useInvalidate();
  const report = usePostResultToast();
  return useMutation({
    mutationFn: (ids: string[]) => integrationsApi.post(ids),
    onSuccess: (r) => { invalidate(true); report(r); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Posts a selection that has been checked: the control total goes with it. */
export function usePostChecked() {
  const invalidate = useInvalidate();
  const report = usePostResultToast();
  return useMutation({
    mutationFn: (v: { ids: string[]; controlTotal: number }) => integrationsApi.post(v.ids, v.controlTotal),
    onSuccess: (r) => { invalidate(true); report(r); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSubmitItems() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { ids: string[]; withdraw?: boolean }) => integrationsApi.submit(v.ids, v.withdraw ?? false),
    onSuccess: (r, v) => {
      invalidate(false);
      if (r.changed > 0)
        toast.success(t(v.withdraw ? "integrations.toast.withdrawn" : "integrations.toast.submitted", { count: r.changed }));
      else if (r.problems.length === 0)
        toast.info(t("integrations.toast.submitNothing"));
      if (r.problems.length > 0)
        toast.warning(t("integrations.toast.submitProblems", { count: r.problems.length }), { description: r.problems[0] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateApproval() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { key: string; approvalLimit: number | null; requireSeparateApprover: boolean }) =>
      integrationsApi.updateApproval(v.key, { approvalLimit: v.approvalLimit, requireSeparateApprover: v.requireSeparateApprover }),
    onSuccess: () => { invalidate(false); toast.success(t("integrations.toast.approvalSaved")); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRetryFailed() {
  const invalidate = useInvalidate();
  const report = usePostResultToast();
  return useMutation({
    mutationFn: (integrationKey?: string) => integrationsApi.retryFailed(integrationKey),
    onSuccess: (r) => { invalidate(true); report(r); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSkipItem() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { id: string; reason?: string }) => integrationsApi.skip(v.id, v.reason),
    onSuccess: () => { invalidate(false); toast.success(t("integrations.toast.skipped")); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRequeueItem() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (id: string) => integrationsApi.requeue(id),
    onSuccess: () => { invalidate(false); toast.success(t("integrations.toast.requeued")); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReverseItem() {
  const invalidate = useInvalidate();
  const { t } = useTranslation("finance");
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => integrationsApi.reverse(v.id, v.reason),
    onSuccess: () => { invalidate(true); toast.success(t("integrations.toast.reversed")); },
    onError: (e: Error) => toast.error(e.message),
  });
}
