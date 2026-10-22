import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmWriteApi, type LeadForm } from "@/lib/crm-write.api";
import { QK } from "@/hooks/query-keys";

/** Everyone the caller may hand a CRM record to -- already scoped to their tier by the server. */
export function useAssignableUsers(module = "crm") {
  return useQuery({
    queryKey: [QK, "assignable-users", module],
    queryFn: () => crmWriteApi.getAssignableUsers(module),
    staleTime: 5 * 60_000,
  });
}

export function useLeadRaw(id: string | undefined) {
  return useQuery({
    queryKey: [QK, "lead-raw", id],
    queryFn: () => crmWriteApi.getLeadRaw(id as string),
    enabled: Boolean(id),
  });
}

export function useDealRaw(id: string | undefined) {
  return useQuery({
    queryKey: [QK, "deal-raw", id],
    queryFn: () => import("@/lib/api-client").then((m) => m.apiClient.get<Record<string, unknown>>(`/api/crm/deals/${id}`)),
    enabled: Boolean(id),
  });
}

function useInvalidateCrm() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [QK, "leads"] });
    qc.invalidateQueries({ queryKey: [QK, "lead"] });
    qc.invalidateQueries({ queryKey: [QK, "lead-raw"] });
    qc.invalidateQueries({ queryKey: [QK, "deals"] });
    qc.invalidateQueries({ queryKey: [QK, "deal"] });
    qc.invalidateQueries({ queryKey: [QK, "accounts"] });
    qc.invalidateQueries({ queryKey: [QK, "crm-dashboard"] });
  };
}

export function useCreateLead() {
  const inv = useInvalidateCrm();
  return useMutation({ mutationFn: (f: LeadForm) => crmWriteApi.createLead(f), onSuccess: inv });
}

export function useUpdateLead() {
  const inv = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LeadForm> }) => crmWriteApi.updateLead(id, patch),
    onSuccess: inv,
  });
}

export function useAssignLead() {
  const inv = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; toUserId: string | null; toUserName: string; note?: string; teamId?: string | null }) =>
      crmWriteApi.assignLead(id, body),
    onSuccess: inv,
  });
}

export function useCreateDeal() {
  const inv = useInvalidateCrm();
  return useMutation({ mutationFn: crmWriteApi.createDeal, onSuccess: inv });
}

export function useUpdateDeal() {
  const inv = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => crmWriteApi.updateDeal(id, patch),
    onSuccess: inv,
  });
}

export function useAccountsSearch(search: string, page = 1) {
  return useQuery({
    queryKey: [QK, "accounts", "paged", search, page],
    queryFn: () => crmWriteApi.getAccounts({ search, page, pageSize: 25 }),
  });
}

export function useAccountRaw(id: string | undefined) {
  return useQuery({
    queryKey: [QK, "accounts", "raw", id],
    queryFn: () => crmWriteApi.getAccount(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const inv = useInvalidateCrm();
  return useMutation({ mutationFn: crmWriteApi.createAccount, onSuccess: inv });
}

export function useUpdateAccount() {
  const inv = useInvalidateCrm();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => crmWriteApi.updateAccount(id, patch),
    onSuccess: inv,
  });
}
