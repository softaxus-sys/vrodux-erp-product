import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Trash2, Users, FileText, Clock, StickyNote, Plus,
  CheckCircle2, Send, ArrowRight, Stamp, Receipt, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useAuthStore } from "@/store/auth.store";
import { Can } from "@/components/auth/can";
import {
  CASE_STATUS_META, CASE_TRANSITIONS,
  type VisaCaseStatus, type CaseDocumentStatus,
} from "@/lib/visa/visa.api";
import {
  useVisaCase, useChangeCaseStatus, useUpdateCaseDocument, useAddCaseDocument,
  useAddCaseNote, useDeleteVisaCase, useGenerateCaseInvoice,
  useCaseSubmissions, useCreateSubmission, useUpdateSubmission,
} from "@/hooks/visa/use-visa";
import { SUBMISSION_TYPES, SUBMISSION_STATUSES, VISA_CHANNELS } from "@/lib/visa/visa.api";

type Tab = "overview" | "applicants" | "documents" | "submissions" | "timeline";

const DOC_STATUS_META: Record<CaseDocumentStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/50" },
  received: { label: "Received", color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  verified: { label: "Verified", color: "text-success",     bg: "bg-success/10" },
  rejected: { label: "Rejected", color: "text-destructive", bg: "bg-destructive/10" },
  expired:  { label: "Expired",  color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20" },
};
const DOC_STATUSES: CaseDocumentStatus[] = ["pending", "received", "verified", "rejected", "expired"];

const EVENT_ICON: Record<string, typeof Clock> = {
  created: Stamp, status_change: ArrowRight, note: StickyNote, document: FileText, assignment: Users, invoice: Receipt,
};

interface Props { caseId: string | null; open: boolean; onClose: () => void; }

export function CaseDrawer({ caseId, open, onClose }: Props) {
  const currency = useCurrency();
  const byName = useAuthStore(s => s.user?.name) ?? "";
  const { data: c, isLoading } = useVisaCase(open ? caseId : null);
  const changeStatus = useChangeCaseStatus();
  const updateDoc = useUpdateCaseDocument();
  const addDoc = useAddCaseDocument();
  const addNote = useAddCaseNote();
  const del = useDeleteVisaCase();
  const genInvoice = useGenerateCaseInvoice();

  const [tab, setTab] = React.useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [newDocName, setNewDocName] = React.useState("");
  // Submit / reject flows collect extra input inline.
  const [pendingStatus, setPendingStatus] = React.useState<VisaCaseStatus | null>(null);
  const [statusExtra, setStatusExtra] = React.useState("");

  React.useEffect(() => {
    if (open) { setTab("overview"); setConfirmDelete(false); setPendingStatus(null); setStatusExtra(""); }
  }, [open, caseId]);

  const busy = changeStatus.isPending || del.isPending;

  const doChangeStatus = (status: VisaCaseStatus) => {
    if (!caseId) return;
    // Submitting captures the government reference; rejecting captures a reason;
    // issuing captures the visa's expiry date (drives Renewals).
    if (status === "submitted" || status === "rejected" || status === "issued") {
      setPendingStatus(status); setStatusExtra("");
      return;
    }
    changeStatus.mutate({ id: caseId, status, byName });
  };

  const confirmPendingStatus = () => {
    if (!caseId || !pendingStatus) return;
    changeStatus.mutate({
      id: caseId, status: pendingStatus, byName,
      govtReference: pendingStatus === "submitted" ? statusExtra.trim() || null : null,
      rejectionReason: pendingStatus === "rejected" ? statusExtra.trim() || null : null,
      visaExpiryDate: pendingStatus === "issued" ? statusExtra.trim() || null : null,
    }, { onSuccess: () => { setPendingStatus(null); setStatusExtra(""); } });
  };

  const submitNote = () => {
    if (!caseId || !note.trim()) return;
    addNote.mutate({ caseId, note: note.trim(), byName }, { onSuccess: () => setNote("") });
  };

  const submitNewDoc = () => {
    if (!caseId || !newDocName.trim()) return;
    addDoc.mutate({ caseId, name: newDocName.trim(), byName }, { onSuccess: () => setNewDocName("") });
  };

  const meta = c ? CASE_STATUS_META[c.status] : null;
  const nextStatuses = c ? (CASE_TRANSITIONS[c.status] ?? []) : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[620px] bg-background border-l border-border shadow-2xl z-50 flex flex-col">

            {isLoading || !c ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-border">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base leading-tight">{c.visaTypeName}</p>
                      {meta && <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", meta.color, meta.bg)}>{meta.label}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{c.caseNumber}{c.govtReference && <> · Govt ref: {c.govtReference}</>}</p>
                    {c.customerName && <p className="text-xs text-muted-foreground mt-0.5">{c.customerName}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border px-6">
                  {(["overview","applicants","documents","submissions","timeline"] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={cn("px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                        tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                      {t}
                      {t === "documents" && c.documents.length > 0 && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          {c.documents.filter(d => d.status === "verified").length}/{c.documents.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {tab === "overview" && (
                    <>
                      {c.rejectionReason && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                          <p className="text-sm font-semibold text-destructive mb-1">Rejected</p>
                          <p className="text-xs text-muted-foreground">{c.rejectionReason}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-muted-foreground">Service Fee</p>
                          <p className="font-bold text-sm">{formatCurrency(c.serviceFee, currency)}</p>
                        </div>
                        <div className="bg-muted/30 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-muted-foreground">Government Fee</p>
                          <p className="font-bold text-sm">{formatCurrency(c.govtFee, currency)}</p>
                        </div>
                      </div>

                      {/* Billing */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Billing</h4>
                        {c.invoiceNumber ? (
                          <Link to="/finance/invoicing" onClick={onClose}
                            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                              <Receipt className="h-4 w-4 text-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium group-hover:text-primary transition-colors">Invoice {c.invoiceNumber}</p>
                              <p className="text-[11px] text-muted-foreground">{formatCurrency(c.serviceFee + c.govtFee, currency)} · view in Finance</p>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary" />
                          </Link>
                        ) : (
                          <Can permission="finance.invoicing.create"
                            fallback={<p className="text-xs text-muted-foreground">No invoice raised yet.</p>}>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 w-full" disabled={genInvoice.isPending}
                              onClick={() => genInvoice.mutate(c)}>
                              {genInvoice.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                              Generate draft invoice — {formatCurrency(c.serviceFee + c.govtFee, currency)}
                            </Button>
                          </Can>
                        )}
                      </div>
                      <div className="space-y-0 bg-muted/30 rounded-xl p-4">
                        {[
                          { label: "Emirate",    value: c.emirate || "—" },
                          { label: "Channel",    value: c.channel },
                          { label: "Priority",   value: c.priority },
                          { label: "Assigned To", value: c.assignedTo || "—" },
                          { label: "SLA Due",    value: c.slaDueDate ? formatDate(c.slaDueDate, "medium") : "—" },
                          ...(c.visaExpiryDate ? [{ label: "Visa Expiry", value: formatDate(c.visaExpiryDate, "medium") }] : []),
                          { label: "Created",    value: formatDate(c.createdAt, "medium") },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between gap-4 py-2 border-b border-border/40 last:border-0">
                            <span className="text-xs text-muted-foreground">{row.label}</span>
                            <span className="text-sm font-medium capitalize">{row.value}</span>
                          </div>
                        ))}
                      </div>
                      {c.notes && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3 leading-relaxed">{c.notes}</p>
                        </div>
                      )}
                    </>
                  )}

                  {tab === "applicants" && (
                    <div className="space-y-3">
                      {c.applicants.map(a => (
                        <div key={a.id} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{getInitials(a.fullName)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{a.fullName}</p>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">{a.relationship}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              <span>Passport: <span className="font-mono text-foreground">{a.passportNumber}</span></span>
                              <span>Nationality: {a.nationality}</span>
                              {a.passportExpiry && <span>Expiry: {formatDate(a.passportExpiry, "medium")}</span>}
                              {a.dateOfBirth && <span>DOB: {formatDate(a.dateOfBirth, "medium")}</span>}
                              {a.emiratesId && <span>EID: {a.emiratesId}</span>}
                              {a.uidNumber && <span>UID: {a.uidNumber}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "documents" && (
                    <div className="space-y-3">
                      <Can permission="visa.cases.edit">
                        <div className="flex gap-2">
                          <Input value={newDocName} onChange={e => setNewDocName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submitNewDoc()}
                            placeholder="Add a document requirement…" className="h-8 text-sm flex-1" />
                          <Button size="sm" className="h-8 gap-1" disabled={!newDocName.trim() || addDoc.isPending} onClick={submitNewDoc}>
                            <Plus className="h-3.5 w-3.5" />Add
                          </Button>
                        </div>
                      </Can>
                      {c.documents.map(d => {
                        const dm = DOC_STATUS_META[d.status];
                        const applicant = d.applicantId ? c.applicants.find(a => a.id === d.applicantId) : null;
                        return (
                          <div key={d.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                            <FileText className={cn("h-4 w-4 shrink-0", dm.color)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{d.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {applicant ? applicant.fullName : "Case-level"}
                                {d.expiryDate && <> · expires {formatDate(d.expiryDate, "medium")}</>}
                                {d.notes && <> · {d.notes}</>}
                              </p>
                            </div>
                            <Can permission="visa.cases.edit"
                              fallback={<span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dm.color, dm.bg)}>{dm.label}</span>}>
                              <select value={d.status} disabled={updateDoc.isPending}
                                onChange={e => caseId && updateDoc.mutate({ caseId, documentId: d.id, status: e.target.value, byName })}
                                className="h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                                {DOC_STATUSES.map(s => <option key={s} value={s}>{DOC_STATUS_META[s].label}</option>)}
                              </select>
                            </Can>
                          </div>
                        );
                      })}
                      {c.documents.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">No document requirements on this case.</p>
                      )}
                    </div>
                  )}

                  {tab === "submissions" && <CaseSubmissionsPanel caseId={c.id} defaultChannel={c.channel} byName={byName} />}

                  {tab === "timeline" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && submitNote()}
                          placeholder="Log a note…" className="h-8 text-sm flex-1" />
                        <Button size="sm" className="h-8 gap-1" disabled={!note.trim() || addNote.isPending} onClick={submitNote}>
                          <Plus className="h-3.5 w-3.5" />Add
                        </Button>
                      </div>
                      {c.timeline.map(e => {
                        const Icon = EVENT_ICON[e.eventType] ?? StickyNote;
                        return (
                          <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">
                                {e.eventType === "status_change" && e.fromStatus && e.toStatus
                                  ? `${CASE_STATUS_META[e.fromStatus as VisaCaseStatus]?.label ?? e.fromStatus} → ${CASE_STATUS_META[e.toStatus as VisaCaseStatus]?.label ?? e.toStatus}`
                                  : e.note ?? e.eventType}
                              </p>
                              {e.eventType === "status_change" && e.note && <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>}
                              <p className="text-[11px] text-muted-foreground mt-0.5">{e.byName} · {formatDate(e.createdAt, "medium")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer — legal next transitions */}
                <div className="border-t border-border px-6 py-4 flex items-center gap-2 flex-wrap">
                  <Can permission="visa.cases.edit">
                    {nextStatuses.map(s => {
                      const sm = CASE_STATUS_META[s];
                      const destructive = s === "rejected" || s === "cancelled";
                      return (
                        <Button key={s} size="sm" variant={destructive ? "outline" : "default"}
                          className={cn("h-9 gap-1.5", destructive && "text-destructive border-destructive/30 hover:bg-destructive/5")}
                          disabled={busy} onClick={() => doChangeStatus(s)}>
                          {s === "submitted" ? <Send className="h-3.5 w-3.5" /> : s === "approved" || s === "issued" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {sm.label}
                        </Button>
                      );
                    })}
                  </Can>
                  <Can permission="visa.cases.delete">
                    <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-destructive hover:bg-destructive/5 ml-auto" disabled={busy}
                      onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </Button>
                  </Can>
                </div>

                {/* Submit / reject extra-input panel */}
                <AnimatePresence>
                  {pendingStatus && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 z-[60]" onClick={() => setPendingStatus(null)} />
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                        className="absolute inset-x-6 top-1/3 z-[61] rounded-xl border border-border bg-background p-5 shadow-2xl">
                        <p className="font-semibold text-sm">
                          {pendingStatus === "submitted" ? "Mark as submitted" : pendingStatus === "issued" ? "Issue visa" : "Reject case"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                          {pendingStatus === "submitted"
                            ? "Enter the reference number from the government portal (optional)."
                            : pendingStatus === "issued"
                            ? "Enter the issued visa's expiry date so it surfaces on Renewals (optional)."
                            : "Why was this application rejected?"}
                        </p>
                        <Input
                          type={pendingStatus === "issued" ? "date" : "text"}
                          value={statusExtra} onChange={e => setStatusExtra(e.target.value)}
                          placeholder={pendingStatus === "submitted" ? "e.g. eDNRD application number…" : "Rejection reason…"}
                          className="h-9 text-sm" />
                        <div className="flex justify-end gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => setPendingStatus(null)} disabled={changeStatus.isPending}>Cancel</Button>
                          <Button size="sm" className={cn("gap-1.5", pendingStatus === "rejected" && "bg-destructive hover:bg-destructive/90")}
                            disabled={changeStatus.isPending} onClick={confirmPendingStatus}>
                            {changeStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {pendingStatus === "submitted" ? "Mark Submitted" : pendingStatus === "issued" ? "Issue Visa" : "Reject"}
                          </Button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Delete confirmation */}
                <AnimatePresence>
                  {confirmDelete && (
                    <>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 z-[60]" onClick={() => setConfirmDelete(false)} />
                      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                        className="absolute inset-x-6 top-1/3 z-[61] rounded-xl border border-border bg-background p-5 shadow-2xl">
                        <p className="font-semibold text-sm">Delete case?</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          This will delete <span className="font-medium text-foreground">{c.caseNumber}</span> and its checklist. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>Cancel</Button>
                          <Button size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5" disabled={del.isPending}
                            onClick={() => caseId && del.mutate(caseId, { onSuccess: onClose })}>
                            {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Delete
                          </Button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const SUB_STATUS_CLS: Record<string, string> = {
  submitted: "text-violet-600 bg-violet-100 dark:bg-violet-900/20",
  in_review: "text-blue-600 bg-blue-100 dark:bg-blue-900/20",
  approved:  "text-success bg-success/10",
  rejected:  "text-destructive bg-destructive/10",
  completed: "text-muted-foreground bg-muted",
};

function CaseSubmissionsPanel({ caseId, defaultChannel, byName }: { caseId: string; defaultChannel: string; byName: string }) {
  const { data: subs = [], isLoading } = useCaseSubmissions(caseId, true);
  const create = useCreateSubmission();
  const update = useUpdateSubmission();
  const [adding, setAdding] = React.useState(false);
  const [channel, setChannel] = React.useState(defaultChannel || "manual");
  const [type, setType] = React.useState(SUBMISSION_TYPES[0]);
  const [ref, setRef] = React.useState("");

  const submit = () => {
    if (!caseId) return;
    create.mutate({ caseId, channel, submissionType: type, externalReference: ref.trim() || null },
      { onSuccess: () => { setAdding(false); setRef(""); } });
  };
  const label = (s: string) => s.replace(/_/g, " ");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Government submissions</h4>
        <Can permission="visa.cases.edit">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setAdding(v => !v)}>
            <Plus className="h-3.5 w-3.5" />Record
          </Button>
        </Can>
      </div>

      {adding && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={channel} onChange={e => setChannel(e.target.value)}
              className="h-9 px-2 rounded-lg border border-border bg-card text-sm text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/30">
              {VISA_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={type} onChange={e => setType(e.target.value)}
              className="h-9 px-2 rounded-lg border border-border bg-card text-sm text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SUBMISSION_TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="Government reference (optional)…" className="h-9 text-sm flex-1" />
            <Button size="sm" className="h-9" onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : subs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No government submissions recorded yet.</p>
      ) : subs.map(s => (
        <div key={s.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium capitalize">{label(s.submissionType)}</p>
            <p className="text-[11px] text-muted-foreground">
              <span className="uppercase">{s.channel}</span>{s.externalReference && <> · {s.externalReference}</>} · {formatDate(s.submittedAt, "medium")}
            </p>
          </div>
          <Can permission="visa.cases.edit"
            fallback={<span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", SUB_STATUS_CLS[s.status] ?? "bg-muted")}>{label(s.status)}</span>}>
            <select value={s.status} onChange={e => caseId && update.mutate({ caseId, submissionId: s.id, status: e.target.value })}
              className="h-8 px-2 rounded-lg border border-border bg-card text-xs text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SUBMISSION_STATUSES.map(st => <option key={st} value={st}>{label(st)}</option>)}
            </select>
          </Can>
        </div>
      ))}
    </div>
  );
}
