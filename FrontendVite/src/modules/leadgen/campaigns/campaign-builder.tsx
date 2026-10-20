import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MERGE_FIELDS, type CampaignDto, type CampaignInput, type StepInput } from "@/lib/leadgen/leadgen.api";
import { useCreateCampaign, useMailboxes, useMeta, useUpdateCampaign } from "@/hooks/leadgen/use-leadgen";
import { Banner, Field, Modal, SELECT, TEXTAREA } from "../shared/ui";

const ZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat", "Asia/Karachi", "Asia/Kolkata", "Europe/London", "America/New_York", "America/Toronto", "Australia/Sydney", "UTC"];
const MAX_STEPS = 6;

const STARTER: StepInput[] = [
  {
    delayDays: 0, subject: "Quick question for {{business_name}}",
    body: "Hello,\n\nI came across {{business_name}} in {{area}} and wanted to reach out.\n\n[In one or two sentences: what you do and the specific result you help {{category}} businesses get.]\n\nWould it be worth a short call this week?\n\nBest regards,\n{{sender_name}}",
  },
  {
    delayDays: 3, subject: "Re: Quick question for {{business_name}}",
    body: "Hello,\n\nFollowing up in case my note got buried. [One concrete detail or example that makes the offer easier to picture.]\n\nIf now is not the right time, just let me know and I will not follow up again.\n\nBest regards,\n{{sender_name}}",
  },
];

/** ISO weekday number (1 = Monday) → a short name in the viewer's language. */
const dayName = (iso: number, locale: string) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, iso));

export function CampaignBuilder({ campaign, onClose, onSaved }: { campaign?: CampaignDto; onClose: () => void; onSaved?: (c: CampaignDto) => void }) {
  const { t, i18n } = useTranslation("leadgen");
  const meta = useMeta();
  const mailboxes = useMailboxes();
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const usable = (mailboxes.data ?? []).filter(m => m.status === "connected" || m.id === campaign?.mailboxId);

  const country = meta.data?.countries.find(c => c.code === meta.data?.defaultCountry);
  const [f, setF] = React.useState<CampaignInput>(() => campaign ? {
    name: campaign.name, mailboxId: campaign.mailboxId, timeZoneId: campaign.timeZoneId, windowStart: campaign.windowStart,
    windowEnd: campaign.windowEnd, sendDays: campaign.sendDays, dailyCap: campaign.dailyCap, stopOnReply: campaign.stopOnReply,
    steps: campaign.steps.map(s => ({ delayDays: s.delayDays, subject: s.subject, body: s.body })),
  } : {
    name: "", mailboxId: "", timeZoneId: "Asia/Dubai", windowStart: "09:00", windowEnd: "17:00", sendDays: "1,2,3,4,5",
    dailyCap: 40, stopOnReply: true, steps: STARTER,
  });
  const [active, setActive] = React.useState(0);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  // New campaigns start on the first usable mailbox and in the country's own time zone and working week.
  React.useEffect(() => {
    if (campaign) return;
    setF(p => ({
      ...p,
      mailboxId: p.mailboxId || usable[0]?.id || "",
      timeZoneId: country && p.timeZoneId === "Asia/Dubai" ? country.timezone : p.timeZoneId,
      sendDays: country && p.sendDays === "1,2,3,4,5" ? country.workingDays.join(",") : p.sendDays,
    }));
  }, [usable[0]?.id, country?.code]);  // eslint-disable-line react-hooks/exhaustive-deps

  const days = new Set(f.sendDays.split(",").filter(Boolean).map(Number));
  const toggleDay = (d: number) => {
    const n = new Set(days); n.has(d) ? n.delete(d) : n.add(d);
    setF({ ...f, sendDays: [...n].sort().join(",") });
  };
  const setStep = (i: number, patch: Partial<StepInput>) => setF({ ...f, steps: f.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const insertField = (field: string) => {
    const ta = bodyRef.current; const step = f.steps[active]; if (!step) return;
    const token = `{{${field}}}`;
    const start = ta?.selectionStart ?? step.body.length; const end = ta?.selectionEnd ?? start;
    setStep(active, { body: step.body.slice(0, start) + token + step.body.slice(end) });
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(start + token.length, start + token.length); });
  };

  const stepErrors = f.steps.map(s => !s.subject.trim() || !s.body.trim());
  const valid = f.name.trim() && f.mailboxId && f.sendDays && f.windowEnd > f.windowStart && !stepErrors.some(Boolean) && f.steps.length > 0;
  const pending = create.isPending || update.isPending;
  const save = () => {
    const done = (c: CampaignDto) => { onSaved?.(c); onClose(); };
    if (campaign) update.mutate({ id: campaign.id, input: f }, { onSuccess: done });
    else create.mutate(f, { onSuccess: done });
  };
  const step = f.steps[active];

  return (
    <Modal size="xl" onClose={onClose} title={campaign ? t("builder.editTitle") : t("builder.newTitle")}
      footer={<>
        <Button variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
        <Button disabled={!valid || pending} className="gap-2" onClick={save}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{t("action.save")}</Button>
      </>}>
      {usable.length === 0 && <Banner tone="warn">{t("builder.noMailbox")}</Banner>}

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Field label={t("builder.name")}><Input value={f.name} maxLength={120} onChange={e => setF({ ...f, name: e.target.value })} autoFocus placeholder={t("builder.namePlaceholder")} /></Field>
          <Field label={t("builder.mailbox")} hint={t("builder.mailboxHint")}>
            <select className={SELECT} value={f.mailboxId} onChange={e => setF({ ...f, mailboxId: e.target.value })}>
              <option value="">—</option>
              {usable.map(m => <option key={m.id} value={m.id}>{m.address}</option>)}
            </select>
          </Field>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-xs font-bold">{t("builder.schedule")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("builder.from")}><Input type="time" value={f.windowStart} onChange={e => setF({ ...f, windowStart: e.target.value })} /></Field>
              <Field label={t("builder.to")}><Input type="time" value={f.windowEnd} onChange={e => setF({ ...f, windowEnd: e.target.value })} /></Field>
            </div>
            {f.windowEnd <= f.windowStart && <p className="text-xs text-destructive" role="alert">{t("builder.windowError")}</p>}
            <Field label={t("builder.timezone")}>
              <select className={SELECT} value={f.timeZoneId} onChange={e => setF({ ...f, timeZoneId: e.target.value })}>
                {[...new Set([f.timeZoneId, ...ZONES])].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>
            <Field label={t("builder.days")}>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <button key={d} type="button" aria-pressed={days.has(d)} onClick={() => toggleDay(d)}
                    className={cn("px-2.5 py-1 rounded-md border text-xs font-medium", days.has(d) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
                    {dayName(d, i18n.language)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t("builder.dailyCap")} hint={t("builder.dailyCapHint", { max: meta.data?.limits.maxDailySendsPerMailbox ?? 50 })}>
              <Input type="number" min={1} max={500} value={f.dailyCap} onChange={e => setF({ ...f, dailyCap: Math.max(1, Math.min(500, parseInt(e.target.value || "1", 10) || 1)) })} />
            </Field>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1" checked={f.stopOnReply} onChange={e => setF({ ...f, stopOnReply: e.target.checked })} />
              <span><span className="font-medium">{t("builder.stopOnReply")}</span><span className="block text-xs text-muted-foreground">{t("builder.stopOnReplyHint")}</span></span>
            </label>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {f.steps.map((_, i) => (
              <button key={i} type="button" onClick={() => setActive(i)}
                className={cn("px-3 py-1.5 rounded-md border text-xs font-semibold", active === i ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border", stepErrors[i] && active !== i && "border-destructive text-destructive")}>
                {t("builder.emailN", { n: i + 1 })}
              </button>
            ))}
            {f.steps.length < MAX_STEPS && (
              <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => {
                setF({ ...f, steps: [...f.steps, { delayDays: 4, subject: `Re: ${f.steps[0]?.subject.replace(/^re:\s*/i, "") ?? ""}`, body: "" }] });
                setActive(f.steps.length);
              }}><Plus className="h-3.5 w-3.5" />{t("builder.addEmail")}</Button>
            )}
          </div>

          {step && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-end gap-3">
                {active > 0 ? (
                  <Field label={t("builder.waitDays")} className="w-36">
                    <Input type="number" min={0} max={60} value={step.delayDays} onChange={e => setStep(active, { delayDays: Math.max(0, Math.min(60, parseInt(e.target.value || "0", 10) || 0)) })} />
                  </Field>
                ) : <p className="text-xs text-muted-foreground pb-2">{t("builder.firstEmail")}</p>}
                {f.steps.length > 1 && (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive ms-auto gap-1" onClick={() => { setF({ ...f, steps: f.steps.filter((_, k) => k !== active) }); setActive(Math.max(0, active - 1)); }}>
                    <Trash2 className="h-3.5 w-3.5" />{t("builder.removeEmail")}
                  </Button>
                )}
              </div>
              <Field label={t("builder.subject")} error={!step.subject.trim() ? t("builder.required") : null}>
                <Input value={step.subject} maxLength={200} onChange={e => setStep(active, { subject: e.target.value })} />
              </Field>
              <Field label={t("builder.body")} error={!step.body.trim() ? t("builder.required") : null}>
                <textarea ref={bodyRef} className={cn(TEXTAREA, "min-h-[220px] font-mono text-[13px]")} value={step.body} maxLength={8000} onChange={e => setStep(active, { body: e.target.value })} />
              </Field>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("builder.mergeHint")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {MERGE_FIELDS.map(m => (
                    <button key={m} type="button" onClick={() => insertField(m)} className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono hover:bg-muted/70">{`{{${m}}}`}</button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("builder.footerNote")}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
