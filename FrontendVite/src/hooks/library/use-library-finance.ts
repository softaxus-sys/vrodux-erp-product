import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useAuthStore } from "@/store/auth.store";
import { financeApi, type AccountDto, type CreateJournalEntryRequest } from "@/lib/finance/finance.api";
import { libraryReportsApi, type FinePostingPreviewDto } from "@/lib/library/reports.api";

/**
 * The library's one optional link to Finance: putting collected fines into the ledger. Modules
 * are sold separately, so this is offered only when the workspace has Finance and the user may
 * create journal entries there — and the entry is made through Finance's own API. The library
 * never writes Finance's data; it only remembers which payments went into which entry.
 */

const msg = (key: string, opts?: Record<string, unknown>) => i18n.t(`finance.${key}`, { ns: "library", ...opts });

/** Workspace has Finance, and this user may create journal entries and settle library fines. */
export function useCanPostFines() {
  const hasModule  = useAuthStore(s => s.hasModuleAccess)("finance");
  const hasRaw     = useAuthStore(s => s.hasRawPermission);
  return hasModule && hasRaw("finance.journals.create") && hasRaw("library.fines.approve");
}

export function useUnpostedFinePayments(through: string, enabled = true) {
  return useQuery({
    queryKey: ["library", "fine-posting", "unposted", through],
    queryFn: () => libraryReportsApi.getUnposted(through),
    enabled, staleTime: 0,
  });
}

export function useFinePostingHistory(enabled = true) {
  return useQuery({ queryKey: ["library", "fine-posting", "history"], queryFn: libraryReportsApi.getHistory, enabled, staleTime: 30 * 1000 });
}

export interface FinePostingAccounts { receivedInId: string; incomeId: string }

const HINTS = {
  receivedIn: ["cash on hand", "cash in hand", "petty cash", "cash", "bank"],
  income:     ["fine", "penalt", "other income", "miscellaneous income", "sundry income", "other revenue", "income", "revenue"],
};

function guess(accounts: AccountDto[], hints: string[]) {
  for (const hint of hints) {
    const hit = accounts.find(a => a.name.toLowerCase().includes(hint));
    if (hit) return hit.id;
  }
  return "";
}

const storageKey = () => `library-fine-posting-accounts:${useAuthStore.getState().tenant?.id ?? "default"}`;

/** The accounts used last time on this device, else a guess by name. Always shown before posting. */
export function defaultFinePostingAccounts(accounts: AccountDto[]): FinePostingAccounts {
  let saved: Partial<FinePostingAccounts> = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey()) ?? "{}"); } catch { /* fall back to guesses */ }
  const known = (id?: string) => (id && accounts.some(a => a.id === id) ? id : "");
  return {
    receivedInId: known(saved.receivedInId) || guess(accounts, HINTS.receivedIn),
    incomeId:     known(saved.incomeId)     || guess(accounts, HINTS.income),
  };
}

/** Money received is debited; fines income is credited. One entry for the whole batch. */
export function buildFinesJournal(preview: FinePostingPreviewDto, accounts: AccountDto[], picked: FinePostingAccounts, date: string): CreateJournalEntryRequest | null {
  const total = Math.round(preview.total * 100) / 100;
  if (total <= 0 || !picked.receivedInId || !picked.incomeId || picked.receivedInId === picked.incomeId) return null;

  const span = preview.from && preview.to
    ? (preview.from === preview.to ? preview.from : `${preview.from} to ${preview.to}`)
    : date;
  const name = (id: string) => accounts.find(a => a.id === id)?.name ?? "";
  const description = `Library fines collected ${span}`;

  return {
    date,
    description,
    reference: `LIB-FINES-${(preview.to ?? date).replace(/-/g, "")}`,
    notes: `${preview.count} fine payment${preview.count === 1 ? "" : "s"} taken at the library desk.`,
    lines: [
      { accountId: picked.receivedInId, accountName: name(picked.receivedInId), debitAmount: total, creditAmount: 0, description },
      { accountId: picked.incomeId,     accountName: name(picked.incomeId),     debitAmount: 0, creditAmount: total, description },
    ],
  };
}

export function usePostFinesToFinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ preview, accounts, picked, date }: {
      preview: FinePostingPreviewDto; accounts: AccountDto[]; picked: FinePostingAccounts; date: string;
    }) => {
      const payload = buildFinesJournal(preview, accounts, picked, date);
      if (!payload) throw new Error(msg("nothingToPost"));

      const created = await financeApi.createJournalEntry(payload) as
        { id?: string; entryNumber?: string; journalNumber?: string } | null;
      if (!created?.id) throw new Error(msg("postFailed"));
      const number = created.entryNumber ?? created.journalNumber ?? null;

      try {
        const marked = await libraryReportsApi.markPosted({
          paymentIds: preview.payments.map(p => p.id), journalEntryId: created.id, journalEntryNumber: number,
        });
        try { localStorage.setItem(storageKey(), JSON.stringify(picked)); } catch { /* convenience only */ }
        return marked;
      } catch (e) {
        // The entry now exists in Finance but the library could not tie the payments to it.
        // Say so plainly: left alone, the same money would be posted a second time.
        throw new Error(msg("markFailed", { number: number ?? "—", error: (e as Error).message }));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onSuccess: r => toast.success(msg("posted", { count: r.payments, number: r.journalEntryNumber ?? "—" })),
    onError: (e: Error) => toast.error(e.message, { duration: 12000 }),
  });
}
