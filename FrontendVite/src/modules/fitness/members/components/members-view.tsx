import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { ProgramsPanel } from "../../programs/components/programs-panel";
import { Camera, Globe, Loader2, Plus, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { portalAdminApi, portalUrl, type MemberPortalPinDto } from "@/lib/fitness/portal.api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  fitnessApi, localToday, PAYMENT_METHODS, type MemberDetailDto, type MemberInput, type PaymentDto, type SubscriptionDto,
} from "@/lib/fitness/fitness.api";
import {
  useAct, useBranches, useMeasurements, useMember, useMembers, usePayments, usePlans, useTrainers, useVisits,
} from "@/hooks/fitness/use-fitness";
import {
  ConfirmDialog, Field, FormModal, Modal, PageHeader, Pill, SearchBox, SELECT, Tabs, TableState, TH, num, orUndef, useDebounced,
  type FormField,
} from "../../shared/ui";

const STATES = [
  { value: "", label: "All members" }, { value: "active", label: "Active" }, { value: "expiring", label: "Expiring soon" },
  { value: "expired", label: "Expired" }, { value: "frozen", label: "Frozen" }, { value: "none", label: "No plan" }, { value: "inactive", label: "Inactive / blacklisted" },
];

// ── Create / edit ───────────────────────────────────────────────────────────

function MemberForm({ member, leadId, initial, onClose, onSaved }: {
  member?: MemberDetailDto; leadId?: string; initial?: Partial<MemberInput>; onClose: () => void; onSaved: (id: string) => void;
}) {
  const { data: branches = [] } = useBranches(true);
  const { data: trainers = [] } = useTrainers(true);
  const save = useAct(
    (m: MemberInput) => member ? fitnessApi.updateMember(member.id, m) : fitnessApi.createMember(m, leadId),
    member ? "Member updated." : "Member added.");

  const fields: FormField[] = [
    { key: "firstName", label: "First name", required: true }, { key: "lastName", label: "Last name" },
    { key: "gender", label: "Gender", type: "select", options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }] },
    { key: "dateOfBirth", label: "Date of birth", type: "date" },
    { key: "phone", label: "Phone / WhatsApp" }, { key: "email", label: "Email", type: "email" },
    { key: "homeBranchId", label: "Home branch", type: "select", required: true, options: branches.map(b => ({ value: b.id, label: b.name })) },
    { key: "trainerId", label: "Assigned trainer", type: "select", options: trainers.map(t => ({ value: t.id, label: t.name })) },
    { key: "nationalId", label: "ID / Emirates ID" }, { key: "address", label: "Address" },
    { key: "emergencyName", label: "Emergency contact" }, { key: "emergencyPhone", label: "Emergency phone" },
    { key: "healthNotes", label: "Health notes", type: "textarea", hint: "Shown to the desk at check-in." },
    { key: "fitnessGoal", label: "Fitness goal" }, { key: "source", label: "How did they hear of us?" },
    { key: "referredBy", label: "Referred by" },
    { key: "waiverSignedOn", label: "Waiver signed on", type: "date" },
    ...(member ? [] : [{ key: "joinedOn", label: "Joined on", type: "date" } as FormField]),
    { key: "notes", label: "Notes", type: "textarea" },
  ];
  const m = member, i = initial ?? {};
  return (
    <FormModal title={member ? `Edit ${member.fullName}` : "New member"} fields={fields} size="lg" pending={save.isPending}
      initial={{
        firstName: m?.firstName ?? i.firstName ?? "", lastName: m?.lastName ?? i.lastName ?? "", gender: m?.gender ?? i.gender ?? "",
        dateOfBirth: m?.dateOfBirth ?? "", phone: m?.phone ?? i.phone ?? "", email: m?.email ?? i.email ?? "",
        homeBranchId: m?.homeBranchId ?? branches[0]?.id ?? "", trainerId: m?.trainerId ?? "", nationalId: m?.nationalId ?? "",
        address: m?.address ?? "", emergencyName: m?.emergencyName ?? "", emergencyPhone: m?.emergencyPhone ?? "",
        healthNotes: m?.healthNotes ?? "", fitnessGoal: m?.fitnessGoal ?? "", source: m?.source ?? i.source ?? "", referredBy: m?.referredBy ?? "",
        waiverSignedOn: m?.waiverSignedOn ?? "", joinedOn: localToday(), notes: m?.notes ?? i.notes ?? "",
      }}
      onClose={onClose}
      onSubmit={v => save.mutate({
        firstName: String(v.firstName).trim(), lastName: orUndef(v.lastName), gender: orUndef(v.gender), dateOfBirth: orUndef(v.dateOfBirth),
        phone: orUndef(v.phone), email: orUndef(v.email), address: orUndef(v.address), nationalId: orUndef(v.nationalId),
        emergencyName: orUndef(v.emergencyName), emergencyPhone: orUndef(v.emergencyPhone), healthNotes: orUndef(v.healthNotes),
        fitnessGoal: orUndef(v.fitnessGoal), source: orUndef(v.source), referredBy: orUndef(v.referredBy), notes: orUndef(v.notes),
        homeBranchId: orUndef(v.homeBranchId), trainerId: orUndef(v.trainerId), waiverSignedOn: orUndef(v.waiverSignedOn), joinedOn: orUndef(v.joinedOn),
      }, { onSuccess: d => { onSaved(d.id); onClose(); } })} />
  );
}

// ── Sell / renew a membership ───────────────────────────────────────────────

function SellModal({ member, renew, onClose }: { member: MemberDetailDto; renew?: SubscriptionDto; onClose: () => void }) {
  const { data: plans = [] } = usePlans(true);
  const cur = useCurrency();
  const sell = useAct((b: Record<string, unknown>) => fitnessApi.sell(member.id, b), "Membership added.");
  const [planId, setPlanId] = React.useState(renew?.planId ?? "");
  const plan = plans.find(p => p.id === planId);
  const [price, setPrice] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [joining, setJoining] = React.useState(!renew);
  const [start, setStart] = React.useState("");
  const [paid, setPaid] = React.useState("0");
  const [method, setMethod] = React.useState("cash");
  const [ref, setRef] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => { if (plan) setPrice(String(plan.price)); }, [plan?.id]);

  const total = Math.max(0, num(price) - num(discount)) + (joining && plan ? plan.joiningFee : 0);
  return (
    <Modal title={renew ? "Renew membership" : "Sell membership"} subtitle={member.fullName} onClose={onClose} size="md"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!plan || sell.isPending || num(paid) > total} className="gap-1.5"
          onClick={() => sell.mutate({
            planId, startDate: orUndef(start), price: num(price), discount: num(discount), chargeJoiningFee: joining, amountPaid: num(paid),
            paymentMethod: num(paid) > 0 ? method : undefined, paymentReference: orUndef(ref), notes: orUndef(notes), renewFromId: renew?.id,
          }, { onSuccess: onClose })}>
          {sell.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Add membership
        </Button>
      </>}>
      <Field label="Plan *">
        <select className={SELECT} value={planId} onChange={e => setPlanId(e.target.value)}>
          <option value="">Choose a plan…</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, cur)} / {p.durationDays} days</option>)}
        </select>
      </Field>
      {plan && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price"><Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className="h-9" /></Field>
          <Field label="Discount"><Input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} className="h-9" /></Field>
          <Field label="Start date" hint={renew ? "Left blank, it starts the day after the old one ends." : "Left blank, it starts today."}>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="h-9" />
          </Field>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={joining} onChange={e => setJoining(e.target.checked)} disabled={!!renew || plan.joiningFee === 0} className="h-4 w-4" />
            Joining fee ({formatCurrency(plan.joiningFee, cur)})
          </label>
          <Field label={`Paid now (of ${formatCurrency(total, cur)})`}><Input type="number" min={0} value={paid} onChange={e => setPaid(e.target.value)} className="h-9" /></Field>
          {num(paid) > 0 && (
            <Field label="Method">
              <select className={SELECT} value={method} onChange={e => setMethod(e.target.value)}>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
            </Field>
          )}
          {num(paid) > 0 && <Field label="Reference" className="col-span-2"><Input value={ref} onChange={e => setRef(e.target.value)} className="h-9" /></Field>}
          <Field label="Notes" className="col-span-2"><Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9" /></Field>
          <p className="col-span-2 text-xs text-muted-foreground">
            {plan.durationDays} days · {plan.classCredits != null ? `${plan.classCredits} class credits · ` : ""}{plan.ptSessions > 0 ? `${plan.ptSessions} PT sessions · ` : ""}
            {plan.allowFreeze ? `freeze up to ${plan.maxFreezeDays} days` : "no freezing"}
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Record a payment ────────────────────────────────────────────────────────

export function PaymentModal({ memberId, memberName, subscriptionId, ptPackageId, balance, onClose }: {
  memberId: string; memberName: string; subscriptionId?: string; ptPackageId?: string; balance: number; onClose: () => void;
}) {
  const cur = useCurrency();
  const pay = useAct((b: Record<string, unknown>) => fitnessApi.recordPayment(b), "Payment recorded.");
  const [amount, setAmount] = React.useState(String(balance));
  const [method, setMethod] = React.useState("cash");
  const [paidOn, setPaidOn] = React.useState(localToday());
  const [ref, setRef] = React.useState("");
  return (
    <Modal title="Record payment" subtitle={`${memberName} · balance ${formatCurrency(balance, cur)}`} onClose={onClose} size="sm"
      footer={<>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={pay.isPending || num(amount) <= 0 || num(amount) > balance} className="gap-1.5"
          onClick={() => pay.mutate({ memberId, subscriptionId, ptPackageId, amount: num(amount), method, paidOn, reference: orUndef(ref) }, { onSuccess: onClose })}>
          {pay.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Record
        </Button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="h-9" /></Field>
        <Field label="Method"><select className={SELECT} value={method} onChange={e => setMethod(e.target.value)}>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        <Field label="Paid on"><Input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className="h-9" /></Field>
        <Field label="Reference"><Input value={ref} onChange={e => setRef(e.target.value)} className="h-9" /></Field>
      </div>
    </Modal>
  );
}

// ── Member drawer ───────────────────────────────────────────────────────────

type Tab = "memberships" | "payments" | "progress" | "visits" | "programs";

function MembershipCard({ s, member }: { s: SubscriptionDto; member: MemberDetailDto }) {
  const cur = useCurrency();
  const [dlg, setDlg] = React.useState<null | "freeze" | "cancel" | "renew" | "pay">(null);
  const [reason, setReason] = React.useState("");
  const freeze = useAct((r: string) => fitnessApi.freeze(s.id, { reason: orUndef(r) }), "Membership frozen.");
  const unfreeze = useAct<void, SubscriptionDto>(() => fitnessApi.unfreeze(s.id), "Membership resumed.");
  const cancel = useAct((r: string) => fitnessApi.cancelMembership(s.id, orUndef(r)), "Membership cancelled.");
  const left = s.freezeDaysUsed >= s.maxFreezeDays ? 0 : s.maxFreezeDays - s.freezeDaysUsed;
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">{s.planName}</p><p className="text-xs text-muted-foreground">{formatDate(s.startDate)} → {formatDate(s.endDate)} · {s.durationDays} days</p></div>
        <Pill state={s.state} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><p className="text-muted-foreground">Total</p><p className="font-semibold tabular-nums">{formatCurrency(s.total, cur)}</p></div>
        <div><p className="text-muted-foreground">Paid</p><p className="font-semibold tabular-nums">{formatCurrency(s.amountPaid, cur)}</p></div>
        <div><p className="text-muted-foreground">Balance</p><p className={cn("font-semibold tabular-nums", s.balance > 0 && "text-red-600")}>{formatCurrency(s.balance, cur)}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        {s.classCredits != null && <>Class credits {s.classCreditsLeft}/{s.classCredits} · </>}
        {s.ptSessionsLeft > 0 && <>{s.ptSessionsLeft} PT left · </>}
        {s.totalVisits != null && <>Visits {s.visitsUsed}/{s.totalVisits} · </>}
        {s.guestPassesLeft > 0 && <>{s.guestPassesLeft} guest passes · </>}
        {s.allowFreeze && <>{left} freeze days left</>}
      </p>
      {s.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Can permission="fitness.payments.create">{s.balance > 0 && <Button size="sm" variant="outline" onClick={() => setDlg("pay")}>Take payment</Button>}</Can>
          <Can permission="fitness.memberships.create"><Button size="sm" variant="outline" onClick={() => setDlg("renew")}>Renew</Button></Can>
          <Can permission="fitness.memberships.edit">
            {s.status === "frozen"
              ? <Button size="sm" variant="outline" disabled={unfreeze.isPending} onClick={() => unfreeze.mutate()}>Resume</Button>
              : s.state === "active" && s.allowFreeze && left > 0 && <Button size="sm" variant="outline" onClick={() => setDlg("freeze")}>Freeze</Button>}
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDlg("cancel")}>Cancel</Button>
          </Can>
        </div>
      )}
      <AnimatePresence>
        {dlg === "pay" && <PaymentModal memberId={member.id} memberName={member.fullName} subscriptionId={s.id} balance={s.balance} onClose={() => setDlg(null)} />}
        {dlg === "renew" && <SellModal member={member} renew={s} onClose={() => setDlg(null)} />}
        {(dlg === "freeze" || dlg === "cancel") && (
          <ConfirmDialog title={dlg === "freeze" ? "Freeze this membership?" : "Cancel this membership?"} destructive={dlg === "cancel"}
            confirmLabel={dlg === "freeze" ? "Freeze" : "Cancel membership"} pending={freeze.isPending || cancel.isPending}
            body={<div className="space-y-2"><p>{dlg === "freeze" ? `Up to ${left} days can be frozen. The end date moves out by the days frozen.` : "The member loses access straight away. Money already paid is not refunded here."}</p>
              <Input placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} className="h-9" /></div>}
            onConfirm={() => (dlg === "freeze" ? freeze : cancel).mutate(reason, { onSuccess: () => setDlg(null) })} onClose={() => setDlg(null)} />
        )}
      </AnimatePresence>
    </Card>
  );
}

function MeasurementsTab({ memberId }: { memberId: string }) {
  const { data = [], isLoading } = useMeasurements(memberId);
  const [open, setOpen] = React.useState(false);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveMeasurement(memberId, null, b), "Measurement saved.", ["measurements"]);
  const del = useAct((id: string) => fitnessApi.deleteMeasurement(id), "Removed.", ["measurements"]);
  const f = (v: unknown) => orUndef(v) === undefined ? undefined : num(v);
  return (
    <div className="space-y-3">
      <Can permission="fitness.members.edit"><Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" />Add measurement</Button></Can>
      <TableState loading={isLoading} empty={data.length === 0} emptyText="No measurements yet." icon={Users} />
      {data.length > 0 && (
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr><th className={TH}>Date</th><th className={TH}>Weight</th><th className={TH}>Body fat</th><th className={TH}>Waist</th><th className={TH}>BMI</th><th /></tr></thead>
          <tbody className="divide-y divide-border">{data.map(m => (
            <tr key={m.id}><td className="px-4 py-2">{formatDate(m.measuredOn)}</td><td className="px-4 py-2">{m.weightKg ?? "—"}</td><td className="px-4 py-2">{m.bodyFatPct ?? "—"}</td><td className="px-4 py-2">{m.waistCm ?? "—"}</td><td className="px-4 py-2">{m.bmi ?? "—"}</td>
              <td className="px-2"><Can permission="fitness.members.edit"><button className="text-xs text-red-600" onClick={() => del.mutate(m.id)}>Remove</button></Can></td></tr>))}</tbody></table>
      )}
      <AnimatePresence>{open && (
        <FormModal title="Add measurement" size="sm" pending={save.isPending} onClose={() => setOpen(false)}
          initial={{ measuredOn: localToday(), weightKg: "", heightCm: "", bodyFatPct: "", muscleMassKg: "", chestCm: "", waistCm: "", hipsCm: "", armCm: "", thighCm: "", restingHeartRate: "", bloodPressure: "", notes: "" }}
          fields={[
            { key: "measuredOn", label: "Date", type: "date", required: true }, { key: "weightKg", label: "Weight (kg)", type: "number" },
            { key: "heightCm", label: "Height (cm)", type: "number" }, { key: "bodyFatPct", label: "Body fat %", type: "number" },
            { key: "muscleMassKg", label: "Muscle mass (kg)", type: "number" }, { key: "chestCm", label: "Chest (cm)", type: "number" },
            { key: "waistCm", label: "Waist (cm)", type: "number" }, { key: "hipsCm", label: "Hips (cm)", type: "number" },
            { key: "armCm", label: "Arm (cm)", type: "number" }, { key: "thighCm", label: "Thigh (cm)", type: "number" },
            { key: "restingHeartRate", label: "Resting heart rate", type: "number" }, { key: "bloodPressure", label: "Blood pressure" },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          onSubmit={v => save.mutate({
            measuredOn: v.measuredOn, weightKg: f(v.weightKg), heightCm: f(v.heightCm), bodyFatPct: f(v.bodyFatPct), muscleMassKg: f(v.muscleMassKg),
            chestCm: f(v.chestCm), waistCm: f(v.waistCm), hipsCm: f(v.hipsCm), armCm: f(v.armCm), thighCm: f(v.thighCm),
            restingHeartRate: f(v.restingHeartRate), bloodPressure: orUndef(v.bloodPressure), notes: orUndef(v.notes),
          }, { onSuccess: () => setOpen(false) })} />
      )}</AnimatePresence>
    </div>
  );
}

/** Scale a picture down so a member photo stays a few tens of KB, not megabytes. */
async function shrinkImage(file: File, max: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Gives a member the online portal. The PIN is shown once, right after it is made; only its hash is kept. */
function PortalAccess({ member }: { member: MemberDetailDto }) {
  const slug = useAuthStore(s => s.tenant?.slug);
  const [issued, setIssued] = React.useState<MemberPortalPinDto | null>(null);
  const [confirm, setConfirm] = React.useState<"replace" | "remove" | null>(null);
  const setPin = useAct((id: string) => portalAdminApi.setPin(id), undefined);
  const clearPin = useAct((id: string) => portalAdminApi.clearPin(id), "Online access removed.");
  const issue = () => setPin.mutate(member.id, { onSuccess: setIssued, onSettled: () => setConfirm(null) });

  return (
    <div className="rounded-lg border border-border px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Online access</p>
        <p className="text-xs text-muted-foreground">{member.hasPortalAccess ? "Can sign in to the member portal." : "No online access yet."}</p>
      </div>
      <Can permission="fitness.members.edit">
        <div className="flex items-center gap-2">
          {member.hasPortalAccess && <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirm("remove")}>Remove</Button>}
          <Button variant="outline" size="sm" disabled={setPin.isPending} onClick={() => (member.hasPortalAccess ? setConfirm("replace") : issue())}>
            {setPin.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{member.hasPortalAccess ? "New PIN" : "Give access"}
          </Button>
        </div>
      </Can>
      <AnimatePresence>
        {confirm === "replace" && (
          <ConfirmDialog key="replace" title="Give a new PIN?" confirmLabel="New PIN" destructive={false} pending={setPin.isPending}
            body={`${member.fullName} will be signed out everywhere and will need the new PIN.`} onClose={() => setConfirm(null)} onConfirm={issue} />
        )}
        {confirm === "remove" && (
          <ConfirmDialog key="remove" title="Remove online access?" confirmLabel="Remove" pending={clearPin.isPending}
            body={`${member.fullName} will no longer be able to sign in to the portal.`} onClose={() => setConfirm(null)}
            onConfirm={() => clearPin.mutate(member.id, { onSettled: () => setConfirm(null) })} />
        )}
        {issued && (
          <Modal key="pin" title="Portal PIN" subtitle={member.fullName} size="sm" onClose={() => setIssued(null)}
            footer={<Button size="sm" onClick={() => setIssued(null)}>Done</Button>}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-3 py-2.5"><p className="text-[11px] font-semibold text-muted-foreground uppercase">Member number</p>
                <p className="text-lg font-bold mt-1 break-all">{issued.memberNumber}</p></div>
              <div className="rounded-lg border border-border px-3 py-2.5"><p className="text-[11px] font-semibold text-muted-foreground uppercase">PIN</p>
                <p className="text-lg font-bold mt-1 tracking-[0.25em] tabular-nums">{issued.pin}</p></div>
            </div>
            {slug && <p className="text-xs text-muted-foreground break-all mt-3">Sign in at <span className="font-medium text-foreground">{portalUrl(slug)}</span></p>}
            <p className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2 mt-3">Write this PIN down or tell the member now. It cannot be shown again.</p>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: m, isLoading, error } = useMember(id);
  const cur = useCurrency();
  const [tab, setTab] = React.useState<Tab>("memberships");
  const [dlg, setDlg] = React.useState<null | "edit" | "sell" | "status">(null);
  const { data: pays } = usePayments({ memberId: id, pageSize: 100 });
  const { data: visits } = useVisits({ memberId: id, includeRefused: true, pageSize: 50 });
  const [voidTarget, setVoidTarget] = React.useState<PaymentDto | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const voidPay = useAct((a: { id: string; reason: string }) => fitnessApi.voidPayment(a.id, a.reason), "Payment voided.");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const savePhoto = useAct((a: { m: MemberDetailDto; photo: string }) => fitnessApi.updateMember(a.m.id, {
    firstName: a.m.firstName, lastName: a.m.lastName, gender: a.m.gender, dateOfBirth: a.m.dateOfBirth, phone: a.m.phone, email: a.m.email,
    address: a.m.address, nationalId: a.m.nationalId, emergencyName: a.m.emergencyName, emergencyPhone: a.m.emergencyPhone,
    healthNotes: a.m.healthNotes, fitnessGoal: a.m.fitnessGoal, source: a.m.source, referredBy: a.m.referredBy, notes: a.m.notes,
    homeBranchId: a.m.homeBranchId, trainerId: a.m.trainerId, waiverSignedOn: a.m.waiverSignedOn, photoData: a.photo }), "Photo updated.");
  const pickPhoto = async (file: File | undefined) => {
    if (!file || !m) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    try { savePhoto.mutate({ m, photo: await shrinkImage(file, 480) }); } catch { toast.error("That image could not be read."); }
  };
  const setStatus = useAct((a: { status: string; reason?: string }) => fitnessApi.setMemberStatus(id, a.status, a.reason), "Status updated.");

  return (
    <>
      <Modal side size="lg" onClose={onClose} title={m?.fullName ?? "Member"} subtitle={m ? `${m.memberNumber} · ${m.homeBranchName ?? ""}` : undefined}
        footer={m && (
          <>
            <Can permission="fitness.members.edit">
              <Button variant="outline" size="sm" onClick={() => setDlg("edit")}>Edit</Button>
              {m.status === "active"
                ? <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ status: "inactive" })}>Mark inactive</Button>
                : <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ status: "active" })}>Mark active</Button>}
            </Can>
            <Can permission="fitness.memberships.create"><Button size="sm" onClick={() => setDlg("sell")}>Sell membership</Button></Can>
          </>
        )}>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {m && (
          <>
            <PortalAccess member={m} />
            <div className="flex items-center gap-3">
              <button type="button" className="h-16 w-16 rounded-full overflow-hidden bg-muted grid place-items-center text-xs text-muted-foreground shrink-0 border border-border"
                title="Change photo" onClick={() => fileRef.current?.click()} disabled={savePhoto.isPending}>
                {m.photoData ? <img src={m.photoData} alt="" className="h-full w-full object-cover" /> : <Camera className="h-5 w-5" />}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <p className="text-xs text-muted-foreground">Shown at the front desk when they check in.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center"><Pill state={m.status} />
              {m.balance > 0 && <span className="text-xs font-semibold text-red-600">Owes {formatCurrency(m.balance, cur)}</span>}
              {m.lockerNumber && <span className="text-xs text-muted-foreground">Locker {m.lockerNumber}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {([["Phone", m.phone], ["Email", m.email], ["Joined", formatDate(m.joinedOn)], ["Last visit", m.lastVisit ? formatDate(m.lastVisit) : "—"],
                ["Visits (30 days)", String(m.visits30Days)], ["Trainer", m.trainerName], ["Emergency", [m.emergencyName, m.emergencyPhone].filter(Boolean).join(" · ")],
                ["Goal", m.fitnessGoal]] as [string, string | undefined][]).map(([k, v]) => v ? <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div> : null)}
              {m.healthNotes && <div className="col-span-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs"><b>Health notes:</b> {m.healthNotes}</div>}
            </dl>
            <Tabs value={tab} onChange={setTab as (v: string) => void} items={[{ value: "memberships", label: "Memberships" }, { value: "payments", label: "Payments" }, { value: "progress", label: "Progress" }, { value: "programs", label: "Programs" }, { value: "visits", label: "Visits" }]} />
            {tab === "memberships" && (m.subscriptions.length === 0
              ? <p className="text-sm text-muted-foreground">No memberships yet.</p>
              : <div className="space-y-3">{m.subscriptions.map(s => <MembershipCard key={s.id} s={s} member={m} />)}</div>)}
            {tab === "payments" && (
              <div className="space-y-2">
                {(pays?.items ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
                {(pays?.items ?? []).map(p => (
                  <div key={p.id} className={cn("flex items-center justify-between rounded-lg border border-border p-3 text-sm", p.isVoided && "opacity-50 line-through")}>
                    <div><p className="font-medium">{p.receiptNumber} · {formatCurrency(p.amount, cur)}</p><p className="text-xs text-muted-foreground">{formatDate(p.paidOn)} · {p.method.replace("_", " ")}{p.receivedByName ? ` · ${p.receivedByName}` : ""}</p></div>
                    {!p.isVoided && <Can permission="fitness.payments.approve"><button className="text-xs text-red-600" onClick={() => { setVoidTarget(p); setVoidReason(""); }}>Void</button></Can>}
                  </div>))}
              </div>
            )}
            {tab === "progress" && <MeasurementsTab memberId={m.id} />}
            {tab === "programs" && <ProgramsPanel memberId={m.id} />}
            {tab === "visits" && (
              <div className="space-y-1 text-sm">
                {(visits?.items ?? []).length === 0 && <p className="text-muted-foreground">No visits yet.</p>}
                {(visits?.items ?? []).map(v => (
                  <div key={v.id} className="flex justify-between border-b border-border py-1.5">
                    <span>{formatDate(v.date)} · {new Date(v.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{v.isGuest ? " · guest" : ""}</span>
                    <span className={v.allowed ? "text-emerald-600" : "text-red-600"}>{v.allowed ? "In" : v.denyReason}</span>
                  </div>))}
              </div>
            )}
          </>
        )}
      </Modal>
      <AnimatePresence>
        {dlg === "edit" && m && <MemberForm member={m} onClose={() => setDlg(null)} onSaved={() => undefined} />}
        {dlg === "sell" && m && <SellModal member={m} onClose={() => setDlg(null)} />}
        {voidTarget && (
          <ConfirmDialog title={`Void ${voidTarget.receiptNumber}?`} confirmLabel="Void payment" pending={voidPay.isPending}
            body={<div className="space-y-2"><p>The amount goes back onto the balance it was paid against.</p><Input placeholder="Reason *" value={voidReason} onChange={e => setVoidReason(e.target.value)} className="h-9" /></div>}
            onConfirm={() => voidReason.trim() && voidPay.mutate({ id: voidTarget.id, reason: voidReason.trim() }, { onSuccess: () => setVoidTarget(null) })} onClose={() => setVoidTarget(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── List ────────────────────────────────────────────────────────────────────

export function MembersView() {
  const [search, setSearch] = React.useState("");
  const [state, setState] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const q = useDebounced(search);
  React.useEffect(() => setPage(1), [q, state, branchId]);
  const { data: branches = [] } = useBranches(true);
  const { data, isLoading, error } = useMembers({ search: q, state: state || undefined, branchId: branchId || undefined, page, pageSize: 25 });
  const cur = useCurrency();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader title="Members" description="Everyone who has joined, their plan and what they owe.">
        <Can permission="fitness.members.create"><Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New member</Button></Can>
      </PageHeader>
      <div className="flex flex-wrap gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Name, member no., phone, email…" className="w-full sm:w-72" />
        <select className={cn(SELECT, "w-auto")} value={state} onChange={e => setState(e.target.value)}>{STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        {branches.length > 1 && <select className={cn(SELECT, "w-auto")} value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      </div>
      <Card className="overflow-hidden">
        <TableState loading={isLoading} error={error as Error | null} empty={!!data && data.items.length === 0} emptyText="No members match." icon={Users} />
        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr><th className={TH}>Member</th><th className={TH}>Phone</th><th className={TH}>Plan</th><th className={TH}>Ends</th><th className={TH}>Status</th><th className={cn(TH, "text-end")}>Owes</th></tr></thead>
              <tbody className="divide-y divide-border">
                {data.items.map(m => (
                  <tr key={m.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setOpen(m.id)}>
                    <td className="px-4 py-3"><p className="font-medium">{m.fullName}</p><p className="text-xs text-muted-foreground">{m.memberNumber}</p></td>
                    <td className="px-4 py-3">{m.phone ?? "—"}</td>
                    <td className="px-4 py-3">{m.planName ?? "—"}</td>
                    <td className="px-4 py-3">{m.endDate ? <>{formatDate(m.endDate)} <span className="text-xs text-muted-foreground">({m.daysLeft}d)</span></> : "—"}</td>
                    <td className="px-4 py-3">{m.status !== "active" ? <Pill state={m.status} /> : <Pill state={m.membershipState} />}</td>
                    <td className={cn("px-4 py-3 text-end tabular-nums", m.balance > 0 && "text-red-600 font-semibold")}>{m.balance > 0 ? formatCurrency(m.balance, cur) : "—"}</td>
                  </tr>))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>{data.total} members</span>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {pages}</span><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</Button></div>
              </div>
            )}
          </div>
        )}
      </Card>
      <AnimatePresence>
        {open && <MemberDrawer id={open} onClose={() => setOpen(null)} />}
        {creating && <MemberForm onClose={() => setCreating(false)} onSaved={id => setOpen(id)} />}
      </AnimatePresence>
    </div>
  );
}

export { MemberForm, SellModal };
