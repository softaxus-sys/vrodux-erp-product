import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmApi } from "@/lib/crm.api";
import { crmExtraApi, type ActivityPageParams, type UpsertContactRequest } from "@/lib/crm-extra.api";
import { QK } from "@/hooks/query-keys";

const X = "crm-extra";

export const useAccount = (id: string) => useQuery({ queryKey: [X, "account", id], queryFn: () => crmExtraApi.getAccount(id) });
export const useAccountTimeline = (id: string) =>
  useQuery({ queryKey: [QK, "activities", "timeline", id], queryFn: () => crmExtraApi.getCustomerTimeline(id), enabled: Boolean(id) });
export const useAccountDeals = (id: string) =>
  useQuery({ queryKey: [X, "account-deals", id], queryFn: () => crmExtraApi.getDealsForAccount(id), enabled: Boolean(id) });
export const useContacts = (customerId: string | undefined) =>
  useQuery({ queryKey: [X, "contacts", customerId], queryFn: () => crmExtraApi.getContacts(customerId as string), enabled: Boolean(customerId) });
export const useDealContacts = (dealId: string) =>
  useQuery({ queryKey: [X, "deal-contacts", dealId], queryFn: () => crmExtraApi.getDealContacts(dealId), enabled: Boolean(dealId) });
export const useLeadAssignments = (id: string) =>
  useQuery({ queryKey: [X, "lead-assignments", id], queryFn: () => crmExtraApi.getLeadAssignments(id), enabled: Boolean(id) });
export const useActivitiesSummary = () => useQuery({ queryKey: [QK, "activities", "summary"], queryFn: crmExtraApi.getActivitiesSummary });
export const useActivitiesPage = (p: ActivityPageParams) =>
  useQuery({ queryKey: [QK, "activities", "paged", p], queryFn: () => crmExtraApi.getActivitiesPaged(p) });

export const useCrmReport = (id: string, from?: string, to?: string) =>
  useQuery({ queryKey: [X, "report", id, from, to], queryFn: () => crmExtraApi.getReport(id, { from, to }), staleTime: 2 * 60_000 });

export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: UpsertContactRequest }): Promise<void> => {
      if (id) await crmExtraApi.updateContact(id, body);
      else await crmExtraApi.createContact(body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [X] }),
  });
}
export function useContactAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "primary" | "delete" }): Promise<void> => {
      if (action === "primary") await crmExtraApi.setPrimaryContact(id);
      else await crmExtraApi.deleteContact(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [X] }),
  });
}
export function useDealContactMutations(dealId: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: [X, "deal-contacts", dealId] });
  return {
    add: useMutation({ mutationFn: (b: { contactId: string; role: string }) => crmExtraApi.addDealContact(dealId, b), onSuccess: done }),
    setRole: useMutation({ mutationFn: (v: { id: string; role: string }) => crmExtraApi.updateDealContactRole(dealId, v.id, v.role), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => crmExtraApi.removeDealContact(dealId, id), onSuccess: done }),
  };
}
export function useActivityToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, complete }: { id: string; complete: boolean }): Promise<void> => {
      if (complete) await crmApi.completeActivity(id);
      else await crmExtraApi.reopenActivity(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, "activities"] }),
  });
}
