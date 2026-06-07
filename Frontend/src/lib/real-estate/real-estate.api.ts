import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/real-estate`;

export type PropertyType    = "residential" | "commercial" | "mixed_use" | "industrial" | "retail";
export type PropertyStatus  = "active" | "inactive" | "under_development";
export type UnitType        = "apartment" | "villa" | "office" | "retail_shop" | "warehouse" | "studio";
export type UnitStatus      = "vacant" | "rented" | "reserved" | "maintenance" | "for_sale" | "sold";
export type TenantStatus    = "active" | "inactive" | "blacklisted";
export type ContractStatus  = "draft" | "active" | "expiring_soon" | "expired" | "terminated";
export type BrokerStatus    = "active" | "inactive";

export interface PropertyDto {
  id: string;
  propertyCode: string;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  locationAddress: string;
  locationCity: string;
  locationEmirate: string;
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
  activeContracts: number;
  totalRentPA: number;
  paymentHistory: "excellent" | "good" | "fair" | "poor";
  notes: string;
}

export interface RentalContractDto {
  id: string;
  contractNumber: string;
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  annualRent: number;
  securityDeposit: number;
  paymentFrequency: string;
  signedDate: string | null;
  notes: string;
}

export interface BrokerDto {
  id: string;
  brokerCode: string;
  name: string;
  agency: string;
  status: BrokerStatus;
  licenseNumber: string;
  licenseExpiry: string;
  email: string;
  phone: string;
  specializations: string[];
  activeListings: number;
  closedDeals: number;
  totalCommission: number;
  rating: number;
}

export interface RealEstateSummaryDto {
  totalProperties: number;
  totalUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalAnnualRent: number;
  activeTenants: number;
  activeContracts: number;
  expiringContracts: number;
}

export const realEstateApi = {
  getProperties: (): Promise<PropertyDto[]> =>
    rawApiClient.get<PropertyDto[]>(`${BASE}/properties`),
  getProperty: (id: string): Promise<PropertyDto> =>
    rawApiClient.get<PropertyDto>(`${BASE}/properties/${id}`),

  getUnits: (propertyId?: string): Promise<UnitDto[]> => {
    const qs = propertyId ? `?propertyId=${propertyId}` : "";
    return rawApiClient.get<UnitDto[]>(`${BASE}/units${qs}`);
  },
  getUnit: (id: string): Promise<UnitDto> =>
    rawApiClient.get<UnitDto>(`${BASE}/units/${id}`),

  getTenants: (): Promise<TenantDto[]> =>
    rawApiClient.get<TenantDto[]>(`${BASE}/tenants`),
  getTenant: (id: string): Promise<TenantDto> =>
    rawApiClient.get<TenantDto>(`${BASE}/tenants/${id}`),

  getContracts: (): Promise<RentalContractDto[]> =>
    rawApiClient.get<RentalContractDto[]>(`${BASE}/contracts`),
  getContract: (id: string): Promise<RentalContractDto> =>
    rawApiClient.get<RentalContractDto>(`${BASE}/contracts/${id}`),

  getBrokers: (): Promise<BrokerDto[]> =>
    rawApiClient.get<BrokerDto[]>(`${BASE}/brokers`),
  getBroker: (id: string): Promise<BrokerDto> =>
    rawApiClient.get<BrokerDto>(`${BASE}/brokers/${id}`),

  getSummary: (): Promise<RealEstateSummaryDto> =>
    rawApiClient.get<RealEstateSummaryDto>(`${BASE}/summary`),
};
