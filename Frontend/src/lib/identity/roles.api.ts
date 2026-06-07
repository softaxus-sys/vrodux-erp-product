import { apiClient, type PagedResult } from "@/lib/api-client";
import type { RoleDto, RoleSummaryDto, PermissionDto } from "./types";

const BASE_ROLES = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/roles`;
const BASE_PERMS = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/permissions`;

export const rolesApi = {
  getAll: (params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PagedResult<RoleSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize ?? 100));
    if (params.search)   qs.set("search",   params.search);
    return apiClient.get<PagedResult<RoleSummaryDto>>(`${BASE_ROLES}?${qs}`);
  },

  getById: (id: string): Promise<RoleDto> =>
    apiClient.get<RoleDto>(`${BASE_ROLES}/${id}`),

  create: (name: string, description: string): Promise<RoleDto> =>
    apiClient.post<RoleDto>(BASE_ROLES, { name, description }),

  update: (id: string, name: string, description: string): Promise<RoleDto> =>
    apiClient.put<RoleDto>(`${BASE_ROLES}/${id}`, { name, description }),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE_ROLES}/${id}`),

  updatePermissions: (id: string, permissionIds: string[]): Promise<RoleDto> =>
    apiClient.put<RoleDto>(`${BASE_ROLES}/${id}/permissions`, { permissionIds }),
};

export const permissionsApi = {
  getAll: (): Promise<PagedResult<PermissionDto>> =>
    apiClient.get<PagedResult<PermissionDto>>(`${BASE_PERMS}?pageSize=500`),
};
