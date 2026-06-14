import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  labelsApi,
  type LabelDto,
  type CreateLabelRequest,
  type UpdateLabelRequest,
} from "@/lib/project-management/labels.api";
import { toast } from "sonner";

export const labelKeys = {
  all:  ["pm-labels"] as const,
  list: (projectId: string) => [...labelKeys.all, projectId] as const,
};

export function useLabels(projectId: string | null) {
  return useQuery<LabelDto[]>({
    queryKey: labelKeys.list(projectId ?? ""),
    queryFn:  () => labelsApi.getAll(projectId!),
    enabled:  !!projectId,
  });
}

export function useCreateLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLabelRequest) => labelsApi.create(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: labelKeys.list(projectId) });
      toast.success("Label created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLabelRequest }) =>
      labelsApi.update(projectId, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: labelKeys.list(projectId) });
      toast.success("Label updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => labelsApi.remove(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: labelKeys.list(projectId) });
      toast.success("Label deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
