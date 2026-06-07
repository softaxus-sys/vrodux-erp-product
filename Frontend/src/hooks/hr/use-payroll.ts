import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  payrollApi,
  type GetPayrollParams,
  type CreatePayrollRunRequest,
  type GeneratePayrollRequest,
} from "@/lib/hr/payroll.api";
import { toast } from "sonner";

export const payrollKeys = {
  all:    ["hr-payroll"] as const,
  lists:  () => [...payrollKeys.all, "list"] as const,
  list:   (params: GetPayrollParams) => [...payrollKeys.lists(), params] as const,
  detail: (id: string) => [...payrollKeys.all, "detail", id] as const,
};

export function usePayrollRuns(params: GetPayrollParams = {}) {
  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn:  () => payrollApi.getAll(params),
  });
}

export function usePayrollRun(id: string) {
  return useQuery({
    queryKey: payrollKeys.detail(id),
    queryFn:  () => payrollApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePayrollRunRequest) => payrollApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      toast.success("Payroll run created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GeneratePayrollRequest) => payrollApi.generate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      toast.success("Payroll generated from active employees.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useProcessPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.process(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.detail(id) });
      toast.success("Payroll run processed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePayPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.pay(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      qc.invalidateQueries({ queryKey: payrollKeys.detail(id) });
      toast.success("Payroll marked as paid.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payrollKeys.lists() });
      toast.success("Payroll run deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
