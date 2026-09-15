import type { Tone } from "@/theme";

/**
 * Real Estate -- property/unit/tenant/lease management + the rent-collection chase queue. Mirrors
 * `Softaxis.RealEstate.Application`'s DTOs. Property/unit/tenant/contract *creation* are all real
 * multi-field forms (a contract create alone picks a property → vacant unit → tenant and can seed
 * an advance-rent schedule) -- desktop-appropriate, same call as Sales/Purchase order creation.
 * What's genuinely mobile-native: browsing the portfolio, and the rent-collection actions (record
 * a payment, waive an installment, send a reminder) that a property manager does away from a desk.
 * The CRM-linked sales pipeline (site visits -> reservations -> bookings + payment plans, its own
 * `real-estate.sales.*` permission group) is a separate sub-feature, out of scope for this pass.
 */

// ── Properties ───────────────────────────────────────────────────────────────────────────────

export interface PropertyLocationDto {
  address: string;
  city: string;
  emirate: string;
}

export interface PropertyUnitDto {
  id: string;
  unitNumber: string;
  unitType: string;
  area: number;
  floor: number;
  rentPerYear: number;
  salePrice: number;
  status: string;
  currentTenantId: string | null;
  currentTenantName: string | null;
}

export interface PropertyDto {
  id: string;
  propertyNumber: string;
  name: string;
  propertyType: string;
  status: string;
  location: PropertyLocationDto;
  totalArea: number;
  totalUnits: number;
  occupiedUnits: number;
  marketValue: number;
  developer: string | null;
  description: string | null;
  occupancyRate: number;
  units: PropertyUnitDto[];
}

export interface PropertiesSummaryDto {
  total: number;
  residential: number;
  commercial: number;
  mixed: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  totalMarketValue: number;
}

export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  partially_occupied: "Partially Occupied",
  fully_occupied: "Fully Occupied",
};

export const PROPERTY_STATUS_TONE: Record<string, Tone> = {
  available: "success",
  partially_occupied: "warning",
  fully_occupied: "info",
};

// ── Units (standalone, cross-property list) ─────────────────────────────────────────────────────

export interface UnitDto {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitType: string;
  area: number;
  floor: number;
  rentPerYear: number;
  salePrice: number;
  status: string;
  currentTenantId: string | null;
  currentTenantName: string | null;
  furnishing: string | null;
  view: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number;
  serviceCharge: number;
  notes: string | null;
}

export interface UnitsSummaryDto {
  total: number;
  vacant: number;
  rented: number;
  sold: number;
  maintenance: number;
  totalAnnualRent: number;
  occupancyRate: number;
}

export const UNIT_STATUS_LABELS: Record<string, string> = {
  vacant: "Vacant",
  rented: "Rented",
  sold: "Sold",
  maintenance: "Maintenance",
};

export const UNIT_STATUS_TONE: Record<string, Tone> = {
  vacant: "success",
  rented: "info",
  sold: "neutral",
  maintenance: "warning",
};

// ── Tenants ──────────────────────────────────────────────────────────────────────────────────

export interface TenantDto {
  id: string;
  tenantNumber: string;
  name: string;
  tenantType: string;
  email: string;
  phone: string;
  nationalId: string | null;
  companyName: string | null;
  tradeLicense: string | null;
  nationality: string;
  status: string;
  activeContracts: number;
  totalPaid: number;
  passportNumber: string | null;
  trn: string | null;
  occupation: string | null;
  monthlyIncome: number | null;
  emergencyContact: string | null;
  notes: string | null;
}

export interface TenantsSummaryDto {
  total: number;
  individual: number;
  company: number;
  active: number;
  inactive: number;
  totalActiveContracts: number;
  totalPaid: number;
}

export const TENANT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export const TENANT_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  inactive: "neutral",
  blacklisted: "destructive",
};

// ── Contracts + rent schedule ────────────────────────────────────────────────────────────────

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
  status: string;
  totalPaid: number;
  balance: number;
  ejariNumber: string | null;
  notes: string | null;
  paymentFrequency: string;
  nextDueDate: string | null;
  nextDueAmount: number;
  lastPaymentDate: string | null;
  overdueCount: number;
  overdueAmount: number;
  installmentCount: number;
  daysToExpiry: number | null;
}

/** "overdue" is derived against today server-side, never stored -- it cannot go stale between
 *  reminder sweeps. Values: pending / partial / paid / waived / overdue. */
export interface RentInstallmentDto {
  id: string;
  contractId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: string;
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

export interface ContractsSummaryDto {
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

/** A payment that is due or late, flattened with the lease context needed to chase it. */
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
  status: string;
  daysOverdue: number;
  daysUntilDue: number;
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  renewed: "Renewed",
};

export const CONTRACT_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  expired: "neutral",
  terminated: "destructive",
  renewed: "info",
};

export const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  waived: "Waived",
  overdue: "Overdue",
};

export const INSTALLMENT_STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  partial: "warning",
  paid: "success",
  waived: "info",
  overdue: "destructive",
};

export const PAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

// ── Brokers ──────────────────────────────────────────────────────────────────────────────────

export interface BrokerDto {
  id: string;
  brokerNumber: string;
  name: string;
  agency: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  specialization: string;
  dealsCompleted: number;
  totalCommission: number;
  commissionRate: number;
  rating: number;
  status: string;
}

export interface BrokersSummaryDto {
  total: number;
  residential: number;
  commercial: number;
  both: number;
  totalDeals: number;
  totalCommission: number;
  avgRating: number;
}
