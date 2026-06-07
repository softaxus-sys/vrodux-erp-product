import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  journalEntriesApi,
  type GetJournalEntriesParams,
  type CreateJournalEntryRequest,
} from "@/lib/finance/journal-entries.api";
import { toast } from "sonner";

export const journalKeys = {
  all:    ["finance-journals"] as const,
  lists:  () => [...journalKeys.all, "list"] as const,
  list:   (params: GetJournalEntriesParams) => [...journalKeys.lists(), params] as const,
  detail: (id: string) => [...journalKeys.all, "detail", id] as const,
};

export function useJournalEntries(params: GetJournalEntriesParams = {}) {
  return useQuery({
    queryKey: journalKeys.list(params),
    queryFn:  () => journalEntriesApi.getAll(params),
  });
}

export function useJournalEntry(id: string) {
  return useQuery({
    queryKey: journalKeys.detail(id),
    queryFn:  () => journalEntriesApi.getById(id),
    enabled:  !!id,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJournalEntryRequest) => journalEntriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      toast.success("Journal entry created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePostJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalEntriesApi.post(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      qc.invalidateQueries({ queryKey: journalKeys.detail(id) });
      toast.success("Journal entry posted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useVoidJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalEntriesApi.void(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      qc.invalidateQueries({ queryKey: journalKeys.detail(id) });
      toast.success("Journal entry voided.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalEntriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: journalKeys.lists() });
      toast.success("Journal entry deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
