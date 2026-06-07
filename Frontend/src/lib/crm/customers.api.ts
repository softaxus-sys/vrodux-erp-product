import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/crm`;

export type CustomerStatus = "active" | "inactive" | "at_risk" | "churned";
export type CustomerTier   = "standard" | "silver" | "gold" | "platinum";

export interface CustomerContactDto {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  department: string;
}

export interface CustomerDealDto {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  closedDate?: string;
}

export interface CustomerActivityDto {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "support";
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  tradeName?: string;
  industry: string;
  website?: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: CustomerStatus;
  tier: CustomerTier;
  accountManager: string;
  since: string;
  lastActivity?: string;
  totalRevenue: number;
  openDeals: number;
  currency: string;
  employees?: string;
  description: string;
  contacts: CustomerContactDto[];
  deals: CustomerDealDto[];
  activities: CustomerActivityDto[];
  tags: string[];
  contractRenewal?: string;
  npsScore?: number;
}

export interface CustomerSummaryDto {
  total: number;
  active: number;
  inactive: number;
  platinum: number;
  gold: number;
  totalRevenue: number;
  openDeals: number;
  avgNps: number;
}

export interface CreateCustomerRequest {
  name: string;
  industry: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  status: CustomerStatus;
  tier: CustomerTier;
  accountManager: string;
  currency: string;
  description: string;
  website?: string;
  tradeName?: string;
  employees?: string;
  tags?: string[];
}

export const customersApi = {
  getAll: (params?: Record<string, string>): Promise<CustomerDto[]> => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return rawApiClient.get<CustomerDto[]>(`${BASE}/customers${qs}`);
  },

  getById: (id: string): Promise<CustomerDto> =>
    rawApiClient.get<CustomerDto>(`${BASE}/customers/${id}`),

  create: (data: CreateCustomerRequest): Promise<CustomerDto> =>
    rawApiClient.post<CustomerDto>(`${BASE}/customers`, data),

  getSummary: (): Promise<CustomerSummaryDto> =>
    rawApiClient.get<CustomerSummaryDto>(`${BASE}/customers/summary`),
};
