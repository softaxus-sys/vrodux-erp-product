import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  reApi,
  type UpsertPropertyInput,
  type CreateContractRequest,
  type CreateTenantRequest,
  type UpsertUnitRequest,
  type UpdateContractRequest,
  type ContractStatus,
  type RentAlertSettingsDto,
  type RePageParams,
} from "@/lib/real-estate/re.api";

const QK = "real-estate";

export function useProperties(params: RePageParams & { propertyType?: string } = {}) {
  return useQuery({
    queryKey: [QK, "properties", params],
    queryFn:  () => reApi.getProperties(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}
export function usePropertySummary() { return useQuery({ queryKey: [QK, "property-summary"],  queryFn: reApi.getPropertySummary,  staleTime: 60_000 }); }

// ── Property mutations ──────────────────────────────────────────────────────
function useInvalidateProperties() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [QK, "properties"] });
    qc.invalidateQueries({ queryKey: [QK, "property-summary"] });
  };
}
export function useCreateProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation({ mutationFn: (d: UpsertPropertyInput) => reApi.createProperty(d), onSuccess: invalidate });
}
export function useUpdateProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation({ mutationFn: (v: { id: string; data: UpsertPropertyInput }) => reApi.updateProperty(v.id, v.data), onSuccess: invalidate });
}
export function useDeleteProperty() {
  const invalidate = useInvalidateProperties();
  return useMutation({ mutationFn: (id: string) => reApi.deleteProperty(id), onSuccess: invalidate });
}

export function useUnits(params: RePageParams & { propertyId?: string } = {}) {
  return useQuery({
    queryKey: [QK, "units", params],
    queryFn:  () => reApi.getUnits(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}
export function useUnitSummary()     { return useQuery({ queryKey: [QK, "unit-summary"],       queryFn: reApi.getUnitSummary,      staleTime: 60_000 }); }
export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: UpsertUnitRequest) => reApi.createUnit(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "units"] }); qc.invalidateQueries({ queryKey: [QK, "unit-summary"] }); toast.success("Unit saved."); }, onError: (e: Error) => toast.error(e.message) });
}

export function useTenants(params: RePageParams & { tenantType?: string } = {}) {
  return useQuery({
    queryKey: [QK, "tenants", params],
    queryFn:  () => reApi.getTenants(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}
export function useTenantSummary()   { return useQuery({ queryKey: [QK, "tenant-summary"],     queryFn: reApi.getTenantSummary,    staleTime: 60_000 }); }
export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: CreateTenantRequest) => reApi.createTenant(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "tenants"] }); qc.invalidateQueries({ queryKey: [QK, "tenant-summary"] }); toast.success("Tenant saved."); }, onError: (e: Error) => toast.error(e.message) });
}

export function useBrokers(params: RePageParams = {}) {
  return useQuery({
    queryKey: [QK, "brokers", params],
    queryFn:  () => reApi.getBrokers(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
}
export function useBrokerSummary()   { return useQuery({ queryKey: [QK, "broker-summary"],     queryFn: reApi.getBrokerSummary,    staleTime: 60_000 }); }
export function useCreateBroker() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, unknown>) => reApi.createBroker(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "brokers"] }); qc.invalidateQueries({ queryKey: [QK, "broker-summary"] }); toast.success("Broker saved."); }, onError: (e: Error) => toast.error(e.message) });
}

// ── Lease contracts ─────────────────────────────────────────────────────────
export function useContracts(params?: { tenantId?: string; status?: string }) {
  return useQuery({
    queryKey: [QK, "contracts", params?.tenantId ?? "", params?.status ?? ""],
    queryFn: () => reApi.getContracts(params),
    staleTime: 60_000,
  });
}
export function useContractSummary() { return useQuery({ queryKey: [QK, "contract-summary"], queryFn: reApi.getContractSummary, staleTime: 60_000 }); }

export function useContract(id: string | null) {
  return useQuery({
    queryKey: [QK, "contract", id],
    queryFn: () => reApi.getContract(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Invalidates everything a rent write can move. A payment changes the installment, the lease's
 * totals, the portfolio summary and the tenant's outstanding balance — refreshing only the
 * contract leaves the stat cards stale and reading as though nothing was collected.
 */
function useInvalidateContracts() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: [QK, "contracts"] });
    qc.invalidateQueries({ queryKey: [QK, "contract-summary"] });
    qc.invalidateQueries({ queryKey: [QK, "rent-due"] });
    qc.invalidateQueries({ queryKey: [QK, "expiring"] });
    qc.invalidateQueries({ queryKey: [QK, "tenants"] });
    qc.invalidateQueries({ queryKey: [QK, "units"] });
    if (id) qc.invalidateQueries({ queryKey: [QK, "contract", id] });
  };
}

export function useCreateContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (d: CreateContractRequest) => reApi.createContract(d),
    onSuccess: (r) => {
      invalidate();

      // Say what the advance actually settled and when the tenant will next be chased — that is
      // the question the person creating the lease has, and it is the only confirmation that the
      // advance landed where they expected.
      const parts = [`Lease ${r.contractNumber} created`];
      if (r.installmentsCreated > 0)
        parts.push(`${r.installmentsCreated} payment${r.installmentsCreated === 1 ? "" : "s"} scheduled`);
      if (r.advanceApplied > 0)
        parts.push(`advance settled ${r.installmentsSettledByAdvance} of them`);
      if (r.nextDueDate) parts.push(`next due ${r.nextDueDate}`);
      else if (r.advanceApplied > 0) parts.push("fully paid up front");

      toast.success(parts.join(" — ") + ".");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (v: { id: string; data: UpdateContractRequest }) => reApi.updateContract(v.id, v.data),
    onSuccess: (_r, v) => { invalidate(v.id); toast.success("Lease updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetContractStatus() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (v: { id: string; status: ContractStatus }) => reApi.setContractStatus(v.id, v.status),
    onSuccess: (_r, v) => { invalidate(v.id); toast.success("Lease status updated."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (id: string) => reApi.deleteContract(id),
    onSuccess: () => { invalidate(); toast.success("Lease deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Rent schedule ───────────────────────────────────────────────────────────
export function useGenerateSchedule() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (v: { id: string; replaceExisting?: boolean }) => reApi.generateSchedule(v.id, v.replaceExisting ?? false),
    onSuccess: (rows, v) => { invalidate(v.id); toast.success(`${rows.length} payment${rows.length === 1 ? "" : "s"} scheduled.`); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecordRentPayment() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (v: {
      id: string; installmentId: string;
      amount: number; paidDate: string; method?: string | null; reference?: string | null; notes?: string | null;
    }) => reApi.recordRentPayment(v.id, v.installmentId, {
      amount: v.amount, paidDate: v.paidDate, method: v.method, reference: v.reference, notes: v.notes,
    }),
    onSuccess: (_r, v) => { invalidate(v.id); toast.success("Payment recorded."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useWaiveInstallment() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (v: { id: string; installmentId: string; reason?: string | null }) =>
      reApi.waiveInstallment(v.id, v.installmentId, v.reason),
    onSuccess: (_r, v) => { invalidate(v.id); toast.success("Installment waived."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRentDue(withinDays = 30, includeOverdue = true) {
  return useQuery({
    queryKey: [QK, "rent-due", withinDays, includeOverdue],
    queryFn: () => reApi.getRentDue(withinDays, includeOverdue),
    staleTime: 60_000,
  });
}

export function useSendRentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; installmentId?: string }) => reApi.sendRentReminder(v.id, v.installmentId),
    onSuccess: (message) => {
      qc.invalidateQueries({ queryKey: [QK, "alert-logs"] });
      toast.success(message || "Reminder sent.");
    },
    // A send that did not leave the building must read as a failure, not a cheerful success.
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Rent + expiry alerts ────────────────────────────────────────────────────
export function useAlertSettings() {
  return useQuery({ queryKey: [QK, "alert-settings"], queryFn: reApi.getAlertSettings, staleTime: 60_000 });
}

export function useUpdateAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Omit<RentAlertSettingsDto, "emailConfigured">) => reApi.updateAlertSettings(d),
    onSuccess: (settings) => {
      qc.setQueryData([QK, "alert-settings"], settings);
      qc.invalidateQueries({ queryKey: [QK, "alert-settings"] });
      toast.success("Reminder settings saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAlertLogs(contractId?: string, limit = 100) {
  return useQuery({
    queryKey: [QK, "alert-logs", contractId ?? "", limit],
    queryFn: () => reApi.getAlertLogs(contractId, limit),
    staleTime: 30_000,
  });
}

export function useExpiringContracts(withinDays = 90) {
  return useQuery({
    queryKey: [QK, "expiring", withinDays],
    queryFn: () => reApi.getExpiringContracts(withinDays),
    staleTime: 60_000,
  });
}

export function useRunAlertSweep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) => reApi.runAlertSweep(dryRun),
    onSuccess: (r, dryRun) => {
      qc.invalidateQueries({ queryKey: [QK, "alert-logs"] });
      const total = r.dueRemindersSent + r.overdueRemindersSent + r.expiryRemindersSent;
      if (r.failed > 0) toast.error(`${r.failed} notice${r.failed === 1 ? "" : "s"} could not be delivered.`);
      else if (total === 0) toast.info(r.messages[0] ?? "Nothing due for a reminder today.");
      else toast.success(dryRun ? `${total} notice${total === 1 ? "" : "s"} would be sent.` : `${total} notice${total === 1 ? "" : "s"} sent.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
