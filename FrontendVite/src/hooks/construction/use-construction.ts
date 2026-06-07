import { useQuery } from "@tanstack/react-query";
import { constructionApi } from "@/lib/construction/construction.api";

const QK = "construction";

export function useProjects() {
  return useQuery({
    queryKey: [QK, "projects"],
    queryFn:  constructionApi.getProjects,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectsSummary() {
  return useQuery({
    queryKey: [QK, "projects-summary"],
    queryFn:  constructionApi.getProjectsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSites() {
  return useQuery({
    queryKey: [QK, "sites"],
    queryFn:  constructionApi.getSites,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSitesSummary() {
  return useQuery({
    queryKey: [QK, "sites-summary"],
    queryFn:  constructionApi.getSitesSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContractors() {
  return useQuery({
    queryKey: [QK, "contractors"],
    queryFn:  constructionApi.getContractors,
    staleTime: 5 * 60 * 1000,
  });
}

export function useContractorsSummary() {
  return useQuery({
    queryKey: [QK, "contractors-summary"],
    queryFn:  constructionApi.getContractorsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBOQs() {
  return useQuery({
    queryKey: [QK, "boqs"],
    queryFn:  constructionApi.getBOQs,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBOQSummary() {
  return useQuery({
    queryKey: [QK, "boqs-summary"],
    queryFn:  constructionApi.getBOQSummary,
    staleTime: 5 * 60 * 1000,
  });
}
