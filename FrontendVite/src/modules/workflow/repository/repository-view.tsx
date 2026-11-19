import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, FolderArchive, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useAct, useActiveBase, useCalendar, useDocTypes, useRepoDocs } from "@/hooks/workflow/use-workflow";
import { fmtBytes, fmtDateTime, localToday, workflowApi, type DocType, type RepoDoc } from "@/lib/workflow/workflow.api";
import { BaseSwitcher, Empty, ErrorBox, Modal, PageHeader, Spinner } from "../shared/ui";

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** One document type for one period: its files, an upload button, and the template if there is one. */
function TypeRow({ type, baseId, period, docs, canUpload, canDelete }: {
  type: DocType; baseId: string; period: string; docs: RepoDoc[]; canUpload: boolean; canDelete: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const up = useAct((file: File) => workflowApi.uploadRepoDoc({ docTypeId: type.id, baseId, periodDate: period, file }), "Filed.");
  const del = useAct((id: string) => workflowApi.deleteRepoDoc(id), "Removed.");
  const mine = docs.filter(d => d.docTypeId === type.id);
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("size-2.5 rounded-full shrink-0", mine.length ? "bg-emerald-500" : "bg-amber-400")} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-tight">{type.name}</p>
          {type.description && <p className="text-xs text-muted-foreground">{type.description}</p>}
        </div>
        {type.templateName && <Button variant="ghost" size="sm" onClick={() => workflowApi.openTemplate(type.id).catch((e: Error) => toast.error(e.message))}><Download className="size-4" /> Template</Button>}
        {canUpload && (
          <>
            <input ref={ref} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" disabled={up.isPending} onClick={() => ref.current?.click()}>
              {up.isPending ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} {mine.length ? "Add file" : "Upload"}
            </Button>
          </>
        )}
      </div>
      {mine.length > 0 && (
        <ul className="mt-2 space-y-1">
          {mine.map(d => (
            <li key={d.id} className="flex items-center gap-2 text-sm rounded-md bg-muted/50 px-2.5 py-1.5">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <button className="truncate text-start font-medium hover:underline" onClick={() => workflowApi.openRepoDoc(d).catch((e: Error) => toast.error(e.message))}>{d.fileName}</button>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{fmtBytes(d.size)} · {d.uploadedByName} · {fmtDateTime(d.createdAt)}</span>
              {canDelete && <button className="ms-auto p-1 rounded text-muted-foreground hover:text-destructive" aria-label="Remove" disabled={del.isPending} onClick={() => del.mutate(d.id)}><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayModal({ date, baseId, baseName, types, onClose }: { date: string; baseId: string; baseName: string; types: DocType[]; onClose: () => void }) {
  const has = useAuthStore(s => s.hasRawPermission);
  const docs = useRepoDocs({ baseId, from: date, to: date, pageSize: 200 });
  const nice = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <Modal title={nice} subtitle={`${baseName} · daily reconciliation documents`} size="lg" onClose={onClose}>
      {docs.isLoading ? <Spinner className="py-6" /> : (
        <div className="space-y-3">
          {types.map(t => <TypeRow key={t.id} type={t} baseId={baseId} period={date} docs={docs.data?.items ?? []} canUpload={has("workflow.repository.create")} canDelete={has("workflow.repository.delete")} />)}
        </div>
      )}
    </Modal>
  );
}

export function RepositoryView() {
  const has = useAuthStore(s => s.hasRawPermission);
  const { base } = useActiveBase();
  const [cursor, setCursor] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [openDay, setOpenDay] = React.useState<string | null>(null);
  const month = monthKey(cursor);
  const types = useDocTypes();
  const cal = useCalendar(base?.id ?? null, month);
  const monthStart = `${month}-01`;
  const monthDocs = useRepoDocs({ baseId: base?.id, from: monthStart, to: `${month}-31`, pageSize: 200 }, !!base);

  const today = localToday();
  const daily = (cal.data?.docTypes ?? types.data ?? []).filter(t => t.frequency === "daily" && t.isActive);
  const monthly = (cal.data?.docTypes ?? types.data ?? []).filter(t => t.frequency === "monthly" && t.isActive);
  const cells = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of cal.data?.cells ?? []) { if (!m.has(c.date)) m.set(c.date, new Set()); m.get(c.date)!.add(c.docTypeId); }
    return m;
  }, [cal.data]);

  const y = cursor.getFullYear(), mo = cursor.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const grid: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (grid.length % 7) grid.push(null);

  // Missing so far this month, for the headline.
  let missing = 0, complete = 0;
  for (let d = 1; d <= days; d++) {
    const key = dayKey(y, mo, d);
    if (key >= today) break;   // today isn't over yet, so it can't be "missing"
    const n = cells.get(key)?.size ?? 0;
    if (daily.length && n >= daily.length) complete++; else missing++;
  }

  if (!base && !types.isLoading) return <Empty icon={FolderArchive} title="No location to show" hint="You need access to a location before you can use the document repository." />;

  return (
    <div>
      <PageHeader title="Document repository" subtitle="Each location files its daily and monthly reconciliation documents here, with their supporting files."
        actions={<BaseSwitcher />} />

      {types.isLoading ? <Spinner /> : types.error ? <ErrorBox error={types.error} onRetry={() => types.refetch()} /> : (types.data?.length ?? 0) === 0 ? (
        <Empty icon={FolderArchive} title="No document types yet" hint="An administrator sets up the daily and monthly documents in Setup → Repository." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(y, mo - 1, 1))}><ChevronLeft className="size-4 rtl:rotate-180" /></Button>
              <h2 className="font-bold text-lg min-w-[10rem] text-center">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(y, mo + 1, 1))}><ChevronRight className="size-4 rtl:rotate-180" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> {complete} complete days</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-400" /> {missing} with something missing</span>
            </div>
          </div>

          {monthly.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 mb-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><CalendarDays className="size-4" /> Monthly documents <span className="text-xs font-normal text-muted-foreground">for {cursor.toLocaleDateString(undefined, { month: "long" })}</span></h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {monthly.map(t => <TypeRow key={t.id} type={t} baseId={base!.id} period={monthStart} docs={monthDocs.data?.items ?? []}
                  canUpload={has("workflow.repository.create")} canDelete={has("workflow.repository.delete")} />)}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <h3 className="font-bold mb-3 px-1">Daily documents <span className="text-xs font-normal text-muted-foreground">· {daily.length} a day · click a day to file or view</span></h3>
            {cal.isLoading && !cal.data ? <Spinner className="py-8" /> : daily.length === 0 ? <p className="text-sm text-muted-foreground px-1 pb-2">No daily document types are set up.</p> : (
              <>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {grid.map((d, i) => {
                    if (d === null) return <div key={i} />;
                    const key = dayKey(y, mo, d);
                    const n = cells.get(key)?.size ?? 0;
                    const full = n >= daily.length;
                    const future = key > today;
                    const isToday = key === today && n === 0;   // not filed yet, but the day isn't over
                    const tone = future || isToday ? "border-border bg-muted/30 text-muted-foreground"
                      : full ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                      : n > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
                      : "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900";
                    return (
                      <button key={i} onClick={() => setOpenDay(key)} className={cn("rounded-lg border p-1.5 sm:p-2 text-start min-h-[58px] sm:min-h-[72px] hover:ring-2 hover:ring-primary/40 transition", tone, key === today && "ring-2 ring-primary")}>
                        <span className="text-sm font-semibold">{d}</span>
                        {isToday && <span className="block text-[11px] mt-1 font-medium text-muted-foreground">due today</span>}
                        {!future && !isToday && <span className={cn("block text-[11px] mt-1 font-medium", full ? "text-emerald-700 dark:text-emerald-300" : n > 0 ? "text-amber-700 dark:text-amber-300" : "text-red-600 dark:text-red-400")}>{n}/{daily.length}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </>
      )}
      {openDay && base && <DayModal date={openDay} baseId={base.id} baseName={base.name} types={daily} onClose={() => setOpenDay(null)} />}
    </div>
  );
}
