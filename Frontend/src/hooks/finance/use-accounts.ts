import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsApi, type UpsertAccountRequest } from "@/lib/finance/accounts.api";
import { toast } from "sonner";

export const accountKeys = {
  all:    ["finance-accounts"] as const,
  lists:  () => [...accountKeys.all, "list"] as const,
  list:   (params?: object) => [...accountKeys.lists(), params ?? {}] as const,
  detail: (id: string) => [...accountKeys.all, "detail", id] as const,
};

export function useAccounts(params?: { search?: string; accountType?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: accountKeys.list(params),
    queryFn:  () => accountsApi.getAll(params),
    staleTime: 30_000,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAccountRequest) => accountsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      toast.success("Account created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpsertAccountRequest) =>
      accountsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      qc.invalidateQueries({ queryKey: accountKeys.detail(id) });
      toast.success("Account updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      toast.success("Account deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
