import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/construction`;

// ── Projects ────────────────────────────────────────────────────────────────

export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type ProjectType   = "residential" | "commercial" | "infrastructure" | "industrial";

export interface ProjectPhaseDto {
  id:            string;
  name:          string;
  startDate:     string;
  endDate:       string;
  status:        "not_started" | "in_progress" | "completed" | "delayed";
  completionPct: number;
}

export interface ProjectDto {
  id:              string;
  projectNumber:   string;
  name:            string;
  client:          string;
  location:        string;
  projectType:     ProjectType;
  status:          ProjectStatus;
  startDate:       string;
  endDate:         string;
  contractValue:   number;
  budgetSpent:     number;
  budgetRemaining: number;
  completionPct:   number;
  projectManager:  string;
  siteEngineer:    string;
  phases:          ProjectPhaseDto[];
  workers:         number;
  notes:           string;
}

export interface ProjectsSummaryDto {
  total:              number;
  inProgress:         number;
  completed:          number;
  onHold:             number;
  planning:           number;
  totalContractValue: number;
  totalSpent:         number;
  avgCompletion:      number;
}

// ── Sites ───────────────────────────────────────────────────────────────────

export type SiteStatus = "active" | "inactive" | "completed";

export interface SiteDto {
  id:                  string;
  siteCode:            string;
  name:                string;
  projectId:           string;
  projectName:         string;
  location: {
    address:  string;
    city:     string;
    emirate:  string;
    lat:      string;
    lng:      string;
  };
  siteManager:         string;
  siteManagerPhone:    string;
  safetyOfficer:       string;
  safetyOfficerPhone:  string;
  status:              SiteStatus;
  workers: {
    current: number;
    max:     number;
  };
  area:              number;
  startDate:         string;
  permitNumber:      string;
  permitExpiry:      string;
  lastInspection:    string;
  nextInspection:    string;
  safetyScore:       number;
  notes:             string;
}

export interface SitesSummaryDto {
  total:               number;
  active:              number;
  inactive:            number;
  completed:           number;
  totalWorkers:        number;
  avgSafetyScore:      number;
  permitsExpiringSoon: number;
}

// ── Contractors ─────────────────────────────────────────────────────────────

export type ContractorTrade  = "civil" | "mep" | "structural" | "finishing" | "landscaping" | "hvac" | "electrical" | "plumbing" | "it_infra" | "safety";
export type ContractorStatus = "active" | "inactive" | "blacklisted";

export interface ContractorDto {
  id:                  string;
  contractorCode:      string;
  companyName:         string;
  tradeName:           string;
  trade:               ContractorTrade[];
  status:              ContractorStatus;
  rating:              number;
  contactPerson:       string;
  email:               string;
  phone:               string;
  location: {
    city:    string;
    country: string;
  };
  licenseNumber:       string;
  licenseExpiry:       string;
  insurance: {
    provider: string;
    expiry:   string;
    covered:  string;
  };
  activeProjects:      number;
  completedProjects:   number;
  totalContractValue:  number;
  notes:               string;
}

export interface ContractorsSummaryDto {
  total:              number;
  active:             number;
  inactive:           number;
  blacklisted:        number;
  avgRating:          number;
  totalContractValue: number;
}

// ── BOQ ─────────────────────────────────────────────────────────────────────

export type BOQStatus = "draft" | "approved" | "in_progress" | "completed";

export interface BOQItemDto {
  id:           string;
  itemCode:     string;
  description:  string;
  unit:         string;
  quantity:     number;
  unitRate:     number;
  amount:       number;
  completedQty: number;
  completedAmt: number;
  variationQty: number;
  variationAmt: number;
}

export interface BOQDto {
  id:               string;
  boqNumber:        string;
  projectId:        string;
  projectName:      string;
  status:           BOQStatus;
  approvedBy:       string | null;
  approvedDate:     string | null;
  items:            BOQItemDto[];
  totalAmount:      number;
  completedAmount:  number;
  variationAmount:  number;
  finalAmount:      number;
  completionPct:    number;
}

export interface BOQSummaryDto {
  total:       number;
  draft:       number;
  approved:    number;
  inProgress:  number;
  completed:   number;
  totalValue:  number;
}

// ── API ─────────────────────────────────────────────────────────────────────

export const constructionApi = {
  getProjects:         (): Promise<ProjectDto[]>          => rawApiClient.get(`${BASE}/projects`),
  getProjectsSummary:  (): Promise<ProjectsSummaryDto>    => rawApiClient.get(`${BASE}/projects/summary`),

  getSites:            (): Promise<SiteDto[]>             => rawApiClient.get(`${BASE}/sites`),
  getSitesSummary:     (): Promise<SitesSummaryDto>       => rawApiClient.get(`${BASE}/sites/summary`),

  getContractors:      (): Promise<ContractorDto[]>       => rawApiClient.get(`${BASE}/contractors`),
  getContractorsSummary:(): Promise<ContractorsSummaryDto>=> rawApiClient.get(`${BASE}/contractors/summary`),

  getBOQs:             (): Promise<BOQDto[]>              => rawApiClient.get(`${BASE}/boqs`),
  getBOQSummary:       (): Promise<BOQSummaryDto>         => rawApiClient.get(`${BASE}/boqs/summary`),
};
