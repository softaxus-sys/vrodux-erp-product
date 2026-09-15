/** Construction: Projects, Sites, Contractors, BOQs -- all read-only, non-paginated GetAll on the
 *  backend (confirmed by reading ProjectsController/SitesController/ContractorsController/
 *  BOQController directly -- none take page/pageSize). The CRM-linked bidding lifecycle
 *  (RFQs -> Estimates -> Contracts, its own ConstructionSalesController) is a separate sub-feature,
 *  deferred -- see README's Construction section, same call as Real Estate's sales pipeline. */

export interface ProjectPhaseDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  completionPct: number;
}

export interface ProjectDto {
  id: string;
  projectNumber: string;
  name: string;
  client: string;
  location: string;
  projectType: string;
  status: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  budgetSpent: number;
  budgetRemaining: number;
  completionPct: number;
  projectManager: string;
  siteEngineer: string;
  workers: number;
  notes: string | null;
  phases: ProjectPhaseDto[];
}

export interface ProjectsSummaryDto {
  total: number;
  inProgress: number;
  completed: number;
  onHold: number;
  planning: number;
  totalContractValue: number;
  totalSpent: number;
  avgCompletion: number;
}

export interface SiteLocationDto {
  address: string;
  city: string;
  emirate: string;
  lat: string;
  lng: string;
}

export interface SiteWorkersDto {
  current: number;
  max: number;
}

export interface SiteDto {
  id: string;
  siteCode: string;
  name: string;
  projectId: string;
  projectName: string;
  location: SiteLocationDto;
  siteManager: string;
  siteManagerPhone: string;
  safetyOfficer: string;
  safetyOfficerPhone: string;
  status: string;
  workers: SiteWorkersDto;
  area: number;
  startDate: string;
  permitNumber: string;
  permitExpiry: string;
  lastInspection: string;
  nextInspection: string;
  safetyScore: number;
  notes: string;
}

export interface SitesSummaryDto {
  total: number;
  active: number;
  inactive: number;
  completed: number;
  totalWorkers: number;
  avgSafetyScore: number;
  permitsExpiringSoon: number;
}

export interface ContractorDto {
  id: string;
  companyName: string;
  trade: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  licenseNumber: string;
  licenseExpiry: string;
  activeProjects: number;
  completedProjects: number;
  totalContractValue: number;
  rating: number;
}

export interface ContractorsSummaryDto {
  total: number;
  civil: number;
  structural: number;
  mep: number;
  totalActiveProjects: number;
  totalContractValue: number;
  avgRating: number;
}

export interface BoqItemDto {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  completedQty: number;
  completedAmt: number;
}

export interface BoqDto {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  approvedBy: string | null;
  approvedDate: string | null;
  totalValue: number;
  completedValue: number;
  items: BoqItemDto[];
}

export interface BoqsSummaryDto {
  total: number;
  draft: number;
  approved: number;
  totalValue: number;
  completedValue: number;
  completionPct: number;
}
