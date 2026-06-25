import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => constructionApi.createProject(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "projects"] }); qc.invalidateQueries({ queryKey: [QK, "projects-summary"] }); toast.success("Project created."); },
    onError: (e: Error) => toast.error(e.message),
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

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => constructionApi.createSite(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "sites"] }); qc.invalidateQueries({ queryKey: [QK, "sites-summary"] }); toast.success("Site registered."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => constructionApi.createContractor(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "contractors"] }); qc.invalidateQueries({ queryKey: [QK, "contractors-summary"] }); toast.success("Contractor saved."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBOQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => constructionApi.createBOQ(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QK, "boqs"] }); qc.invalidateQueries({ queryKey: [QK, "boqs-summary"] }); toast.success("BOQ created."); },
    onError: (e: Error) => toast.error(e.message),
  });
}
