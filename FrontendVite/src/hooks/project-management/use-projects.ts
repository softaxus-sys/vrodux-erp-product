import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  projectsApi,
  type ProjectDto,
  type ProjectSummaryDto,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from "@/lib/project-management/projects.api";
import { toast } from "sonner";

export const projectKeys = {
  all:     ["pm-projects"] as const,
  lists:   () => [...projectKeys.all, "list"] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail:  (id: string) => [...projectKeys.details(), id] as const,
};

export function useProjects() {
  return useQuery<ProjectSummaryDto[]>({
    queryKey: projectKeys.lists(),
    queryFn:  () => projectsApi.getAll(),
  });
}

export function useProject(id: string | null) {
  return useQuery<ProjectDto>({
    queryKey: projectKeys.detail(id ?? ""),
    queryFn:  () => projectsApi.getById(id!),
    enabled:  !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectRequest) => projectsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectRequest }) =>
      projectsApi.update(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      qc.invalidateQueries({ queryKey: projectKeys.detail(vars.id) });
      toast.success("Project updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project archived.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project activated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
