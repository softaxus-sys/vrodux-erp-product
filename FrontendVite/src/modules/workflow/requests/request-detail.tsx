import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Check, Clock, FileDown, Loader2, MessageSquare, Pencil, RotateCcw, Send, Trash2, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAct, useRequest } from "@/hooks/workflow/use-workflow";
import { actionLabel, ago, fmtDateTime, fmtMoney, parseFields, workflowApi, type RequestDetail, type RequestStep } from "@/lib/workflow/workflow.api";
import { ErrorBox, Modal, Spinner, StatusPill, TEXTAREA, UserPicker, initials } from "../shared/ui";
import { DataView } from "./form-renderer";

function StepIcon({ status }: { status: string }) {
  const base = "size-7 rounded-full flex items-center justify-center shrink-0 ring-4 ring-card";
  if (status === "approved") return <span className={cn(base, "bg-emerald-500 text-white")}><Check className="size-4" /></span>;
  if (status === "rejected") return <span className={cn(base, "bg-red-500 text-white")}><X className="size-4" /></span>;
  if (status === "pending") return <span className={cn(base, "bg-amber-500 text-white")}><Clock className="size-4" /></span>;
  return <span className={cn(base, "bg-muted text-muted-foreground")}><span className="size-1.5 rounded-full bg-current" /></span>;
}

function Chain({ r, onPdf }: { r: RequestDetail; onPdf: (s: RequestStep) => void }) {
  return (
    <ol className="space-y-0">
      {r.steps.map((s, i) => (
        <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < r.steps.length - 1 && <span className="absolute start-[13px] top-7 bottom-0 w-px bg-border" />}
          <StepIcon status={s.status} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-semibold text-sm">{s.label ?? s.positionName}</p>
              {s.kind === "review" && <span className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">review</span>}
              <StatusPill status={s.status === "waiting" ? "waiting" : s.status} className="ms-auto" />
            </div>
            {s.status === "approved" || s.status === "rejected" ? (
              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-medium text-foreground">{s.decidedByName}</span>{s.decidedByDesignation ? `, ${s.decidedByDesignation}` : ""} · {fmtDateTime(s.decidedAt)}</p>
                {s.comment && <p className={cn("rounded-md px-2 py-1 mt-1 whitespace-pre-wrap", s.status === "rejected" ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" : "bg-muted")}>{s.comment}</p>}
                {s.hasPdf && (
                  <button onClick={() => onPdf(s)} className="inline-flex items-center gap-1 text-primary font-medium hover:underline mt-1">
                    <FileDown className="size-3.5" /> {s.status === "rejected" ? "Rejection" : "Approval"} PDF
                  </button>
                )}
              </div>
            ) : s.status === "skipped" ? (
              <p className="mt-1 text-xs text-muted-foreground">{s.skipReason ?? "Skipped"}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {s.status === "pending" ? "Waiting for " : "Will go to "}
                <span className="text-foreground font-medium">{s.assignees.map(a => a.name).join(" or ") || "—"}</span>
                {s.status === "pending" && s.activatedAt && <> · {ago(s.activatedAt)}</>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DecisionBox({ r }: { r: RequestDetail }) {
  const [comment, setComment] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);
  const decide = useAct((a: "approve" | "reject") => workflowApi.decide(r.id, a, comment.trim() || undefined));
  const step = r.steps.find(s => s.id === r.currentStepId);
  const go = async (a: "approve" | "reject") => {
    if (a === "reject" && !comment.trim()) { setRejecting(true); toast.error("Give a reason for rejecting."); return; }
    try { await decide.mutateAsync(a); toast.success(a === "approve" ? "Approved — a PDF record was issued." : "Rejected — a PDF record was issued."); setComment(""); setRejecting(false); } catch { /* toast */ }
  };
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/[0.03] p-4 space-y-3">
      <div>
        <p className="font-bold">Your decision</p>
        <p className="text-xs text-muted-foreground">You are the {step?.label ?? step?.positionName}. A PDF with your name, designation and the time is issued either way.</p>
      </div>
      <textarea className={cn(TEXTAREA, rejecting && !comment.trim() && "border-destructive")} placeholder="Comment (required if you reject)" value={comment} onChange={e => setComment(e.target.value)} />
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={decide.isPending} onClick={() => go("reject")}>
          {decide.isPending && decide.variables === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
        </Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={decide.isPending} onClick={() => go("approve")}>
          {decide.isPending && decide.variables === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </Button>
      </div>
    </div>
  );
}

function ReassignModal({ r, step, onClose }: { r: RequestDetail; step: RequestStep; onClose: () => void }) {
  const [users, setUsers] = React.useState(step.assignees.map(a => ({ userId: a.userId, userName: a.name })));
  const [reason, setReason] = React.useState("");
  const act = useAct(() => workflowApi.reassign(r.id, step.id, users, reason.trim()), "Approval reassigned.");
  return (
    <Modal title="Reassign this approval" subtitle={`${step.label ?? step.positionName} · ${r.number}`} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={users.length === 0 || !reason.trim() || act.isPending} onClick={async () => { try { await act.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Reassign</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Whoever you choose can approve or reject this step. The change is written to the audit log with your reason.</p>
        <div className="flex flex-wrap gap-2">
          {users.map(u => (
            <span key={u.userId} className="inline-flex items-center gap-1.5 rounded-full bg-muted ps-3 pe-1.5 py-1 text-sm">{u.userName}
              <button className="rounded-full p-0.5 hover:bg-background" onClick={() => setUsers(users.filter(x => x.userId !== u.userId))} aria-label="Remove"><X className="size-3.5" /></button></span>
          ))}
        </div>
        <UserPicker exclude={users.map(u => u.userId)} onPick={u => setUsers([...users, { userId: u.id, userName: u.name }])} />
        <textarea className={TEXTAREA} placeholder="Why is it being reassigned? (required)" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

export function RequestDetailView() {
  const { id } = useParams();
  const nav = useNavigate();
  const q = useRequest(id);
  const [comment, setComment] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reassign, setReassign] = React.useState<RequestStep | null>(null);

  const add = useAct((t: string) => workflowApi.comment(id!, t));
  const cancel = useAct((rs: string) => workflowApi.cancelRequest(id!, rs), "Request cancelled.");
  const del = useAct(() => workflowApi.deleteRequest(id!), "Draft deleted.");
  const again = useAct(() => workflowApi.resubmit(id!));

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox error={q.error ?? new Error("Not found")} onRetry={() => q.refetch()} />;
  const r = q.data;
  const fields = parseFields(r.fieldsJson);
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(r.dataJson); } catch { /* empty */ }
  const open = (a: Parameters<typeof workflowApi.openAttachment>[1]) => workflowApi.openAttachment(r.id, a).catch((e: Error) => toast.error(e.message));
  const pdf = (s: RequestStep) => workflowApi.openStepPdf(r.id, s.id).catch((e: Error) => toast.error(e.message));
  const waiting = r.steps.find(s => s.id === r.currentStepId) ?? null;

  return (
    <div>
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="size-4 rtl:rotate-180" /> Back</button>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{r.number}</span><StatusPill status={r.status} />
            </div>
            <h1 className="text-xl font-bold mt-1">{r.title ?? r.formName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{r.formName} · {r.baseName}{r.unitName ? ` · ${r.unitName}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.status !== "draft" && <Button variant="outline" size="sm" onClick={() => workflowApi.openRequestPdf(r.id).catch((e: Error) => toast.error(e.message))}><FileDown className="size-4" /> PDF record</Button>}
            {r.canEdit && <Button variant="outline" size="sm" onClick={() => nav(`/workflow/requests/${r.id}/edit`)}><Pencil className="size-4" /> Edit draft</Button>}
            {r.canEdit && <Button variant="outline" size="sm" className="text-destructive" disabled={del.isPending} onClick={() => setDeleting(true)}><Trash2 className="size-4" /> Delete</Button>}
            {r.canResubmit && <Button size="sm" disabled={again.isPending} onClick={async () => { try { const n = await again.mutateAsync(undefined); toast.success(`New draft ${n.number} created.`); nav(`/workflow/requests/${n.id}/edit`); } catch { /* toast */ } }}><RotateCcw className="size-4" /> Start again</Button>}
            {r.canReassign && waiting && <Button variant="outline" size="sm" onClick={() => setReassign(waiting)}><UserCog className="size-4" /> Reassign</Button>}
            {r.canCancel && <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancelling(true)}><Ban className="size-4" /> Cancel request</Button>}
            {r.status === "draft" && r.canEdit && <Button size="sm" onClick={() => nav(`/workflow/requests/${r.id}/edit`)}><Send className="size-4" /> Continue</Button>}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-xs text-muted-foreground">Requested by</dt><dd className="font-medium flex items-center gap-2 mt-0.5"><span className="size-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{initials(r.requesterName)}</span>{r.requesterName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="font-medium mt-0.5">{fmtDateTime(r.submittedAt)}</dd></div>
          {r.amount > 0 && <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums mt-0.5">{fmtMoney(r.amount)}</dd></div>}
          {r.completedAt && <div><dt className="text-xs text-muted-foreground">Finished</dt><dd className="font-medium mt-0.5">{fmtDateTime(r.completedAt)}</dd></div>}
        </dl>
        {r.status === "rejected" && r.finalReason && <p className="mt-4 rounded-lg bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 text-sm p-3"><b>Rejected:</b> {r.finalReason}</p>}
        {r.status === "cancelled" && r.finalReason && <p className="mt-4 rounded-lg bg-muted text-sm p-3"><b>Cancelled:</b> {r.finalReason}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-5 min-w-0">
          {r.canDecide && <DecisionBox r={r} />}
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="font-bold mb-4">Request details</h2>
            <DataView fields={fields} data={data} attachments={r.attachments} onOpenAttachment={open} />
          </section>

          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2"><MessageSquare className="size-4" /> Comments</h2>
            {r.comments.length === 0 && <p className="text-sm text-muted-foreground mb-3">No comments yet.</p>}
            <div className="space-y-3 mb-3">
              {r.comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <span className="size-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{initials(c.authorName)}</span>
                  <div className="min-w-0"><p className="text-sm"><span className="font-semibold">{c.authorName}</span> <span className="text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</span></p><p className="text-sm whitespace-pre-wrap">{c.text}</p></div>
                </div>
              ))}
            </div>
            {r.status !== "draft" && (
              <div className="flex gap-2">
                <input className="flex-1 h-9 rounded-md border border-input bg-card px-3 text-sm" placeholder="Write a comment…" value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && comment.trim()) { add.mutate(comment.trim(), { onSuccess: () => setComment("") }); } }} />
                <Button size="sm" disabled={!comment.trim() || add.isPending} onClick={() => add.mutate(comment.trim(), { onSuccess: () => setComment("") })}>Post</Button>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4">
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold">Approval chain</h2>{r.steps.length > 0 && <span className="text-xs text-muted-foreground">{r.steps.filter(s => s.status === "approved").length}/{r.steps.filter(s => s.status !== "skipped").length} done</span>}</div>
            {r.steps.length === 0 ? <p className="text-sm text-muted-foreground">The chain is set when the request is submitted.</p> : <Chain r={r} onPdf={pdf} />}
          </section>
          <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="font-bold mb-3">Activity</h2>
            <ul className="space-y-2.5">
              {r.timeline.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
              {r.timeline.map((t, i) => (
                <li key={i} className="text-xs">
                  <p><span className="font-medium">{t.userName ?? "System"}</span> · {actionLabel(t.action)}</p>
                  {t.detail && <p className="text-muted-foreground line-clamp-2">{t.detail}</p>}
                  <p className="text-[11px] text-muted-foreground">{fmtDateTime(t.at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {cancelling && (
        <Modal title="Cancel this request?" subtitle={r.number} size="sm" onClose={() => setCancelling(false)}
          footer={<><Button variant="outline" onClick={() => setCancelling(false)}>Keep it</Button>
            <Button variant="destructive" disabled={cancel.isPending} onClick={async () => { try { await cancel.mutateAsync(reason.trim()); setCancelling(false); } catch { /* toast */ } }}>Cancel request</Button></>}>
          <p className="text-sm text-muted-foreground mb-3">Anyone it is waiting on is told they no longer need to act. It stays on record.</p>
          <textarea className={TEXTAREA} placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete this draft?" subtitle={r.number} size="sm" onClose={() => setDeleting(false)}
          footer={<><Button variant="outline" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button variant="destructive" disabled={del.isPending} onClick={async () => { try { await del.mutateAsync(undefined); nav("/workflow/requests"); } catch { /* toast */ } }}>Delete draft</Button></>}>
          <p className="text-sm text-muted-foreground">Only drafts can be deleted. A submitted request is kept on record.</p>
        </Modal>
      )}
      {reassign && <ReassignModal r={r} step={reassign} onClose={() => setReassign(null)} />}
    </div>
  );
}
