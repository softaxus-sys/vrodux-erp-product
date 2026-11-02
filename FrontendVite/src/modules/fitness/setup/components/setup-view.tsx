import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Building2, Plus, Ticket } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { portalAdminApi, portalUrl } from "@/lib/fitness/portal.api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Can } from "@/components/auth/can";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { fitnessApi, PLAN_CATEGORIES, type BranchDto, type PlanDto } from "@/lib/fitness/fitness.api";
import { useAct, useBranches, usePlans, useSettings } from "@/hooks/fitness/use-fitness";
import { FormModal, PageHeader, Pill, Tabs, TableState, TH, num, orUndef, type FormValues } from "../../shared/ui";

function BranchForm({ branch, onClose }: { branch?: BranchDto; onClose: () => void }) {
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveBranch(branch?.id ?? null, b), "Branch saved.");
  return (
    <FormModal title={branch ? `Edit ${branch.name}` : "New branch"} pending={save.isPending} onClose={onClose}
      initial={{ name: branch?.name ?? "", code: branch?.code ?? "", address: branch?.address ?? "", phone: branch?.phone ?? "", email: branch?.email ?? "", openingTime: branch?.openingTime ?? "06:00", closingTime: branch?.closingTime ?? "22:00", capacity: String(branch?.capacity ?? ""), isActive: branch?.isActive ?? true }}
      fields={[{ key: "name", label: "Name", required: true }, { key: "code", label: "Short code" }, { key: "address", label: "Address", span: 2 }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", type: "email" },
        { key: "openingTime", label: "Opens", type: "time" }, { key: "closingTime", label: "Closes", type: "time" }, { key: "capacity", label: "Max people at once", type: "number", hint: "Shown against the live headcount." }, { key: "isActive", label: "Open", type: "checkbox" }]}
      onSubmit={v => save.mutate({ name: String(v.name).trim(), code: orUndef(v.code), address: orUndef(v.address), phone: orUndef(v.phone), email: orUndef(v.email), openingTime: orUndef(v.openingTime), closingTime: orUndef(v.closingTime), capacity: orUndef(v.capacity) ? num(v.capacity) : undefined, isActive: !!v.isActive }, { onSuccess: onClose })} />
  );
}

function PlanForm({ plan, onClose }: { plan?: PlanDto; onClose: () => void }) {
  const save = useAct((b: Record<string, unknown>) => fitnessApi.savePlan(plan?.id ?? null, b), "Plan saved.");
  const n = (v: unknown) => orUndef(v) === undefined ? undefined : num(v);
  return (
    <FormModal title={plan ? `Edit ${plan.name}` : "New membership plan"} size="lg" pending={save.isPending} onClose={onClose}
      initial={{ name: plan?.name ?? "", code: plan?.code ?? "", category: plan?.category ?? "gym", durationDays: String(plan?.durationDays ?? 30), price: String(plan?.price ?? 0), joiningFee: String(plan?.joiningFee ?? 0),
        classCredits: plan?.classCredits != null ? String(plan.classCredits) : "", ptSessions: String(plan?.ptSessions ?? 0), visitsPerDay: plan?.visitsPerDay != null ? String(plan.visitsPerDay) : "", totalVisits: plan?.totalVisits != null ? String(plan.totalVisits) : "",
        guestPasses: String(plan?.guestPasses ?? 0), allowFreeze: plan?.allowFreeze ?? true, maxFreezeDays: String(plan?.maxFreezeDays ?? 30), allBranches: plan?.allBranches ?? true,
        accessFrom: plan?.accessFrom ?? "", accessUntil: plan?.accessUntil ?? "", description: plan?.description ?? "", isActive: plan?.isActive ?? true }}
      fields={[
        { key: "name", label: "Name", required: true }, { key: "code", label: "Code" },
        { key: "category", label: "Type", type: "select", required: true, options: PLAN_CATEGORIES }, { key: "durationDays", label: "Lasts (days)", type: "number", required: true },
        { key: "price", label: "Price", type: "number", required: true }, { key: "joiningFee", label: "Joining fee", type: "number" },
        { key: "classCredits", label: "Class credits", type: "number", hint: "Blank = unlimited classes for class plans." }, { key: "ptSessions", label: "Free PT sessions", type: "number" },
        { key: "visitsPerDay", label: "Visits per day (max)", type: "number" }, { key: "totalVisits", label: "Total visits (pass)", type: "number", hint: "For day passes and punch cards." },
        { key: "guestPasses", label: "Guest passes", type: "number" }, { key: "maxFreezeDays", label: "Freeze up to (days)", type: "number" },
        { key: "accessFrom", label: "Access from", type: "time", hint: "Off-peak plans: set both times." }, { key: "accessUntil", label: "Access until", type: "time" },
        { key: "allowFreeze", label: "Can be frozen", type: "checkbox" }, { key: "allBranches", label: "Valid at every branch", type: "checkbox" },
        { key: "description", label: "Description", type: "textarea" }, { key: "isActive", label: "On sale", type: "checkbox" },
      ]}
      onSubmit={v => save.mutate({ name: String(v.name).trim(), code: orUndef(v.code), description: orUndef(v.description), category: v.category, durationDays: num(v.durationDays), price: num(v.price), joiningFee: num(v.joiningFee),
        classCredits: n(v.classCredits), ptSessions: num(v.ptSessions), visitsPerDay: n(v.visitsPerDay), totalVisits: n(v.totalVisits), allowFreeze: !!v.allowFreeze, maxFreezeDays: num(v.maxFreezeDays), guestPasses: num(v.guestPasses),
        allBranches: !!v.allBranches, accessFrom: orUndef(v.accessFrom), accessUntil: orUndef(v.accessUntil), isActive: !!v.isActive }, { onSuccess: onClose })} />
  );
}

/** Switches the member portal on and off. Off until the gym turns it on. */
function PortalCard() {
  const slug = useAuthStore(s => s.tenant?.slug);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["fitness", "portal-settings"], queryFn: () => portalAdminApi.getSettings() });
  const save = useAct((b: { enabled: boolean; allowBooking: boolean }) => portalAdminApi.updateSettings(b), "Portal settings saved.", []);
  const apply = (b: { enabled: boolean; allowBooking: boolean }) =>
    save.mutate(b, { onSuccess: () => qc.invalidateQueries({ queryKey: ["fitness", "portal-settings"] }) });
  if (!data) return null;
  return (
    <Card className="p-5 space-y-3 max-w-2xl">
      <div>
        <h3 className="font-semibold">Member portal</h3>
        <p className="text-xs text-muted-foreground">Members sign in with their member number and a PIN from the front desk to see their membership, book classes and see payments.</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={data.enabled}
        onChange={e => apply({ enabled: e.target.checked, allowBooking: data.allowBooking })} />Turn the member portal on</label>
      <label className={"flex items-center gap-2 text-sm " + (data.enabled ? "" : "opacity-50")}><input type="checkbox" className="h-4 w-4" checked={data.allowBooking} disabled={!data.enabled}
        onChange={e => apply({ enabled: data.enabled, allowBooking: e.target.checked })} />Let members book and cancel classes themselves</label>
      <p className="text-xs text-muted-foreground">{data.membersWithAccess} member{data.membersWithAccess === 1 ? "" : "s"} can sign in.
        {slug && data.enabled && <> Address: <span className="font-medium text-foreground break-all">{portalUrl(slug)}</span></>}</p>
    </Card>
  );
}

function RulesPanel() {
  const { data: s } = useSettings();
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveSettings(b as never), "Rules saved.", ["settings"]);
  const [v, setV] = React.useState<FormValues | null>(null);
  React.useEffect(() => { if (s) setV({ ...s, graceDays: String(s.graceDays), expiringWithinDays: String(s.expiringWithinDays), lateCancelHours: String(s.lateCancelHours), bookingWindowDays: String(s.bookingWindowDays) } as unknown as FormValues); }, [s]);
  if (!v) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const set = (k: string, x: string | boolean) => setV(p => ({ ...p!, [k]: x }));
  const num2 = (k: string, label: string, hint?: string) => (
    <label className="space-y-1 text-sm block"><span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <input type="number" min={0} value={String(v[k])} onChange={e => set(k, e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" />{hint && <span className="text-[11px] text-muted-foreground block">{hint}</span>}</label>);
  const chk = (k: string, label: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v[k]} onChange={e => set(k, e.target.checked)} className="h-4 w-4" />{label}</label>;
  return (
    <Card className="p-5 space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-1 text-sm block"><span className="text-xs font-semibold text-muted-foreground uppercase">Member number prefix</span>
          <input value={String(v.memberNumberPrefix)} onChange={e => set("memberNumberPrefix", e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm" /></label>
        {num2("graceDays", "Grace days after expiry", "Members can still check in for this long.")}
        {num2("expiringWithinDays", "\"Expiring soon\" window (days)")}
        {num2("bookingWindowDays", "Class booking opens (days ahead)")}
        {num2("lateCancelHours", "Late-cancel cut-off (hours)", "Cancelling inside this keeps the credit spent.")}
      </div>
      <div className="space-y-2">
        {chk("allowCheckInWithDues", "Allow check-in with an unpaid balance")}
        {chk("requireWaiver", "Require a signed waiver to join and check in")}
        {chk("chargeCreditForNoShow", "No-shows use up their class credit")}
        {chk("expiryAlertsEnabled", "Send expiry alerts to the team")}
      </div>
      <Can permission="fitness.setup.edit">
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ ...v, graceDays: num(v.graceDays), expiringWithinDays: num(v.expiringWithinDays), lateCancelHours: num(v.lateCancelHours), bookingWindowDays: num(v.bookingWindowDays) })}>Save rules</Button>
      </Can>
    </Card>
  );
}

export function SetupView() {
  const [tab, setTab] = React.useState<"plans" | "branches" | "rules">("plans");
  const cur = useCurrency();
  const { data: plans = [], isLoading: pl } = usePlans();
  const { data: branches = [], isLoading: bl } = useBranches();
  const [plan, setPlan] = React.useState<PlanDto | "new" | null>(null);
  const [branch, setBranch] = React.useState<BranchDto | "new" | null>(null);
  const delPlan = useAct((id: string) => fitnessApi.deletePlan(id), "Plan removed.");
  const delBranch = useAct((id: string) => fitnessApi.deleteBranch(id), "Branch removed.");
  return (
    <div className="space-y-5">
      <PageHeader title="Plans & branches" description="What you sell, where, and the house rules." />
      <Tabs value={tab} onChange={setTab as (v: string) => void} items={[{ value: "plans", label: "Membership plans" }, { value: "branches", label: "Branches" }, { value: "rules", label: "Rules" }]} />
      {tab === "plans" && (
        <div className="space-y-3">
          <Can permission="fitness.setup.edit"><Button size="sm" className="gap-1.5" onClick={() => setPlan("new")}><Plus className="h-4 w-4" />New plan</Button></Can>
          <Card className="overflow-hidden"><TableState loading={pl} empty={plans.length === 0} emptyText="No plans yet — add Monthly, Quarterly, Annual…" icon={Ticket} />
            {plans.length > 0 && <table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Plan</th><th className={TH}>Price</th><th className={TH}>Lasts</th><th className={TH}>Members</th><th /></tr></thead>
              <tbody className="divide-y divide-border">{plans.map(p => (
                <tr key={p.id}><td className="px-4 py-2.5">{p.name} {!p.isActive && <Pill state="inactive" label="Off" />}<p className="text-xs text-muted-foreground">{PLAN_CATEGORIES.find(c => c.value === p.category)?.label}</p></td>
                  <td className="px-4 py-2.5 tabular-nums">{formatCurrency(p.price, cur)}</td><td className="px-4 py-2.5">{p.durationDays} days</td><td className="px-4 py-2.5">{p.activeMembers}</td>
                  <td className="px-4 py-2.5 text-end space-x-2"><Can permission="fitness.setup.edit"><button className="text-xs text-primary" onClick={() => setPlan(p)}>Edit</button><button className="text-xs text-red-600" onClick={() => delPlan.mutate(p.id)}>Delete</button></Can></td></tr>))}</tbody></table>}
          </Card>
        </div>)}
      {tab === "branches" && (
        <div className="space-y-3">
          <Can permission="fitness.setup.edit"><Button size="sm" className="gap-1.5" onClick={() => setBranch("new")}><Plus className="h-4 w-4" />New branch</Button></Can>
          <Card className="overflow-hidden"><TableState loading={bl} empty={branches.length === 0} emptyText="No branches." icon={Building2} />
            {branches.length > 0 && <table className="w-full text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className={TH}>Branch</th><th className={TH}>Hours</th><th className={TH}>Members</th><th className={TH}>Inside now</th><th /></tr></thead>
              <tbody className="divide-y divide-border">{branches.map(b => (
                <tr key={b.id}><td className="px-4 py-2.5">{b.name} {!b.isActive && <Pill state="inactive" label="Closed" />}<p className="text-xs text-muted-foreground">{b.address}</p></td><td className="px-4 py-2.5">{b.openingTime}–{b.closingTime}</td>
                  <td className="px-4 py-2.5">{b.members}</td><td className="px-4 py-2.5">{b.inGymNow}{b.capacity ? ` / ${b.capacity}` : ""}</td>
                  <td className="px-4 py-2.5 text-end space-x-2"><Can permission="fitness.setup.edit"><button className="text-xs text-primary" onClick={() => setBranch(b)}>Edit</button><button className="text-xs text-red-600" onClick={() => delBranch.mutate(b.id)}>Delete</button></Can></td></tr>))}</tbody></table>}
          </Card>
        </div>)}
      {tab === "rules" && <><RulesPanel /><PortalCard /></>}
      <AnimatePresence>
        {plan && <PlanForm plan={plan === "new" ? undefined : plan} onClose={() => setPlan(null)} />}
        {branch && <BranchForm branch={branch === "new" ? undefined : branch} onClose={() => setBranch(null)} />}
      </AnimatePresence>
    </div>
  );
}
