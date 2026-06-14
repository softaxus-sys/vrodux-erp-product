import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  boardColumnsApi,
  type BoardColumnDto,
  type CreateBoardColumnRequest,
  type UpdateBoardColumnRequest,
  type ReorderBoardColumnsRequest,
} from "@/lib/project-management/board-columns.api";
import { toast } from "sonner";

export const boardColumnKeys = {
  all:  ["pm-board-columns"] as const,
  list: (projectId: string) => [...boardColumnKeys.all, projectId] as const,
};

export function useBoardColumns(projectId: string | null) {
  return useQuery<BoardColumnDto[]>({
    queryKey: boardColumnKeys.list(projectId ?? ""),
    queryFn:  () => boardColumnsApi.getAll(projectId!),
    enabled:  !!projectId,
  });
}

export function useCreateBoardColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBoardColumnRequest) => boardColumnsApi.create(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardColumnKeys.list(projectId) });
      toast.success("Column created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBoardColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBoardColumnRequest }) =>
      boardColumnsApi.update(projectId, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardColumnKeys.list(projectId) });
      toast.success("Column updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBoardColumn(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => boardColumnsApi.remove(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardColumnKeys.list(projectId) });
      toast.success("Column deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderBoardColumns(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReorderBoardColumnsRequest) => boardColumnsApi.reorder(projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardColumnKeys.list(projectId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
