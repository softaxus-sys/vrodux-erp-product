import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  budgetsApi,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
} from "@/lib/finance/budgets.api";
import { toast } from "sonner";

export const budgetKeys = {
  all:    ["finance-budgets"] as const,
  lists:  () => [...budgetKeys.all, "list"] as const,
  list:   (params?: object) => [...budgetKeys.lists(), params ?? {}] as const,
  detail: (id: string) => [...budgetKeys.all, "detail", id] as const,
};

export function useBudgets(params?: { period?: string; status?: string }) {
  return useQuery({
    queryKey: budgetKeys.list(params),
    queryFn:  () => budgetsApi.getAll(params),
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn:  () => budgetsApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBudgetRequest) => budgetsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      toast.success("Budget created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateBudgetRequest) =>
      budgetsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      qc.invalidateQueries({ queryKey: budgetKeys.detail(id) });
      toast.success("Budget updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
      toast.success("Budget deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
