import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/construction`;

// ─── Projects ────────────────────────────────────────────────────────────────
export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type ProjectType   = "residential" | "commercial" | "infrastructure" | "industrial";

export interface ProjectPhaseDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "not_started" | "in_progress" | "completed" | "delayed";
  completionPct: number;
}

export interface ProjectDto {
  id: string;
  projectNumber: string;
  name: string;
  client: string;
  location: string;
  projectType: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  contractValue: number;
  budgetSpent: number;
  budgetRemaining: number;
  completionPct: number;
  projectManager: string;
  siteEngineer: string;
  phases: ProjectPhaseDto[];
  workers: number;
  notes: string;
}

export interface ProjectSummaryDto {
  total: number;
  inProgress: number;
  planning: number;
  onHold: number;
  completed: number;
  totalContractValue: number;
  totalBudgetSpent: number;
}

// ─── Contractors ─────────────────────────────────────────────────────────────
export type ContractorTrade  = "civil" | "mep" | "structural" | "finishing" | "landscaping" | "hvac" | "electrical" | "plumbing" | "it_infra" | "safety";
export type ContractorStatus = "active" | "inactive" | "blacklisted";

export interface ContractorDto {
  id: string;
  contractorCode: string;
  companyName: string;
  tradeName: string;
  trade: ContractorTrade[];
  status: ContractorStatus;
  rating: number;
  contactPerson: string;
  email: string;
  phone: string;
  locationCity: string;
  locationCountry: string;
  licenseNumber: string;
  licenseExpiry: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  activeProjects: number;
  completedProjects: number;
  totalContractValue: number;
  notes: string;
}

// ─── BOQ ─────────────────────────────────────────────────────────────────────
export type BOQStatus = "draft" | "approved" | "in_progress" | "completed";

export interface BOQItemDto {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  completedQty: number;
  completedAmt: number;
  variationQty: number;
  variationAmt: number;
}

export interface BOQDto {
  id: string;
  boqNumber: string;
  projectId: string;
  projectName: string;
  status: BOQStatus;
  approvedBy: string | null;
  approvedDate: string | null;
  items: BOQItemDto[];
  totalAmount: number;
  completedAmount: number;
  variationAmount: number;
  finalAmount: number;
  completionPct: number;
}

// ─── Sites ────────────────────────────────────────────────────────────────────
export type SiteStatus = "active" | "inactive" | "completed";

export interface SiteDto {
  id: string;
  siteCode: string;
  name: string;
  projectId: string;
  projectName: string;
  locationAddress: string;
  locationCity: string;
  locationEmirate: string;
  siteManager: string;
  siteManagerPhone: string;
  safetyOfficer: string;
  safetyOfficerPhone: string;
  status: SiteStatus;
  workersCurrent: number;
  workersMax: number;
  area: number;
  startDate: string;
  permitNumber: string;
  permitExpiry: string;
  lastInspection: string;
  nextInspection: string;
  safetyScore: number;
  notes: string;
}

export interface ConstructionSummaryDto {
  totalProjects: number;
  activeProjects: number;
  totalContractValue: number;
  totalContractors: number;
  activeSites: number;
  totalBOQs: number;
}

export const constructionApi = {
  // Projects
  getProjects: (): Promise<ProjectDto[]> =>
    rawApiClient.get<ProjectDto[]>(`${BASE}/projects`),
  getProject: (id: string): Promise<ProjectDto> =>
    rawApiClient.get<ProjectDto>(`${BASE}/projects/${id}`),
  getProjectSummary: (): Promise<ProjectSummaryDto> =>
    rawApiClient.get<ProjectSummaryDto>(`${BASE}/projects/summary`),

  // Contractors
  getContractors: (): Promise<ContractorDto[]> =>
    rawApiClient.get<ContractorDto[]>(`${BASE}/contractors`),
  getContractor: (id: string): Promise<ContractorDto> =>
    rawApiClient.get<ContractorDto>(`${BASE}/contractors/${id}`),

  // BOQ
  getBOQs: (projectId?: string): Promise<BOQDto[]> => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    return rawApiClient.get<BOQDto[]>(`${BASE}/boqs${qs}`);
  },
  getBOQ: (id: string): Promise<BOQDto> =>
    rawApiClient.get<BOQDto>(`${BASE}/boqs/${id}`),

  // Sites
  getSites: (): Promise<SiteDto[]> =>
    rawApiClient.get<SiteDto[]>(`${BASE}/sites`),
  getSite: (id: string): Promise<SiteDto> =>
    rawApiClient.get<SiteDto>(`${BASE}/sites/${id}`),

  getSummary: (): Promise<ConstructionSummaryDto> =>
    rawApiClient.get<ConstructionSummaryDto>(`${BASE}/summary`),
};
