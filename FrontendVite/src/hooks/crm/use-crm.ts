import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmApi } from "@/lib/crm/crm.api";
import type {
  CreateLeadRequest, UpdateLeadRequest, CreateDealRequest, UpdateDealRequest,
  CreateCustomerRequest, UpdateCustomerRequest, CreateActivityRequest,
  UpsertContactRequest,
} from "@/lib/crm/crm.api";

const QK = "crm";

export function useDeals() {
  return useQuery({
    queryKey: [QK, "deals"],
    queryFn:  crmApi.getDeals,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCrmSummary() {
  return useQuery({
    queryKey: [QK, "deals-summary"],
    queryFn:  crmApi.getCrmSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeads() {
  return useQuery({
    queryKey: [QK, "leads"],
    queryFn:  crmApi.getLeads,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadsSummary() {
  return useQuery({
    queryKey: [QK, "leads-summary"],
    queryFn:  crmApi.getLeadsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: [QK, "customers"],
    queryFn:  crmApi.getCustomers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomersSummary() {
  return useQuery({
    queryKey: [QK, "customers-summary"],
    queryFn:  crmApi.getCustomersSummary,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutation helper ──────────────────────────────────────────────────────────

function useCrmMutation<TArgs>(fn: (a: TArgs) => Promise<unknown>, opts?: { msg?: string; invalidate?: string[] }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      const keys = opts?.invalidate ?? ["leads", "leads-summary", "deals", "deals-summary",
        "customers", "customers-summary", "activities", "activities-summary", "dashboard"];
      keys.forEach(k => qc.invalidateQueries({ queryKey: [QK, k] }));
      if (opts?.msg) toast.success(opts.msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Leads ────────────────────────────────────────────────────────────────────

export function useLead(id: string | null) {
  return useQuery({ queryKey: [QK, "lead", id], queryFn: () => crmApi.getLead(id!), enabled: !!id });
}
export function useCreateLead()  { return useCrmMutation((d: CreateLeadRequest) => crmApi.createLead(d), { msg: "Lead created." }); }
export function useUpdateLead()  { return useCrmMutation(({ id, data }: { id: string; data: UpdateLeadRequest }) => crmApi.updateLead(id, data), { msg: "Lead updated." }); }
export function useSetLeadStatus() { return useCrmMutation(({ id, status }: { id: string; status: string }) => crmApi.setLeadStatus(id, status), { msg: "Lead status updated." }); }
export function useSetLeadScore()  { return useCrmMutation(({ id, score }: { id: string; score: number }) => crmApi.setLeadScore(id, score)); }
export function useConvertLead()   { return useCrmMutation(({ id, body }: { id: string; body: { dealTitle?: string; dealValue?: number; expectedCloseDate?: string } }) => crmApi.convertLead(id, body), { msg: "Lead converted to customer + deal." }); }
export function useDeleteLead()    { return useCrmMutation((id: string) => crmApi.deleteLead(id), { msg: "Lead deleted." }); }

// ── Deals ────────────────────────────────────────────────────────────────────

export function useDeal(id: string | null) {
  return useQuery({ queryKey: [QK, "deal", id], queryFn: () => crmApi.getDeal(id!), enabled: !!id });
}
export function useCreateDeal()   { return useCrmMutation((d: CreateDealRequest) => crmApi.createDeal(d), { msg: "Deal created." }); }
export function useUpdateDeal()   { return useCrmMutation(({ id, data }: { id: string; data: UpdateDealRequest }) => crmApi.updateDeal(id, data), { msg: "Deal updated." }); }
export function useMoveDealStage() { return useCrmMutation(({ id, stage, probability }: { id: string; stage: string; probability: number }) => crmApi.moveDealStage(id, stage, probability)); }
export function useDeleteDeal()   { return useCrmMutation((id: string) => crmApi.deleteDeal(id), { msg: "Deal deleted." }); }

// ── Customers ────────────────────────────────────────────────────────────────

export function useCreateCustomer() { return useCrmMutation((c: CreateCustomerRequest) => crmApi.createCustomer(c), { msg: "Customer created." }); }
export function useUpdateCustomer() { return useCrmMutation(({ id, data }: { id: string; data: UpdateCustomerRequest }) => crmApi.updateCustomer(id, data), { msg: "Customer updated." }); }
export function useDeleteCustomer() { return useCrmMutation((id: string) => crmApi.deleteCustomer(id), { msg: "Customer deleted." }); }

// ── Activities ───────────────────────────────────────────────────────────────

export function useActivities(params?: { relatedToType?: string; relatedToId?: string; completed?: boolean; type?: string }) {
  return useQuery({ queryKey: [QK, "activities", params ?? {}], queryFn: () => crmApi.getActivities(params) });
}
export function useActivitiesSummary() {
  return useQuery({ queryKey: [QK, "activities-summary"], queryFn: crmApi.getActivitiesSummary });
}
export function useCreateActivity()   { return useCrmMutation((a: CreateActivityRequest) => crmApi.createActivity(a), { msg: "Activity logged." }); }
export function useCompleteActivity() { return useCrmMutation((id: string) => crmApi.completeActivity(id)); }
export function useReopenActivity()   { return useCrmMutation((id: string) => crmApi.reopenActivity(id)); }
export function useDeleteActivity()   { return useCrmMutation((id: string) => crmApi.deleteActivity(id), { msg: "Activity deleted." }); }

// ── Dashboard ────────────────────────────────────────────────────────────────

export function useCrmDashboard() {
  return useQuery({ queryKey: [QK, "dashboard"], queryFn: crmApi.getDashboard });
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export function useContacts(customerId: string | null) {
  return useQuery({ queryKey: [QK, "contacts", customerId], queryFn: () => crmApi.getContacts(customerId!), enabled: !!customerId });
}
function useContactMutation<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "contacts"] }); if (msg) toast.success(msg); },
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useCreateContact()    { return useContactMutation((c: UpsertContactRequest) => crmApi.createContact(c), "Contact added."); }
export function useUpdateContact()    { return useContactMutation(({ id, data }: { id: string; data: UpsertContactRequest }) => crmApi.updateContact(id, data), "Contact updated."); }
export function useSetPrimaryContact(){ return useContactMutation((id: string) => crmApi.setPrimaryContact(id)); }
export function useDeleteContact()    { return useContactMutation((id: string) => crmApi.deleteContact(id), "Contact removed."); }
