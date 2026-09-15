import { apiClient, type PagedResult } from "@/lib/api-client";
import type {
  BrokerDto,
  BrokersSummaryDto,
  ContractDetailDto,
  ContractDto,
  ContractsSummaryDto,
  PropertiesSummaryDto,
  PropertyDto,
  RentDueItemDto,
  TenantDto,
  TenantsSummaryDto,
  UnitDto,
  UnitsSummaryDto,
} from "@/types/real-estate";

const BASE = "/api/real-estate";

// Read keys, plus the two rent-collection action keys -- create/edit/delete on properties, units,
// tenants and contracts are all real multi-field forms (a contract create alone picks a property
// -> vacant unit -> tenant and can seed an advance-rent schedule), desktop-appropriate and left
// unused here, same call as Sales/Purchase order creation.
export const REAL_ESTATE_PROPERTIES_VIEW = "real-estate.properties.view";
export const REAL_ESTATE_UNITS_VIEW = "real-estate.units.view";
export const REAL_ESTATE_TENANTS_VIEW = "real-estate.tenants.view";
export const REAL_ESTATE_CONTRACTS_VIEW = "real-estate.contracts.view";
export const REAL_ESTATE_RENT_VIEW = "real-estate.rent.view";
// Recording money received is gated separately from editing the lease on the backend -- "the
// person who takes a cheque at the counter is rarely the person allowed to change the rent"
// (ContractsController's own comment) -- so this is genuinely its own key, not a nearest-key rule.
export const REAL_ESTATE_RENT_RECORD = "real-estate.rent.record";
export const REAL_ESTATE_RENT_REMIND = "real-estate.rent.remind";
export const REAL_ESTATE_BROKERS_VIEW = "real-estate.brokers.view";

export interface PropertiesPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  propertyType?: string;
}

export interface UnitsPageParams {
  page?: number;
  pageSize?: number;
  propertyId?: string;
  search?: string;
  status?: string;
}

export interface TenantsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  tenantType?: string;
}

export interface BrokersPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface RecordPaymentBody {
  amount: number;
  paidDate: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

function qs(params: Record<string, string | number | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export const realEstateApi = {
  // ── Properties ───────────────────────────────────────────────────────────────────────────
  getPropertiesSummary: (): Promise<PropertiesSummaryDto> => apiClient.get(`${BASE}/properties/summary`),
  getProperties: (p: PropertiesPageParams): Promise<PagedResult<PropertyDto>> =>
    apiClient.get(`${BASE}/properties${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, search: p.search, status: p.status, propertyType: p.propertyType })}`),
  getProperty: (id: string): Promise<PropertyDto> => apiClient.get(`${BASE}/properties/${id}`),

  // ── Units ────────────────────────────────────────────────────────────────────────────────
  getUnitsSummary: (): Promise<UnitsSummaryDto> => apiClient.get(`${BASE}/units/summary`),
  getUnits: (p: UnitsPageParams): Promise<PagedResult<UnitDto>> =>
    apiClient.get(`${BASE}/units${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, propertyId: p.propertyId, search: p.search, status: p.status })}`),

  // ── Tenants ──────────────────────────────────────────────────────────────────────────────
  getTenantsSummary: (): Promise<TenantsSummaryDto> => apiClient.get(`${BASE}/tenants/summary`),
  getTenants: (p: TenantsPageParams): Promise<PagedResult<TenantDto>> =>
    apiClient.get(`${BASE}/tenants${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, search: p.search, status: p.status, tenantType: p.tenantType })}`),

  // ── Contracts + rent schedule ────────────────────────────────────────────────────────────
  getContractsSummary: (): Promise<ContractsSummaryDto> => apiClient.get(`${BASE}/contracts/summary`),
  getContracts: (status?: string, tenantId?: string): Promise<ContractDto[]> =>
    apiClient.get(`${BASE}/contracts${qs({ status: status && status !== "all" ? status : undefined, tenantId })}`),
  getContract: (id: string): Promise<ContractDetailDto> => apiClient.get(`${BASE}/contracts/${id}`),
  getRentDue: (withinDays = 30, includeOverdue = true): Promise<RentDueItemDto[]> =>
    apiClient.get(`${BASE}/contracts/rent-due${qs({ withinDays, includeOverdue: String(includeOverdue) })}`),
  recordPayment: (contractId: string, installmentId: string, body: RecordPaymentBody): Promise<void> =>
    apiClient.post(`${BASE}/contracts/${contractId}/installments/${installmentId}/payment`, body),
  waiveInstallment: (contractId: string, installmentId: string, reason?: string): Promise<void> =>
    apiClient.post(`${BASE}/contracts/${contractId}/installments/${installmentId}/waive`, { reason }),
  /** Omit installmentId to send the lease-expiry notice instead of an installment reminder. */
  remind: (contractId: string, installmentId?: string): Promise<void> =>
    apiClient.post(`${BASE}/contracts/${contractId}/remind${qs({ installmentId })}`, {}),

  // ── Brokers ──────────────────────────────────────────────────────────────────────────────
  getBrokersSummary: (): Promise<BrokersSummaryDto> => apiClient.get(`${BASE}/brokers/summary`),
  getBrokers: (p: BrokersPageParams): Promise<PagedResult<BrokerDto>> =>
    apiClient.get(`${BASE}/brokers${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, search: p.search, status: p.status })}`),
};
