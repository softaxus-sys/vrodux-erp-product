import { apiClient, type PagedResult } from "@/lib/api-client";
import type { UserDto, UserSummaryDto } from "./types";

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

  update: (id: string, payload: UpdateUserPayload): Promise<UserDto> =>
    apiClient.put<UserDto>(`${BASE}/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${id}`),

  assignRole: (userId: string, roleId: string): Promise<void> =>
    apiClient.post<void>(`${BASE}/${userId}/roles`, { roleId }),

  removeRole: (userId: string, roleId: string): Promise<void> =>
    apiClient.delete<void>(`${BASE}/${userId}/roles/${roleId}`),

  changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> =>
    apiClient.post<void>(`${BASE}/${userId}/change-password`, {
      currentPassword,
      newPassword,
    }),
};
