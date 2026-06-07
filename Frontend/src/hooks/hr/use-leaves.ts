import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  leavesApi,
  type GetLeavesParams,
  type CreateLeaveRequest,
  type ApproveRejectRequest,
} from "@/lib/hr/leaves.api";
import { toast } from "sonner";

export const leaveKeys = {
  all:    ["hr-leaves"] as const,
  lists:  () => [...leaveKeys.all, "list"] as const,
  list:   (params: GetLeavesParams) => [...leaveKeys.lists(), params] as const,
  detail: (id: string) => [...leaveKeys.all, "detail", id] as const,
};

export function useLeaves(params: GetLeavesParams = {}) {
  return useQuery({
    queryKey: leaveKeys.list(params),
    queryFn:  () => leavesApi.getAll(params),
  });
}

export function useLeave(id: string) {
  return useQuery({
    queryKey: leaveKeys.detail(id),
    queryFn:  () => leavesApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveRequest) => leavesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.lists() });
      toast.success("Leave request submitted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ApproveRejectRequest) =>
      leavesApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.lists() });
      toast.success("Leave approved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ApproveRejectRequest) =>
      leavesApi.reject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.lists() });
      toast.success("Leave rejected.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leavesApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.lists() });
      toast.success("Leave cancelled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leavesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaveKeys.lists() });
      toast.success("Leave request deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
