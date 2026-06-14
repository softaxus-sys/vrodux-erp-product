import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sprintsApi,
  type SprintDto,
  type CreateSprintRequest,
  type UpdateSprintRequest,
} from "@/lib/project-management/sprints.api";
import { issueKeys } from "@/hooks/project-management/use-issues";
import { toast } from "sonner";

export const sprintKeys = {
  all:  ["pm-sprints"] as const,
  list: (projectId: string) => [...sprintKeys.all, projectId] as const,
};

export function useSprints(projectId: string | null) {
  return useQuery<SprintDto[]>({
    queryKey: sprintKeys.list(projectId ?? ""),
    queryFn:  () => sprintsApi.getAll(projectId!),
    enabled:  !!projectId,
  });
}

export function useCreateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSprintRequest) => sprintsApi.create(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success("Sprint created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSprintRequest }) =>
      sprintsApi.update(projectId, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success("Sprint updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useStartSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sprintsApi.start(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success("Sprint started.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCompleteSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sprintsApi.complete(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      qc.invalidateQueries({ queryKey: issueKeys.all });
      toast.success("Sprint completed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sprintsApi.remove(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success("Sprint deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
