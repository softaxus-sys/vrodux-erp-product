import * as React from "react";
import { motion } from "framer-motion";
import { Briefcase, FileText, Repeat, LifeBuoy, DollarSign, AlertTriangle, Plus, X, Trash2, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import {
  useB2BSummary, useProposals, useServiceContracts, useSupportTickets,
  useCreateProposal, useSetProposalStatus, useDeleteProposal,
  useCreateServiceContract, useSetServiceContractStatus, useDeleteServiceContract,
  useCreateSupportTicket, useResolveTicket, useSetTicketStatus, useDeleteSupportTicket,
} from "@/hooks/b2b/use-b2b";
import type { ServiceContractDto } from "@/lib/b2b/b2b.api";
import { Can } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";

type Tab = "proposals" | "contracts" | "tickets";
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "proposals", label: "Proposals", icon: FileText },
  { key: "contracts", label: "Contracts (AMC/SLA)", icon: Repeat },
  { key: "tickets", label: "Support Tickets", icon: LifeBuoy },
];
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const CONTRACT_TYPES = ["project", "amc", "retainer", "sla"];
const SLA_TIERS = ["bronze", "silver", "gold", "platinum"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const badge = (s: string) => ({
  draft: "bg-muted text-muted-foreground", sent: "bg-blue-100 text-blue-700",
  accepted: "bg-success/10 text-success", rejected: "bg-destructive/10 text-destructive",
  active: "bg-success/10 text-success", completed: "bg-violet-100 text-violet-700",
  renewed: "bg-success/10 text-success", terminated: "bg-destructive/10 text-destructive",
  open: "bg-blue-100 text-blue-700", in_progress: "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success", closed: "bg-muted text-muted-foreground",
  critical: "bg-destructive/10 text-destructive", high: "bg-warning/10 text-warning",
  medium: "bg-blue-100 text-blue-700", low: "bg-muted text-muted-foreground",
}[s] ?? "bg-muted text-muted-foreground");

export function B2BView() {
  const CUR = useCurrency();
  const [tab, setTab] = React.useState<Tab>("proposals");
  const { data: s } = useB2BSummary();
  const { data: contracts = [] } = useServiceContracts();
  const stats = [
    { label: "Open Proposals", value: s?.openProposals ?? 0, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Proposal Value", value: formatCurrency(s?.proposalsValue ?? 0, CUR), icon: DollarSign, color: "text-primary bg-primary/10" },
    { label: "Active Contracts", value: s?.activeContracts ?? 0, icon: Repeat, color: "text-success bg-success/10" },
    { label: "Recurring Revenue", value: formatCurrency(s?.recurringRevenue ?? 0, CUR), icon: DollarSign, color: "text-violet-600 bg-violet-100" },
    { label: "Open Tickets", value: s?.openTickets ?? 0, icon: LifeBuoy, color: "text-warning bg-warning/10" },
    { label: "Critical", value: s?.criticalTickets ?? 0, icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Briefcase className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">B2B Services</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → Discovery → Proposal → Contract → Project → Support → Renewal</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
      {tab === "proposals" && <ProposalsTab />}
      {tab === "contracts" && <ContractsTab />}
      {tab === "tickets" && <TicketsTab contracts={contracts} />}
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

function ProposalsTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useProposals();
  const create = useCreateProposal(); const setStatus = useSetProposalStatus(); const del = useDeleteProposal();
  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState(""); const [title, setTitle] = React.useState(""); const [amount, setAmount] = React.useState("");
  const save = () => create.mutate({ clientName: client.trim(), title: title.trim(), amount: parseFloat(amount) || 0, validUntil: plusDays(30) },
    { onSuccess: () => { setOpen(false); setClient(""); setTitle(""); setAmount(""); } });
  return (
    <div className="space-y-3">
      <Can permission="b2b.proposals.create">
        <AddBar open={open} setOpen={setOpen} label="New Proposal" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!title.trim() && !!amount}>
          <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-40 text-sm" />
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Proposal title" className="h-9 w-56 text-sm" />
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="h-9 w-28 text-sm text-right" />
        </AddBar>
      </Can>
      <Table cols={["Proposal #", "Client", "Title", "Amount", "Valid Until", "Status", ""]} empty={rows.length === 0} emptyMsg="No proposals yet.">
        {rows.map(p => (
          <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{p.proposalNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{p.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.title}</td>
            <td className="px-4 py-2.5 text-sm font-semibold">{formatCurrency(p.amount, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.validUntil}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(p.status))}>{p.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {p.status === "draft" && <button title="Mark sent" onClick={() => setStatus.mutate({ id: p.id, status: "sent" })} className="p-1.5 rounded text-blue-600 hover:bg-blue-50"><ArrowRight className="h-3.5 w-3.5" /></button>}
              {p.status === "sent" && <button title="Mark accepted" onClick={() => setStatus.mutate({ id: p.id, status: "accepted" })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              <Can permission="b2b.proposals.delete"><button title="Delete" onClick={() => del.mutate(p.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ContractsTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useServiceContracts();
  const create = useCreateServiceContract(); const setStatus = useSetServiceContractStatus(); const del = useDeleteServiceContract();
  const [open, setOpen] = React.useState(false);
  const [client, setClient] = React.useState(""); const [title, setTitle] = React.useState(""); const [type, setType] = React.useState("amc");
  const [value, setValue] = React.useState(""); const [sla, setSla] = React.useState("silver");
  const save = () => create.mutate({ clientName: client.trim(), title: title.trim(), contractType: type, value: parseFloat(value) || 0, startDate: today(), endDate: plusDays(365), slaTier: type === "sla" ? sla : null },
    { onSuccess: () => { setOpen(false); setClient(""); setTitle(""); setValue(""); } });
  return (
    <div className="space-y-3">
      <Can permission="b2b.contracts.create">
        <AddBar open={open} setOpen={setOpen} label="New Contract" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!title.trim() && !!value}>
          <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-36 text-sm" />
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contract title" className="h-9 w-48 text-sm" />
          <select value={type} onChange={e => setType(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm capitalize">
            {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="Value" className="h-9 w-28 text-sm text-right" />
          {type === "sla" && <select value={sla} onChange={e => setSla(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm capitalize">
            {SLA_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>}
        </AddBar>
      </Can>
      <Table cols={["Contract #", "Client", "Title", "Type", "Value", "SLA Tier", "Status", ""]} empty={rows.length === 0} emptyMsg="No contracts yet.">
        {rows.map(c => (
          <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{c.contractNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{c.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{c.title}</td>
            <td className="px-4 py-2.5 text-sm uppercase font-semibold">{c.contractType}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(c.value, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{c.slaTier ?? "—"}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(c.status))}>{c.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {c.status === "active" && <button title="Renew" onClick={() => setStatus.mutate({ id: c.id, status: "renewed" })} className="p-1.5 rounded text-success hover:bg-success/10"><Repeat className="h-3.5 w-3.5" /></button>}
              <Can permission="b2b.contracts.delete"><button title="Delete" onClick={() => del.mutate(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function TicketsTab({ contracts }: { contracts: ServiceContractDto[] }) {
  const { data: rows = [] } = useSupportTickets();
  const create = useCreateSupportTicket(); const resolve = useResolveTicket(); const setStatus = useSetTicketStatus(); const del = useDeleteSupportTicket();
  const [open, setOpen] = React.useState(false);
  const [contractId, setContractId] = React.useState(""); const [client, setClient] = React.useState("");
  const [subject, setSubject] = React.useState(""); const [priority, setPriority] = React.useState("medium");
  const save = () => create.mutate({ contractId: contractId || null, clientName: client.trim(), subject: subject.trim(), priority },
    { onSuccess: () => { setOpen(false); setContractId(""); setClient(""); setSubject(""); } });
  return (
    <div className="space-y-3">
      <Can permission="b2b.tickets.create">
        <AddBar open={open} setOpen={setOpen} label="New Ticket" onSave={save} saving={create.isPending} canSave={!!client.trim() && !!subject.trim()}>
          <select value={contractId} onChange={e => { const c = contracts.find(x => x.id === e.target.value); setContractId(e.target.value); if (c) setClient(c.clientName); }} className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
            <option value="">Contract (optional)…</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.contractNumber} · {c.clientName}</option>)}
          </select>
          <Input value={client} onChange={e => setClient(e.target.value)} placeholder="Client" className="h-9 w-36 text-sm" />
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="h-9 w-56 text-sm" />
          <select value={priority} onChange={e => setPriority(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm capitalize">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </AddBar>
      </Can>
      <Table cols={["Ticket #", "Client", "Subject", "Priority", "Status", ""]} empty={rows.length === 0} emptyMsg="No tickets yet.">
        {rows.map(t => (
          <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{t.ticketNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{t.clientName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.subject}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(t.priority))}>{t.priority}</span></td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(t.status))}>{t.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {t.status === "open" && <button title="Start work" onClick={() => setStatus.mutate({ id: t.id, status: "in_progress" })} className="p-1.5 rounded text-warning hover:bg-warning/10"><ArrowRight className="h-3.5 w-3.5" /></button>}
              {(t.status === "open" || t.status === "in_progress") && <button title="Resolve" onClick={() => resolve.mutate({ id: t.id })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              <Can permission="b2b.tickets.delete"><button title="Delete" onClick={() => del.mutate(t.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
