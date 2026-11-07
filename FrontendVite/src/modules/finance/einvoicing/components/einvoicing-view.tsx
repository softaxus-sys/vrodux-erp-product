import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, Send, RefreshCw, FileText, Settings2, ListChecks, Undo2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  useEInvoiceReadiness, useEInvoiceSettings, useUpdateEInvoiceSettings, useEInvoiceSubmissions,
  useRetryEInvoice, useCreditNotes, useIssueCreditNote, useCancelCreditNote,
} from "@/hooks/finance/use-einvoicing";
import { einvoicingApi, type EInvoiceStatus, type UpdateEInvoiceSettings } from "@/lib/finance/einvoicing.api";

type Tab = "readiness" | "submissions" | "credit-notes" | "settings";

const STATUS_STYLE: Record<EInvoiceStatus, { label: string; cls: string }> = {
  queued:    { label: "Waiting to send", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  sending:   { label: "Sending",         cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  sent:      { label: "Sent",            cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  delivered: { label: "Delivered",       cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  accepted:  { label: "Accepted",        cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  rejected:  { label: "Rejected",        cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
  failed:    { label: "Failed",          cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
  cancelled: { label: "Cancelled",       cls: "bg-muted text-muted-foreground" },
  blocked:   { label: "Needs fixing",    cls: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

/** Said in words as well as colour. */
export function EInvoiceStatusBadge({ status }: { status: EInvoiceStatus }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>{s.label}</span>;
}

export function EInvoicingView() {
  const [tab, setTab] = React.useState<Tab>("readiness");
  const tabs: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: "readiness", label: "Readiness", icon: ListChecks },
    { id: "submissions", label: "Sent documents", icon: Send },
    { id: "credit-notes", label: "Credit notes", icon: Undo2 },
    { id: "settings", label: "Provider & registration", icon: Settings2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">UAE E-Invoicing</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Prepares your invoices and credit notes in the UAE e-invoice format and hands them to your accredited provider.
          Vrodux does not send anything to the tax authority itself.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "readiness" && <ReadinessTab />}
      {tab === "submissions" && <SubmissionsTab />}
      {tab === "credit-notes" && <CreditNotesTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", tone)}>{value}</p>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
      <p className="font-medium text-red-700 dark:text-red-400">Could not load this</p>
      <p className="text-muted-foreground mt-1">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Retry</Button>
    </div>
  );
}

// ── Readiness ──────────────────────────────────────────────────────────────────────────────

function ReadinessTab() {
  const { data, isLoading, isError, error, refetch } = useEInvoiceReadiness();
  const settings = useEInvoiceSettings();
  if (isLoading) return <p className="text-sm text-muted-foreground">Checking your invoices…</p>;
  if (isError || !data) return <ErrorBox message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;

  const providerOk = settings.data?.providerAvailable;
  return (
    <div className="space-y-6">
      {!providerOk && (
        <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No e-invoicing provider is connected yet</p>
            <p className="text-muted-foreground mt-1">
              {settings.data?.providerUnavailableReason ?? "Nothing is sent yet."} You can still fix the data below and download
              the XML of any invoice from its page, so you are ready the day a provider is connected.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Invoices checked" value={data.invoicesChecked} />
        <Tile label="Ready to send" value={data.invoicesReady} tone="text-emerald-600 dark:text-emerald-400" />
        <Tile label="Need fixing" value={data.invoicesBlocked} tone={data.invoicesBlocked > 0 ? "text-red-600 dark:text-red-400" : undefined} />
        <Tile label="Customers without a TRN" value={data.customersMissingTrn} tone={data.customersMissingTrn > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
      </div>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          {data.supplierReady ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
          <h2 className="text-sm font-semibold">Your company's details</h2>
        </header>
        <div className="p-4 text-sm">
          {data.supplierReady ? (
            <p className="text-muted-foreground">Your name, TRN, trade licence and address are complete.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.supplierIssues.map(i => <li key={i.code} className="flex gap-2"><AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />{i.message}</li>)}
            </ul>
          )}
        </div>
      </section>

      {data.totals.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold">What is stopping invoices</h2></header>
          <table className="w-full text-sm">
            <tbody>
              {data.totals.map(t => (
                <tr key={t.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">{t.message}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.problems.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <header className="px-4 py-3 border-b border-border"><h2 className="text-sm font-semibold">Invoices to fix (first {data.problems.length})</h2></header>
          <table className="w-full text-sm">
            <tbody>
              {data.problems.map(p => (
                <tr key={`${p.kind}-${p.id}`} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.problem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.invoicesBlocked === 0 && data.supplierReady && data.invoicesChecked > 0 && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Every invoice checked is complete.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Checked: invoices since the go-live date (or the last 90 days), up to 500. Customers without a TRN are only a problem if they are VAT-registered.
      </p>
    </div>
  );
}

// ── Submissions ────────────────────────────────────────────────────────────────────────────

function SubmissionsTab() {
  const [status, setStatus] = React.useState("");
  const { data, isLoading, isError, error, refetch } = useEInvoiceSubmissions({ status: status || undefined });
  const retry = useRetryEInvoice();
  const canSend = useCan("finance.einvoicing.send");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-card text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : isError ? <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />
        : !data || data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing has been queued. Documents appear here once e-invoicing is switched on or you queue one from an invoice.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5">Document</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Tries</th><th className="px-4 py-2.5">Provider says</th><th className="px-4 py-2.5" />
              </tr></thead>
              <tbody>
                {data.items.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2.5"><p className="font-medium">{s.documentNumber}</p>
                      <p className="text-xs text-muted-foreground">{s.documentType === "credit_note" ? "Credit note" : "Invoice"} · {formatDate(s.createdAt)}</p></td>
                    <td className="px-4 py-2.5"><EInvoiceStatusBadge status={s.status} /></td>
                    <td className="px-4 py-2.5 tabular-nums">{s.attempts}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-md">{s.lastError ?? (s.externalId ? `Reference ${s.externalId}` : "—")}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {s.hasXml && (
                        <Button variant="ghost" size="sm" onClick={() => einvoicingApi.downloadXml(s.documentType === "credit_note" ? "credit-note" : "invoice", s.documentId, s.documentNumber)}>
                          <Download className="w-3.5 h-3.5 mr-1" />XML
                        </Button>
                      )}
                      {canSend && ["failed", "rejected", "blocked"].includes(s.status) && (
                        <Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(s.id)}>Try again</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// ── Credit notes ───────────────────────────────────────────────────────────────────────────

function CreditNotesTab() {
  const { data, isLoading, isError, error, refetch } = useCreditNotes();
  const issue = useIssueCreditNote();
  const cancel = useCancelCreditNote();
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No credit notes yet. Open an issued invoice and choose “Credit note” to correct it. An issued invoice is never edited or made negative.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
          <th className="px-4 py-2.5">Credit note</th><th className="px-4 py-2.5">Invoice</th><th className="px-4 py-2.5">Reason</th>
          <th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" />
        </tr></thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id} className="border-b border-border last:border-0 align-top">
              <td className="px-4 py-2.5"><p className="font-medium">{c.creditNoteNumber}</p><p className="text-xs text-muted-foreground">{c.customerName} · {formatDate(c.creditDate)}</p></td>
              <td className="px-4 py-2.5">{c.invoiceNumber}</td>
              <td className="px-4 py-2.5 text-muted-foreground max-w-xs">{c.reason}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(c.total, c.currencyCode)}</td>
              <td className="px-4 py-2.5 space-y-1">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  c.status === "issued" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : c.status === "draft" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>{c.status}</span>
                {c.eInvoiceStatus && <div><EInvoiceStatusBadge status={c.eInvoiceStatus} /></div>}
              </td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                {c.status === "draft" && (
                  <Can permission="finance.invoicing.edit">
                    {confirmId === c.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Posts to the ledger.</span>
                        <Button size="sm" disabled={issue.isPending} onClick={() => issue.mutate(c.id, { onSettled: () => setConfirmId(null) })}>Issue</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Back</Button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-2">
                        <Button size="sm" onClick={() => setConfirmId(c.id)}>Issue</Button>
                        <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(c.id)}>Discard</Button>
                      </span>
                    )}
                  </Can>
                )}
                {c.status === "issued" && (
                  <Button variant="ghost" size="sm" onClick={() => einvoicingApi.downloadXml("credit-note", c.id, c.creditNoteNumber).catch((e: Error) => toast.error(e.message))}>
                    <FileText className="w-3.5 h-3.5 mr-1" />XML
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data, isLoading, isError, error, refetch } = useEInvoiceSettings();
  const save = useUpdateEInvoiceSettings();
  const canEdit = useCan("finance.einvoicing.edit");
  const [form, setForm] = React.useState<UpdateEInvoiceSettings | null>(null);

  React.useEffect(() => {
    if (data) setForm({
      providerKey: data.providerKey, environment: data.environment, enabled: data.enabled, goLiveDate: data.goLiveDate,
      legalIdScheme: data.legalIdScheme ?? "AE:TL", legalId: data.legalId, registrationAuthority: data.registrationAuthority,
      supplierCity: data.supplierCity,
    });
  }, [data]);

  if (isLoading || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !data) return <ErrorBox message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;

  const set = <K extends keyof UpdateEInvoiceSettings>(k: K, v: UpdateEInvoiceSettings[K]) => setForm(f => f ? { ...f, [k]: v } : f);
  const field = "space-y-1.5";
  const label = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";
  const blank = (v: string | null) => v ?? "";

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Your registration</h2>
        <p className="text-sm text-muted-foreground">
          Used on every e-invoice. Your name and TRN come from <b>Finance, Tax, FTA Return</b> (or Settings, General):
          currently <b>{data.supplierName || "not set"}</b>, TRN <b>{data.supplierTrn || "not set"}</b>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className={field}><label className={label}>Registration type</label>
            <select disabled={!canEdit} value={blank(form.legalIdScheme)} onChange={e => set("legalIdScheme", e.target.value)}
              className="h-9 w-full px-3 rounded-lg border border-border bg-card text-sm">
              <option value="AE:TL">Trade licence</option><option value="AE:EID">Emirates ID</option>
              <option value="AE:PAS">Passport</option><option value="AE:CD">Cabinet Decision</option>
            </select></div>
          <div className={field}><label className={label}>Registration number</label>
            <Input disabled={!canEdit} value={blank(form.legalId)} onChange={e => set("legalId", e.target.value)} placeholder="e.g. 123456" /></div>
          <div className={field}><label className={label}>Issuing authority</label>
            <Input disabled={!canEdit} value={blank(form.registrationAuthority)} onChange={e => set("registrationAuthority", e.target.value)} placeholder="e.g. DED Dubai" />
            <p className="text-xs text-muted-foreground">Required for a trade licence.</p></div>
          <div className={field}><label className={label}>City</label>
            <Input disabled={!canEdit} value={blank(form.supplierCity)} onChange={e => set("supplierCity", e.target.value)} placeholder="e.g. Dubai" /></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Provider</h2>
        {!data.providerAvailable && (
          <div className="flex gap-3 rounded-lg bg-sky-500/5 border border-sky-500/30 p-3 text-sm">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">{data.providerUnavailableReason}</p>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className={field}><label className={label}>Environment</label>
            <select disabled={!canEdit} value={form.environment} onChange={e => set("environment", e.target.value as "sandbox" | "production")}
              className="h-9 w-full px-3 rounded-lg border border-border bg-card text-sm">
              <option value="sandbox">Sandbox (test)</option><option value="production">Production</option>
            </select></div>
          <div className={field}><label className={label}>Start sending from</label>
            <Input type="date" disabled={!canEdit} value={blank(form.goLiveDate)} onChange={e => set("goLiveDate", e.target.value || null)} />
            <p className="text-xs text-muted-foreground">Invoices dated earlier are never sent.</p></div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={!canEdit || !data.providerAvailable} checked={form.enabled} onChange={e => set("enabled", e.target.checked)} />
          Send invoices and credit notes to the provider automatically when they are issued
        </label>
      </section>

      <Can permission="finance.einvoicing.edit">
        <Button disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</Button>
      </Can>
    </div>
  );
}
