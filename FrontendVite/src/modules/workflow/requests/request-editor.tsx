import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Send, Save, UserCheck, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAct, useActiveBase, useForms, useRequest, useResolvedFlow, useWfContext } from "@/hooks/workflow/use-workflow";
import { parseFields, workflowApi, type Attachment, type FieldDef, type WfForm } from "@/lib/workflow/workflow.api";
import { BaseSwitcher, Empty, ErrorBox, Field, PageHeader, SELECT, Spinner } from "../shared/ui";
import { FormRenderer, isVisible, type FormData } from "./form-renderer";

const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

/** What the request is worth, worked out the same way the server does — it decides which approval steps apply. */
function amountOf(fields: FieldDef[], data: FormData) {
  let total = 0;
  for (const f of fields) {
    if (!isVisible(f, data)) continue;
    if (f.isAmount && (f.type === "money" || f.type === "number")) total += num(data[f.key]);
    if (f.type === "lines") for (const row of (data[f.key] as Record<string, unknown>[] | undefined) ?? [])
      for (const c of f.columns ?? []) if (c.isAmount)
        total += c.product?.length === 2 ? num(row[c.product[0]]) * num(row[c.product[1]]) : num(row[c.key]);
  }
  return Math.round(total * 100) / 100;
}

/** Who will approve — shown before submitting, so a missing approver is found now, not after. */
function ApprovalPreview({ formId, baseId, unitId, amount }: { formId?: string; baseId?: string; unitId: string | null; amount: number }) {
  const q = useResolvedFlow({ formId, baseId, unitId, amount });
  if (!formId || !baseId) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-semibold text-sm mb-3"><Workflow className="size-4 text-primary" /> Who will approve this</div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <p className="text-[11px] text-muted-foreground mb-3">Flow: {q.data.scope}</p>
          <ol className="space-y-3">
            {q.data.steps.filter(s => s.applies).map((s, i, arr) => (
              <li key={s.order} className="relative ps-9">
                <span className={cn("absolute start-0 top-0 size-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                  s.problem ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary")}>{i + 1}</span>
                {i < arr.length - 1 && <span className="absolute start-3 top-6 bottom-[-12px] w-px bg-border" />}
                <p className="text-sm font-medium leading-6">{s.label ?? s.positionName}{s.kind === "review" && <span className="text-muted-foreground font-normal"> · review</span>}</p>
                {s.problem ? <p className="text-xs text-destructive">{s.problem}</p>
                  : <p className="text-xs text-muted-foreground">{s.holders.map(h => h.name).join(", ")}</p>}
              </li>
            ))}
          </ol>
          {q.data.steps.some(s => !s.applies) && (
            <p className="text-[11px] text-muted-foreground mt-3">Some steps only apply above a certain amount: {q.data.steps.filter(s => !s.applies).map(s => s.positionName).join(", ")}.</p>
          )}
          {q.data.problems.length > 0 && (
            <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5 text-xs text-destructive flex gap-2">
              <AlertTriangle className="size-4 shrink-0" /><div>{q.data.problems.map((p, i) => <p key={i}>{p}</p>)}<p className="mt-1 text-muted-foreground">You can save a draft now; ask an administrator to fix the approval flow before submitting.</p></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FormPicker({ forms, onPick }: { forms: WfForm[]; onPick: (f: WfForm) => void }) {
  const groups = React.useMemo(() => {
    const m = new Map<string, WfForm[]>();
    for (const f of forms) { const k = f.category ?? "General"; m.set(k, [...(m.get(k) ?? []), f]); }
    return [...m.entries()];
  }, [forms]);
  if (forms.length === 0) return <Empty icon={Workflow} title="No forms available yet" hint="An administrator needs to set up forms (Setup → Forms, or install the starter pack)." />;
  return (
    <div className="space-y-6">
      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{cat}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(f => (
              <button key={f.id} onClick={() => onPick(f)} className="group text-start rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{f.name}</p>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary rtl:rotate-180 shrink-0 mt-0.5" />
                </div>
                {f.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{f.description}</p>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** New request (`/workflow/new`) and editing a draft (`/workflow/requests/:id/edit`). */
export function RequestEditor() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { id: draftId } = useParams();
  const [search] = useSearchParams();
  const ctx = useWfContext();
  const formsQ = useForms();
  const draftQ = useRequest(draftId);
  const { base: activeBase, bases, setBase } = useActiveBase();

  const [formId, setFormId] = React.useState<string | null>(search.get("form"));
  const [requestId, setRequestId] = React.useState<string | null>(draftId ?? null);
  const [baseId, setBaseId] = React.useState<string | null>(null);
  const [unitId, setUnitId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<FormData>({});
  const [atts, setAtts] = React.useState<Attachment[]>([]);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [fieldsOverride, setFieldsOverride] = React.useState<FieldDef[] | null>(null);
  const loaded = React.useRef(false);

  // Seed from an existing draft once.
  React.useEffect(() => {
    const d = draftQ.data;
    if (!d || loaded.current) return;
    loaded.current = true;
    setFormId(d.formId); setBaseId(d.baseId); setUnitId(d.unitId); setAtts(d.attachments);
    try { setData(JSON.parse(d.dataJson)); } catch { setData({}); }
    setFieldsOverride(parseFields(d.fieldsJson));
  }, [draftQ.data]);
  React.useEffect(() => { if (!baseId && activeBase) setBaseId(activeBase.id); }, [activeBase, baseId]);

  const form = formsQ.data?.find(f => f.id === formId) ?? null;
  const fields = React.useMemo(() => fieldsOverride ?? (form ? parseFields(form.fieldsJson) : []), [fieldsOverride, form]);
  const amount = React.useMemo(() => amountOf(fields, data), [fields, data]);

  const save = useAct(async (_: boolean) => {
    if (!formId || !baseId) throw new Error("Choose a form and a location first.");
    setErrors([]);
    try {
      const r = await workflowApi.saveRequest({ id: requestId, formId, baseId, unitId, data, submit: false });
      setRequestId(r.id);
      qc.setQueryData(["workflow", "request", r.id], r);
      return r;
    } catch (e) {
      setErrors([(e as Error).message]);
      throw e;
    }
  });

  /** A file needs a request to hang off, so the first upload saves the draft. */
  const attach = async (fieldKey: string, file: File) => {
    if (!formId || !baseId) return;
    setUploading(fieldKey);
    try {
      let id = requestId;
      if (!id) { const r = await workflowApi.saveRequest({ id: null, formId, baseId, unitId, data, submit: false }); id = r.id; setRequestId(r.id); }
      const a = await workflowApi.uploadAttachment(id, file, fieldKey);
      setAtts(prev => [...prev, a]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(null); }
  };
  const removeAtt = async (a: Attachment) => {
    if (!requestId) return;
    try { await workflowApi.deleteAttachment(requestId, a.id); setAtts(p => p.filter(x => x.id !== a.id)); }
    catch (e) { toast.error((e as Error).message); }
  };

  const onSave = async () => {
    try { await save.mutateAsync(false); toast.success("Draft saved."); } catch { /* shown */ }
  };
  const onSubmit = async () => {
    // Save first, then submit: if the submission is refused (say, an approver is missing) the draft
    // already exists and its id is known, so fixing the problem and retrying updates it instead of
    // creating a second copy.
    let saved;
    try { saved = await save.mutateAsync(false); } catch { return; }
    try {
      const r = await workflowApi.submitRequest(saved.id);
      qc.invalidateQueries({ queryKey: ["workflow"] });
      toast.success(`${r.number} submitted for approval.`);
      nav(`/workflow/requests/${r.id}`);
    } catch (e) {
      setErrors([(e as Error).message]);
      toast.error("Not submitted — your entries were kept as a draft.");
    }
  };

  if (ctx.isLoading || formsQ.isLoading || (draftId && draftQ.isLoading)) return <Spinner />;
  if (formsQ.error) return <ErrorBox error={formsQ.error} onRetry={() => formsQ.refetch()} />;
  if (draftId && draftQ.data && draftQ.data.status !== "draft")
    return <Empty title="This request was already submitted" hint="A submitted request can't be edited." action={<Button onClick={() => nav(`/workflow/requests/${draftId}`)}>Open it</Button>} />;
  if ((ctx.data?.bases.length ?? 0) === 0)
    return <Empty icon={Workflow} title="You don't have access to any location yet" hint="Ask an administrator to give you access to a location, then you can raise requests." />;

  const lab = ctx.data?.settings;
  const baseOk = !!baseId && bases.some(b => b.id === baseId);

  return (
    <div>
      <PageHeader title={form ? form.name : "New request"} subtitle={form?.description ?? "Choose the kind of request you want to raise."}
        actions={<><BaseSwitcher /><Button variant="outline" size="sm" onClick={() => (form && !draftId ? setFormId(null) : nav("/workflow/requests"))}><ArrowLeft className="size-4 rtl:rotate-180" /> {form && !draftId ? "Other forms" : "Back"}</Button></>} />

      {!form ? (
        <FormPicker forms={formsQ.data ?? []} onPick={f => { setFormId(f.id); setData({}); setFieldsOverride(null); }} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={lab?.locationLabel ?? "Base"} required>
                <select className={SELECT} value={baseId ?? ""} onChange={e => { setBaseId(e.target.value); setBase(e.target.value); }}>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label={lab?.unitLabel ?? "Business unit"} hint="Decides who approves, where the flow depends on the unit.">
                <select className={SELECT} value={unitId ?? ""} onChange={e => setUnitId(e.target.value || null)}>
                  <option value="">Not specific</option>
                  {(ctx.data?.units ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            </div>
            <hr className="border-border" />
            <FormRenderer fields={fields} data={data} onChange={setData} attachments={atts} uploading={uploading} errors={errors}
              onAttach={attach} onRemoveAttachment={removeAtt} onOpenAttachment={a => requestId && workflowApi.openAttachment(requestId, a)} />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={onSave} disabled={save.isPending || !baseOk}>{save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft</Button>
              <Button onClick={onSubmit} disabled={save.isPending || !baseOk}><Send className="size-4" /> Submit for approval</Button>
            </div>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4">
            <ApprovalPreview formId={formId ?? undefined} baseId={baseId ?? undefined} unitId={unitId} amount={amount} />
            <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="flex items-center gap-1.5 font-semibold text-foreground text-sm"><UserCheck className="size-4" /> {ctx.data?.userName ?? "You"}</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> A PDF is issued for every approval or rejection.</p>
              <p className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Everything you do here is recorded in the audit log.</p>
              {amount > 0 && <p className="pt-1">Amount on this request: <span className="font-semibold text-foreground tabular-nums">{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
