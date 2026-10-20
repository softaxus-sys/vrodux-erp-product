import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Coins, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { useAssignableByTeam } from "@/hooks/identity/use-assignable-by-team";
import type { AddRecipientsResult, ImportToCrmResult, RevealItemDto } from "@/lib/leadgen/leadgen.api";
import {
  useAddRecipients, useBulkProspects, useCampaigns, useCreateProspect, useMeta, useRevealProspects, useWallet,
} from "@/hooks/leadgen/use-leadgen";
import { Banner, Field, Modal, SELECT, StatTile, TEXTAREA } from "../shared/ui";

// ── Reveal ──────────────────────────────────────────────────────────────────

/**
 * Spends credits. It says what it may cost BEFORE anything is charged, works through the selection in
 * small batches so a big one shows progress instead of hanging, and reports exactly what happened —
 * including what was refunded because no usable contact could be found.
 */
export function RevealDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  const meta = useMeta();
  const wallet = useWallet();
  const reveal = useRevealProspects();

  const [phase, setPhase] = React.useState<"confirm" | "running" | "done">("confirm");
  const [progress, setProgress] = React.useState(0);
  const [items, setItems] = React.useState<RevealItemDto[]>([]);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [ranOut, setRanOut] = React.useState(false);

  const cost = meta.data?.limits.revealCost ?? 1;
  const bonus = meta.data?.limits.verifiedEmailBonus ?? 0;
  const maxBatch = Math.max(1, Math.min(10, meta.data?.limits.maxRevealsPerRequest ?? 10));
  const have = wallet.data?.balance ?? 0;
  const base = ids.length * cost;
  const most = ids.length * (cost + bonus);

  const run = async () => {
    setPhase("running"); setProgress(0); setItems([]);
    const all: RevealItemDto[] = [];
    for (let i = 0; i < ids.length; i += maxBatch) {
      const chunk = ids.slice(i, i + maxBatch);
      try {
        const res = await reveal.mutateAsync(chunk);
        all.push(...res.items); setBalance(res.balance);
        if (res.items.some(x => x.outcome === "insufficient_credits")) { setRanOut(true); break; }
      } catch {
        break;   // the hook already showed why; what finished is still reported below
      }
      setProgress(Math.min(ids.length, i + maxBatch));
      setItems([...all]);
    }
    setItems(all); setPhase("done"); onDone?.();
  };

  const revealed = items.filter(i => i.outcome === "revealed");
  const refunded = items.filter(i => i.outcome === "refunded");
  const skipped = items.filter(i => i.outcome === "skipped" || i.outcome === "not_found");
  const noCredit = items.filter(i => i.outcome === "insufficient_credits").length + (ranOut ? Math.max(0, ids.length - items.length) : 0);
  const spent = items.reduce((s, i) => s + i.credits, 0);

  return (
    <Modal size="md" onClose={phase === "running" ? () => undefined : onClose} title={t("reveal.title", { count: ids.length })}
      footer={phase === "confirm" ? (
        <>
          <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
          <Button className="gap-2" disabled={ids.length === 0 || have < cost} onClick={run}><Lock className="h-4 w-4" />{t("reveal.confirm", { count: ids.length })}</Button>
        </>
      ) : phase === "done" ? (
        <>
          {noCredit > 0 && <Can permission="leadgen.credits.view"><Button variant="outline" onClick={() => navigate("/lead-generation/credits")}>{t("reveal.buyCredits")}</Button></Can>}
          <Button onClick={onClose}>{t("action.done")}</Button>
        </>
      ) : undefined}>
      {phase === "confirm" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={t("reveal.youHave")} value={have} tone={have < cost ? "bad" : undefined} />
            <StatTile label={t("reveal.mostItCosts")} value={most} hint={t("reveal.costHint", { base, extra: most - base })} />
          </div>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc ps-5">
            <li>{t("reveal.rule1", { cost })}</li>
            <li>{t("reveal.rule2", { bonus })}</li>
            <li>{t("reveal.rule3")}</li>
            <li>{t("reveal.rule4", { days: meta.data?.limits.bounceRefundDays ?? 7 })}</li>
          </ul>
          {have < cost && <Banner tone="bad">{t("reveal.notEnough")}</Banner>}
          {have >= cost && have < base && <Banner tone="warn">{t("reveal.partial", { count: Math.floor(have / cost) })}</Banner>}
        </>
      )}

      {phase === "running" && (
        <div className="py-6 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-sm font-semibold mt-3">{t("reveal.working")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("reveal.progress", { done: progress, total: ids.length })}</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-4"><div className="h-full bg-primary transition-all" style={{ width: `${(progress / Math.max(1, ids.length)) * 100}%` }} /></div>
        </div>
      )}

      {phase === "done" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label={t("reveal.revealed")} value={revealed.length} tone={revealed.length > 0 ? "good" : undefined} />
            <StatTile label={t("reveal.refunded")} value={refunded.length} hint={t("reveal.refundedHint")} />
            <StatTile label={t("reveal.spent")} value={spent} hint={balance != null ? t("reveal.balanceNow", { count: balance }) : undefined} />
          </div>
          {noCredit > 0 && <Banner tone="warn">{t("reveal.ranOut", { count: noCredit })}</Banner>}
          {skipped.length > 0 && <p className="text-xs text-muted-foreground">{t("reveal.skipped", { count: skipped.length })}</p>}
          {refunded.length > 0 && <p className="text-xs text-muted-foreground">{t("reveal.refundNote", { count: refunded.length })}</p>}
        </>
      )}
    </Modal>
  );
}

// ── Add by hand ─────────────────────────────────────────────────────────────

export function AddProspectDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation("leadgen");
  const ar = i18n.language.startsWith("ar");
  const meta = useMeta();
  const create = useCreateProspect();
  const [f, setF] = React.useState({ name: "", category: "", region: "", city: "", address: "", phone: "", email: "", website: "", notes: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const country = meta.data?.countries.find(c => c.code === (meta.data?.defaultCountry ?? "AE"));
  const reachable = !!(f.phone.trim() || f.email.trim() || f.website.trim());

  return (
    <Modal onClose={onClose} title={t("prospects.addManual")} subtitle={t("prospects.addManualHint")}
      footer={<>
        <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={!f.name.trim() || !reachable || create.isPending} className="gap-2"
          onClick={() => create.mutate({ name: f.name, category: f.category || null, countryCode: country?.code ?? "AE", region: f.region || null, city: f.city || null,
            address: f.address || null, phone: f.phone || null, email: f.email || null, website: f.website || null, notes: f.notes || null }, { onSuccess: onClose })}>
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.add")}
        </Button>
      </>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("prospects.businessName")} className="sm:col-span-2"><Input value={f.name} onChange={set("name")} maxLength={200} autoFocus /></Field>
        <Field label={t("prospects.category")}>
          <select className={SELECT} value={f.category} onChange={set("category")}>
            <option value="">—</option>
            {(meta.data?.categories ?? []).map(c => <option key={c.key} value={c.key}>{ar ? c.labelAr : c.label}</option>)}
          </select>
        </Field>
        <Field label={t("prospects.region")}>
          <select className={SELECT} value={f.region} onChange={set("region")}>
            <option value="">—</option>
            {(country?.regions ?? []).map(r => <option key={r.name} value={r.name}>{ar ? r.nameAr : r.name}</option>)}
          </select>
        </Field>
        <Field label={t("prospects.phone")}><Input value={f.phone} onChange={set("phone")} placeholder="+971 50 123 4567" /></Field>
        <Field label={t("prospects.email")}><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label={t("prospects.website")} className="sm:col-span-2"><Input value={f.website} onChange={set("website")} placeholder="example.ae" /></Field>
        <Field label={t("prospects.address")} className="sm:col-span-2"><Input value={f.address} onChange={set("address")} /></Field>
        <Field label={t("prospects.notes")} className="sm:col-span-2"><textarea className={TEXTAREA} value={f.notes} onChange={set("notes")} /></Field>
      </div>
      {!reachable && f.name.trim() && <p className="text-xs text-amber-700 dark:text-amber-400">{t("prospects.needContact")}</p>}
    </Modal>
  );
}

// ── Add to campaign ─────────────────────────────────────────────────────────

export function AddToCampaignDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  const campaigns = useCampaigns();
  const add = useAddRecipients();
  const open = (campaigns.data ?? []).filter(c => c.status !== "completed" && c.status !== "stopped");
  const [campaignId, setCampaignId] = React.useState("");
  const [result, setResult] = React.useState<AddRecipientsResult | null>(null);

  React.useEffect(() => { if (!campaignId && open.length > 0) setCampaignId(open[0].id); }, [open.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  const skipped = result ? result.noEmail + result.notSendable + result.suppressed + result.duplicate + result.notRevealed : 0;

  return (
    <Modal onClose={onClose} size="md" title={t("addToCampaign.title", { count: ids.length })}
      footer={!result ? (
        <>
          <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
          <Button disabled={!campaignId || add.isPending} className="gap-2"
            onClick={() => add.mutate({ id: campaignId, prospectIds: ids }, { onSuccess: r => { setResult(r); onDone?.(); } })}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t("addToCampaign.add")}
          </Button>
        </>
      ) : <Button onClick={onClose}>{t("action.done")}</Button>}>
      {!result ? (
        open.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">{t("addToCampaign.none")}</p>
            <Can permission="leadgen.campaigns.create"><Button className="mt-3" onClick={() => navigate("/lead-generation/campaigns")}>{t("addToCampaign.create")}</Button></Can>
          </div>
        ) : (
          <>
            <Field label={t("addToCampaign.campaign")}>
              <select className={SELECT} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                {open.map(c => <option key={c.id} value={c.id}>{c.name} · {t(`status.${c.status}`)}</option>)}
              </select>
            </Field>
            <p className="text-xs text-muted-foreground">{t("addToCampaign.rules")}</p>
          </>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={t("addToCampaign.added")} value={result.added} tone={result.added > 0 ? "good" : undefined} />
            <StatTile label={t("addToCampaign.skipped")} value={skipped} />
          </div>
          {skipped > 0 && (
            <ul className="text-sm space-y-1.5 text-muted-foreground">
              {result.notRevealed > 0 && <li>• {t("addToCampaign.notRevealed", { count: result.notRevealed })}</li>}
              {result.noEmail > 0 && <li>• {t("addToCampaign.noEmail", { count: result.noEmail })}</li>}
              {result.notSendable > 0 && <li>• {t("addToCampaign.notSendable", { count: result.notSendable })}</li>}
              {result.suppressed > 0 && <li>• {t("addToCampaign.suppressed", { count: result.suppressed })}</li>}
              {result.duplicate > 0 && <li>• {t("addToCampaign.duplicate", { count: result.duplicate })}</li>}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

// ── Assign ──────────────────────────────────────────────────────────────────

export function AssignDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation("leadgen");
  // Scoped to people who can actually use Lead Generation: assigning to someone who cannot open the screen helps nobody.
  const { groups } = useAssignableByTeam(true, "leadgen");
  const bulk = useBulkProspects();
  const [value, setValue] = React.useState("");

  const flat = groups.flatMap(g => g.members);
  const chosen = flat.find(m => `${m.teamId ?? ""}::${m.id}` === value);

  return (
    <Modal onClose={onClose} size="sm" title={t("assign.title", { count: ids.length })}
      footer={<>
        <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={bulk.isPending} className="gap-2"
          onClick={() => bulk.mutate({ ids, action: "assign", ownerUserId: chosen?.id ?? null, ownerName: chosen?.fullName ?? null }, { onSuccess: () => { onDone?.(); onClose(); } })}>
          {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{chosen ? t("assign.assign") : t("assign.unassign")}
        </Button>
      </>}>
      <Field label={t("assign.to")} hint={t("assign.hint")}>
        <select className={SELECT} value={value} onChange={e => setValue(e.target.value)}>
          <option value="">{t("assign.nobody")}</option>
          {groups.map(g => (
            <optgroup key={g.team} label={g.team}>
              {g.members.map(m => <option key={`${g.team}-${m.id}`} value={`${m.teamId ?? ""}::${m.id}`}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

// ── CRM result ──────────────────────────────────────────────────────────────

export function CrmResultDialog({ result, onClose }: { result: ImportToCrmResult; onClose: () => void }) {
  const { t } = useTranslation("leadgen");
  const navigate = useNavigate();
  return (
    <Modal onClose={onClose} size="md" title={t("crm.resultTitle")}
      footer={<>
        {result.created > 0 && <Can permission="crm.leads.view"><Button variant="outline" onClick={() => navigate("/crm/leads")}>{t("crm.openLeads")}</Button></Can>}
        <Button onClick={onClose}>{t("action.done")}</Button>
      </>}>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t("crm.created")} value={result.created} tone={result.created > 0 ? "good" : undefined} />
        <StatTile label={t("crm.already")} value={result.duplicates} />
        <StatTile label={t("crm.failed")} value={result.failed} tone={result.failed > 0 ? "bad" : undefined} />
      </div>
      {result.notRevealed > 0 && <p className="text-sm text-muted-foreground">{t("crm.notRevealed", { count: result.notRevealed })}</p>}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-border p-3 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold mb-1.5">{t("crm.problems")}</p>
          <ul className="text-xs text-muted-foreground space-y-1">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" />{t("crm.free")}</p>
    </Modal>
  );
}
