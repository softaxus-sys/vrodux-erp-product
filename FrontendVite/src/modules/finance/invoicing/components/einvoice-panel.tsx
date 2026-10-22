import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  FileCode2, ChevronDown, Download, Send, Loader2, AlertCircle, AlertTriangle,
  CheckCircle2, XCircle, Clock, PlugZap, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { downloadFile } from "@/lib/csv";
import { useEInvoiceStatus, useSubmitEInvoice } from "@/hooks/finance/use-einvoice";
import type { EInvoiceOutcome } from "@/lib/finance/einvoice.api";

const OUTCOME: Record<EInvoiceOutcome, { icon: typeof CheckCircle2; cls: string }> = {
  accepted:       { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  sending:        { icon: Clock,        cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  rejected:       { icon: XCircle,      cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
  failed:         { icon: AlertCircle,  cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
  not_configured: { icon: PlugZap,      cls: "bg-muted text-muted-foreground" },
};

/**
 * UAE e-invoice (PINT AE) for one invoice: check it, preview and download the XML, and send it to
 * the connected Accredited Service Provider. Collapsed by default — opening it is what builds the
 * XML on the server, so a drawer opened only to read an invoice costs nothing extra.
 */
export function EInvoicePanel({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation("finance");
  const [open, setOpen]       = React.useState(false);
  const [showXml, setShowXml] = React.useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useEInvoiceStatus(invoiceId, open);
  const submit = useSubmitEInvoice(invoiceId);

  const errors   = data?.issues.filter(i => i.severity === "error") ?? [];
  const warnings = data?.issues.filter(i => i.severity === "warning") ?? [];
  const accepted = data?.submissions.find(s => s.status === "accepted");
  const tx = (k: string, d: string, o?: Record<string, unknown>) => t(`einvoice.${k}`, { defaultValue: d, ...o });

  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-start" aria-expanded={open}>
        <FileCode2 className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{tx("title", "E-invoice (UAE)")}</p>
          <p className="text-xs text-muted-foreground">{tx("subtitle", "PINT AE document for the e-invoicing network")}</p>
        </div>
        {accepted && (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            {tx("status.accepted", "Accepted")}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{tx("loading", "Building the e-invoice…")}
            </p>
          ) : isError || !data ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive">{(error as Error)?.message ?? tx("loadFailed", "Could not build the e-invoice.")}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>{tx("retry", "Retry")}</Button>
            </div>
          ) : (
            <>
              {/* Provider connection — stated plainly so nobody assumes an invoice was transmitted. */}
              <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                data.gatewayConfigured ? "bg-sky-500/10 text-sky-800 dark:text-sky-300" : "bg-muted text-muted-foreground")}>
                <PlugZap className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  {data.gatewayConfigured
                    ? tx("connected", "Sends to {{provider}} ({{env}}).", { provider: data.provider, env: data.environment })
                    : tx("notConnected", "No e-invoicing provider is connected yet. You can check and download the XML; sending is switched off.")}
                </span>
              </div>

              {/* Checks */}
              {errors.length === 0 && warnings.length === 0 ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />{tx("ready", "Passes all checks.")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {errors.map(i => (
                    <li key={i.code + i.message} className="flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />{i.message}
                    </li>
                  ))}
                  {warnings.map(i => (
                    <li key={i.code + i.message} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />{i.message}
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!data.xml}
                  onClick={() => setShowXml(s => !s)}>
                  <FileCode2 className="h-3.5 w-3.5" />{showXml ? tx("hideXml", "Hide XML") : tx("previewXml", "Preview XML")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!data.xml}
                  onClick={() => data.xml && downloadFile(`${data.invoiceNumber}.xml`, data.xml, "application/xml")}>
                  <Download className="h-3.5 w-3.5" />{tx("download", "Download XML")}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" disabled={isFetching} onClick={() => refetch()}>
                  <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />{tx("recheck", "Re-check")}
                </Button>
                <Can permission="finance.invoicing.edit">
                  <Button size="sm" className="gap-1.5 ms-auto"
                    disabled={!data.gatewayConfigured || !data.canSubmit || submit.isPending}
                    title={!data.gatewayConfigured ? tx("sendOffHint", "Connect a provider to send.")
                      : accepted ? tx("sentHint", "Already accepted — correct it with a credit note.")
                      : errors.length ? tx("fixHint", "Fix the errors above first.") : undefined}
                    onClick={() => submit.mutate()}>
                    {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {tx("send", "Send to provider")}
                  </Button>
                </Can>
              </div>

              {showXml && data.xml && (
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed font-mono whitespace-pre" dir="ltr">
                  {data.xml}
                </pre>
              )}

              {/* History — every attempt, with what the provider said. */}
              {data.submissions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tx("history", "Sending history")}</p>
                  {data.submissions.map(s => {
                    const meta = OUTCOME[s.status] ?? OUTCOME.failed;
                    const Icon = meta.icon;
                    return (
                      <div key={s.id} className="rounded-lg border border-border px-3 py-2 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", meta.cls)}>
                            <Icon className="h-3 w-3" />{tx(`status.${s.status}`, s.status)}
                          </span>
                          <span className="text-muted-foreground">{formatDate(s.createdAt)}</span>
                          {s.submittedByName && <span className="text-muted-foreground">· {s.submittedByName}</span>}
                          {s.providerMessageId && <span className="font-mono text-muted-foreground ms-auto" dir="ltr">{s.providerMessageId}</span>}
                        </div>
                        {s.message && <p className="text-muted-foreground break-words">{s.message}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
