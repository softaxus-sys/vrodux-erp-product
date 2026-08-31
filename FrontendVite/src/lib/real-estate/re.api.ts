import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/real-estate`;
const ALERTS = `${BASE}/rent-alerts`;

/** Builds a query string from defined values only, so an unset filter is omitted rather than
 * sent as the literal "undefined". */
function qs(params?: Record<string, string | undefined>) {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? `?${new URLSearchParams(entries as [string, string][])}` : "";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropertyType   = "residential" | "commercial" | "mixed_use" | "industrial" | "retail";
/** Occupancy-derived, set by the server from how many units are let. The old
 *  "active | inactive | under_development" values were never returned by anything, so every
 *  lookup keyed on them resolved to undefined. */
export type PropertyStatus = "available" | "partially_occupied" | "fully_occupied";
export type UnitType       = "apartment" | "villa" | "office" | "retail_shop" | "warehouse" | "studio";
export type UnitStatus     = "vacant" | "rented" | "reserved" | "maintenance" | "for_sale" | "sold";
export type TenantStatus   = "active" | "inactive" | "blacklisted";
export type ContractStatus = "active" | "expired" | "terminated" | "renewed";
export type BrokerStatus   = "active" | "inactive";
export type PaymentHistory = "excellent" | "good" | "fair" | "poor";

export interface PropertyUnitSummaryDto {
  id: string;
  unitNumber: string;
  unitType: string;
  area: number;
  floor: number;
  rentPerYear: number;
  salePrice: number;
  status: UnitStatus;
  currentTenantId: string | null;
  currentTenantName: string | null;
}

export interface PropertyDto {
  id: string;
  propertyNumber: string;
  name: string;
  propertyType: string;
  status: PropertyStatus;
  location: { address: string; city: string; emirate: string };
  totalArea: number;
  totalUnits: number;
  occupiedUnits: number;
  marketValue: number;
  developer: string | null;
  description: string | null;
  occupancyRate: number;
  /** Only populated by GET /properties/{id}; the list returns it too but it is the detail that
   *  matters — rent per property is derived from these, since the property has no rent of its own. */
  units: PropertyUnitSummaryDto[];
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

  // The fields above this line are NOT all returned by the API (see note on ContractDto).
  // These are the ones the units endpoint actually sends:
  unitType: string;
  rentPerYear: number;
  salePrice: number;
  currentTenantId: string | null;
  currentTenantName: string | null;
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

  // Actually returned by the tenants endpoint:
  tenantNumber: string;
  tenantType: string;
  activeContracts: number;
  totalPaid: number;
  passportNumber: string | null;
  occupation: string | null;
  monthlyIncome: number | null;
  emergencyContact: string | null;
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


/** Mirrors CreateUnitCommand field for field. Typed, not Record<string, unknown> — the untyped
 *  version is why the form could post propertyName/annualRent/sellingPrice unnoticed. */
export interface UpsertUnitRequest {
  propertyId: string;
  unitNumber: string;
  unitType: string;
  area: number;
  floor: number;
  rentPerYear: number;
  salePrice: number;
  furnishing?: string;
  view?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  serviceCharge?: number;
  notes?: string;
}

/** Mirrors CreateTenantCommand field for field. */
export interface CreateTenantRequest {
  name: string;
  tenantType: "individual" | "company";
  email: string;
  phone: string;
  nationality: string;
  nationalId?: string;
  companyName?: string;
  tradeLicense?: string;
  passportNumber?: string;
  trn?: string;
  occupation?: string;
  monthlyIncome?: number;
  emergencyContact?: string;
  notes?: string;
  status?: string;
}

// ── Lease contracts + rent schedule ───────────────────────────────────────────
//
// This block previously described a contract that does not exist: `type`, `brokerId`,
// `rentAmount`, `saleAmount`, `depositAmount` and `contractDoc` were never returned by any
// endpoint, so every one of them was `undefined` at runtime. It now mirrors the API exactly.

export type PaymentFrequency   = "monthly" | "quarterly" | "semi_annual" | "annual";
export type InstallmentStatus  = "pending" | "partial" | "paid" | "waived" | "overdue";

export interface ContractDto {
  id: string;
  contractNumber: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  cheques: number;
  securityDeposit: number;
  status: ContractStatus;
  totalPaid: number;
  balance: number;
  ejariNumber: string | null;
  notes: string | null;
  paymentFrequency: PaymentFrequency;
  nextDueDate: string | null;
  nextDueAmount: number;
  lastPaymentDate: string | null;
  overdueCount: number;
  overdueAmount: number;
  installmentCount: number;
  daysToExpiry: number | null;
}

export interface RentInstallmentDto {
  id: string;
  contractId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balance: number;
  /** "overdue" is derived server-side against today, never stored. */
  status: InstallmentStatus;
  daysOverdue: number;
  paidDate: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
}

export interface ContractDetailDto {
  contract: ContractDto;
  installments: RentInstallmentDto[];
}

export interface RentDueItemDto {
  installmentId: string;
  contractId: string;
  contractNumber: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unitNumber: string;
  dueDate: string;
  amount: number;
  balance: number;
  status: InstallmentStatus;
  daysOverdue: number;
  daysUntilDue: number;
}

export interface CreateContractRequest {
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  securityDeposit: number;
  paymentFrequency: PaymentFrequency;
  ejariNumber?: string | null;
  notes?: string | null;
  /** Rent taken at signing. Applied across the schedule from installment 1 onward, so a tenant
   *  who has already paid is not chased for it on day one. */
  advanceRentAmount?: number;
  advancePaidDate?: string;
  advanceMethod?: string;
  advanceReference?: string;
}

export interface CreatedContractDto {
  id: string;
  contractNumber: string;
  installmentsCreated: number;
  advanceApplied: number;
  installmentsSettledByAdvance: number;
  /** The first payment the tenant will actually be reminded about. */
  nextDueDate: string | null;
}

export interface UpdateContractRequest {
  startDate: string;
  endDate: string;
  annualRent: number;
  securityDeposit: number;
  paymentFrequency: PaymentFrequency;
  ejariNumber?: string | null;
  notes?: string | null;
  regenerateSchedule?: boolean;
}

// ── Rent + expiry alerts ──────────────────────────────────────────────────────

export interface RentAlertSettingsDto {
  enabled: boolean;
  dueReminderDaysBefore: string;
  overdueRepeatDays: number;
  overdueMaxReminders: number;
  expiryReminderDaysBefore: string;
  ccEmails: string | null;
  ccAllRealEstateUsers: boolean;
  timeZoneId: string;
  /** False when the deployment has no SMTP account — nothing will actually be delivered. */
  emailConfigured: boolean;
}

export interface RentAlertLogDto {
  id: string;
  contractId: string;
  installmentId: string | null;
  kind: "rent_due" | "rent_overdue" | "contract_expiry";
  offsetKey: string;
  toEmail: string;
  ccEmails: string | null;
  sent: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface ExpiringContractDto {
  contractId: string;
  contractNumber: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unitNumber: string;
  endDate: string;
  daysToExpiry: number;
  annualRent: number;
  outstanding: number;
  status: ContractStatus;
}

export interface RentAlertRunResultDto {
  dueRemindersSent: number;
  overdueRemindersSent: number;
  expiryRemindersSent: number;
  skipped: number;
  failed: number;
  messages: string[];
}

// ── Summary DTOs ──────────────────────────────────────────────────────────────

export interface RePropertySummaryDto {
  total: number;
  residential: number;
  commercial: number;
  mixed: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalMarketValue: number;
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
  expired: number;
  terminated: number;
  totalAnnualRent: number;
  totalCollected: number;
  outstanding: number;
  expiringSoon: number;
  overdueInstallments: number;
  overdueAmount: number;
  dueThisMonth: number;
  dueThisMonthAmount: number;
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

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Server-side paging + search shared by the property, unit, tenant and broker lists. */
export interface RePageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export const reApi = {
  getProperties: (p: RePageParams & { propertyType?: string } = {}): Promise<PagedResult<PropertyDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.search?.trim()) qs.set("search", p.search.trim());
    if (p.status && p.status !== "all") qs.set("status", p.status);
    if (p.propertyType && p.propertyType !== "all") qs.set("propertyType", p.propertyType);
    return rawApiClient.get(`${BASE}/properties?${qs}`);
  },
  getPropertySummary:  (): Promise<RePropertySummaryDto>   => rawApiClient.get(`${BASE}/properties/summary`),
  createProperty:      (data: UpsertPropertyInput)         => rawApiClient.post(`${BASE}/properties`, data),
  updateProperty:      (id: string, data: UpsertPropertyInput) => rawApiClient.put(`${BASE}/properties/${id}`, data),
  deleteProperty:      (id: string)                        => rawApiClient.delete(`${BASE}/properties/${id}`),

  getUnits: (p: RePageParams & { propertyId?: string } = {}): Promise<PagedResult<UnitDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.search?.trim()) qs.set("search", p.search.trim());
    if (p.status && p.status !== "all") qs.set("status", p.status);
    if ((p as { propertyId?: string }).propertyId) qs.set("propertyId", (p as { propertyId?: string }).propertyId!);
    return rawApiClient.get(`${BASE}/units?${qs}`);
  },
  getUnitSummary:      (): Promise<ReUnitSummaryDto>       => rawApiClient.get(`${BASE}/units/summary`),
  createUnit:          (data: UpsertUnitRequest): Promise<UnitDto> => rawApiClient.post(`${BASE}/units`, data),
  updateUnit:          (id: string, data: UpsertUnitRequest): Promise<void> =>
    rawApiClient.put(`${BASE}/units/${id}`, data),
  deleteUnit:          (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/units/${id}`),

  getTenants: (p: RePageParams & { tenantType?: string } = {}): Promise<PagedResult<TenantDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.search?.trim()) qs.set("search", p.search.trim());
    if (p.status && p.status !== "all") qs.set("status", p.status);
    if (p.tenantType && p.tenantType !== "all") qs.set("tenantType", p.tenantType);
    return rawApiClient.get(`${BASE}/tenants?${qs}`);
  },
  getTenantSummary:    (): Promise<ReTenantSummaryDto>     => rawApiClient.get(`${BASE}/tenants/summary`),
  // Typed deliberately. This was `Record<string, unknown>`, which is why the form could send
  // fullName/emiratesId/company — names the API has no counterpart for — and nothing caught it
  // until the server returned "The Name field is required".
  createTenant:        (data: CreateTenantRequest): Promise<{ id: string; tenantNumber: string; name: string }> =>
    rawApiClient.post(`${BASE}/tenants`, data),
  deleteTenant:        (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/tenants/${id}`),

  getBrokers: (p: RePageParams = {}): Promise<PagedResult<BrokerDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.search?.trim()) qs.set("search", p.search.trim());
    if (p.status && p.status !== "all") qs.set("status", p.status);
    return rawApiClient.get(`${BASE}/brokers?${qs}`);
  },
  getBrokerSummary:    (): Promise<ReBrokerSummaryDto>     => rawApiClient.get(`${BASE}/brokers/summary`),
  createBroker:        (data: Record<string, unknown>): Promise<BrokerDto> => rawApiClient.post(`${BASE}/brokers`, data),
  deleteBroker:        (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/brokers/${id}`),

  getContracts:        (params?: { tenantId?: string; status?: string }): Promise<ContractDto[]> =>
    rawApiClient.get(`${BASE}/contracts${qs(params)}`),
  getContractSummary:  (): Promise<ReContractSummaryDto>   => rawApiClient.get(`${BASE}/contracts/summary`),
  getContract:         (id: string): Promise<ContractDetailDto> => rawApiClient.get(`${BASE}/contracts/${id}`),
  createContract:      (data: CreateContractRequest): Promise<CreatedContractDto> =>
    rawApiClient.post(`${BASE}/contracts`, data),
  updateContract:      (id: string, data: UpdateContractRequest): Promise<void> =>
    rawApiClient.put(`${BASE}/contracts/${id}`, data),
  setContractStatus:   (id: string, status: ContractStatus): Promise<void> =>
    rawApiClient.patch(`${BASE}/contracts/${id}/status`, { status }),
  deleteContract:      (id: string): Promise<void>         => rawApiClient.delete(`${BASE}/contracts/${id}`),

  // ── Rent schedule ──────────────────────────────────────────────────────────
  generateSchedule:    (id: string, replaceExisting = false): Promise<RentInstallmentDto[]> =>
    rawApiClient.post(`${BASE}/contracts/${id}/schedule`, { replaceExisting }),
  recordRentPayment:   (id: string, installmentId: string, data: {
    amount: number; paidDate: string; method?: string | null; reference?: string | null; notes?: string | null;
  }): Promise<RentInstallmentDto> =>
    rawApiClient.post(`${BASE}/contracts/${id}/installments/${installmentId}/payment`, data),
  waiveInstallment:    (id: string, installmentId: string, reason?: string | null): Promise<void> =>
    rawApiClient.post(`${BASE}/contracts/${id}/installments/${installmentId}/waive`, { reason }),
  getRentDue:          (withinDays = 30, includeOverdue = true): Promise<RentDueItemDto[]> =>
    rawApiClient.get(`${BASE}/contracts/rent-due?withinDays=${withinDays}&includeOverdue=${includeOverdue}`),
  sendRentReminder:    (id: string, installmentId?: string): Promise<string> =>
    rawApiClient.post(`${BASE}/contracts/${id}/remind${installmentId ? `?installmentId=${installmentId}` : ""}`, {}),

  // ── Rent + expiry alerts ───────────────────────────────────────────────────
  getAlertSettings:    (): Promise<RentAlertSettingsDto> => rawApiClient.get(`${ALERTS}/settings`),
  updateAlertSettings: (data: Omit<RentAlertSettingsDto, "emailConfigured">): Promise<RentAlertSettingsDto> =>
    rawApiClient.put(`${ALERTS}/settings`, data),
  getAlertLogs:        (contractId?: string, limit = 100): Promise<RentAlertLogDto[]> =>
    rawApiClient.get(`${ALERTS}/logs?limit=${limit}${contractId ? `&contractId=${contractId}` : ""}`),
  getExpiringContracts:(withinDays = 90): Promise<ExpiringContractDto[]> =>
    rawApiClient.get(`${ALERTS}/expiring?withinDays=${withinDays}`),
  runAlertSweep:       (dryRun = false): Promise<RentAlertRunResultDto> =>
    rawApiClient.post(`${ALERTS}/run`, { dryRun }),
};
