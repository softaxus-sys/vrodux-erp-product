import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FileCheck2, Plus, Rocket, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAct, useDashboard, useForms, useRequests, useStarterPack, useWfContext } from "@/hooks/workflow/use-workflow";
import { workflowApi } from "@/lib/workflow/workflow.api";
import { BaseSwitcher, Empty, PageHeader, Spinner } from "../shared/ui";
import { RequestRow } from "../requests/requests-view";

function Stat({ icon: Icon, label, value, tone, onClick, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone: string; onClick?: () => void; hint?: string }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={cn("text-start rounded-xl border border-border bg-card p-4 transition", onClick && "hover:border-primary/40 hover:shadow-sm")}>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><span className={cn("size-8 rounded-lg flex items-center justify-center", tone)}><Icon className="size-4" /></span></div>
      <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </button>
  );
}

function SetupBanner() {
  const pack = useStarterPack();
  const install = useAct((key: string) => workflowApi.installStarterPack(key), "Starter pack installed.");
  const nav = useNavigate();
  const p = pack.data?.available[0];
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Rocket className="size-6" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Let's set up your approvals</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">You need locations, forms and approval chains before anyone can raise a request. Start from a ready-made pack and adjust it, or build your own from Setup.</p>
          {p && <p className="text-sm mt-3"><b>{p.name}.</b> <span className="text-muted-foreground">{p.description}</span></p>}
          <div className="flex flex-wrap gap-2 mt-4">
            {p && <Button disabled={install.isPending} onClick={async () => { try { await install.mutateAsync(p.key); toast.message("Next: choose who holds each position, and who can use each location."); nav("/workflow/setup"); } catch { /* toast */ } }}>Install the starter pack</Button>}
            <Button variant="outline" onClick={() => nav("/workflow/setup")}>Build it myself</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "My work": what is waiting for you, what you've raised, and a way to start something. */
export function WorkflowHome() {
  const nav = useNavigate();
  const ctx = useWfContext();
  const dash = useDashboard();
  const forms = useForms();
  const todo = useRequests({ scope: "todo", pageSize: 6 });
  const mine = useRequests({ scope: "mine", pageSize: 6 });
  const d = dash.data;

  if (ctx.isLoading) return <Spinner />;
  const needsSetup = ctx.data && !ctx.data.setupDone && ctx.data.isAdmin;
  const noAccess = ctx.data && ctx.data.bases.length === 0 && !ctx.data.isAdmin;

  return (
    <div>
      <PageHeader title={`Hello${ctx.data?.userName ? `, ${ctx.data.userName.split(" ")[0]}` : ""}`} subtitle="Requests, approvals and the paper trail, in one place."
        actions={<><BaseSwitcher />{ctx.data?.canCreate && <Button onClick={() => nav("/workflow/new")}><Plus className="size-4" /> New request</Button>}</>} />

      {needsSetup && <div className="mb-5"><SetupBanner /></div>}
      {noAccess && <div className="mb-5 rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm flex gap-3"><AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <p>You haven't been given access to a location yet, so you can't raise requests. Ask an administrator to add you to one.</p></div>}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat icon={Clock} label="To approve" value={d?.toApprove ?? "–"} tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" onClick={() => nav("/workflow/requests?scope=todo")}
          hint={d && d.overdueOver48h > 0 ? `${d.overdueOver48h} waiting over 48h` : "Nothing overdue"} />
        <Stat icon={FileCheck2} label="My open requests" value={d?.myOpen ?? "–"} tone="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" onClick={() => nav("/workflow/requests?scope=mine")} hint="In approval now" />
        <Stat icon={CheckCircle2} label="Approved · 30 days" value={d?.approvedLast30 ?? "–"} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          hint={d && d.avgHoursToDecision > 0 ? `Average ${d.avgHoursToDecision < 24 ? `${d.avgHoursToDecision}h` : `${(d.avgHoursToDecision / 24).toFixed(1)} days`} to approve` : undefined} />
        <Stat icon={XCircle} label="Rejected · 30 days" value={d?.rejectedLast30 ?? "–"} tone="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px] items-start">
        <div className="space-y-5 min-w-0">
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-bold flex items-center gap-2"><Timer className="size-4 text-amber-600" /> Waiting for you</h2>
              <button className="text-sm text-primary font-medium inline-flex items-center" onClick={() => nav("/workflow/requests?scope=todo")}>See all <ChevronRight className="size-4 rtl:rotate-180" /></button>
            </div>
            {todo.isLoading ? <Spinner className="py-6" /> : (todo.data?.items.length ?? 0) === 0 ? <Empty icon={CheckCircle2} title="You're all caught up" hint="Anything that needs your approval will appear here." />
              : <div className="overflow-x-auto"><table className="w-full"><tbody>{todo.data!.items.map(r => <RequestRow compact key={r.id} r={r} onOpen={() => nav(`/workflow/requests/${r.id}`)} />)}</tbody></table></div>}
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-bold">My recent requests</h2>
              <button className="text-sm text-primary font-medium inline-flex items-center" onClick={() => nav("/workflow/requests?scope=mine")}>See all <ChevronRight className="size-4 rtl:rotate-180" /></button>
            </div>
            {mine.isLoading ? <Spinner className="py-6" /> : (mine.data?.items.length ?? 0) === 0 ? <Empty title="You haven't raised anything yet" hint="Pick a form on the right to start." />
              : <div className="overflow-x-auto"><table className="w-full"><tbody>{mine.data!.items.map(r => <RequestRow compact key={r.id} r={r} onOpen={() => nav(r.status === "draft" ? `/workflow/requests/${r.id}/edit` : `/workflow/requests/${r.id}`)} />)}</tbody></table></div>}
          </section>
        </div>

        <aside className="space-y-5">
          {ctx.data?.canCreate && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bold mb-3">Start a request</h2>
              {forms.isLoading ? <Spinner className="py-4" /> : (forms.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No forms yet.</p> : (
                <ul className="space-y-1">
                  {forms.data!.slice(0, 10).map(f => (
                    <li key={f.id}><button onClick={() => nav(`/workflow/new?form=${f.id}`)} className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-start hover:bg-muted">
                      <span className="truncate">{f.name}</span><ChevronRight className="size-4 text-muted-foreground rtl:rotate-180 shrink-0" /></button></li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {d && d.byForm.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bold mb-3">Most used forms <span className="text-xs font-normal text-muted-foreground">· 90 days</span></h2>
              <ul className="space-y-2">
                {d.byForm.slice(0, 6).map(x => {
                  const max = Math.max(...d.byForm.map(y => y.count));
                  return (<li key={x.label} className="text-sm"><div className="flex justify-between gap-2"><span className="truncate">{x.label}</span><span className="tabular-nums text-muted-foreground">{x.count}</span></div>
                    <div className="h-1.5 rounded-full bg-muted mt-1"><div className="h-full rounded-full bg-primary/70" style={{ width: `${(x.count / max) * 100}%` }} /></div></li>);
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
