import { apiClient } from "@/lib/api-client";
import type { BoqDto, BoqsSummaryDto, ContractorDto, ContractorsSummaryDto, ProjectDto, ProjectsSummaryDto, SiteDto, SitesSummaryDto } from "@/types/construction";

const BASE = "/api/construction";

export const constructionApi = {
  getProjectsSummary: (): Promise<ProjectsSummaryDto> => apiClient.get(`${BASE}/projects/summary`),
  getProjects: (): Promise<ProjectDto[]> => apiClient.get(`${BASE}/projects`),

  getSitesSummary: (): Promise<SitesSummaryDto> => apiClient.get(`${BASE}/sites/summary`),
  getSites: (): Promise<SiteDto[]> => apiClient.get(`${BASE}/sites`),

  getContractorsSummary: (): Promise<ContractorsSummaryDto> => apiClient.get(`${BASE}/contractors/summary`),
  getContractors: (): Promise<ContractorDto[]> => apiClient.get(`${BASE}/contractors`),

  getBoqsSummary: (): Promise<BoqsSummaryDto> => apiClient.get(`${BASE}/boqs/summary`),
  getBoqs: (): Promise<BoqDto[]> => apiClient.get(`${BASE}/boqs`),
};
