import { useQuery } from "@tanstack/react-query";
import { reApi } from "@/lib/real-estate/re.api";

const QK = "real-estate";

export function useProperties()      { return useQuery({ queryKey: [QK, "properties"],        queryFn: reApi.getProperties,      staleTime: 60_000 }); }
export function usePropertySummary() { return useQuery({ queryKey: [QK, "property-summary"],  queryFn: reApi.getPropertySummary,  staleTime: 60_000 }); }

export function useUnits()           { return useQuery({ queryKey: [QK, "units"],              queryFn: reApi.getUnits,            staleTime: 60_000 }); }
export function useUnitSummary()     { return useQuery({ queryKey: [QK, "unit-summary"],       queryFn: reApi.getUnitSummary,      staleTime: 60_000 }); }

export function useTenants()         { return useQuery({ queryKey: [QK, "tenants"],            queryFn: reApi.getTenants,          staleTime: 60_000 }); }
export function useTenantSummary()   { return useQuery({ queryKey: [QK, "tenant-summary"],     queryFn: reApi.getTenantSummary,    staleTime: 60_000 }); }

export function useBrokers()         { return useQuery({ queryKey: [QK, "brokers"],            queryFn: reApi.getBrokers,          staleTime: 60_000 }); }
export function useBrokerSummary()   { return useQuery({ queryKey: [QK, "broker-summary"],     queryFn: reApi.getBrokerSummary,    staleTime: 60_000 }); }

export function useContracts()       { return useQuery({ queryKey: [QK, "contracts"],          queryFn: reApi.getContracts,        staleTime: 60_000 }); }
export function useContractSummary() { return useQuery({ queryKey: [QK, "contract-summary"],   queryFn: reApi.getContractSummary,  staleTime: 60_000 }); }
