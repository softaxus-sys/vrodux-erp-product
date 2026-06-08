import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useTenants()         { return useQuery({ queryKey: [QK, "tenants"],            queryFn: reApi.getTenants,          staleTime: 60_000 }); }
export function useTenantSummary()   { return useQuery({ queryKey: [QK, "tenant-summary"],     queryFn: reApi.getTenantSummary,    staleTime: 60_000 }); }

export function useBrokers()         { return useQuery({ queryKey: [QK, "brokers"],            queryFn: reApi.getBrokers,          staleTime: 60_000 }); }
export function useBrokerSummary()   { return useQuery({ queryKey: [QK, "broker-summary"],     queryFn: reApi.getBrokerSummary,    staleTime: 60_000 }); }

export function useContracts()       { return useQuery({ queryKey: [QK, "contracts"],          queryFn: reApi.getContracts,        staleTime: 60_000 }); }
export function useContractSummary() { return useQuery({ queryKey: [QK, "contract-summary"],   queryFn: reApi.getContractSummary,  staleTime: 60_000 }); }
