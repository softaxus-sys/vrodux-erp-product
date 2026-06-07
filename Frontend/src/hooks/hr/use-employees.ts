import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  employeesApi,
  type GetEmployeesParams,
  type CreateEmployeeRequest,
  type UpdateEmployeeRequest,
} from "@/lib/hr/employees.api";
import { toast } from "sonner";

export const employeeKeys = {
  all:     ["hr-employees"] as const,
  lists:   () => [...employeeKeys.all, "list"] as const,
  list:    (params: GetEmployeesParams) => [...employeeKeys.lists(), params] as const,
  simples: () => [...employeeKeys.all, "simple"] as const,
  detail:  (id: string) => [...employeeKeys.all, "detail", id] as const,
};

export function useEmployees(params: GetEmployeesParams = {}) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn:  () => employeesApi.getAll(params),
  });
}

export function useEmployeesSimple() {
  return useQuery({
    queryKey: employeeKeys.simples(),
    queryFn:  () => employeesApi.getAll2(),
    staleTime: 60_000,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn:  () => employeesApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) => employeesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.simples() });
      toast.success("Employee added.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateEmployeeRequest) =>
      employeesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.simples() });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      toast.success("Employee updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      qc.invalidateQueries({ queryKey: employeeKeys.simples() });
      toast.success("Employee removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
