import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, DoorOpen, Loader2, LogOut, ShieldAlert, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { fitnessApi, localToday, type CheckInResultDto } from "@/lib/fitness/fitness.api";
import { useAct, useMembers, useOccupancy, useVisits, useWorkingBranch } from "@/hooks/fitness/use-fitness";
import { Field, Modal, PageHeader, SELECT, Stat, TableState, TH, useDebounced } from "../../shared/ui";

function GuestModal({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [hostSearch, setHostSearch] = React.useState("");
  const q = useDebounced(hostSearch);
  const { data } = useMembers({ search: q, state: "active", pageSize: 6 });
  const [host, setHost] = React.useState<{ id: string; name: string } | null>(null);
  const [guest, setGuest] = React.useState("");
  const go = useAct(() => fitnessApi.guestCheckIn(host!.id, branchId, guest.trim()), "Guest checked in.", ["visits", "occupancy", "members", "member"]);
  return (
    <Modal title="Guest check-in" subtitle="Uses one guest pass from the member's plan." size="sm" onClose={onClose}
      footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!host || !guest.trim() || go.isPending} onClick={() => go.mutate(undefined, { onSuccess: onClose })}>Check in guest</Button></>}>
      <Field label="Host member">
        {host ? <div className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm">{host.name}<button className="text-xs text-muted-foreground" onClick={() => setHost(null)}>Change</button></div> : (
          <div className="space-y-1.5">
            <Input value={hostSearch} onChange={e => setHostSearch(e.target.value)} placeholder="Search member…" className="h-9" autoFocus />
            {(data?.items ?? []).map(m => <button key={m.id} className="block w-full text-start rounded-md px-3 py-1.5 text-sm hover:bg-muted" onClick={() => setHost({ id: m.id, name: m.fullName })}>{m.fullName} <span className="text-xs text-muted-foreground">{m.memberNumber}</span></button>)}
          </div>)}
      </Field>
      <Field label="Guest name"><Input value={guest} onChange={e => setGuest(e.target.value)} className="h-9" /></Field>
    </Modal>
  );
}

function Result({ r, onOverride, overriding }: { r: CheckInResultDto; onOverride: () => void; overriding: boolean }) {
  const cur = useCurrency();
  const ok = r.allowed;
  return (
    <Card className={cn("p-5 border-2", ok ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/50 bg-red-500/5")}>
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 className="h-9 w-9 text-emerald-600 shrink-0" /> : <XCircle className="h-9 w-9 text-red-600 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold truncate">{r.memberName}</p>
          <p className="text-xs text-muted-foreground">{r.memberNumber}{r.planName ? ` · ${r.planName}` : ""}{r.endDate ? ` · ends ${formatDate(r.endDate)}` : ""}</p>
          <p className={cn("mt-1 font-semibold", ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>{ok ? "Welcome — checked in" : r.denyReason}</p>
          {r.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3 shrink-0" />{w}</p>)}
          {ok && (r.classCreditsLeft != null || r.visitsLeft != null) && (
            <p className="text-xs text-muted-foreground mt-1">{r.classCreditsLeft != null && <>Class credits left: {r.classCreditsLeft}. </>}{r.visitsLeft != null && <>Visits left: {r.visitsLeft}.</>}</p>)}
          {r.balance > 0 && <p className="text-xs font-semibold text-red-600 mt-1">Owes {formatCurrency(r.balance, cur)}</p>}
          {r.healthNotes && <p className="text-xs mt-2 rounded bg-amber-500/10 border border-amber-500/30 p-2"><b>Health:</b> {r.healthNotes}</p>}
          {!ok && r.denyReason !== "Already checked in." && !r.denyReason?.includes("blacklisted") && (
            <Can permission="fitness.checkin.edit">
              <Button size="sm" variant="outline" className="mt-3 gap-1.5" disabled={overriding} onClick={onOverride}>
                {overriding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}Let them in anyway
              </Button>
            </Can>)}
        </div>
      </div>
    </Card>
  );
}

export function FrontDeskView() {
  const { branches, branchId, setBranchId } = useWorkingBranch();
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState<CheckInResultDto | null>(null);
  const [lastRef, setLastRef] = React.useState("");
  const [guest, setGuest] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { data: occ = [] } = useOccupancy();
  const mine = occ.find(o => o.branchId === branchId);
  const { data: inside, isLoading, error } = useVisits({ branchId: branchId || undefined, inGymOnly: true, pageSize: 200 }, true);
  const { data: recent } = useVisits({ branchId: branchId || undefined, from: localToday(), to: localToday(), includeRefused: true, pageSize: 12 }, true);

  const scan = useAct((a: { ref: string; override: boolean }) => fitnessApi.checkIn(a.ref, branchId, a.override), undefined, ["visits", "occupancy", "members", "member"]);
  const out = useAct((id: string) => fitnessApi.checkOut(id), undefined, ["visits", "occupancy"]);
  const outAll = useAct<void, number>(() => fitnessApi.checkOutAll(branchId), "Everyone checked out.", ["visits", "occupancy"]);

  const submit = (ref: string, override = false) => {
    const r = ref.trim();
    if (!r || !branchId) return;
    setLastRef(r);
    scan.mutate({ ref: r, override }, { onSuccess: d => { setResult(d); setCode(""); inputRef.current?.focus(); } });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Front desk" description="Scan a card or type a member number or phone to check someone in.">
        {branches.length > 1 && <select className={cn(SELECT, "w-auto")} value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <Can permission="fitness.checkin.create"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setGuest(true)}><UserPlus className="h-4 w-4" />Guest</Button></Can>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="In the gym now" value={mine?.inGym ?? 0} sub={mine?.capacity ? `of ${mine.capacity}` : undefined} tone={mine?.capacity && mine.inGym >= mine.capacity ? "bad" : undefined} />
        <Stat label="Visits today" value={mine?.visitsToday ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <Can permission="fitness.checkin.create">
            <Card className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input ref={inputRef} autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Member no. / phone / scan…" className="h-11 text-base"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(code); } }} />
                <Button className="h-11 px-6" disabled={scan.isPending || !code.trim() || !branchId} onClick={() => submit(code)}>
                  {scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in"}
                </Button>
              </div>
              {scan.error && <p className="text-sm text-destructive">{(scan.error as Error).message}</p>}
            </Card>
          </Can>
          {result && <Result r={result} overriding={scan.isPending} onOverride={() => submit(lastRef, true)} />}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm flex items-center gap-2"><DoorOpen className="h-4 w-4" />In the gym ({inside?.total ?? 0})</p>
            <Can permission="fitness.checkin.edit">{(inside?.total ?? 0) > 0 && <Button size="sm" variant="outline" disabled={outAll.isPending} onClick={() => outAll.mutate()}>Check everyone out</Button>}</Can>
          </div>
          <TableState loading={isLoading} error={error as Error | null} empty={(inside?.items.length ?? 0) === 0} emptyText="Nobody checked in." icon={DoorOpen} />
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {(inside?.items ?? []).map(v => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div><p className="font-medium">{v.isGuest ? `${v.guestName} (guest of ${v.memberName})` : v.memberName}</p>
                  <p className="text-xs text-muted-foreground">since {new Date(v.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>
                <Can permission="fitness.checkin.create"><Button size="sm" variant="ghost" className="gap-1" disabled={out.isPending} onClick={() => out.mutate(v.id)}><LogOut className="h-3.5 w-3.5" />Out</Button></Can>
              </div>))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <p className="px-4 py-3 border-b border-border font-semibold text-sm">Today's scans</p>
        <table className="w-full text-sm"><thead className="text-xs text-muted-foreground bg-muted/30"><tr><th className={TH}>Time</th><th className={TH}>Member</th><th className={TH}>Result</th></tr></thead>
          <tbody className="divide-y divide-border">{(recent?.items ?? []).map(v => (
            <tr key={v.id}><td className="px-4 py-2">{new Date(v.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td className="px-4 py-2">{v.memberName}</td>
              <td className={cn("px-4 py-2", v.allowed ? "text-emerald-600" : "text-red-600")}>{v.allowed ? (v.method === "override" ? "In (override)" : "In") : v.denyReason}</td></tr>))}</tbody></table>
      </Card>
      <AnimatePresence>{guest && <GuestModal branchId={branchId} onClose={() => setGuest(false)} />}</AnimatePresence>
    </div>
  );
}
