import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/real-estate`;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropertyType   = "residential" | "commercial" | "mixed_use" | "industrial" | "retail";
export type PropertyStatus = "active" | "inactive" | "under_development";
export type UnitType       = "apartment" | "villa" | "office" | "retail_shop" | "warehouse" | "studio";
export type UnitStatus     = "vacant" | "rented" | "reserved" | "maintenance" | "for_sale" | "sold";
export type TenantStatus   = "active" | "inactive" | "blacklisted";
export type ContractStatus = "draft" | "active" | "expiring_soon" | "expired" | "terminated";
export type BrokerStatus   = "active" | "inactive";
export type PaymentHistory = "excellent" | "good" | "fair" | "poor";

export interface PropertyDto {
  id: string;
  propertyCode: string;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  location: { address: string; city: string; emirate: string };
  developer: string;
  totalUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalValue: number;
  annualRent: number;
  managedBy: string;
  yearBuilt: number;
  facilities: string[];
}

export interface UnitDto {
  id: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  type: UnitType;
  status: UnitStatus;
  floor: number;
  area: number;
  bedrooms: number | null;
  bathrooms: number;
  rentPricePA: number;
  salePriceIfForSale: number | null;
  tenantId: string | null;
  tenantName: string | null;
  contractId: string | null;
  contractExpiry: string | null;
  lastMaintenanceDate: string | null;
}

export interface TenantDto {
  id: string;
  tenantCode: string;
  name: string;
  type: "individual" | "corporate";
  status: TenantStatus;
  contactPerson: string;
  email: string;
  phone: string;
  nationality: string;
  emiratesId: string | null;
  trn: string | null;
  totalUnits: number;
  monthlyRent: number;
  activeContractId: string | null;
  outstandingBalance: number;
  paymentHistory: PaymentHistory;
  joinDate: string;
  notes: string;
}

export interface BrokerDto {
  id: string;
  brokerCode: string;
  name: string;
  agencyName: string;
  rera: string;
  email: string;
  phone: string;
  status: BrokerStatus;
  specializations: PropertyType[];
  rating: number;
  activeListings: number;
  closedDeals: number;
  totalCommission: number;
  avgDealValue: number;
  joinDate: string;
}

export interface ContractDto {
  id: string;
  contractNumber: string;
  type: "lease" | "sale";
  status: ContractStatus;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  brokerId: string | null;
  brokerName: string | null;
  startDate: string;
  endDate: string;
  rentAmount: number | null;
  saleAmount: number | null;
  depositAmount: number;
  paymentFrequency: "monthly" | "quarterly" | "annual";
  nextPaymentDate: string | null;
  lastPaymentDate: string | null;
  contractDoc: string;
  notes: string;
}

// ── Summary DTOs ──────────────────────────────────────────────────────────────

export interface RePropertySummaryDto {
  totalProperties: number;
  activeProperties: number;
  totalUnits: number;
  vacantUnits: number;
  totalPortfolioValue: number;
  avgOccupancyRate: number;
  totalAnnualRent: number;
}

export interface ReUnitSummaryDto {
  total: number;
  vacant: number;
  rented: number;
  maintenance: number;
  forSale: number;
  occupancyRate: number;
}

export interface ReTenantSummaryDto {
  total: number;
  active: number;
  corporate: number;
  individual: number;
  totalOutstanding: number;
}

export interface ReBrokerSummaryDto {
  total: number;
  active: number;
  totalDeals: number;
  totalCommission: number;
  avgRating: number;
  avgDealValue: number;
}

export interface ReContractSummaryDto {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  leaseCount: number;
  saleCount: number;
}

// ── API client ────────────────────────────────────────────────────────────────

export interface UpsertPropertyInput {
  name: string;
  propertyType: string;
  address?: string;
  city?: string;
  emirate: string;
  totalArea: number;
  totalUnits: number;
  marketValue: number;
  developer?: string | null;
  description?: string | null;
}

export const reApi = {
  getProperties:       (): Promise<PropertyDto[]>          => rawApiClient.get(`${BASE}/properties`),
  getPropertySummary:  (): Promise<RePropertySummaryDto>   => rawApiClient.get(`${BASE}/properties/summary`),
  createProperty:      (data: UpsertPropertyInput)         => rawApiClient.post(`${BASE}/properties`, data),
  updateProperty:      (id: string, data: UpsertPropertyInput) => rawApiClient.put(`${BASE}/properties/${id}`, data),
  deleteProperty:      (id: string)                        => rawApiClient.delete(`${BASE}/properties/${id}`),

  getUnits:            (): Promise<UnitDto[]>              => rawApiClient.get(`${BASE}/units`),
  getUnitSummary:      (): Promise<ReUnitSummaryDto>       => rawApiClient.get(`${BASE}/units/summary`),
  createUnit:          (data: Record<string, unknown>): Promise<UnitDto> => rawApiClient.post(`${BASE}/units`, data),
  deleteUnit:          (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/units/${id}`),

  getTenants:          (): Promise<TenantDto[]>            => rawApiClient.get(`${BASE}/tenants`),
  getTenantSummary:    (): Promise<ReTenantSummaryDto>     => rawApiClient.get(`${BASE}/tenants/summary`),
  createTenant:        (data: Record<string, unknown>): Promise<TenantDto> => rawApiClient.post(`${BASE}/tenants`, data),
  deleteTenant:        (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/tenants/${id}`),

  getBrokers:          (): Promise<BrokerDto[]>            => rawApiClient.get(`${BASE}/brokers`),
  getBrokerSummary:    (): Promise<ReBrokerSummaryDto>     => rawApiClient.get(`${BASE}/brokers/summary`),
  createBroker:        (data: Record<string, unknown>): Promise<BrokerDto> => rawApiClient.post(`${BASE}/brokers`, data),
  deleteBroker:        (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/brokers/${id}`),

  getContracts:        (): Promise<ContractDto[]>          => rawApiClient.get(`${BASE}/contracts`),
  getContractSummary:  (): Promise<ReContractSummaryDto>   => rawApiClient.get(`${BASE}/contracts/summary`),
  createContract:      (data: Record<string, unknown>): Promise<ContractDto> => rawApiClient.post(`${BASE}/contracts`, data),
  deleteContract:      (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/contracts/${id}`),
};
