import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { X, Link2, Wand2, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { BankAccountDto, ReconBankItemDto, ReconBookItemDto } from "@/lib/finance/finance.api";
import {
  useAccounts, useReconciliation, useSetBankLedgerAccount, useMatchBankTransaction, useAutoMatchBank,
} from "@/hooks/finance/use-finance";

const WINDOWS = [0, 3, 5, 10, 30];

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={cn("text-lg font-bold truncate", tone)} title={value}>{value}</p>
    </div>
  );
}

function Direction({ isIn }: { isIn: boolean }) {
  const { t } = useTranslation("finance");
  return isIn
    ? <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-success"><ArrowDownLeft className="h-3 w-3" />{t("banking.recon.in")}</span>
    : <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive"><ArrowUpRight className="h-3 w-3" />{t("banking.recon.out")}</span>;
}

/**
 * Pairs bank statement lines with the posted ledger lines on the bank's own ledger account.
 * The server decides what is allowed (same amount, same direction, posted entry, used once);
 * this screen only lays the open items out and sends the pairing the person chooses.
 */
export function ReconcilePanel({ account, open, onClose }: { account: BankAccountDto | undefined; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("finance");
  const [windowDays, setWindowDays] = React.useState(5);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [ledgerChoice, setLedgerChoice] = React.useState("");
  const [autoNote, setAutoNote] = React.useState<string | null>(null);

  const { data, isLoading, isError, error } = useReconciliation(account?.id, windowDays, open);
  const { data: chart = [] } = useAccounts({ isActive: true });
  const setLedger = useSetBankLedgerAccount();
  const match = useMatchBankTransaction();
  const auto = useAutoMatchBank();

  React.useEffect(() => { if (!open) { setSelected(null); setAutoNote(null); } }, [open]);
  React.useEffect(() => { setLedgerChoice(data?.ledgerAccountId ?? ""); }, [data?.ledgerAccountId]);

  const money = (n: number) => formatCurrency(n, data?.currency ?? account?.currency);
  const selectedItem: ReconBankItemDto | undefined = data?.unmatchedBank.find(b => b.id === selected);

  // Only ledger lines the server would accept for the chosen statement line are offered;
  // the ones inside the date window are listed first and marked.
  const candidates: ReconBookItemDto[] = React.useMemo(() => {
    if (!data || !selectedItem) return [];
    const near = new Set(selectedItem.suggestions);
    return data.unmatchedBook
      .filter(b => b.in === selectedItem.in && b.amount === selectedItem.amount)
      .sort((a, b) => Number(near.has(b.journalLineId)) - Number(near.has(a.journalLineId)));
  }, [data, selectedItem]);

  const accounts = React.useMemo(() => [...chart].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)), [chart]);
  const ledgerReady = Boolean(data?.ledgerAccountId);

  const runAuto = async () => {
    if (!account) return;
    setAutoNote(null);
    const n = await auto.mutateAsync({ accountId: account.id, windowDays }).catch(() => null);
    if (n === null) return;
    setAutoNote(n > 0 ? t("banking.recon.autoDone", { count: n }) : t("banking.recon.autoNone"));
  };

  return (
    <AnimatePresence>
      {open && account && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 z-50 w-full max-w-6xl bg-background border-s border-border flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{t("banking.recon.title", { name: account.accountName })}</h2>
                <p className="text-xs text-muted-foreground">{t("banking.recon.pickHint")}</p>
              </div>
              <button onClick={onClose} aria-label={t("banking.recon.close")} className="p-2 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              {/* Ledger account — nothing is guessed, so reconciling starts by choosing it */}
              <div className={cn("rounded-xl border p-4 space-y-2", ledgerReady ? "border-border bg-card" : "border-warning/50 bg-warning/5")}>
                <p className="text-sm font-semibold">{t("banking.recon.ledgerAccount")}</p>
                <p className="text-xs text-muted-foreground">{t("banking.recon.ledgerHint")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={ledgerChoice} onChange={e => setLedgerChoice(e.target.value)} aria-label={t("banking.recon.ledgerAccount")}
                    className="h-9 min-w-64 px-3 rounded-lg border border-border bg-card text-sm text-foreground">
                    <option value="">{t("banking.recon.choose")}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} · {a.name}</option>)}
                  </select>
                  <Can permission="finance.banking.edit">
                    <Button size="sm" disabled={!ledgerChoice || ledgerChoice === (data?.ledgerAccountId ?? "") || setLedger.isPending}
                      onClick={() => setLedger.mutate({ accountId: account.id, ledgerAccountId: ledgerChoice })}>
                      {t("banking.recon.save")}
                    </Button>
                  </Can>
                </div>
              </div>

              {isError && <p className="text-sm text-destructive">{(error as Error)?.message}</p>}

              {ledgerReady && data && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label={t("banking.recon.statement")} value={money(data.statementBalance)} />
                    <Stat label={t("banking.recon.book")} value={money(data.bookBalance)} />
                    <Stat label={t("banking.recon.difference")} value={money(data.difference)}
                      tone={Math.abs(data.difference) < 0.005 ? "text-success" : "text-warning"} />
                    <Stat label={t("banking.recon.matched")} value={String(data.matchedCount)} />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("banking.recon.explain")}</p>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-muted-foreground flex items-center gap-2">
                      {t("banking.recon.window")}
                      <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))}
                        className="h-8 px-2 rounded-lg border border-border bg-card text-sm text-foreground">
                        {WINDOWS.map(w => <option key={w} value={w}>{t("banking.recon.days", { count: w })}</option>)}
                      </select>
                    </label>
                    <Can permission="finance.banking.edit">
                      <Button size="sm" variant="outline" className="gap-2" disabled={auto.isPending} onClick={runAuto}>
                        <Wand2 className="h-4 w-4" />{t("banking.recon.autoMatch")}
                      </Button>
                    </Can>
                    {autoNote && <span className="text-xs text-muted-foreground">{autoNote}</span>}
                    {data.truncated && <span className="text-xs text-warning">{t("banking.recon.truncated")}</span>}
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <section className="bg-card border border-border rounded-xl overflow-hidden">
                      <h3 className="px-4 py-3 text-sm font-semibold border-b border-border">
                        {t("banking.recon.statementLines")} <span className="text-muted-foreground font-normal">({data.unmatchedBank.length})</span>
                      </h3>
                      {data.unmatchedBank.length === 0 ? (
                        <p className="p-6 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />{t("banking.recon.noneBank")}
                        </p>
                      ) : (
                        <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                          {data.unmatchedBank.map(b => (
                            <li key={b.id}>
                              <button onClick={() => setSelected(selected === b.id ? null : b.id)}
                                className={cn("w-full text-start px-4 py-2.5 hover:bg-muted/50 flex items-center gap-3",
                                  selected === b.id && "bg-primary/10")}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm truncate">{b.description}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{formatDate(b.date)}{b.reference ? ` · ${b.reference}` : ""}</p>
                                </div>
                                <div className="text-end shrink-0">
                                  <p className={cn("text-sm font-semibold", b.in ? "text-success" : "text-destructive")}>{money(b.amount)}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {b.suggestions.length === 0 ? t("banking.recon.noMatch") : t("banking.recon.found", { count: b.suggestions.length })}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="bg-card border border-border rounded-xl overflow-hidden">
                      <h3 className="px-4 py-3 text-sm font-semibold border-b border-border">
                        {selectedItem ? t("banking.recon.sameAmount") : t("banking.recon.bookLines")}{" "}
                        <span className="text-muted-foreground font-normal">({selectedItem ? candidates.length : data.unmatchedBook.length})</span>
                      </h3>
                      {(selectedItem ? candidates : data.unmatchedBook).length === 0 ? (
                        <p className="p-6 text-sm text-center text-muted-foreground">{t("banking.recon.noneBook")}</p>
                      ) : (
                        <ul className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                          {(selectedItem ? candidates : data.unmatchedBook).map(l => {
                            const suggested = selectedItem?.suggestions.includes(l.journalLineId);
                            return (
                              <li key={l.journalLineId} className={cn("px-4 py-2.5 flex items-center gap-3", suggested && "bg-success/5")}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm truncate">{l.description}</p>
                                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                                    <span className="font-mono">{l.entryNumber}</span> · {formatDate(l.date)} <Direction isIn={l.in} />
                                    {suggested && <span className="text-success font-medium">· {t("banking.recon.suggested")}</span>}
                                  </p>
                                </div>
                                <p className="text-sm font-semibold shrink-0">{money(l.amount)}</p>
                                {selectedItem && (
                                  <Can permission="finance.banking.edit">
                                    <Button size="sm" variant={suggested ? "default" : "outline"} className="gap-1.5 shrink-0" disabled={match.isPending}
                                      onClick={() => match.mutate({ id: selectedItem.id, journalLineId: l.journalLineId }, { onSuccess: () => setSelected(null) })}>
                                      <Link2 className="h-3.5 w-3.5" />{t("banking.recon.match")}
                                    </Button>
                                  </Can>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </div>
                </>
              )}
              {isLoading && <p className="text-sm text-muted-foreground">…</p>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
