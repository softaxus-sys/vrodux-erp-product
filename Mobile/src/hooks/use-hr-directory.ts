import { useQuery } from "@tanstack/react-query";
import { hrDirectoryApi } from "@/lib/hr-directory.api";

const QK = "hr-directory" as const;

export function useEmployees(includeInactive = false) {
  return useQuery({
    queryKey: [QK, "employees", includeInactive],
    queryFn: () => hrDirectoryApi.getEmployees(includeInactive),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: [QK, "employee", id],
    queryFn: () => hrDirectoryApi.getEmployeeById(id),
    enabled: Boolean(id),
  });
}

export function useHrSummary(enabled = true) {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn: hrDirectoryApi.getSummary,
    enabled,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: [QK, "departments"],
    queryFn: hrDirectoryApi.getDepartments,
  });
}
