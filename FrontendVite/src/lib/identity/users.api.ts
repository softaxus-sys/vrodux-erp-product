import { apiClient, type PagedResult } from "@/lib/api-client";
import type { UserDto, UserSummaryDto, ProvisionUserPayload, ProvisionedUserDto } from "./types";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/users`;

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDesc?: boolean;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserPayload {
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
}

export const usersApi = {
  getAll: (params: GetUsersParams = {}): Promise<PagedResult<UserSummaryDto>> => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set("page",     String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.search)   qs.set("search",   params.search);
    if (params.sortBy)   qs.set("sortBy",   params.sortBy);
    if (params.sortDesc) qs.set("sortDesc", "true");
    return apiClient.get<PagedResult<UserSummaryDto>>(`${BASE}?${qs}`);
  },

  getById: (id: string): Promise<UserDto> =>
    apiClient.get<UserDto>(`${BASE}/${id}`),

  create: (payload: CreateUserPayload): Promise<UserDto> =>
    apiClient.post<UserDto>(BASE, payload),

  /**
   * Creates a login for someone an administrator is standing in front of (HR giving an employee
   * portal access). Unlike create(), no verification email is sent and the account works
   * immediately — the returned temporary password is shown ONCE and cannot be retrieved again.
   */
  provision: (payload: ProvisionUserPayload): Promise<ProvisionedUserDto> =>
    apiClient.post<ProvisionedUserDto>(`${BASE}/provision`, payload),

  /**
   * Gives an existing login access to their own HR record. Additive — it assigns the
   * "Employee (Self-Service)" role and never removes what the user already has.
   */
  grantSelfService: (id: string): Promise<void> =>
    apiClient.post<void>(`${BASE}/${id}/grant-self-service`, {}),

  update: (id: string, payload: UpdateUserPayload): Promise<UserDto> =>
    apiClient.put<UserDto>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),

  assignRole: (userId: string, roleId: string): Promise<void> =>
    apiClient.post<void>(`${BASE}/${userId}/roles`, { roleId }),

  removeRole: (userId: string, roleId: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${userId}/roles/${roleId}`),

  /** Replace all per-user permission overrides (grants + denies). Empty list clears them. */
  updatePermissions: (
    userId: string,
    overrides: { permissionId: string; isGranted: boolean }[]
  ): Promise<UserDto> =>
    apiClient.put<UserDto>(`${BASE}/${userId}/permissions`, { overrides }),

  changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> =>
    apiClient.post<void>(`${BASE}/${userId}/change-password`, {
      currentPassword,
      newPassword,
    }),

  /** Admin: forcibly reset a user's password without requiring their current password. */
  adminResetPassword: (userId: string, newPassword: string): Promise<void> =>
    apiClient.post<void>(`${BASE}/${userId}/reset-password`, { newPassword }),
};
