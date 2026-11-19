import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Contact, Pencil, Plus, Search, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpreadsheetImportModal, type ImportField } from "@/components/ui/spreadsheet-import-modal";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useAct, useDebounced, useEmployees, useWfBases, useWfContext, useWfUnits } from "@/hooks/workflow/use-workflow";
import { fmtDate, workflowApi, type Employee, type EmployeeRow } from "@/lib/workflow/workflow.api";
import { Empty, ErrorBox, Field, Modal, PageHeader, SELECT, Spinner, TH, initials } from "../shared/ui";

type K = keyof EmployeeRow;
const IMPORT_FIELDS: ImportField<K>[] = [
  { key: "name", label: "Full name", required: true, synonyms: ["name", "fullname", "employeename", "employee"], sample: "Aisha Khan" },
  { key: "email", label: "Work email", synonyms: ["email", "workemail", "mail", "emailaddress"], sample: "aisha.khan@company.com" },
  { key: "code", label: "Employee ID", synonyms: ["employeeid", "empid", "code", "staffid", "employeenumber", "id"], sample: "E1042" },
  { key: "designation", label: "Designation", synonyms: ["designation", "jobtitle", "title", "position", "role"], sample: "Front Office Manager" },
  { key: "department", label: "Department", synonyms: ["department", "dept", "division"], sample: "Rooms" },
  { key: "base", label: "Location (Base)", synonyms: ["base", "location", "property", "site", "branch", "country"], sample: "UAE" },
  { key: "unit", label: "Business unit", synonyms: ["unit", "businessunit", "bu"], sample: "Accommodation" },
  { key: "manager", label: "Manager", synonyms: ["manager", "reportsto", "linemanager", "supervisor"], sample: "Omar Saleh" },
  { key: "phone", label: "Phone", synonyms: ["phone", "mobile", "telephone", "contact"], sample: "+971 50 000 0000" },
];

function EditModal({ e, onClose }: { e: Employee | null; onClose: () => void }) {
  const bases = useWfBases(); const units = useWfUnits();
  const [f, setF] = React.useState({ name: e?.name ?? "", email: e?.email ?? "", code: e?.code ?? "", designation: e?.designation ?? "", department: e?.department ?? "",
    phone: e?.phone ?? "", managerName: e?.managerName ?? "", baseId: e?.baseId ?? "", unitId: e?.unitId ?? "", isActive: e?.isActive ?? true });
  const save = useAct(() => workflowApi.saveEmployee({ id: e?.id, name: f.name, email: f.email || null, code: f.code || null, designation: f.designation || null,
    department: f.department || null, phone: f.phone || null, managerName: f.managerName || null, baseId: f.baseId || null, unitId: f.unitId || null, isActive: f.isActive }), "Saved.");
  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal title={e ? "Edit person" : "Add a person"} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name.trim() || save.isPending} onClick={async () => { try { await save.mutateAsync(undefined); onClose(); } catch { /* toast */ } }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2"><Input value={f.name} onChange={x => set("name", x.target.value)} /></Field>
        <Field label="Work email"><Input type="email" value={f.email} onChange={x => set("email", x.target.value)} /></Field>
        <Field label="Employee ID"><Input value={f.code} onChange={x => set("code", x.target.value)} /></Field>
        <Field label="Designation"><Input value={f.designation} onChange={x => set("designation", x.target.value)} /></Field>
        <Field label="Department"><Input value={f.department} onChange={x => set("department", x.target.value)} /></Field>
        <Field label="Location"><select className={SELECT} value={f.baseId} onChange={x => set("baseId", x.target.value)}><option value="">—</option>{(bases.data ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Business unit"><select className={SELECT} value={f.unitId} onChange={x => set("unitId", x.target.value)}><option value="">—</option>{(units.data ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Manager"><Input value={f.managerName} onChange={x => set("managerName", x.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={x => set("phone", x.target.value)} /></Field>
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.isActive} onChange={x => set("isActive", x.target.checked)} /> Active employee</label>
      </div>
    </Modal>
  );
}

export function DirectoryView() {
  const has = useAuthStore(s => s.hasRawPermission);
  const isAdmin = has("workflow.admin.edit");
  const ctx = useWfContext();
  const bases = useWfBases();
  const [search, setSearch] = React.useState("");
  const [baseId, setBaseId] = React.useState("");
  const [active, setActive] = React.useState<"" | "true" | "false">("true");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<Employee | "new" | null>(null);
  const [importing, setImporting] = React.useState(false);
  const fullList = React.useRef(true);
  const [full, setFull] = React.useState(true);
  const q = useDebounced(search, 300);
  React.useEffect(() => setPage(1), [q, baseId, active]);
  const list = useEmployees({ search: q || undefined, baseId: baseId || undefined, active: active === "" ? undefined : active === "true", page, pageSize: 30 });
  const del = useAct((id: string) => workflowApi.deleteEmployee(id), "Removed.");
  const s = ctx.data?.settings;
  const refreshedAt = s?.directoryRefreshedAt ? new Date(/Z|[+-]\d\d:?\d\d$/.test(s.directoryRefreshedAt) ? s.directoryRefreshedAt : `${s.directoryRefreshedAt}Z`) : null;
  const dueDays = s?.directoryRefresh === "biweekly" ? 14 : 31;
  const age = refreshedAt ? Math.floor((Date.now() - refreshedAt.getTime()) / 86_400_000) : null;
  const stale = age === null || age > dueDays;
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 30));

  return (
    <div>
      <PageHeader title="Employee directory" subtitle="Everyone across every location, with who is currently active. Refreshed from HR on a schedule."
        actions={isAdmin ? <><Button variant="outline" onClick={() => { fullList.current = full; setImporting(true); }}><UploadCloud className="size-4" /> Import / refresh</Button><Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add person</Button></> : undefined} />

      <div className={cn("rounded-xl border p-3 mb-4 flex items-start gap-3 text-sm", stale ? "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/20")}>
        {stale ? <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />}
        <div>
          <p className="font-medium">{refreshedAt ? `Last refreshed ${fmtDate(s!.directoryRefreshedAt)} (${age === 0 ? "today" : `${age} days ago`})` : "The directory has never been refreshed."}</p>
          <p className="text-xs text-muted-foreground">Expected {s?.directoryRefresh === "biweekly" ? "every two weeks" : "every month"}. {isAdmin ? "Upload HR's current list with “Import / refresh”." : "An administrator refreshes it from HR."}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="ps-9" placeholder="Search name, email, ID, designation…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className={cn(SELECT, "w-auto min-w-[150px]")} value={baseId} onChange={e => setBaseId(e.target.value)}><option value="">All locations</option>{(bases.data ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className={cn(SELECT, "w-auto min-w-[130px]")} value={active} onChange={e => setActive(e.target.value as typeof active)}><option value="true">Active</option><option value="false">Inactive</option><option value="">Everyone</option></select>
      </div>

      {list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : (list.data?.items.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-border bg-card"><Empty icon={Contact} title="No one found" hint={isAdmin ? "Import HR's employee list to fill the directory." : "Try a different search."} /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase"><tr><th className={TH}>Name</th><th className={cn(TH, "hidden md:table-cell")}>Designation</th><th className={cn(TH, "hidden lg:table-cell")}>Department</th>
                <th className={cn(TH, "hidden sm:table-cell")}>Location</th><th className={TH}>Status</th>{isAdmin && <th className="w-20" />}</tr></thead>
              <tbody>{list.data!.items.map(e => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="size-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{initials(e.name)}</span>
                    <div className="min-w-0"><p className="font-medium leading-tight">{e.name}</p><p className="text-xs text-muted-foreground truncate">{e.email ?? e.code ?? "—"}</p></div></div></td>
                  <td className="px-4 py-3 hidden md:table-cell">{e.designation ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{e.department ?? "—"}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{e.baseName ?? "—"}{e.unitName ? <span className="text-muted-foreground"> · {e.unitName}</span> : null}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold", e.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800")}>{e.isActive ? "Active" : "Inactive"}</span></td>
                  {isAdmin && <td className="px-2"><div className="flex justify-end">
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Edit" onClick={() => setEditing(e)}><Pencil className="size-4" /></button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label="Remove" onClick={() => del.mutate(e.id)}><Trash2 className="size-4" /></button></div></td>}
                </tr>))}</tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm"><span className="text-muted-foreground">{list.data!.total} people</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></Button><span>{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></Button></div></div>}
        </div>
      )}

      {editing && <EditModal e={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <SpreadsheetImportModal open={importing} onClose={() => setImporting(false)} title="Import the employee list" noun="people" fields={IMPORT_FIELDS}
        description="One row per person. People are matched on email, then employee ID, so importing again updates instead of duplicating."
        onImport={async rows => {
          const r = await workflowApi.importEmployees(rows, fullList.current);
          if (r.deactivated > 0) toast.message(`${r.deactivated} people not in this file were marked inactive.`);
          return { created: r.created, skipped: r.updated, failed: r.failed, problems: r.errors.map(x => ({ row: x.row, message: x.reason })),
            note: fullList.current ? "Treated as the full list: anyone not in the file was marked inactive." : undefined };
        }} />
      {isAdmin && (
        <label className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="size-3.5" checked={full} onChange={e => { setFull(e.target.checked); fullList.current = e.target.checked; }} />
          When I import, treat the file as the complete current list (people missing from it become inactive)
        </label>
      )}
    </div>
  );
}
