import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadFile, toCsv } from "@/lib/csv";
import { useAudit, useDebounced } from "@/hooks/workflow/use-workflow";
import { actionLabel, fmtDateTime, localToday, workflowApi } from "@/lib/workflow/workflow.api";
import { Empty, ErrorBox, PageHeader, SELECT, Spinner, TH } from "../shared/ui";

const GROUPS = [
  { value: "", label: "All actions" }, { value: "request.", label: "Requests" }, { value: "attachment.", label: "Attachments" }, { value: "pdf.", label: "PDFs" },
  { value: "repository.", label: "Repository" }, { value: "form.", label: "Forms" }, { value: "flow.", label: "Approval flows" },
  { value: "position.", label: "Positions" }, { value: "base.", label: "Locations" }, { value: "directory.", label: "Directory" },
];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

export function AuditView() {
  const nav = useNavigate();
  const [from, setFrom] = React.useState(addDays(localToday(), -7));
  const [to, setTo] = React.useState(localToday());
  const [group, setGroup] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);
  const s = useDebounced(search, 300);
  React.useEffect(() => setPage(1), [from, to, group, s]);
  const q = useAudit({ from, to, action: group || undefined, search: s || undefined, page, pageSize: 50 });
  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 50));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: Awaited<ReturnType<typeof workflowApi.audit>>["items"] = [];
      for (let p = 1; p <= 40; p++) {
        const r = await workflowApi.audit({ from, to, action: group || undefined, search: s || undefined, page: p, pageSize: 200 });
        rows.push(...r.items);
        if (rows.length >= r.total) break;
      }
      const out = rows.map(r => ({ When: fmtDateTime(r.at), Who: r.userName ?? "", Action: actionLabel(r.action), Request: r.requestNumber ?? "", Detail: r.detail ?? "", IP: r.ip ?? "" }));
      downloadFile(`audit-log_${from}_${to}.csv`, toCsv(out, ["When", "Who", "Action", "Request", "Detail", "IP"]));
    } finally { setExporting(false); }
  };

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every action by every user, with who, what, when and from where. Entries can't be edited or deleted."
        actions={<Button variant="outline" onClick={exportCsv} disabled={exporting || !q.data?.total}><Download className="size-4" /> Export CSV</Button>} />
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <label className="text-xs text-muted-foreground">From</label><Input type="date" className="w-auto" value={from} max={to} onChange={e => setFrom(e.target.value)} />
        <label className="text-xs text-muted-foreground">to</label><Input type="date" className="w-auto" value={to} min={from} onChange={e => setTo(e.target.value)} />
        <select className={cn(SELECT, "w-auto min-w-[150px]")} value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <div className="relative flex-1 min-w-[180px] max-w-xs"><Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input className="ps-9" placeholder="Search person or detail…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (q.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border bg-card"><Empty icon={ScrollText} title="No activity in this period" hint="Try a wider date range." /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase"><tr><th className={TH}>When</th><th className={TH}>Who</th><th className={TH}>Action</th><th className={cn(TH, "hidden md:table-cell")}>Detail</th><th className={cn(TH, "hidden lg:table-cell")}>IP</th></tr></thead>
              <tbody>{q.data!.items.map(a => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(a.at)}</td>
                  <td className="px-4 py-2.5 font-medium">{a.userName ?? "System"}</td>
                  <td className="px-4 py-2.5">{actionLabel(a.action)}{a.requestNumber && <button onClick={() => a.requestId && nav(`/workflow/requests/${a.requestId}`)} className="ms-2 font-mono text-xs text-primary hover:underline">{a.requestNumber}</button>}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell max-w-md"><span className="line-clamp-2">{a.detail ?? ""}</span></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell font-mono">{a.ip ?? ""}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm"><span className="text-muted-foreground">{q.data!.total.toLocaleString()} entries</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button><span>{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button></div></div>
        </div>
      )}
    </div>
  );
}
