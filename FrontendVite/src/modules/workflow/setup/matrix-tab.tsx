import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAct, useFlows, useForms, usePositions, useWfBases, useWfContext, useWfUnits } from "@/hooks/workflow/use-workflow";
import { workflowApi, type Flow } from "@/lib/workflow/workflow.api";
import { Empty, Field, Modal, SELECT, Spinner } from "../shared/ui";

type StepDraft = { kind: string; positionId: string; label: string; minAmount: string };

function FlowModal({ formId, formName, flow, onClose }: { formId: string; formName: string; flow: Flow | null; onClose: () => void }) {
  const bases = useWfBases(); const units = useWfUnits(); const positions = usePositions(); const ctx = useWfContext();
  const pos = (positions.data ?? []).filter(p => p.isActive);
  const [baseId, setBaseId] = React.useState(flow?.baseId ?? "");
  const [unitId, setUnitId] = React.useState(flow?.unitId ?? "");
  const [isActive, setActive] = React.useState(flow?.isActive ?? true);
  const [steps, setSteps] = React.useState<StepDraft[]>(() => flow?.steps.map(s => ({ kind: s.kind, positionId: s.positionId, label: s.label ?? "", minAmount: s.minAmount ? String(s.minAmount) : "" })) ?? []);
  const save = useAct(() => workflowApi.saveFlow({ id: flow?.id, formId, baseId: baseId || null, unitId: unitId || null, isActive,
    steps: steps.map(s => ({ kind: s.kind, positionId: s.positionId, label: s.label || null, minAmount: s.minAmount ? Number(s.minAmount) : null })) }), "Approval flow saved.");
  const set = (i: number, p: Partial<StepDraft>) => setSteps(steps.map((s, x) => (x === i ? { ...s, ...p } : s)));
  const valid = steps.length > 0 && steps.every(s => s.positionId) && steps.some(s => s.kind === "approve");
  return (
    <Modal title={flow ? "Edit approval flow" : "Add an approval flow"} subtitle={formName} size="lg" onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save flow</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Applies to ${(ctx.data?.settings.locationLabel ?? "Base").toLowerCase()}`}><select className={SELECT} value={baseId} onChange={e => setBaseId(e.target.value)}><option value="">Every location</option>{(bases.data ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label={`Applies to ${(ctx.data?.settings.unitLabel ?? "Business unit").toLowerCase()}`}><select className={SELECT} value={unitId} onChange={e => setUnitId(e.target.value)}><option value="">Every unit</option>{(units.data ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">A request uses the most specific flow that fits: location + unit, then location, then unit, then the default.</p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Steps, in order</p>
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <select className={cn(SELECT, "flex-1")} value={s.positionId} onChange={e => set(i, { positionId: e.target.value })}><option value="">Choose a position…</option>{pos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select className={cn(SELECT, "w-[120px]")} value={s.kind} onChange={e => set(i, { kind: e.target.value })}><option value="approve">Approves</option><option value="review">Reviews</option></select>
                <button className="p-1 rounded hover:bg-muted disabled:opacity-30" disabled={i === 0} aria-label="Up" onClick={() => { const n = [...steps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setSteps(n); }}><ArrowUp className="size-4" /></button>
                <button className="p-1 rounded hover:bg-muted disabled:opacity-30" disabled={i === steps.length - 1} aria-label="Down" onClick={() => { const n = [...steps]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setSteps(n); }}><ArrowDown className="size-4" /></button>
                <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Remove" onClick={() => setSteps(steps.filter((_, x) => x !== i))}><Trash2 className="size-4" /></button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 ps-8">
                <Input className="h-8" placeholder="Step name (optional)" value={s.label} onChange={e => set(i, { label: e.target.value })} />
                <Input className="h-8" type="number" min={0} placeholder="Only when the amount is at least… (optional)" value={s.minAmount} onChange={e => set(i, { minAmount: e.target.value })} />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSteps([...steps, { kind: "approve", positionId: "", label: "", minAmount: "" }])}><Plus className="size-4" /> Add a step</Button>
          {!steps.some(s => s.kind === "approve") && steps.length > 0 && <p className="text-xs text-amber-600">At least one step must approve — reviews alone can't approve a request.</p>}
        </div>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={isActive} onChange={e => setActive(e.target.checked)} /> Flow is active</label>
      </div>
    </Modal>
  );
}

/** For one form: does every location resolve to a staffed chain? Catches gaps before someone hits them. */
function Coverage({ formId }: { formId: string }) {
  const bases = useWfBases();
  const live = (bases.data ?? []).filter(b => b.isActive);
  const results = useQueries({ queries: live.map(b => ({ queryKey: ["workflow", "coverage", formId, b.id], queryFn: () => workflowApi.resolve({ formId, baseId: b.id, amount: 1_000_000 }), staleTime: 10_000 })) });
  if (live.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="font-bold text-sm mb-1">Is it ready for every location?</h4>
      <p className="text-xs text-muted-foreground mb-3">Checks that each location has a flow and that every step has someone to approve it (assuming a large amount, so all steps count).</p>
      <ul className="space-y-1.5">
        {live.map((b, i) => {
          const r = results[i]?.data;
          const ok = r && r.problems.length === 0;
          return (
            <li key={b.id} className="flex items-start gap-2 text-sm">
              {!r ? <span className="size-4 mt-0.5 rounded-full bg-muted animate-pulse" /> : ok ? <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />}
              <div><span className="font-medium">{b.name}</span>{r && <span className="text-muted-foreground"> — {ok ? `${r.scope}, ${r.steps.filter(s => s.applies).length} steps` : r.problems[0]}</span>}</div>
            </li>);
        })}
      </ul>
    </div>
  );
}

export function MatrixTab() {
  const forms = useForms(true);
  const [formId, setFormId] = React.useState<string | null>(null);
  const id = formId ?? forms.data?.[0]?.id ?? null;
  const form = forms.data?.find(f => f.id === id);
  const flows = useFlows(id ?? undefined, !!id);
  const [edit, setEdit] = React.useState<Flow | "new" | null>(null);
  const del = useAct((fid: string) => workflowApi.deleteFlow(fid), "Removed.");

  if (forms.isLoading) return <Spinner />;
  if ((forms.data?.length ?? 0) === 0) return <Empty icon={Workflow} title="Build a form first" hint="Approval flows belong to a form." />;
  const scopeName = (f: Flow) => f.baseName && f.unitName ? `${f.baseName} · ${f.unitName}` : f.baseName ?? f.unitName ?? "Default — every location";

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr] items-start">
      <nav className="rounded-xl border border-border bg-card p-2 lg:sticky lg:top-4 max-h-[70vh] overflow-y-auto">
        {forms.data!.map(f => (
          <button key={f.id} onClick={() => setFormId(f.id)} className={cn("w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-start", f.id === id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted")}>
            <span className="truncate">{f.name}</span>{f.flowCount === 0 ? <AlertTriangle className="size-3.5 text-amber-600 shrink-0" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />}
          </button>))}
      </nav>
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-bold text-lg">{form?.name}</h3><p className="text-xs text-muted-foreground">Who approves this form, by location and business unit.</p></div>
          <Button onClick={() => setEdit("new")}><Plus className="size-4" /> Add flow</Button>
        </div>
        {flows.isLoading ? <Spinner className="py-6" /> : (flows.data?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/10"><Empty icon={AlertTriangle} title="No approval flow yet" hint="Until this form has a flow, nobody can submit it. Add a default flow that applies to every location." action={<Button onClick={() => setEdit("new")}><Plus className="size-4" /> Add the default flow</Button>} /></div>
        ) : (
          <div className="space-y-3">
            {flows.data!.map(f => (
              <div key={f.id} className={cn("rounded-xl border border-border bg-card p-4", !f.isActive && "opacity-60")}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="font-semibold">{scopeName(f)}{!f.isActive && <span className="ms-2 text-[10px] uppercase text-muted-foreground">off</span>}</p>
                  <div className="flex"><button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEdit(f)}><Pencil className="size-4" /></button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Delete" onClick={() => del.mutate(f.id)}><Trash2 className="size-4" /></button></div>
                </div>
                <ol className="flex flex-wrap items-center gap-y-2">
                  {f.steps.map((s, i) => (
                    <li key={i} className="flex items-center">
                      <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 ps-2 pe-3 py-1.5 text-sm">
                        <span className="size-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="font-medium">{s.label ?? s.positionName}</span>
                        {s.kind === "review" && <span className="text-[10px] uppercase text-muted-foreground">review</span>}
                        {s.minAmount ? <span className="text-[10px] text-muted-foreground">≥ {s.minAmount.toLocaleString()}</span> : null}
                      </span>
                      {i < f.steps.length - 1 && <ChevronRight className="size-4 mx-1 text-muted-foreground rtl:rotate-180" />}
                    </li>))}
                </ol>
              </div>))}
          </div>
        )}
        {id && (flows.data?.length ?? 0) > 0 && <Coverage formId={id} />}
      </div>
      {edit && id && form && <FlowModal formId={id} formName={form.name} flow={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
