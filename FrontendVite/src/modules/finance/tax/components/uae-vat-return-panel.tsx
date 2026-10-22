import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Info, XCircle, Download, Send, ShieldCheck, FileCheck2,
  RefreshCw, Landmark, Loader2, Building2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can, useCan } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { EMIRATES, uaeVatApi, type VatReturnDto, type VatReturnStatus } from "@/lib/finance/uae-vat.api";
import {
  useUaeVatProfile, useUaeVatIntegration, useVatReturns, useSaveUaeVatProfile,
  usePrepareVatReturn, useApproveVatReturn, useMarkVatReturnReady, useSubmitVatReturn, useRecordVatPortalFiling,
} from "@/hooks/finance/use-uae-vat";
import type { TaxPeriodDto } from "@/lib/finance/finance.api";

// FTA VAT 201 figures are always AED, whatever the workspace's display currency.
const AED = (v: number) => formatCurrency(v, "AED");

const STEPS: { key: VatReturnStatus; label: string }[] = [
  { key: "draft", label: "Draft" }, { key: "validated", label: "Validated" }, { key: "reconciled", label: "Reconciled" },
  { key: "approved", label: "Approved" }, { key: "ready_to_submit", label: "Ready to submit" },
  { key: "submitted", label: "Submitted" }, { key: "acknowledged", label: "Acknowledged" },
];
const ORDER: Record<string, number> = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));
ORDER.filed_via_portal = ORDER.submitted;
ORDER.rejected = ORDER.submitted;

const OUTCOME_STYLE: Record<string, string> = {
  submitted: "text-success", acknowledged: "text-success", rejected: "text-destructive",
  failed: "text-warning", auth_failed: "text-destructive", not_available: "text-muted-foreground", in_progress: "text-blue-600",
};

function Stepper({ status }: { status: VatReturnStatus }) {
  const at = ORDER[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((s, i) => {
        const done = i < at || (i === at && status !== "rejected");
        const label = i === ORDER.submitted && status === "filed_via_portal" ? "Filed on EmaraTax"
                    : i === ORDER.submitted && status === "rejected" ? "Rejected" : s.label;
        return (
          <span key={s.key} className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border",
            i === at && status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/30"
              : done ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border")}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function IssueList({ issues }: { issues: VatReturnDto["issues"] }) {
  if (!issues.length) return null;
  const icon = { error: XCircle, warning: AlertTriangle, info: Info } as const;
  const color = { error: "text-destructive", warning: "text-warning", info: "text-muted-foreground" } as const;
  const sorted = [...issues].sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity));
  return (
    <div className="space-y-1.5">
      {sorted.map((i, n) => {
        const I = icon[i.severity];
        return (
          <div key={n} className="flex gap-2 text-xs">
            <I className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", color[i.severity])} />
            <span>{i.message}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profile } = useUaeVatProfile();
  const save = useSaveUaeVatProfile();
  const [form, setForm] = React.useState({ trn: "", nameEn: "", nameAr: "", address: "", defaultEmirate: "DXB", taxAgencyName: "", tan: "", taxAgentName: "", taan: "" });
  React.useEffect(() => {
    if (open && profile) setForm({
      trn: profile.trn, nameEn: profile.nameEn, nameAr: profile.nameAr ?? "", address: profile.address ?? "",
      defaultEmirate: profile.defaultEmirate || "DXB", taxAgencyName: profile.taxAgencyName ?? "", tan: profile.tan ?? "",
      taxAgentName: profile.taxAgentName ?? "", taan: profile.taan ?? "",
    });
  }, [open, profile]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const trnOk = /^100\d{12}$/.test(form.trn.replace(/\D/g, ""));

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
            className="w-full max-w-md max-h-full overflow-y-auto bg-background border border-border rounded-xl shadow-xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">UAE VAT registration</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <label className="block text-xs space-y-1"><span>TRN (15 digits)</span>
              <Input value={form.trn} onChange={set("trn")} inputMode="numeric" maxLength={15} placeholder="100XXXXXXXXXXXX" />
              {form.trn && !trnOk && <span className="text-destructive">Must be 15 digits starting with 100.</span>}
            </label>
            <label className="block text-xs space-y-1"><span>Taxable person name (English)</span><Input value={form.nameEn} onChange={set("nameEn")} /></label>
            <label className="block text-xs space-y-1"><span>Name (Arabic)</span><Input dir="rtl" value={form.nameAr} onChange={set("nameAr")} /></label>
            <label className="block text-xs space-y-1"><span>Address</span><Input value={form.address} onChange={set("address")} /></label>
            <label className="block text-xs space-y-1"><span>Emirate of supply (boxes 1a–1g)</span>
              <select value={form.defaultEmirate} onChange={set("defaultEmirate")} className="bg-card w-full h-9 rounded-md border border-input px-2 text-sm">
                {EMIRATES.map(e => <option key={e.code} value={e.code}>{e.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs space-y-1"><span>Tax agent name</span><Input value={form.taxAgentName} onChange={set("taxAgentName")} /></label>
              <label className="block text-xs space-y-1"><span>TAAN</span><Input value={form.taan} onChange={set("taan")} /></label>
              <label className="block text-xs space-y-1"><span>Tax agency name</span><Input value={form.taxAgencyName} onChange={set("taxAgencyName")} /></label>
              <label className="block text-xs space-y-1"><span>TAN</span><Input value={form.tan} onChange={set("tan")} /></label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" disabled={!trnOk || !form.nameEn.trim() || save.isPending}
                onClick={async () => { try { await save.mutateAsync(form); onClose(); } catch { /* hook toasts */ } }}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function UaeVatReturnPanel({ period }: { period: TaxPeriodDto }) {
  const { data: profile } = useUaeVatProfile();
  const { data: integration } = useUaeVatIntegration();
  const { data: returns = [], isLoading } = useVatReturns(period.id);
  const ret = returns[0];
  const prepare = usePrepareVatReturn();
  const approve = useApproveVatReturn();
  const ready = useMarkVatReturnReady();
  const submit = useSubmitVatReturn();
  const portal = useRecordVatPortalFiling();
  const canApprove = useCan("finance.tax.approve");
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [portalRef, setPortalRef] = React.useState("");
  const busy = prepare.isPending || approve.isPending || ready.isPending || submit.isPending || portal.isPending;
  const env = integration?.environment ?? "sandbox";

  const dl = (kind: "faf" | "xml" | "attempts") =>
    uaeVatApi.download(ret!.id, kind, `${kind}-${ret!.periodLabel}`).catch((e: Error) => toast.error(e.message));

  return (
    <div className="relative space-y-4">
      {/* Taxpayer + environment */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
        <div className="flex gap-2 min-w-0">
          <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{profile?.configured ? profile.nameEn : "VAT registration not set"}</p>
            <p className="text-xs text-muted-foreground">TRN {profile?.configured ? profile.trn : "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
            env === "production" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
            {env}
          </span>
          <Can permission="finance.tax.edit">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setProfileOpen(true)}>Registration</Button>
          </Can>
        </div>
      </div>

      {integration && !integration.submissionAvailable && (
        <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3 text-xs">
          <Landmark className="h-4 w-4 text-blue-600 shrink-0" />
          <span>{integration.unavailableReason}</span>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      : !ret ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-muted-foreground">No FTA return has been prepared for {period.period}.</p>
          <Can permission="finance.tax.create">
            <Button size="sm" disabled={busy} onClick={() => prepare.mutate(period.id)} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />Prepare from ledger
            </Button>
          </Can>
        </div>
      ) : (
        <>
          <Stepper status={ret.status} />

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            {[["Output VAT", ret.outputVat], ["Recoverable input VAT", ret.inputVat], [ret.netVat >= 0 ? "Net VAT payable" : "Net VAT refundable", Math.abs(ret.netVat)]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border p-3 min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{l}</p>
                <p className="text-sm font-bold truncate">{AED(v as number)}</p>
              </div>
            ))}
          </div>

          {/* Reconciliation */}
          {ret.reconciliation && (
            <div className={cn("rounded-xl border p-3 text-xs space-y-1",
              ret.reconciliation.reconciled ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5")}>
              <p className="font-semibold flex items-center gap-1.5">
                {ret.reconciliation.reconciled ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                {ret.reconciliation.reconciled ? "Reconciled to the VAT control account" : "Not reconciled"}
              </p>
              <p className="text-muted-foreground">
                Return {AED(ret.reconciliation.returnNetVat)} · GL {ret.reconciliation.glNetVat == null ? "no postings" : AED(ret.reconciliation.glNetVat)} · Difference {AED(ret.reconciliation.difference)}
              </p>
            </div>
          )}

          <IssueList issues={ret.issues} />

          {/* Boxes */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr><th className="text-start p-2 w-12">Box</th><th className="text-start p-2">Description</th><th className="text-end p-2">Amount (AED)</th><th className="text-end p-2">VAT (AED)</th></tr>
              </thead>
              <tbody>
                {ret.boxes.map(b => (
                  <tr key={b.box} className={cn("border-t border-border", (b.box === "8" || b.box === "12" || b.box === "14") && "font-semibold bg-muted/20")}>
                    <td className="p-2">{b.box.replace("-due", "")}</td>
                    <td className="p-2">{b.label}</td>
                    <td className="p-2 text-end tabular-nums">{b.amount ? b.amount.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}</td>
                    <td className="p-2 text-end tabular-nums">{b.vat ? b.vat.toLocaleString("en-AE", { minimumFractionDigits: 2 }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ret.status === "rejected" && ret.rejectionReason && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">Rejected: {ret.rejectionReason}</div>
          )}
          {ret.submissionReference && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs">
              {ret.status === "filed_via_portal" ? "Filed on EmaraTax" : `Submitted (${ret.environment})`} · Reference <b>{ret.submissionReference}</b>
              {ret.submittedAt && <> · {formatDate(ret.submittedAt, "short")}</>}
            </div>
          )}

          {/* Actions — each appears only when the workflow allows it */}
          <div className="flex flex-wrap gap-2">
            {["draft", "validated", "reconciled", "rejected"].includes(ret.status) && (
              <Can permission="finance.tax.create">
                <Button variant="outline" size="sm" disabled={busy} className="gap-1.5" onClick={() => prepare.mutate(period.id)}>
                  <RefreshCw className="h-3.5 w-3.5" />Re-prepare
                </Button>
              </Can>
            )}
            {canApprove && ret.status === "reconciled" && (
              <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => approve.mutate(ret.id)}><ShieldCheck className="h-3.5 w-3.5" />Approve</Button>
            )}
            {canApprove && ret.status === "approved" && (
              <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => ready.mutate(ret.id)}><FileCheck2 className="h-3.5 w-3.5" />Generate files &amp; mark ready</Button>
            )}
            {canApprove && ret.status === "ready_to_submit" && integration?.submissionAvailable && (
              <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => submit.mutate(ret.id)}>
                <Send className="h-3.5 w-3.5" />{ret.attempts.length ? "Retry submission" : `Submit to ${env}`}
              </Button>
            )}
            {ret.hasFiles && (<>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => dl("xml")}><Download className="h-3.5 w-3.5" />Return (XML)</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => dl("faf")}><Download className="h-3.5 w-3.5" />Audit file (FAF)</Button>
            </>)}
            {ret.attempts.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => dl("attempts")}><Download className="h-3.5 w-3.5" />Submission log</Button>
            )}
          </div>

          {canApprove && ret.status === "ready_to_submit" && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-xs font-semibold">Filed on EmaraTax yourself?</p>
              <p className="text-[11px] text-muted-foreground">Enter the reference EmaraTax shows after you submit the return. This records a manual filing — Vrodux did not transmit it.</p>
              <div className="flex gap-2">
                <Input value={portalRef} onChange={e => setPortalRef(e.target.value)} placeholder="EmaraTax reference" className="h-8 text-xs" />
                <Button size="sm" className="h-8" disabled={!portalRef.trim() || busy}
                  onClick={() => portal.mutate({ id: ret.id, reference: portalRef.trim() }, { onSuccess: () => setPortalRef("") })}>Record</Button>
              </div>
            </div>
          )}

          {/* Submission history */}
          {ret.attempts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Submission history</p>
              {ret.attempts.map(a => (
                <div key={a.id} className="rounded-lg border border-border p-2 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>#{a.attemptNumber} · {a.environment} · <span className={cn("font-semibold", OUTCOME_STYLE[a.outcome])}>{a.outcome.replace(/_/g, " ")}</span>{a.httpStatus ? ` · HTTP ${a.httpStatus}` : ""}</span>
                    <span className="text-muted-foreground">{formatDate(a.startedAt, "short")}</span>
                  </div>
                  {a.externalReference && <p>Reference {a.externalReference}</p>}
                  {a.message && <p className="text-muted-foreground">{a.message}</p>}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Prepared by {ret.preparedByName ?? "—"}{ret.preparedAt && ` · ${formatDate(ret.preparedAt, "short")}`}
            {ret.approvedByName && ` · Approved by ${ret.approvedByName}`}
          </p>
        </>
      )}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
