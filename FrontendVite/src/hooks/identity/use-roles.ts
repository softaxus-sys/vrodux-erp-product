import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi, permissionsApi } from "@/lib/identity/roles.api";
import type { RoleDto, RoleSummaryDto, PermissionDto } from "@/lib/identity/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const roleKeys = {
  all:         ["roles"] as const,
  lists:       () => [...roleKeys.all, "list"] as const,
  list:        (params?: object) => [...roleKeys.lists(), params] as const,
  details:     () => [...roleKeys.all, "detail"] as const,
  detail:      (id: string) => [...roleKeys.details(), id] as const,
  permissions: ["permissions"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useRoles(params: { page?: number; pageSize?: number; search?: string } = {}) {
  return useQuery<PagedResult<RoleSummaryDto>>({
    queryKey: roleKeys.list(params),
    queryFn:  () => rolesApi.getAll(params),
  });
}

export function useRole(id: string) {
  return useQuery<RoleDto>({
    queryKey: roleKeys.detail(id),
    queryFn:  () => rolesApi.getById(id),
    enabled:  !!id,
  });
}

export function useAllPermissions() {
  return useQuery<PermissionDto[]>({
    queryKey: roleKeys.permissions,
    queryFn:  permissionsApi.getAll,
    staleTime: 5 * 60 * 1000, // permissions rarely change
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      rolesApi.create(name, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.lists() });
      toast.success("Role created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRole(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      rolesApi.update(roleId, name, description),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: roleKeys.lists() });
      qc.setQueryData(roleKeys.detail(roleId), data);
      toast.success("Role updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => rolesApi.delete(roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roleKeys.lists() });
      toast.success("Role deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRolePermissions(roleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permissionIds: string[]) =>
      rolesApi.updatePermissions(roleId, permissionIds),
    onSuccess: (data) => {
      qc.setQueryData(roleKeys.detail(roleId), data);
      qc.invalidateQueries({ queryKey: roleKeys.lists() });
      toast.success("Permissions saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
