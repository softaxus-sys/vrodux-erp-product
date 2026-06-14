import * as React from "react";
import { motion } from "framer-motion";
import { FileText, Calculator, FileSignature, DollarSign, Plus, X, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useConBiddingSummary, useRfqs, useEstimates, useConContracts,
  useCreateRfq, useSetRfqStatus, useDeleteRfq,
  useCreateEstimate, useSetEstimateStatus, useDeleteEstimate,
  useCreateConContract, useSetConContractStatus, useDeleteConContract,
} from "@/hooks/construction/use-con-bidding";

type Tab = "rfqs" | "estimates" | "contracts";
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "rfqs", label: "RFQs", icon: FileText },
  { key: "estimates", label: "Estimates", icon: Calculator },
  { key: "contracts", label: "Contracts", icon: FileSignature },
];
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const badge = (s: string) => ({
  open: "bg-blue-100 text-blue-700", quoted: "bg-warning/10 text-warning", won: "bg-success/10 text-success", lost: "bg-destructive/10 text-destructive",
  draft: "bg-muted text-muted-foreground", sent: "bg-blue-100 text-blue-700", approved: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive",
  active: "bg-success/10 text-success", completed: "bg-violet-100 text-violet-700", terminated: "bg-destructive/10 text-destructive",
}[s] ?? "bg-muted text-muted-foreground");

export function ConstructionBiddingView() {
  const CUR = useCurrency();
  const [tab, setTab] = React.useState<Tab>("rfqs");
  const { data: s } = useConBiddingSummary();
  const stats = [
    { label: "Open RFQs", value: s?.openRfqs ?? 0, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Pending Estimates", value: s?.pendingEstimates ?? 0, icon: Calculator, color: "text-warning bg-warning/10" },
    { label: "Estimated Value", value: formatCurrency(s?.estimatedValue ?? 0, CUR), icon: DollarSign, color: "text-violet-600 bg-violet-100" },
    { label: "Active Contracts", value: s?.activeContracts ?? 0, icon: FileSignature, color: "text-primary bg-primary/10" },
    { label: "Contract Value", value: formatCurrency(s?.contractValue ?? 0, CUR), icon: DollarSign, color: "text-success bg-success/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileSignature className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bidding & Contracts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → RFQ → Estimate → Proposal → Contract → Project</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((x, i) => { const Icon = x.icon; return (
          <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", x.color)}><Icon className="h-4.5 w-4.5" /></div>
            <p className="text-xs text-muted-foreground">{x.label}</p><p className="font-bold text-base leading-tight mt-0.5">{x.value}</p>
          </motion.div>); })}
      </div>
      <div className="flex items-center gap-1.5">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
            tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" />{t.label}</button>); })}
      </div>
      {tab === "rfqs" && <RfqsTab />}
      {tab === "estimates" && <EstimatesTab />}
      {tab === "contracts" && <ContractsTab />}
    </div>
  );
}

function AddBar({ open, setOpen, label, children, onSave, saving, canSave }:
  { open: boolean; setOpen: (v: boolean) => void; label: string; children: React.ReactNode; onSave: () => void; saving: boolean; canSave: boolean }) {
  if (!open) return <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center gap-2">
      {children}
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}><X className="h-3.5 w-3.5" /></Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

function Table({ cols, children, empty, emptyMsg }: { cols: string[]; children: React.ReactNode; empty: boolean; emptyMsg: string }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full"><thead><tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
        {cols.map((c, i) => <th key={i} className={cn("px-4 py-3 font-semibold", i === cols.length - 1 ? "text-right" : "text-left")}>{c}</th>)}
      </tr></thead>
      <tbody>{empty ? <tr><td colSpan={cols.length} className="text-center py-12 text-sm text-muted-foreground">{emptyMsg}</td></tr> : children}</tbody></table>
    </div>
  );
}

function RfqsTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useRfqs();
  const create = useCreateRfq(); const setStatus = useSetRfqStatus(); const del = useDeleteRfq();
  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState(""); const [title, setTitle] = React.useState(""); const [budget, setBudget] = React.useState(""); const [due, setDue] = React.useState(plusDays(14));
  const save = () => create.mutate({ clientName: client.trim(), projectTitle: title.trim(), budget: budget ? parseFloat(budget) : null, dueDate: due, assignedTo: null },
    { onSuccess: () => { setOpen(false); setClient(""); setTitle(""); setBudget(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New RFQ" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!title.trim()}>
        <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-40 text-sm" />
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title" className="h-9 w-52 text-sm" />
        <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Budget" className="h-9 w-28 text-sm text-right" />
        <Input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-9 w-40 text-sm" />
      </AddBar>
      <Table cols={["RFQ #", "Client", "Project", "Budget", "Due", "Status", ""]} empty={rows.length === 0} emptyMsg="No RFQs yet.">
        {rows.map(r => (
          <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{r.rfqNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{r.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.projectTitle}</td>
            <td className="px-4 py-2.5 text-sm">{r.budget ? formatCurrency(r.budget, CUR) : "—"}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.dueDate}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(r.status))}>{r.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {r.status === "open" && <button title="Mark won" onClick={() => setStatus.mutate({ id: r.id, status: "won" })} className="p-1.5 rounded text-success hover:bg-success/10"><ArrowRight className="h-3.5 w-3.5" /></button>}
              <button title="Delete" onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function EstimatesTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useEstimates();
  const create = useCreateEstimate(); const setStatus = useSetEstimateStatus(); const del = useDeleteEstimate();
  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState(""); const [title, setTitle] = React.useState(""); const [amount, setAmount] = React.useState(""); const [valid, setValid] = React.useState(plusDays(30));
  const save = () => create.mutate({ clientName: client.trim(), title: title.trim(), amount: parseFloat(amount) || 0, validUntil: valid },
    { onSuccess: () => { setOpen(false); setClient(""); setTitle(""); setAmount(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New Estimate" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!title.trim() && !!amount}>
        <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-40 text-sm" />
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Estimate title" className="h-9 w-52 text-sm" />
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="h-9 w-28 text-sm text-right" />
        <Input type="date" value={valid} onChange={e => setValid(e.target.value)} className="h-9 w-40 text-sm" />
      </AddBar>
      <Table cols={["Estimate #", "Client", "Title", "Amount", "Valid Until", "Status", ""]} empty={rows.length === 0} emptyMsg="No estimates yet.">
        {rows.map(r => (
          <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{r.estimateNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{r.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.title}</td>
            <td className="px-4 py-2.5 text-sm font-semibold">{formatCurrency(r.amount, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.validUntil}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(r.status))}>{r.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {r.status === "draft" && <button title="Mark sent" onClick={() => setStatus.mutate({ id: r.id, status: "sent" })} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><ArrowRight className="h-3.5 w-3.5" /></button>}
              {r.status === "sent" && <button title="Mark approved" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })} className="p-1.5 rounded text-success hover:bg-success/10"><ArrowRight className="h-3.5 w-3.5" /></button>}
              <button title="Delete" onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ContractsTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useConContracts();
  const create = useCreateConContract(); const setStatus = useSetConContractStatus(); const del = useDeleteConContract();
  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState(""); const [title, setTitle] = React.useState(""); const [value, setValue] = React.useState("");
  const [start, setStart] = React.useState(today()); const [end, setEnd] = React.useState(plusDays(180));
  const save = () => create.mutate({ clientName: client.trim(), title: title.trim(), contractValue: parseFloat(value) || 0, startDate: start, endDate: end },
    { onSuccess: () => { setOpen(false); setClient(""); setTitle(""); setValue(""); } });
  return (
    <div className="space-y-3">
      <AddBar open={open} setOpen={setOpen} label="New Contract" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!title.trim() && !!value}>
        <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-40 text-sm" />
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contract title" className="h-9 w-52 text-sm" />
        <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="Value" className="h-9 w-28 text-sm text-right" />
        <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-9 w-36 text-sm" />
        <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="h-9 w-36 text-sm" />
      </AddBar>
      <Table cols={["Contract #", "Client", "Title", "Value", "End", "Status", ""]} empty={rows.length === 0} emptyMsg="No contracts yet.">
        {rows.map(r => (
          <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{r.contractNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{r.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.title}</td>
            <td className="px-4 py-2.5 text-sm font-semibold">{formatCurrency(r.contractValue, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.endDate}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(r.status))}>{r.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {r.status === "draft" && <button title="Activate" onClick={() => setStatus.mutate({ id: r.id, status: "active" })} className="p-1.5 rounded text-success hover:bg-success/10"><ArrowRight className="h-3.5 w-3.5" /></button>}
              {r.status === "active" && <button title="Complete" onClick={() => setStatus.mutate({ id: r.id, status: "completed" })} className="p-1.5 rounded text-violet-600 hover:bg-violet-50"><ArrowRight className="h-3.5 w-3.5" /></button>}
              <button title="Delete" onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
