import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentsApi, type UpsertDepartmentRequest } from "@/lib/hr/departments.api";
import { toast } from "sonner";

export const departmentKeys = {
  all:   ["hr-departments"] as const,
  lists: () => [...departmentKeys.all, "list"] as const,
  list:  (params?: object) => [...departmentKeys.lists(), params ?? {}] as const,
  detail: (id: string) => [...departmentKeys.all, "detail", id] as const,
};

export function useDepartments(params?: { search?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: departmentKeys.list(params),
    queryFn:  () => departmentsApi.getAll(params),
    staleTime: 30_000,
  });
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: departmentKeys.detail(id),
    queryFn:  () => departmentsApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertDepartmentRequest) => departmentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: departmentKeys.lists() });
      toast.success("Department created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpsertDepartmentRequest) =>
      departmentsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: departmentKeys.lists() });
      qc.invalidateQueries({ queryKey: departmentKeys.detail(id) });
      toast.success("Department updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: departmentKeys.lists() });
      toast.success("Department deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
