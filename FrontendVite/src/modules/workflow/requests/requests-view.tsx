import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileCheck2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebounced, useForms, useRequests, useWfContext } from "@/hooks/workflow/use-workflow";
import { ago, fmtDate, fmtMoney, type RequestSummary } from "@/lib/workflow/workflow.api";
import { Empty, ErrorBox, PageHeader, SELECT, Spinner, StatusPill, TH } from "../shared/ui";

const TABS = [
  { key: "todo", label: "To approve" },
  { key: "mine", label: "My requests" },
  { key: "watching", label: "I'm involved in" },
  { key: "all", label: "Everything I can see" },
] as const;

/** `compact` is for narrow panels (the home page): request, status and date only. */
export function RequestRow({ r, onOpen, compact = false }: { r: RequestSummary; onOpen: () => void; compact?: boolean }) {
  return (
    <tr onClick={onOpen} className="border-t border-border hover:bg-muted/40 cursor-pointer">
      <td className="px-4 py-3">
        <p className="font-medium leading-tight">{r.title ?? r.formName}</p>
        <p className="text-xs text-muted-foreground">{compact ? `${r.formName} · ${r.requesterName}` : <span className="font-mono">{r.number}</span>}</p>
      </td>
      {!compact && <>
        <td className="px-4 py-3 text-sm hidden md:table-cell">{r.formName}</td>
        <td className="px-4 py-3 text-sm hidden lg:table-cell">{r.baseName}{r.unitName ? <span className="text-muted-foreground"> · {r.unitName}</span> : null}</td>
        <td className="px-4 py-3 text-sm hidden lg:table-cell">{r.requesterName}</td>
        <td className="px-4 py-3 text-sm text-end tabular-nums hidden sm:table-cell">{r.amount > 0 ? fmtMoney(r.amount) : "—"}</td>
      </>}
      <td className="px-4 py-3">
        <StatusPill status={r.status} />
        {r.status === "pending" && (
          <p className={cn("text-[11px] mt-1", r.waitingOnMe ? "text-primary font-semibold" : "text-muted-foreground")}>
            {r.waitingOnMe ? "Waiting for you" : r.waitingOn ? `With ${r.waitingOn}` : ""} · {r.stepsDone}/{r.stepsTotal}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">{r.waitingOnMe && r.waitingSince ? ago(r.waitingSince) : fmtDate(r.submittedAt ?? r.createdAt)}</td>
    </tr>
  );
}

export function RequestsView() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const ctx = useWfContext();
  const forms = useForms();
  const scope = sp.get("scope") ?? (ctx.data && !ctx.data.canApprove ? "mine" : "todo");
  const [status, setStatus] = React.useState("");
  const [formId, setFormId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const q = useDebounced(search, 300);
  React.useEffect(() => setPage(1), [scope, status, formId, q]);

  const list = useRequests({ scope, status: status || undefined, formId: formId || undefined, search: q || undefined, page, pageSize: 20 });
  const tabs = TABS.filter(t => t.key !== "all" || ctx.data?.seesAll || true);
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20));

  return (
    <div>
      <PageHeader title="Requests" subtitle="Everything you've raised, everything waiting for you, and everything you're part of."
        actions={ctx.data?.canCreate ? <Button onClick={() => nav("/workflow/new")}><Plus className="size-4" /> New request</Button> : undefined} />

      <div className="flex gap-1 overflow-x-auto border-b border-border mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSp({ scope: t.key })}
            className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              scope === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="ps-9" placeholder="Search number, title, person…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={cn(SELECT, "w-auto min-w-[150px]")} value={formId} onChange={e => setFormId(e.target.value)}>
          <option value="">All forms</option>{(forms.data ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={cn(SELECT, "w-auto min-w-[140px]")} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {["draft", "pending", "approved", "rejected", "cancelled"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <Empty icon={FileCheck2}
            title={scope === "todo" ? "Nothing is waiting for you" : "No requests here"}
            hint={scope === "todo" ? "When a request reaches your step in an approval chain, it appears here and you get a notification." : "Try another tab or clear the filters."}
            action={ctx.data?.canCreate && scope !== "todo" ? <Button onClick={() => nav("/workflow/new")}><Plus className="size-4" /> New request</Button> : undefined} />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr><th className={TH}>Request</th><th className={cn(TH, "hidden md:table-cell")}>Form</th><th className={cn(TH, "hidden lg:table-cell")}>Location</th>
                  <th className={cn(TH, "hidden lg:table-cell")}>By</th><th className={cn(TH, "text-end hidden sm:table-cell")}>Amount</th><th className={TH}>Status</th>
                  <th className={cn(TH, "hidden sm:table-cell")}>{scope === "todo" ? "Waiting" : "Date"}</th></tr>
              </thead>
              <tbody>{list.data!.items.map(r => <RequestRow key={r.id} r={r} onOpen={() => nav(r.status === "draft" ? `/workflow/requests/${r.id}/edit` : `/workflow/requests/${r.id}`)} />)}</tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">{list.data!.total} requests</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
                <span>{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
