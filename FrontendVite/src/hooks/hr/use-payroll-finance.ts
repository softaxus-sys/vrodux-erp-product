import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hrApi, type PayrollRunDto } from "@/lib/hr/hr.api";
import { financeApi, type AccountDto, type JournalLineRequest } from "@/lib/finance/finance.api";

const QK = "hr";

/**
 * Finance approving a payroll run — the sign-off and the accounting entry it produces.
 *
 * <p>Two calls rather than one endpoint, because HR and Finance are separate services with
 * separate schemas and HR must never write into the Finance ledger. The orchestration lives on
 * the client, the same shape the visa module uses to raise a Finance invoice.</p>
 *
 * <p>Order matters: the approval goes first. An approval without its journal entry is a run that
 * can be paid and whose posting can be retried; a journal entry for a run that was never approved
 * is money in the ledger with nothing authorising it.</p>
 */

/** How the payroll journal entry is built. Names are matched case-insensitively, first hit wins. */
const EXPENSE_ACCOUNT_HINTS = ["salary", "salaries", "payroll", "wages", "staff cost"];
const PAYABLE_ACCOUNT_HINTS = ["salaries payable", "payroll payable", "accrued payroll", "wages payable"];

function findAccount(accounts: AccountDto[], hints: string[], fallbackType: string) {
  const active = accounts.filter(a => a.isActive);
  for (const hint of hints) {
    const hit = active.find(a => a.name.toLowerCase().includes(hint));
    if (hit) return hit;
  }
  // Nothing named for payroll: fall back to any account of the right type rather than failing.
  return active.find(a => a.accountType?.toLowerCase() === fallbackType) ?? null;
}

/**
 * Builds the double entry for a run: the salary cost is recognised as an expense, and the amount
 * owed to staff as a liability. Payment then clears the liability — which is why approval posts an
 * accrual rather than touching the bank account directly.
 */
export function buildPayrollJournal(run: PayrollRunDto, accounts: AccountDto[]) {
  const expense = findAccount(accounts, EXPENSE_ACCOUNT_HINTS, "expense");
  const payable = findAccount(accounts, PAYABLE_ACCOUNT_HINTS, "liability");
  if (!expense || !payable) return null;

  const amount = run.totalNetSalary;
  const lines: JournalLineRequest[] = [
    {
      accountId: expense.id, accountName: expense.name,
      debitAmount: amount, creditAmount: 0,
      description: `Payroll ${run.period} — ${run.slipCount} employees`,
    },
    {
      accountId: payable.id, accountName: payable.name,
      debitAmount: 0, creditAmount: amount,
      description: `Payroll ${run.period} — net payable to staff`,
    },
  ];

  return {
    date: new Date().toISOString().split("T")[0],
    description: `Payroll ${run.period} (${run.runNumber})`,
    reference: run.runNumber,
    notes: `Approved payroll run ${run.runNumber} for ${run.period}.`,
    lines,
  };
}

export function useFinanceApprovePayroll() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (run: PayrollRunDto) => {
      await hrApi.financeApprovePayrollRun(run.id);

      // Posting is best-effort and reported separately: a chart of accounts without salary
      // accounts is a setup gap, not a reason to leave the run unapproved and staff unpaid.
      let journalEntryNumber: string | null = null;
      try {
        const accounts = await financeApi.getAccounts({ isActive: true });
        const payload = buildPayrollJournal(run, accounts);
        if (payload) {
          const created = await financeApi.createJournalEntry(payload) as
            { id?: string; entryNumber?: string; journalNumber?: string } | null;

          if (created?.id) {
            journalEntryNumber = created.entryNumber ?? created.journalNumber ?? null;
            await hrApi.linkPayrollJournalEntry(run.id, {
              journalEntryId: created.id,
              journalEntryNumber: journalEntryNumber ?? undefined,
            });
          }
        }
      } catch (e) {
        return { posted: false, reason: (e as Error).message, journalEntryNumber: null };
      }

      return { posted: journalEntryNumber !== null, reason: null, journalEntryNumber };
    },

    onSuccess: (result, run) => {
      qc.invalidateQueries({ queryKey: [QK, "payroll-runs"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-summary"] });
      qc.invalidateQueries({ queryKey: [QK, "payroll-run", run.id] });
      qc.invalidateQueries({ queryKey: ["finance", "journals"] });

      if (result.posted) {
        toast.success(`Payroll approved and posted to the ledger (${result.journalEntryNumber}).`);
      } else {
        // Named precisely, because "approved" alone would hide that the books are not updated.
        toast.warning(
          "Payroll approved, but no ledger entry was posted. Check that the chart of accounts has a salary expense and a salaries payable account.",
        );
      }
    },

    onError: (err: Error) => toast.error(err.message),
  });
}
