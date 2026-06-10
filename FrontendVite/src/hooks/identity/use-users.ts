import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { usersApi, type GetUsersParams, type CreateUserPayload, type UpdateUserPayload } from "@/lib/identity/users.api";
import type { UserDto, UserSummaryDto } from "@/lib/identity/types";
import type { PagedResult } from "@/lib/api-client";
import { toast } from "sonner";

// ── Query keys ────────────────────────────────────────────────────────────────

export const userKeys = {
  all:     ["users"] as const,
  lists:   () => [...userKeys.all, "list"] as const,
  list:    (params: GetUsersParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail:  (id: string) => [...userKeys.details(), id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useUsers(params: GetUsersParams = {}) {
  return useQuery<PagedResult<UserSummaryDto>>({
    queryKey: userKeys.list(params),
    queryFn:  () => usersApi.getAll(params),
  });
}

export function useUser(id: string, options?: Partial<UseQueryOptions<UserDto>>) {
  return useQuery<UserDto>({
    queryKey: userKeys.detail(id),
    queryFn:  () => usersApi.getById(id),
    enabled:  !!id,
    ...options,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success("User created successfully.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateUser(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserPayload) => usersApi.update(userId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      qc.setQueryData(userKeys.detail(userId), data);
      toast.success("User updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.delete(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success("User deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.assignRole(userId, roleId),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      toast.success("Role assigned.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.removeRole(userId, roleId),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: userKeys.detail(userId) });
      toast.success("Role removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useChangePassword(userId: string) {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => usersApi.changePassword(userId, currentPassword, newPassword),
    onSuccess: () => toast.success("Password changed successfully."),
    onError:   (err: Error) => toast.error(err.message),
  });
}

export function useAdminResetPassword(userId: string) {
  return useMutation({
    mutationFn: (newPassword: string) => usersApi.adminResetPassword(userId, newPassword),
    onSuccess: () => toast.success("Password reset successfully."),
    onError:   (err: Error) => toast.error(err.message),
  });
}
