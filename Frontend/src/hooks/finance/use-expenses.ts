import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  expensesApi,
  type GetExpensesParams,
  type CreateExpenseRequest,
  type ApproveRequest,
} from "@/lib/finance/expenses.api";
import { toast } from "sonner";

export const expenseKeys = {
  all:    ["finance-expenses"] as const,
  lists:  () => [...expenseKeys.all, "list"] as const,
  list:   (params: GetExpensesParams) => [...expenseKeys.lists(), params] as const,
  detail: (id: string) => [...expenseKeys.all, "detail", id] as const,
};

export function useExpenses(params: GetExpensesParams = {}) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn:  () => expensesApi.getAll(params),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) => expensesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      toast.success("Expense created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & CreateExpenseRequest) =>
      expensesApi.update(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      toast.success("Expense updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApproveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ApproveRequest) =>
      expensesApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      toast.success("Expense approved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ApproveRequest) =>
      expensesApi.reject(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      toast.success("Expense rejected.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMarkExpensePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.markPaid(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      toast.success("Expense marked as paid.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      toast.success("Expense deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
