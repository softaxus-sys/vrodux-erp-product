import * as React from "react";
import { motion } from "framer-motion";
import { CalendarClock, IdCard, FileText, AlertTriangle, Search, Stamp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useLazyList } from "@/hooks/use-lazy-list";
import { useVisaRenewals } from "@/hooks/visa/use-visa";
import { CASE_STATUS_META, type RenewalItemDto, type VisaCaseStatus } from "@/lib/visa/visa.api";
import { CaseDrawer } from "@/modules/visa/cases/components/case-drawer";

const HORIZONS = [30, 60, 90, 180];

function urgency(days: number) {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: "text-destructive bg-destructive/10" };
  if (days <= 14) return { label: `${days}d left`, cls: "text-destructive bg-destructive/10" };
  if (days <= 30) return { label: `${days}d left`, cls: "text-warning bg-warning/10" };
  return { label: `${days}d left`, cls: "text-muted-foreground bg-muted" };
}

export function VisaRenewalsView() {
  const [withinDays, setWithinDays] = React.useState(90);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const { data: items = [], isLoading } = useVisaRenewals(withinDays);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i => !search
      || i.subject.toLowerCase().includes(q)
      || i.caseNumber.toLowerCase().includes(q)
      || i.visaTypeName.toLowerCase().includes(q));
  }, [items, search]);

  const lazy = useLazyList(filtered, 25);
  const overdue = items.filter(i => i.daysLeft < 0).length;

  const open = (i: RenewalItemDto) => { setSelectedId(i.caseId); setDrawerOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Renewals & Expiries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Passports and documents coming due — act before they block processing</p>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
          {HORIZONS.map(h => (
            <button key={h} onClick={() => setWithinDays(h)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                withinDays === h ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Expiring Items", value: items.length,                          icon: CalendarClock, color: "text-primary bg-primary/10" },
          { label: "Overdue",        value: overdue,                                icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
          { label: "Visas",          value: items.filter(i => i.kind === "visa").length,     icon: Stamp,   color: "text-violet-600 bg-violet-100 dark:bg-violet-900/20" },
          { label: "Passports",      value: items.filter(i => i.kind === "passport").length, icon: IdCard,  color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="card-hover"><CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.color)}><s.icon className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{s.label}</p><p className="font-bold text-base leading-tight">{s.value}</p></div>
            </CardContent></Card>
          </motion.div>
        ))}
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search applicant, case, type…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/30">
                <tr>
                  {["Item","Case","Visa Type","Expiry","Urgency","Case Status","Assigned To"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">Loading…</td></tr>
                ) : lazy.total === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-muted-foreground text-sm">Nothing expiring within {withinDays} days. 🎉</td></tr>
                ) : lazy.visible.map((it, i) => {
                  const u = urgency(it.daysLeft);
                  const m = CASE_STATUS_META[it.caseStatus as VisaCaseStatus];
                  const Icon = it.kind === "visa" ? Stamp : it.kind === "passport" ? IdCard : FileText;
                  return (
                    <motion.tr key={`${it.caseId}-${it.subject}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 12) * 0.03 }} className="erp-table-row cursor-pointer" onClick={() => open(it)}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="font-medium">{it.subject}</span></div></td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{it.caseNumber}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{it.visaTypeName}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{it.expiryDate ? formatDate(it.expiryDate, "medium") : "—"}</td>
                      <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", u.cls)}>{u.label}</span></td>
                      <td className="px-4 py-3">{m && <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", m.color, m.bg)}>{m.label}</span>}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{it.assignedTo || "—"}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {lazy.hasMore && (
            <div ref={lazy.sentinelRef} className="flex justify-center py-4 border-t border-border">
              <span className="text-xs text-muted-foreground">Loading more…</span>
            </div>
          )}
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">Showing {lazy.shown} of {lazy.total}</div>
        </CardContent>
      </Card>

      <CaseDrawer caseId={selectedId} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
