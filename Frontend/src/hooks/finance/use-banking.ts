import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bankingApi,
  type CreateBankAccountRequest,
  type CreateTransactionRequest,
} from "@/lib/finance/banking.api";
import { toast } from "sonner";

export const bankingKeys = {
  all:          ["finance-banking"] as const,
  accounts:     () => [...bankingKeys.all, "accounts"] as const,
  account:      (id: string) => [...bankingKeys.accounts(), id] as const,
  transactions: (params?: object) => [...bankingKeys.all, "transactions", params ?? {}] as const,
};

export function useBankAccounts() {
  return useQuery({
    queryKey: bankingKeys.accounts(),
    queryFn:  () => bankingApi.getAccounts(),
  });
}

export function useBankTransactions(params?: { accountId?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: bankingKeys.transactions(params),
    queryFn:  () => bankingApi.getTransactions(params),
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBankAccountRequest) => bankingApi.createAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bankingKeys.accounts() });
      toast.success("Bank account added.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionRequest) => bankingApi.createTransaction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bankingKeys.all });
      toast.success("Transaction recorded.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReconcileTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bankingApi.reconcileTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bankingKeys.all });
      toast.success("Transaction reconciled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
