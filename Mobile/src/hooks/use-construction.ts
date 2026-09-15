import { useQuery } from "@tanstack/react-query";
import { constructionApi } from "@/lib/construction.api";

const QK = "construction" as const;

export function useProjectsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "projects", "summary"], queryFn: constructionApi.getProjectsSummary, enabled });
}
export function useProjects(enabled = true) {
  return useQuery({ queryKey: [QK, "projects"], queryFn: constructionApi.getProjects, enabled });
}

export function useSitesSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "sites", "summary"], queryFn: constructionApi.getSitesSummary, enabled });
}
export function useSites(enabled = true) {
  return useQuery({ queryKey: [QK, "sites"], queryFn: constructionApi.getSites, enabled });
}

export function useContractorsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "contractors", "summary"], queryFn: constructionApi.getContractorsSummary, enabled });
}
export function useContractors(enabled = true) {
  return useQuery({ queryKey: [QK, "contractors"], queryFn: constructionApi.getContractors, enabled });
}

export function useBoqsSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "boqs", "summary"], queryFn: constructionApi.getBoqsSummary, enabled });
}
export function useBoqs(enabled = true) {
  return useQuery({ queryKey: [QK, "boqs"], queryFn: constructionApi.getBoqs, enabled });
}
