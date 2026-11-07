import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { fitnessApi, LEAD_STATUSES, type LeadDto } from "@/lib/fitness/fitness.api";
import { useAct, useBranches, useLeads } from "@/hooks/fitness/use-fitness";
import { MemberForm } from "../../members/components/members-view";
import { FormModal, PageHeader, Pill, SearchBox, SELECT, TableState, TH, orUndef, useDebounced } from "../../shared/ui";

function LeadForm({ lead, onClose }: { lead?: LeadDto; onClose: () => void }) {
  const { data: branches = [] } = useBranches(true);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveLead(lead?.id ?? null, b), "Lead saved.", ["leads", "dashboard"]);
  return (
    <FormModal title={lead ? `Edit ${lead.name}` : "New lead"} pending={save.isPending} onClose={onClose}
      initial={{ name: lead?.name ?? "", phone: lead?.phone ?? "", email: lead?.email ?? "", source: lead?.source ?? "", interest: lead?.interest ?? "", branchId: lead?.branchId ?? "",
        status: lead?.status ?? "new", trialDate: lead?.trialDate ?? "", followUpOn: lead?.followUpOn ?? "", lostReason: lead?.lostReason ?? "", notes: lead?.notes ?? "" }}
      fields={[
        { key: "name", label: "Name", required: true }, { key: "phone", label: "Phone / WhatsApp" }, { key: "email", label: "Email", type: "email" },
        { key: "source", label: "Source", placeholder: "Walk-in, Instagram, referral…" }, { key: "interest", label: "Interested in" },
        { key: "branchId", label: "Branch", type: "select", options: branches.map(b => ({ value: b.id, label: b.name })) },
        { key: "status", label: "Stage", type: "select", required: true, options: LEAD_STATUSES.filter(s => s.value !== "converted") },
        { key: "trialDate", label: "Trial / tour date", type: "date" }, { key: "followUpOn", label: "Follow up on", type: "date" },
        { key: "lostReason", label: "Why lost", hint: "Only kept when the stage is Lost." }, { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={v => save.mutate({ name: String(v.name).trim(), phone: orUndef(v.phone), email: orUndef(v.email), source: orUndef(v.source), interest: orUndef(v.interest), branchId: orUndef(v.branchId),
        status: v.status, trialDate: orUndef(v.trialDate), followUpOn: orUndef(v.followUpOn), lostReason: orUndef(v.lostReason), notes: orUndef(v.notes) }, { onSuccess: onClose })} />
  );
}

export function LeadsView() {
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [due, setDue] = React.useState(false);
  const q = useDebounced(search);
  const { data = [], isLoading, error } = useLeads({ status: status || undefined, search: q, followUpDueOnly: due });
  const [edit, setEdit] = React.useState<LeadDto | "new" | null>(null);
  const [convert, setConvert] = React.useState<LeadDto | null>(null);
  const del = useAct((id: string) => fitnessApi.deleteLead(id), "Lead removed.", ["leads", "dashboard"]);
  return (
    <div className="space-y-5">
      <PageHeader title="Leads" description="Enquiries and trial visits, from first contact to joining.">
        <Can permission="fitness.leads.create"><Button size="sm" className="gap-1.5" onClick={() => setEdit("new")}><Plus className="h-4 w-4" />New lead</Button></Can>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Name, phone, email…" className="w-full sm:w-64" />
        <select className={cn(SELECT, "w-auto")} value={status} onChange={e => setStatus(e.target.value)}><option value="">All stages</option>{LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={due} onChange={e => setDue(e.target.checked)} />Follow-up due</label>
      </div>
      <Card className="overflow-hidden"><TableState loading={isLoading} error={error as Error | null} empty={data.length === 0} emptyText="No leads match." icon={Target} />
        {data.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Lead</th><th className={TH}>Source</th><th className={TH}>Stage</th><th className={TH}>Follow up</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(l => (
            <tr key={l.id}><td className="px-4 py-2.5">{l.name}<p className="text-xs text-muted-foreground">{[l.phone, l.email].filter(Boolean).join(" · ")}</p></td><td className="px-4 py-2.5">{l.source ?? "—"}</td>
              <td className="px-4 py-2.5"><Pill state={l.status} /></td><td className={cn("px-4 py-2.5", l.followUpDue && "text-amber-600 font-semibold")}>{l.followUpOn ? formatDate(l.followUpOn) : "—"}</td>
              <td className="px-4 py-2.5 text-end space-x-2 whitespace-nowrap">
                {l.status !== "converted" && <Can permission="fitness.members.create"><button className="text-xs text-primary" onClick={() => setConvert(l)}>Make member</button></Can>}
                <Can permission="fitness.leads.edit"><button className="text-xs text-primary" onClick={() => setEdit(l)}>Edit</button></Can>
                <Can permission="fitness.leads.delete"><button className="text-xs text-red-600" onClick={() => del.mutate(l.id)}>Delete</button></Can></td></tr>))}</tbody></table></div>}
      </Card>
      <AnimatePresence>
        {edit && <LeadForm lead={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
        {convert && <MemberForm leadId={convert.id} initial={{ firstName: convert.name.split(" ")[0], lastName: convert.name.split(" ").slice(1).join(" "), phone: convert.phone, email: convert.email, source: convert.source, notes: convert.notes }}
          onClose={() => setConvert(null)} onSaved={() => undefined} />}
      </AnimatePresence>
    </div>
  );
}
