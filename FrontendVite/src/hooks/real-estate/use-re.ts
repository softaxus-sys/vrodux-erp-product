import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reApi, type UpsertPropertyInput } from "@/lib/real-estate/re.api";

const QK = "real-estate";

export function useProperties()      { return useQuery({ queryKey: [QK, "properties"],        queryFn: reApi.getProperties,      staleTime: 60_000 }); }
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

export function useUnits()           { return useQuery({ queryKey: [QK, "units"],              queryFn: reApi.getUnits,            staleTime: 60_000 }); }
export function useUnitSummary()     { return useQuery({ queryKey: [QK, "unit-summary"],       queryFn: reApi.getUnitSummary,      staleTime: 60_000 }); }
export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, unknown>) => reApi.createUnit(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "units"] }); qc.invalidateQueries({ queryKey: [QK, "unit-summary"] }); toast.success("Unit saved."); }, onError: (e: Error) => toast.error(e.message) });
}

export function useTenants()         { return useQuery({ queryKey: [QK, "tenants"],            queryFn: reApi.getTenants,          staleTime: 60_000 }); }
export function useTenantSummary()   { return useQuery({ queryKey: [QK, "tenant-summary"],     queryFn: reApi.getTenantSummary,    staleTime: 60_000 }); }
export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, unknown>) => reApi.createTenant(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "tenants"] }); qc.invalidateQueries({ queryKey: [QK, "tenant-summary"] }); toast.success("Tenant saved."); }, onError: (e: Error) => toast.error(e.message) });
}

export function useBrokers()         { return useQuery({ queryKey: [QK, "brokers"],            queryFn: reApi.getBrokers,          staleTime: 60_000 }); }
export function useBrokerSummary()   { return useQuery({ queryKey: [QK, "broker-summary"],     queryFn: reApi.getBrokerSummary,    staleTime: 60_000 }); }
export function useCreateBroker() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, unknown>) => reApi.createBroker(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "brokers"] }); qc.invalidateQueries({ queryKey: [QK, "broker-summary"] }); toast.success("Broker saved."); }, onError: (e: Error) => toast.error(e.message) });
}

export function useContracts()       { return useQuery({ queryKey: [QK, "contracts"],          queryFn: reApi.getContracts,        staleTime: 60_000 }); }
export function useContractSummary() { return useQuery({ queryKey: [QK, "contract-summary"],   queryFn: reApi.getContractSummary,  staleTime: 60_000 }); }
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (d: Record<string, unknown>) => reApi.createContract(d), onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "contracts"] }); qc.invalidateQueries({ queryKey: [QK, "contract-summary"] }); toast.success("Contract created."); }, onError: (e: Error) => toast.error(e.message) });
}
