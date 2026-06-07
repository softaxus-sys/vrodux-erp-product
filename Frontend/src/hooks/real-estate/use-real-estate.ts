import { useQuery } from "@tanstack/react-query";
import { realEstateApi } from "@/lib/real-estate/real-estate.api";

export const realEstateKeys = {
  all:        ["real-estate"] as const,
  properties: () => [...realEstateKeys.all, "properties"] as const,
  property:   (id: string) => [...realEstateKeys.all, "property", id] as const,
  units:      (propertyId?: string) => [...realEstateKeys.all, "units", propertyId ?? "all"] as const,
  unit:       (id: string) => [...realEstateKeys.all, "unit", id] as const,
  tenants:    () => [...realEstateKeys.all, "tenants"] as const,
  tenant:     (id: string) => [...realEstateKeys.all, "tenant", id] as const,
  contracts:  () => [...realEstateKeys.all, "contracts"] as const,
  contract:   (id: string) => [...realEstateKeys.all, "contract", id] as const,
  brokers:    () => [...realEstateKeys.all, "brokers"] as const,
  broker:     (id: string) => [...realEstateKeys.all, "broker", id] as const,
  summary:    () => [...realEstateKeys.all, "summary"] as const,
};

export function useProperties() {
  return useQuery({
    queryKey: realEstateKeys.properties(),
    queryFn:  () => realEstateApi.getProperties(),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: realEstateKeys.property(id),
    queryFn:  () => realEstateApi.getProperty(id),
    enabled:  !!id,
  });
}

export function useUnits(propertyId?: string) {
  return useQuery({
    queryKey: realEstateKeys.units(propertyId),
    queryFn:  () => realEstateApi.getUnits(propertyId),
  });
}

export function useUnit(id: string) {
  return useQuery({
    queryKey: realEstateKeys.unit(id),
    queryFn:  () => realEstateApi.getUnit(id),
    enabled:  !!id,
  });
}

export function useTenants() {
  return useQuery({
    queryKey: realEstateKeys.tenants(),
    queryFn:  () => realEstateApi.getTenants(),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: realEstateKeys.tenant(id),
    queryFn:  () => realEstateApi.getTenant(id),
    enabled:  !!id,
  });
}

export function useContracts() {
  return useQuery({
    queryKey: realEstateKeys.contracts(),
    queryFn:  () => realEstateApi.getContracts(),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: realEstateKeys.contract(id),
    queryFn:  () => realEstateApi.getContract(id),
    enabled:  !!id,
  });
}

export function useBrokers() {
  return useQuery({
    queryKey: realEstateKeys.brokers(),
    queryFn:  () => realEstateApi.getBrokers(),
  });
}

export function useBroker(id: string) {
  return useQuery({
    queryKey: realEstateKeys.broker(id),
    queryFn:  () => realEstateApi.getBroker(id),
    enabled:  !!id,
  });
}

export function useRealEstateSummary() {
  return useQuery({
    queryKey: realEstateKeys.summary(),
    queryFn:  () => realEstateApi.getSummary(),
  });
}
