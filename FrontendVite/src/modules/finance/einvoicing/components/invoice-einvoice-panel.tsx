import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Download, Send, Undo2, X, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useEInvoiceCheck, useEInvoiceSubmissions, useQueueEInvoice, useCreditNotes, useCreateCreditNote,
} from "@/hooks/finance/use-einvoicing";
import { einvoicingApi } from "@/lib/finance/einvoicing.api";
import { EInvoiceStatusBadge } from "./einvoicing-view";

/**
 * The e-invoice side of an invoice, inside its drawer: is the data complete, where it is with the
 * provider, the XML, and the credit notes raised against it.
 *
 * Renders nothing for someone who can neither see e-invoicing nor raise a credit note, and nothing
 * for a draft — a draft is edited, not e-invoiced or credited.
 */
export function InvoiceEInvoicePanel({ invoiceId, invoiceNumber, status, currency, total }: {
  invoiceId: string; invoiceNumber: string; status: string; currency: string; total: number;
}) {
  const canView = useCan("finance.einvoicing.view");
  const canCredit = useCan("finance.invoicing.create");
  const issued = status !== "draft" && status !== "cancelled";
  const [creditOpen, setCreditOpen] = React.useState(false);

  const check = useEInvoiceCheck("invoice", invoiceId, canView && issued);
  const subs = useEInvoiceSubmissions({ documentId: invoiceId }, canView && issued);
  const credits = useCreditNotes({ invoiceId }, (canView || canCredit) && issued);
  const queue = useQueueEInvoice();

  if (!issued || (!canView && !canCredit)) return null;
  const sub = subs.data?.items[0];
  const issues = check.data?.issues ?? [];

  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-primary" />E-invoice</h3>
        {sub && <EInvoiceStatusBadge status={sub.status} />}
      </div>

      {canView && (
        <>
          {check.isLoading ? (
            <p className="text-xs text-muted-foreground">Checking…</p>
          ) : check.isError ? (
            <p className="text-xs text-red-600">Could not check this invoice: {(check.error as Error).message}</p>
          ) : check.data?.ready ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />Complete. Ready to be sent to your provider.
            </p>
          ) : (
            <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />{check.data?.errors} thing{check.data?.errors === 1 ? "" : "s"} to fix before it can be sent
            </p>
          )}

          {issues.length > 0 && (
            <ul className="space-y-1 text-xs">
              {issues.map((i, n) => (
                <li key={`${i.code}-${n}`} className={cn("flex gap-1.5", i.severity === "error" ? "text-foreground" : "text-muted-foreground")}>
                  <span className={cn("mt-0.5", i.severity === "error" ? "text-red-600" : "text-amber-600")}>●</span>{i.message}
                </li>
              ))}
            </ul>
          )}

          {sub?.lastError && <p className="text-xs rounded-md bg-red-500/5 border border-red-500/20 p-2">{sub.lastError}</p>}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!check.data?.ready}
              onClick={() => einvoicingApi.downloadXml("invoice", invoiceId, invoiceNumber).catch((e: Error) => toast.error(e.message))}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Download XML
            </Button>
            <Can permission="finance.einvoicing.send">
              {(!sub || ["blocked", "failed", "rejected"].includes(sub.status)) && (
                <Button size="sm" variant="outline" disabled={queue.isPending || !check.data?.ready}
                  onClick={() => queue.mutate({ type: "invoice", id: invoiceId })}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />Queue for provider
                </Button>
              )}
            </Can>
          </div>
        </>
      )}

      {(credits.data?.length ?? 0) > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Credit notes</p>
          {credits.data!.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <span><b>{c.creditNoteNumber}</b> · {formatDate(c.creditDate)} · <span className="capitalize">{c.status}</span></span>
              <span className="tabular-nums">{formatCurrency(c.total, c.currencyCode)}</span>
            </div>
          ))}
        </div>
      )}

      <Can permission="finance.invoicing.create">
        <Button size="sm" variant="outline" onClick={() => setCreditOpen(true)}>
          <Undo2 className="w-3.5 h-3.5 mr-1.5" />Credit note
        </Button>
      </Can>

      {creditOpen && (
        <CreditNoteDialog invoiceId={invoiceId} invoiceNumber={invoiceNumber} currency={currency} total={total}
          onClose={() => setCreditOpen(false)} />
      )}
    </section>
  );
}

/** Portalled: the invoice drawer is transformed, which would clip a fixed-position child. */
function CreditNoteDialog({ invoiceId, invoiceNumber, currency, total, onClose }: {
  invoiceId: string; invoiceNumber: string; currency: string; total: number; onClose: () => void;
}) {
  const create = useCreateCreditNote();
  const [mode, setMode] = React.useState<"whole" | "part">("whole");
  const [reason, setReason] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!reason.trim()) return setError("Say why the invoice is being credited.");
    const net = Number(amount);
    if (mode === "part" && (!desc.trim() || !(net > 0))) return setError("Describe what is being credited and enter an amount above zero.");
    create.mutate(
      {
        invoiceId, reason: reason.trim(),
        items: mode === "whole" ? undefined : [{ description: desc.trim(), quantity: 1, unitPrice: net, taxCategory: "S" }],
      },
      { onSuccess: onClose, onError: (e) => setError((e as Error).message) },
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Credit note for {invoiceNumber}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Corrects an issued invoice without changing it. It is drafted first; nothing reaches the books until you issue it.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {(["whole", "part"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("rounded-lg border px-3 py-2 text-left", mode === m ? "border-primary bg-primary/5" : "border-border")}>
              <p className="font-medium">{m === "whole" ? "Whole invoice" : "Part of it"}</p>
              <p className="text-xs text-muted-foreground">{m === "whole" ? `All lines, ${formatCurrency(total, currency)}` : "One amount you enter"}</p>
            </button>
          ))}
        </div>

        {mode === "part" && (
          <div className="space-y-3">
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">What is being credited</label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Damaged goods returned" /></div>
            <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">Amount before VAT ({currency})</label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">VAT at the invoice's rate is added.</p></div>
          </div>
        )}

        <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">Reason (required)</label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer returned the goods" /></div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={create.isPending} onClick={submit}>{create.isPending ? "Drafting…" : "Create draft"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
