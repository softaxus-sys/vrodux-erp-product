import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { realEstateApi, type BrokersPageParams, type PropertiesPageParams, type RecordPaymentBody, type TenantsPageParams, type UnitsPageParams } from "@/lib/real-estate.api";

const QK = "real-estate" as const;

// ── Properties ───────────────────────────────────────────────────────────────────────────────

export function usePropertiesSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "properties", "summary"], queryFn: realEstateApi.getPropertiesSummary, enabled });
}

export function usePropertiesPaged(params: PropertiesPageParams, enabled = true) {
  return useQuery({ queryKey: [QK, "properties", "paged", params], queryFn: () => realEstateApi.getProperties(params), enabled });
}

export function useProperty(id: string) {
  return useQuery({ queryKey: [QK, "property", id], queryFn: () => realEstateApi.getProperty(id), enabled: Boolean(id) });
}

// ── Units ────────────────────────────────────────────────────────────────────────────────────

export function useUnitsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "units", "summary"], queryFn: realEstateApi.getUnitsSummary, enabled });
}

export function useUnitsPaged(params: UnitsPageParams, enabled = true) {
  return useQuery({ queryKey: [QK, "units", "paged", params], queryFn: () => realEstateApi.getUnits(params), enabled });
}

// ── Tenants ──────────────────────────────────────────────────────────────────────────────────

export function useTenantsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "tenants", "summary"], queryFn: realEstateApi.getTenantsSummary, enabled });
}

export function useTenantsPaged(params: TenantsPageParams, enabled = true) {
  return useQuery({ queryKey: [QK, "tenants", "paged", params], queryFn: () => realEstateApi.getTenants(params), enabled });
}

// ── Contracts + rent schedule ────────────────────────────────────────────────────────────────

export function useContractsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "contracts", "summary"], queryFn: realEstateApi.getContractsSummary, enabled });
}

export function useContracts(status: string, enabled = true) {
  return useQuery({ queryKey: [QK, "contracts", status], queryFn: () => realEstateApi.getContracts(status), enabled });
}

export function useContractsByTenant(tenantId: string) {
  return useQuery({
    queryKey: [QK, "contracts", "by-tenant", tenantId],
    queryFn: () => realEstateApi.getContracts(undefined, tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useContract(id: string) {
  return useQuery({ queryKey: [QK, "contract", id], queryFn: () => realEstateApi.getContract(id), enabled: Boolean(id) });
}

export function useRentDue(withinDays: number, enabled = true) {
  return useQuery({ queryKey: [QK, "rent-due", withinDays], queryFn: () => realEstateApi.getRentDue(withinDays), enabled });
}

function invalidateContract(qc: ReturnType<typeof useQueryClient>, contractId: string) {
  qc.invalidateQueries({ queryKey: [QK, "contract", contractId] });
  qc.invalidateQueries({ queryKey: [QK, "contracts"] });
  qc.invalidateQueries({ queryKey: [QK, "rent-due"] });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, installmentId, body }: { contractId: string; installmentId: string; body: RecordPaymentBody }) =>
      realEstateApi.recordPayment(contractId, installmentId, body),
    onSuccess: (_data, { contractId }) => invalidateContract(qc, contractId),
  });
}

export function useWaiveInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, installmentId, reason }: { contractId: string; installmentId: string; reason?: string }) =>
      realEstateApi.waiveInstallment(contractId, installmentId, reason),
    onSuccess: (_data, { contractId }) => invalidateContract(qc, contractId),
  });
}

export function useRemindContract() {
  return useMutation({
    mutationFn: ({ contractId, installmentId }: { contractId: string; installmentId?: string }) => realEstateApi.remind(contractId, installmentId),
  });
}

// ── Brokers ──────────────────────────────────────────────────────────────────────────────────

export function useBrokersSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "brokers", "summary"], queryFn: realEstateApi.getBrokersSummary, enabled });
}

export function useBrokersPaged(params: BrokersPageParams, enabled = true) {
  return useQuery({ queryKey: [QK, "brokers", "paged", params], queryFn: () => realEstateApi.getBrokers(params), enabled });
}
