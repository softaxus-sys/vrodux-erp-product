import * as React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, FileText, RefreshCw, FileWarning, DollarSign, Plus, X, Trash2, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import {
  useInsuranceSummary, usePolicies, useRenewals, useClaims,
  useCreatePolicy, useSetPolicyStatus, useRenewPolicy, useDeletePolicy,
  useCompleteRenewal, useDeleteRenewal,
  useCreateClaim, useApproveClaim, useSetClaimStatus, useDeleteClaim,
} from "@/hooks/insurance/use-insurance";
import type { PolicyDto } from "@/lib/insurance/insurance.api";
import { Can } from "@/components/auth/can";
import { useCurrency } from "@/hooks/use-currency";

type Tab = "policies" | "renewals" | "claims";
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "policies", label: "Policies", icon: FileText },
  { key: "renewals", label: "Renewals", icon: RefreshCw },
  { key: "claims", label: "Claims", icon: FileWarning },
];
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const PRODUCTS = ["life", "health", "motor", "property", "travel"];
const badge = (s: string) => ({
  proposal: "bg-blue-100 text-blue-700", issued: "bg-success/10 text-success", renewed: "bg-success/10 text-success",
  lapsed: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
  due: "bg-warning/10 text-warning",
  filed: "bg-blue-100 text-blue-700", under_review: "bg-warning/10 text-warning", approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive", paid: "bg-violet-100 text-violet-700",
}[s] ?? "bg-muted text-muted-foreground");

export function InsuranceView() {
  const CUR = useCurrency();
  const [tab, setTab] = React.useState<Tab>("policies");
  const { data: s } = useInsuranceSummary();
  const { data: policies = [] } = usePolicies();
  const stats = [
    { label: "Active Policies", value: s?.activePolicies ?? 0, icon: ShieldCheck, color: "text-success bg-success/10" },
    { label: "Proposals", value: s?.proposals ?? 0, icon: FileText, color: "text-blue-600 bg-blue-100" },
    { label: "Premium In-Force", value: formatCurrency(s?.premiumInForce ?? 0, CUR), icon: DollarSign, color: "text-primary bg-primary/10" },
    { label: "Renewals Due", value: s?.renewalsDue ?? 0, icon: RefreshCw, color: "text-warning bg-warning/10" },
    { label: "Open Claims", value: s?.openClaims ?? 0, icon: FileWarning, color: "text-destructive bg-destructive/10" },
    { label: "Claims Paid", value: formatCurrency(s?.claimsPaid ?? 0, CUR), icon: DollarSign, color: "text-violet-600 bg-violet-100" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Insurance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lead → Policy Proposal → Issuance → Renewal → Claims</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((x, i) => { const Icon = x.icon; return (
          <motion.div key={x.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", x.color)}><Icon className="h-4.5 w-4.5" /></div>
            <p className="text-xs text-muted-foreground truncate">{x.label}</p><p className={cn("font-bold leading-tight mt-0.5 truncate", fitTextClass(x.value, "lg"))} title={String(x.value)}>{x.value}</p>
          </motion.div>); })}
      </div>
      <div className="flex items-center gap-1.5">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all",
            tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" />{t.label}</button>); })}
      </div>
      {tab === "policies" && <PoliciesTab />}
      {tab === "renewals" && <RenewalsTab />}
      {tab === "claims" && <ClaimsTab policies={policies} />}
    </div>
  );
}

function AddBar({ open, setOpen, label, children, onSave, saving, canSave, perm }:
  { open: boolean; setOpen: (v: boolean) => void; label: string; children: React.ReactNode; onSave: () => void; saving: boolean; canSave: boolean; perm?: string }) {
  if (!open) return <Can permission={perm}><Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button></Can>;
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

function PoliciesTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = usePolicies();
  const create = useCreatePolicy(); const setStatus = useSetPolicyStatus(); const renew = useRenewPolicy(); const del = useDeletePolicy();
  const [open, setOpen] = React.useState(false);
  const [holder, setHolder] = React.useState(""); const [product, setProduct] = React.useState("health");
  const [premium, setPremium] = React.useState(""); const [sum, setSum] = React.useState("");
  const save = () => create.mutate({ holderName: holder.trim(), productType: product, premium: parseFloat(premium) || 0, sumInsured: parseFloat(sum) || 0, startDate: today(), endDate: plusDays(365) },
    { onSuccess: () => { setOpen(false); setHolder(""); setPremium(""); setSum(""); } });
  return (
    <div className="space-y-3">
      <AddBar perm="insurance.policies.create" open={open} setOpen={setOpen} label="New Policy" onSave={save} saving={create.isPending} canSave={!!holder.trim() && !!premium}>
        <Input value={holder} onChange={e => setHolder(e.target.value)} placeholder="Policy holder" className="h-9 w-44 text-sm" />
        <select value={product} onChange={e => setProduct(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm capitalize">
          {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <Input type="number" value={premium} onChange={e => setPremium(e.target.value)} placeholder="Premium" className="h-9 w-28 text-sm text-right" />
        <Input type="number" value={sum} onChange={e => setSum(e.target.value)} placeholder="Sum insured" className="h-9 w-32 text-sm text-right" />
      </AddBar>
      <Table cols={["Policy #", "Holder", "Product", "Premium", "Sum Insured", "Status", ""]} empty={rows.length === 0} emptyMsg="No policies yet.">
        {rows.map(p => (
          <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{p.policyNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{p.holderName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{p.productType}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(p.premium, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground">{formatCurrency(p.sumInsured, CUR)}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(p.status))}>{p.status}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {p.status === "proposal" && <button title="Issue policy" onClick={() => setStatus.mutate({ id: p.id, status: "issued" })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              {(p.status === "issued" || p.status === "renewed") && <button title="Raise renewal" onClick={() => renew.mutate({ id: p.id, data: { renewalDate: plusDays(365), newPremium: null } })} className="p-1.5 rounded text-warning hover:bg-warning/10"><RefreshCw className="h-3.5 w-3.5" /></button>}
              <Can permission="insurance.policies.delete"><button title="Delete" onClick={() => del.mutate(p.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function RenewalsTab() {
  const CUR = useCurrency();
  const { data: rows = [] } = useRenewals();
  const complete = useCompleteRenewal(); const del = useDeleteRenewal();
  return (
    <Table cols={["Policy #", "Holder", "Renewal Date", "New Premium", "Status", ""]} empty={rows.length === 0} emptyMsg="No renewals due. Raise one from an active policy.">
      {rows.map(r => (
        <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
          <td className="px-4 py-2.5 font-mono text-xs">{r.policyNumber}</td>
          <td className="px-4 py-2.5 text-sm font-medium">{r.holderName}</td>
          <td className="px-4 py-2.5 text-sm">{r.renewalDate}</td>
          <td className="px-4 py-2.5 text-sm">{formatCurrency(r.newPremium, CUR)}</td>
          <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(r.status))}>{r.status}</span></td>
          <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
            {r.status === "due" && <button title="Complete renewal" onClick={() => complete.mutate(r.id)} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
            <Can permission="insurance.renewals.delete"><button title="Delete" onClick={() => del.mutate(r.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
          </div></td>
        </tr>
      ))}
    </Table>
  );
}

function ClaimsTab({ policies }: { policies: PolicyDto[] }) {
  const CUR = useCurrency();
  const { data: rows = [] } = useClaims();
  const create = useCreateClaim(); const approve = useApproveClaim(); const setStatus = useSetClaimStatus(); const del = useDeleteClaim();
  const [open, setOpen] = React.useState(false);
  const [policyId, setPolicyId] = React.useState(""); const [amount, setAmount] = React.useState(""); const [reason, setReason] = React.useState("");
  const save = () => create.mutate({ policyId, claimDate: today(), claimAmount: parseFloat(amount) || 0, reason: reason.trim() || null },
    { onSuccess: () => { setOpen(false); setPolicyId(""); setAmount(""); setReason(""); } });
  return (
    <div className="space-y-3">
      <AddBar perm="insurance.claims.create" open={open} setOpen={setOpen} label="File Claim" onSave={save} saving={create.isPending} canSave={!!policyId && !!amount}>
        <select value={policyId} onChange={e => setPolicyId(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
          <option value="">Policy…</option>
          {policies.map(p => <option key={p.id} value={p.id}>{p.policyNumber} · {p.holderName}</option>)}
        </select>
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Claim amount" className="h-9 w-32 text-sm text-right" />
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" className="h-9 w-48 text-sm" />
      </AddBar>
      <Table cols={["Claim #", "Holder", "Policy #", "Claim Amt", "Approved", "Status", ""]} empty={rows.length === 0} emptyMsg="No claims yet.">
        {rows.map(c => (
          <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
            <td className="px-4 py-2.5 font-mono text-xs">{c.claimNumber}</td>
            <td className="px-4 py-2.5 text-sm font-medium">{c.holderName}</td>
            <td className="px-4 py-2.5 text-sm text-muted-foreground font-mono text-xs">{c.policyNumber}</td>
            <td className="px-4 py-2.5 text-sm">{formatCurrency(c.claimAmount, CUR)}</td>
            <td className="px-4 py-2.5 text-sm text-success">{c.approvedAmount > 0 ? formatCurrency(c.approvedAmount, CUR) : "—"}</td>
            <td className="px-4 py-2.5"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", badge(c.status))}>{c.status.replace("_", " ")}</span></td>
            <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1">
              {(c.status === "filed" || c.status === "under_review") && <button title="Approve full amount" onClick={() => approve.mutate({ id: c.id, amount: c.claimAmount })} className="p-1.5 rounded text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>}
              {c.status === "approved" && <button title="Mark paid" onClick={() => setStatus.mutate({ id: c.id, status: "paid" })} className="p-1.5 rounded text-violet-600 hover:bg-violet-50"><ArrowRight className="h-3.5 w-3.5" /></button>}
              <Can permission="insurance.claims.delete"><button title="Delete" onClick={() => del.mutate(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></Can>
            </div></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
