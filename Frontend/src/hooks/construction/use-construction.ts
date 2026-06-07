import { useQuery } from "@tanstack/react-query";
import { constructionApi } from "@/lib/construction/construction.api";

export const constructionKeys = {
  all:            ["construction"] as const,
  projects:       () => [...constructionKeys.all, "projects"] as const,
  project:        (id: string) => [...constructionKeys.all, "project", id] as const,
  projectSummary: () => [...constructionKeys.all, "project-summary"] as const,
  contractors:    () => [...constructionKeys.all, "contractors"] as const,
  contractor:     (id: string) => [...constructionKeys.all, "contractor", id] as const,
  boqs:           (projectId?: string) => [...constructionKeys.all, "boqs", projectId ?? "all"] as const,
  boq:            (id: string) => [...constructionKeys.all, "boq", id] as const,
  sites:          () => [...constructionKeys.all, "sites"] as const,
  site:           (id: string) => [...constructionKeys.all, "site", id] as const,
  summary:        () => [...constructionKeys.all, "summary"] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: constructionKeys.projects(),
    queryFn:  () => constructionApi.getProjects(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: constructionKeys.project(id),
    queryFn:  () => constructionApi.getProject(id),
    enabled:  !!id,
  });
}

export function useProjectSummary() {
  return useQuery({
    queryKey: constructionKeys.projectSummary(),
    queryFn:  () => constructionApi.getProjectSummary(),
  });
}

export function useContractors() {
  return useQuery({
    queryKey: constructionKeys.contractors(),
    queryFn:  () => constructionApi.getContractors(),
  });
}

export function useContractor(id: string) {
  return useQuery({
    queryKey: constructionKeys.contractor(id),
    queryFn:  () => constructionApi.getContractor(id),
    enabled:  !!id,
  });
}

export function useBOQs(projectId?: string) {
  return useQuery({
    queryKey: constructionKeys.boqs(projectId),
    queryFn:  () => constructionApi.getBOQs(projectId),
  });
}

export function useBOQ(id: string) {
  return useQuery({
    queryKey: constructionKeys.boq(id),
    queryFn:  () => constructionApi.getBOQ(id),
    enabled:  !!id,
  });
}

export function useSites() {
  return useQuery({
    queryKey: constructionKeys.sites(),
    queryFn:  () => constructionApi.getSites(),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: constructionKeys.site(id),
    queryFn:  () => constructionApi.getSite(id),
    enabled:  !!id,
  });
}

export function useConstructionSummary() {
  return useQuery({
    queryKey: constructionKeys.summary(),
    queryFn:  () => constructionApi.getSummary(),
  });
}
