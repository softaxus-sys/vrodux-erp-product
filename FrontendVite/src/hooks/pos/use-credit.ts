import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { creditApi, type CreditReminderSettingsInput } from "@/lib/pos/credit.api";

/** Every credit query hangs off this key, so one invalidation refreshes the file, the overview and the till. */
export const CREDIT_KEY = "pos-credit";

export function useCustomerCredit(customerId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [CREDIT_KEY, "customer", customerId],
    queryFn: () => creditApi.getCustomer(customerId!),
    enabled: enabled && !!customerId,
    staleTime: 0, // a customer's standing changes with every sale and payment
  });
}

export function useCreditOverview() {
  return useQuery({
    queryKey: [CREDIT_KEY, "overview"],
    queryFn: creditApi.getOverview,
    staleTime: 30_000,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [CREDIT_KEY] });
    qc.invalidateQueries({ queryKey: ["pos-customers"] });
  };
}

export function useSetCreditTerms(customerId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (days: number) => creditApi.setTerms(customerId, days),
    onSuccess: () => { refresh(); toast.success("Payment terms saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetCreditHold(customerId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { hold: boolean; reason: string | null }) => creditApi.setHold(customerId, v.hold, v.reason),
    onSuccess: (_d, v) => { refresh(); toast.success(v.hold ? "Credit stopped for this customer." : "Credit resumed."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreditReminderSettings() {
  return useQuery({ queryKey: [CREDIT_KEY, "reminder-settings"], queryFn: creditApi.getReminderSettings, staleTime: 60_000 });
}

export function useCreditReminderLog(customerId?: string) {
  return useQuery({ queryKey: [CREDIT_KEY, "reminder-log", customerId ?? "all"], queryFn: () => creditApi.getReminderLog(customerId), staleTime: 15_000 });
}

export function useSaveCreditReminderSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: CreditReminderSettingsInput) => creditApi.saveReminderSettings(s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [CREDIT_KEY, "reminder-settings"] }); toast.success("Reminder settings saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** dryRun = preview only; false sends. Both refresh the log. */
export function useRunCreditReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) => creditApi.runReminders(dryRun),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [CREDIT_KEY, "reminder-log"] });
      if (!r.dryRun) toast.success(`Reminders sent: ${r.dueSoon + r.overdue}${r.failed ? `, ${r.failed} failed` : ""}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemindCustomer(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => creditApi.remindCustomer(customerId),
    onSuccess: (l) => { qc.invalidateQueries({ queryKey: [CREDIT_KEY, "reminder-log"] }); toast.success(`Reminder emailed to ${l.email}.`); },
    onError: (e: Error) => toast.error(e.message),
  });
}
