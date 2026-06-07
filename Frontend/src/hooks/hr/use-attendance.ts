import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  attendanceApi,
  type GetAttendanceParams,
  type CreateAttendanceRequest,
  type UpdateAttendanceRequest,
} from "@/lib/hr/attendance.api";
import { toast } from "sonner";

export const attendanceKeys = {
  all:    ["hr-attendance"] as const,
  lists:  () => [...attendanceKeys.all, "list"] as const,
  list:   (params: GetAttendanceParams) => [...attendanceKeys.lists(), params] as const,
  detail: (id: string) => [...attendanceKeys.all, "detail", id] as const,
};

export function useAttendance(params: GetAttendanceParams = {}) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn:  () => attendanceApi.getAll(params),
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAttendanceRequest) => attendanceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
      toast.success("Attendance recorded.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateAttendanceRequest) =>
      attendanceApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
      qc.invalidateQueries({ queryKey: attendanceKeys.detail(id) });
      toast.success("Attendance updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.lists() });
      toast.success("Attendance record deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
