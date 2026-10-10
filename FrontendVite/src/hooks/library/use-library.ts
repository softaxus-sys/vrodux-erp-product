import * as React from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  libraryApi, type AddCopiesRequest, type BranchRequest, type CopyRequest, type LoanFilter,
  type MemberRequest, type MembershipTypeRequest, type TitleRequest,
} from "@/lib/library/library.api";

const QK = "library";
const msg = (key: string) => i18n.t(`toast.${key}`, { ns: "library" });

// ── Working branch ──────────────────────────────────────────────────────────

const BRANCH_KEY = "vrodux.library.branch";

/**
 * The branch this desk is at. Kept per device rather than per user: a counter PC belongs to one
 * branch whoever is signed in. It is where returns are received and what the lists start filtered to.
 */
export function useWorkingBranch() {
  const { data: branches = [] } = useBranches(true);
  const [stored, setStored] = React.useState<string>(() => {
    try { return localStorage.getItem(BRANCH_KEY) ?? ""; } catch { return ""; }
  });

  // A saved branch that no longer exists (deleted, or another workspace's) falls back to the first.
  const branchId = branches.some(b => b.id === stored) ? stored : (branches[0]?.id ?? "");

  const setBranchId = React.useCallback((id: string) => {
    setStored(id);
    try { localStorage.setItem(BRANCH_KEY, id); } catch { /* private window — keep it in memory */ }
  }, []);

  return { branchId, setBranchId, branches, branch: branches.find(b => b.id === branchId) ?? null };
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useLibraryDashboard(enabled = true) {
  return useQuery({ queryKey: [QK, "dashboard"], queryFn: libraryApi.getDashboard, enabled, staleTime: 30 * 1000 });
}

export function useBranches(activeOnly = false, enabled = true) {
  return useQuery({
    queryKey: [QK, "branches", activeOnly], queryFn: () => libraryApi.getBranches(activeOnly), enabled, staleTime: 60 * 1000,
  });
}

export function useMembershipTypes(activeOnly = false, enabled = true) {
  return useQuery({
    queryKey: [QK, "membership-types", activeOnly], queryFn: () => libraryApi.getMembershipTypes(activeOnly),
    enabled, staleTime: 60 * 1000,
  });
}

export function useTitles(
  p: { search?: string; category?: string; branchId?: string; availableOnly?: boolean; page?: number; pageSize?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: [QK, "titles", p.search ?? "", p.category ?? "", p.branchId ?? "", !!p.availableOnly, p.page ?? 1, p.pageSize ?? 50],
    queryFn: () => libraryApi.getTitles(p), enabled, staleTime: 30 * 1000, placeholderData: keepPreviousData,
  });
}

export function useCategories(enabled = true) {
  return useQuery({ queryKey: [QK, "categories"], queryFn: libraryApi.getCategories, enabled, staleTime: 60 * 1000 });
}

export function useTitle(id: string | null) {
  return useQuery({ queryKey: [QK, "title", id], queryFn: () => libraryApi.getTitle(id!), enabled: !!id });
}

export function useInTransit(enabled = true) {
  return useQuery({ queryKey: [QK, "in-transit"], queryFn: libraryApi.getInTransit, enabled, staleTime: 30 * 1000 });
}

export function useMembers(p: { search?: string; status?: string; page?: number; pageSize?: number }, enabled = true) {
  return useQuery({
    queryKey: [QK, "members", p.search ?? "", p.status ?? "", p.page ?? 1, p.pageSize ?? 50],
    queryFn: () => libraryApi.getMembers(p), enabled, staleTime: 30 * 1000, placeholderData: keepPreviousData,
  });
}

export function useMember(id: string | null) {
  return useQuery({ queryKey: [QK, "member", id], queryFn: () => libraryApi.getMember(id!), enabled: !!id });
}

export function useLoans(f: LoanFilter, enabled = true) {
  return useQuery({
    queryKey: [QK, "loans", f.status ?? "", f.branchId ?? "", f.memberId ?? "", f.titleId ?? "", f.search ?? "", f.page ?? 1, f.pageSize ?? 50],
    queryFn: () => libraryApi.getLoans(f), enabled, staleTime: 30 * 1000, placeholderData: keepPreviousData,
  });
}

export function useReservations(p: { status?: string; branchId?: string; memberId?: string; titleId?: string }, enabled = true) {
  return useQuery({
    queryKey: [QK, "reservations", p.status ?? "", p.branchId ?? "", p.memberId ?? "", p.titleId ?? ""],
    queryFn: () => libraryApi.getReservations(p), enabled, staleTime: 30 * 1000,
  });
}

export function useFines(p: { status?: string; memberId?: string; search?: string }, enabled = true) {
  return useQuery({
    queryKey: [QK, "fines", p.status ?? "", p.memberId ?? "", p.search ?? ""],
    queryFn: () => libraryApi.getFines(p), enabled, staleTime: 30 * 1000,
  });
}

export function useFinesSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "fines-summary"], queryFn: libraryApi.getFinesSummary, enabled, staleTime: 30 * 1000 });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Every Library write refreshes the whole module: one return moves a copy, a loan, possibly a
 * reservation and a fine, and every count on the dashboard with them.
 * Pass no `successKey` when the caller shows its own, more specific, message.
 */
function useLibraryMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, successKey?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (successKey) toast.success(msg(successKey));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateBranch = () => useLibraryMutation((b: BranchRequest) => libraryApi.createBranch(b), "branchSaved");
export const useUpdateBranch = () =>
  useLibraryMutation(({ id, body }: { id: string; body: BranchRequest }) => libraryApi.updateBranch(id, body), "branchSaved");
export const useDeleteBranch = () => useLibraryMutation((id: string) => libraryApi.deleteBranch(id), "branchDeleted");

export const useCreateMembershipType = () =>
  useLibraryMutation((b: MembershipTypeRequest) => libraryApi.createMembershipType(b), "typeSaved");
export const useUpdateMembershipType = () =>
  useLibraryMutation(({ id, body }: { id: string; body: MembershipTypeRequest }) => libraryApi.updateMembershipType(id, body), "typeSaved");
export const useDeleteMembershipType = () => useLibraryMutation((id: string) => libraryApi.deleteMembershipType(id), "typeDeleted");

export const useCreateTitle = () => useLibraryMutation((b: TitleRequest) => libraryApi.createTitle(b), "titleSaved");
export const useUpdateTitle = () =>
  useLibraryMutation(({ id, body }: { id: string; body: TitleRequest }) => libraryApi.updateTitle(id, body), "titleSaved");
export const useDeleteTitle = () => useLibraryMutation((id: string) => libraryApi.deleteTitle(id), "titleDeleted");

export const useAddCopies = () =>
  useLibraryMutation(({ titleId, body }: { titleId: string; body: AddCopiesRequest }) => libraryApi.addCopies(titleId, body), "copiesAdded");
export const useUpdateCopy = () =>
  useLibraryMutation(({ id, body }: { id: string; body: CopyRequest }) => libraryApi.updateCopy(id, body), "copySaved");
export const useDeleteCopy = () => useLibraryMutation((id: string) => libraryApi.deleteCopy(id), "copyDeleted");
export const useTransferCopy = () =>
  useLibraryMutation(({ id, toBranchId }: { id: string; toBranchId: string }) => libraryApi.transferCopy(id, toBranchId), "copySent");
export const useReceiveCopy = () => useLibraryMutation((id: string) => libraryApi.receiveCopy(id), "copyReceived");

// No toast: the import screen shows its own created / already-there / failed summary.
export const useImportTitles = () =>
  useLibraryMutation((b: { rows: Record<string, unknown>[]; defaultBranchId: string | null; createBranches: boolean }) => libraryApi.importTitles(b));
export const useImportMembers = () =>
  useLibraryMutation((b: { rows: Record<string, unknown>[]; defaultMembershipTypeId: string | null }) => libraryApi.importMembers(b));

export const useCreateMember = () => useLibraryMutation((b: MemberRequest) => libraryApi.createMember(b), "memberSaved");
export const useUpdateMember = () =>
  useLibraryMutation(({ id, body }: { id: string; body: MemberRequest }) => libraryApi.updateMember(id, body), "memberSaved");
export const useDeleteMember = () => useLibraryMutation((id: string) => libraryApi.deleteMember(id), "memberDeleted");

export const useIssueLoan = () =>
  useLibraryMutation((b: { memberId: string; copyId: string; dueDate?: string | null }) => libraryApi.issue(b));
export const useReturnLoan = () =>
  useLibraryMutation(({ id, ...body }: { id: string; returnBranchId?: string | null; damaged?: boolean; notes?: string | null }) =>
    libraryApi.returnLoan(id, body));
export const useRenewLoan = () => useLibraryMutation((id: string) => libraryApi.renew(id), "loanRenewed");
export const useMarkLoanLost = () => useLibraryMutation((id: string) => libraryApi.markLost(id), "loanLost");

export const useReserve = () =>
  useLibraryMutation((b: { titleId: string; memberId: string; pickupBranchId: string }) => libraryApi.reserve(b));
export const useCancelReservation = () => useLibraryMutation((id: string) => libraryApi.cancelReservation(id), "reservationCancelled");

export const useCreateFine = () =>
  useLibraryMutation((b: { memberId: string; type: string; amount: number; reason?: string | null }) => libraryApi.createFine(b), "fineAdded");
export const usePayFine = () =>
  useLibraryMutation(({ id, amount, method }: { id: string; amount: number; method?: string | null }) => libraryApi.payFine(id, { amount, method }), "finePaid");
export const useWaiveFine = () =>
  useLibraryMutation(({ id, reason }: { id: string; reason?: string | null }) => libraryApi.waiveFine(id, reason), "fineWaived");
