import * as React from "react";
import {
  Loader2, CheckCircle2, AlertCircle, ChevronDown, Send, RefreshCw, RotateCcw, Info, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  useMetaConversions, useMetaConversionEvents, useSaveMetaConversions, useVerifyMetaConversions,
  useSendMetaTestEvent, useCatchUpMetaConversions, useRetryFailedMetaConversions,
} from "@/hooks/crm/use-integrations";
import type { MetaConversionEvent } from "@/lib/crm/integrations.api";

/** What each CRM stage is called on screen, in funnel order. Keys are the CRM's own stage keys. */
const LEAD_STAGES: { key: string; label: string; hint: string }[] = [
  { key: "new",         label: "New lead",               hint: "A lead arrives from a Meta ad" },
  { key: "contacted",   label: "Contacted",              hint: "Your team reached the lead" },
  { key: "qualified",   label: "Qualified",              hint: "The lead is a real prospect" },
  { key: "converted",   label: "Became an opportunity",  hint: "You converted the lead into a deal" },
  { key: "unqualified", label: "Not a fit",              hint: "Marked unqualified" },
  { key: "lost",        label: "Lead lost",              hint: "Marked lost" },
];
const DEAL_STAGES: { key: string; label: string; hint: string }[] = [
  { key: "proposal",    label: "Proposal sent",          hint: "The deal reached proposal" },
  { key: "negotiation", label: "Negotiation",            hint: "The deal reached negotiation" },
  { key: "won",         label: "Deal won",               hint: "Closed won — sends the deal value" },
  { key: "lost",        label: "Deal lost",              hint: "Closed lost" },
];

const STATUS_STYLE: Record<MetaConversionEvent["status"], string> = {
  pending: "bg-amber-500/10 text-amber-600",
  sent:    "bg-success/10 text-success",
  failed:  "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
};

export function MetaConversionsTab({ integration, canEdit }: { integration: { id: string; status: string }; canEdit: boolean }) {
  const id = integration.id;
  const { data, isLoading } = useMetaConversions(id);
  const save = useSaveMetaConversions();
  const verify = useVerifyMetaConversions();
  const sendTest = useSendMetaTestEvent();
  const catchUp = useCatchUpMetaConversions();
  const retry = useRetryFailedMetaConversions();

  const [enabled, setEnabled] = React.useState(false);
  const [datasetId, setDatasetId] = React.useState("");
  const [token, setToken] = React.useState("");
  const [sendValue, setSendValue] = React.useState(true);
  const [callingCode, setCallingCode] = React.useState("");
  const [leadMap, setLeadMap] = React.useState<Record<string, string>>({});
  const [dealMap, setDealMap] = React.useState<Record<string, string>>({});
  const [testCode, setTestCode] = React.useState("");
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [catchUpMsg, setCatchUpMsg] = React.useState<string | null>(null);
  const [showGuide, setShowGuide] = React.useState(false);
  const [filter, setFilter] = React.useState<string | undefined>(undefined);
  const events = useMetaConversionEvents(id, filter);

  // Fill the form once per integration. Re-applying on every refetch (the tab polls) would overwrite
  // whatever the user is in the middle of typing.
  const loadedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!data || loadedFor.current === data.integrationId) return;
    loadedFor.current = data.integrationId;
    setEnabled(data.enabled);
    setDatasetId(data.datasetId ?? "");
    setSendValue(data.sendDealValue);
    setCallingCode(data.defaultCallingCode ?? "");
    setLeadMap({ ...data.leadEvents });
    setDealMap({ ...data.dealEvents });
    // First time here: show how to find the two values, since that is the only hard part.
    setShowGuide(!data.datasetId);
  }, [data]);

  if (isLoading || !data) {
    return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const configured = !!data.datasetId && data.hasToken;
  const hasProblem = !!data.lastError;
  const busy = save.isPending || verify.isPending;

  const handleSave = async () => {
    try {
      const saved = await save.mutateAsync({
        id,
        req: {
          enabled,
          datasetId: datasetId.trim() || null,
          accessToken: token.trim() || null,
          sendDealValue: sendValue,
          defaultCallingCode: callingCode.trim() || null,
          leadEvents: leadMap,
          dealEvents: dealMap,
        },
      });
      setToken("");
      // Check the pair straight away: a wrong token should be caught here, not found out a week later
      // when no events have arrived in Meta.
      if (saved.datasetId && saved.hasToken) {
        const v = await verify.mutateAsync(id);
        if (v.ok) toast.success(enabled ? `${v.message} Lead quality is now being sent.` : `${v.message} Saved.`);
        else toast.error(v.message);
      } else {
        toast.success("Saved.");
      }
    } catch { /* the hooks already toast the error */ }
  };

  const handleTest = async () => {
    setTestResult(null);
    const r = await sendTest.mutateAsync({ id, code: testCode.trim() }).catch(() => null);
    if (r) setTestResult(r);
  };

  const handleCatchUp = async () => {
    setCatchUpMsg(null);
    const r = await catchUp.mutateAsync({ id, days: 7 }).catch(() => null);
    if (!r) return;
    setCatchUpMsg(
      r.eventsQueued > 0
        ? `Queued ${r.eventsQueued} event(s) for ${r.leadsQueued} lead(s) from the last 7 days. They will be sent within a minute or two.`
        : r.alreadyTracked > 0
          ? "Nothing new to send — your recent leads are already being reported."
          : "No recent Meta leads needed reporting.");
  };

  const resetDefaults = () => { setLeadMap({ ...data.defaultLeadEvents }); setDealMap({ ...data.defaultDealEvents }); };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">Send lead quality back to Meta</h4>
          <p className="text-xs text-muted-foreground mt-1">
            When your team qualifies a lead or wins a deal, tell Meta. Its ads then learn which leads were
            good and find more people like them — instead of just more people who fill in forms.
          </p>
        </div>
      </div>

      <StatusBanner data={data} configured={configured} hasProblem={hasProblem} />

      {integration.status !== "connected" && (
        <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
          Meta Lead Ads is not connected on this integration yet, so no leads are arriving to report on.
          You can still set this up now.
        </p>
      )}

      {/* 1 — connect */}
      <Card step={1} title="Connect your Meta dataset">
        <p className="text-xs text-muted-foreground">
          Meta needs to know which dataset (your pixel) to send results to, and a token that lets us write to it.
        </p>
        <button type="button" onClick={() => setShowGuide(v => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Info className="h-3.5 w-3.5" /> Where do I find these?
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showGuide && "rotate-180")} />
        </button>
        {showGuide && (
          <ol className="mt-2 text-xs text-muted-foreground list-decimal ps-5 space-y-1 bg-muted/40 rounded-lg p-3">
            <li>Open <b>Meta Events Manager</b> and pick the <b>Data source</b> (dataset) your lead ads use.</li>
            <li>Copy its <b>Dataset ID</b> — the number shown under its name.</li>
            <li>Go to <b>Settings → Conversions API → Generate access token</b>, and copy the token.</li>
            <li>Paste both here and press <b>Save</b>. We check them with Meta straight away.</li>
          </ol>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="space-y-1">
            <span className="text-xs font-medium">Dataset ID</span>
            <Input value={datasetId} onChange={e => setDatasetId(e.target.value)} disabled={!canEdit}
              placeholder="e.g. 468275456140994" inputMode="numeric" className="h-9 text-sm font-mono" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Access token</span>
            <Input type="password" value={token} onChange={e => setToken(e.target.value)} disabled={!canEdit}
              autoComplete="off"
              placeholder={data.hasToken ? "Saved — paste a new one to replace" : "Paste the token"}
              className="h-9 text-sm font-mono" />
          </label>
        </div>
        {data.hasToken && (
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" /> A token is saved. It is stored encrypted and never shown again.
          </p>
        )}
      </Card>

      {/* 2 — what to send */}
      <Card step={2} title="Choose what to report">
        <p className="text-xs text-muted-foreground">
          Each CRM stage below is sent to Meta under the name you give it. Leave a name empty to send nothing for that stage.
        </p>

        <MapTable title="When a lead changes" rows={LEAD_STAGES} value={leadMap} defaults={data.defaultLeadEvents}
          onChange={(k, v) => setLeadMap(m => ({ ...m, [k]: v }))} disabled={!canEdit} />
        <MapTable title="When its deal changes" rows={DEAL_STAGES} value={dealMap} defaults={data.defaultDealEvents}
          onChange={(k, v) => setDealMap(m => ({ ...m, [k]: v }))} disabled={!canEdit} />

        <div className="flex items-start gap-2 text-xs bg-primary/5 rounded-lg p-3">
          <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <span className="text-muted-foreground">
            <b className="text-foreground">Tip:</b> in Ads Manager, choose one of these (usually <b>Qualified</b> or <b>Won</b>)
            as the result a campaign optimises for. Meta needs a steady flow of that event to learn from it.
          </span>
        </div>

        <label className="flex items-start gap-2 mt-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={sendValue} disabled={!canEdit}
            onChange={e => setSendValue(e.target.checked)} />
          <span>
            <span className="font-medium">Send the deal value with opportunity events</span>
            <span className="block text-xs text-muted-foreground">
              Lets Meta find people likely to spend more, not just more people. A won deal sends what it actually closed at.
            </span>
          </span>
        </label>

        <label className="block mt-3 space-y-1 max-w-xs">
          <span className="text-xs font-medium">Country code for numbers starting with 0 <span className="text-muted-foreground font-normal">(optional)</span></span>
          <Input value={callingCode} onChange={e => setCallingCode(e.target.value)} disabled={!canEdit}
            placeholder="971 for the UAE" className="h-9 text-sm font-mono" />
          <span className="text-[11px] text-muted-foreground block">
            Meta matches people on their phone number including the country code. Numbers from Meta forms already have it;
            this only completes ones typed locally.
          </span>
        </label>
      </Card>

      {/* 3 — switch on */}
      <Card step={3} title="Turn it on">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Send lead quality to Meta</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "Stage changes on Meta leads are sent automatically." : "Off — nothing is sent to Meta."}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={enabled} disabled={!canEdit}
            onClick={() => setEnabled(v => !v)}
            className={cn("relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-50",
              enabled ? "bg-primary" : "bg-muted-foreground/30")}>
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              enabled ? "start-[22px]" : "start-0.5")} />
          </button>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" disabled={busy} onClick={handleSave} className="gap-1.5">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save &amp; check connection
            </Button>
            <Button size="sm" variant="ghost" onClick={resetDefaults} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Reset names to recommended
            </Button>
          </div>
        )}
      </Card>

      {/* 4 — test */}
      <Card step={4} title="Test it (optional, recommended)">
        <p className="text-xs text-muted-foreground">
          Sends one sample of each event to Meta's <b>Test events</b> tab so you can see exactly what Meta receives.
          Nothing reaches your live data. In Events Manager open <b>Test events</b> and copy the code at the top.
        </p>
        <div className="flex gap-2 mt-3">
          <Input value={testCode} onChange={e => setTestCode(e.target.value)} disabled={!canEdit || !configured}
            placeholder="TEST12345" className="h-9 text-sm font-mono max-w-[200px]" />
          <Button size="sm" variant="outline" className="gap-1.5"
            disabled={!canEdit || !configured || !testCode.trim() || sendTest.isPending} onClick={handleTest}>
            {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send test events
          </Button>
        </div>
        {!configured && <p className="text-[11px] text-muted-foreground mt-1.5">Save your Dataset ID and token first.</p>}
        {testResult && (
          <p className={cn("text-xs mt-2 flex items-start gap-1.5", testResult.ok ? "text-success" : "text-destructive")}>
            {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            {testResult.message}
          </p>
        )}
      </Card>

      {/* activity */}
      <div className="space-y-3 pt-1">
        <h4 className="text-sm font-semibold">Activity</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Meta leads" value={data.metaLeads} />
          <Stat label="Sent (7 days)" value={data.stats.sentLast7Days} tone="success" />
          <Stat label="Waiting" value={data.stats.pending} tone={data.stats.pending > 0 ? "warn" : undefined} />
          <Stat label="Failed" value={data.stats.failed} tone={data.stats.failed > 0 ? "bad" : undefined} />
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!configured || !data.enabled || catchUp.isPending}
              onClick={handleCatchUp}
              title="Reports what happened to Meta leads from the last 7 days that were never reported">
              {catchUp.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Send last 7 days of leads
            </Button>
            {data.stats.failed > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={retry.isPending} onClick={() => retry.mutate(id)}>
                {retry.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Retry {data.stats.failed} failed
              </Button>
            )}
          </div>
        )}
        {catchUpMsg && <p className="text-xs text-muted-foreground">{catchUpMsg}</p>}
        {!data.enabled && (
          <p className="text-[11px] text-muted-foreground">
            Turn sending on to start. Leads that arrived before then can be reported with “Send last 7 days of leads” —
            Meta only accepts events from the last week.
          </p>
        )}

        <div className="flex gap-1 text-xs">
          {[undefined, "pending", "sent", "failed"].map(s => (
            <button key={s ?? "all"} onClick={() => setFilter(s)}
              className={cn("px-2.5 py-1 rounded-full border",
                filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s ? s[0].toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>

        <EventList items={events.data ?? []} loading={events.isLoading} />
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function StatusBanner({ data, configured, hasProblem }: {
  data: NonNullable<ReturnType<typeof useMetaConversions>["data"]>; configured: boolean; hasProblem: boolean;
}) {
  if (hasProblem) {
    return (
      <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Meta is not accepting events</p>
          <p className="text-muted-foreground mt-0.5">{data.lastError}</p>
          <p className="text-muted-foreground mt-0.5">Fix the details above and save — then use “Retry failed” to send what was missed.</p>
        </div>
      </div>
    );
  }
  if (!configured) {
    return (
      <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-muted-foreground">Not set up yet. It takes about two minutes — follow the steps below.</p>
      </div>
    );
  }
  if (data.enabled) {
    return (
      <div className="flex gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-success">
            Sending{data.datasetName ? ` to “${data.datasetName}”` : " to your Meta dataset"}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {data.lastSentAt ? `Last sent ${formatDate(data.lastSentAt, "relative")}.` : "Nothing sent yet — events go out as your team moves leads."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-muted-foreground">Connected{data.datasetName ? ` to “${data.datasetName}”` : ""}, but switched off. Turn it on in step 3.</p>
    </div>
  );
}

function Card({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h5 className="text-sm font-semibold flex items-center gap-2 mb-2">
        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] flex items-center justify-center">{step}</span>
        {title}
      </h5>
      {children}
    </section>
  );
}

function MapTable({ title, rows, value, defaults, onChange, disabled }: {
  title: string; rows: { key: string; label: string; hint: string }[];
  value: Record<string, string>; defaults: Record<string, string>;
  onChange: (key: string, v: string) => void; disabled: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium mb-1.5">{title}</p>
      <div className="rounded-lg border border-border divide-y divide-border">
        {rows.map(r => (
          <div key={r.key} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm">{r.label}</p>
              <p className="text-[11px] text-muted-foreground truncate">{r.hint}</p>
            </div>
            <Input value={value[r.key] ?? ""} onChange={e => onChange(r.key, e.target.value)} disabled={disabled}
              maxLength={100} placeholder="Don't send"
              title={defaults[r.key] ? `Recommended: ${defaults[r.key]}` : "Nothing is sent by default"}
              className="h-8 text-sm w-40 sm:w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warn" | "bad" }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className={cn("text-lg font-semibold tabular-nums",
        tone === "success" && "text-success", tone === "warn" && "text-amber-600", tone === "bad" && "text-destructive")}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EventList({ items, loading }: { items: MetaConversionEvent[]; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
      No events yet. They appear here as leads move through your pipeline.
    </p>;
  }
  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {items.map(e => (
        <div key={e.id} className="px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{e.leadName}</span>
            <span className="text-muted-foreground">→ {e.eventName}</span>
            {e.value != null && e.currency && (
              <span className="text-muted-foreground tabular-nums">{e.value.toLocaleString()} {e.currency}</span>
            )}
            <span className="ms-auto text-muted-foreground shrink-0">{formatDate(e.eventTime, "relative")}</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0", STATUS_STYLE[e.status])}>{e.status}</span>
          </div>
          {e.lastError && e.status !== "sent" && <p className="text-[11px] text-muted-foreground mt-1">{e.lastError}</p>}
        </div>
      ))}
    </div>
  );
}
