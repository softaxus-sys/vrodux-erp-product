import * as React from "react";
import { motion } from "framer-motion";
import {
  X, Loader2, Plus, Zap, ShieldCheck, Play, Pencil, Trash2, ChevronLeft,
  Clock, CheckCircle2, XCircle, AlertTriangle, Power, PowerOff, Bot, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  useAutomations, useAutomation, useAiAgents, useCreateAutomation, useUpdateAutomation,
  useToggleAutomation, useDeleteAutomation, useRunAutomationNow, useResolveAutomationRun,
} from "@/hooks/ai/use-ai";
import { useUsers } from "@/hooks/identity/use-users";
import { useAuthStore } from "@/store/auth.store";
import type {
  AutomationRuleSummaryDto, AutomationRunDto,
  AiRuleFrequency, AiRuleMode, SaveAutomationRulePayload,
} from "@/lib/ai/ai.api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREQUENCIES: { value: AiRuleFrequency; label: string }[] = [
  { value: "interval", label: "Every N minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

// ── Modal shell ────────────────────────────────────────────────────────────────

export function AutomationsModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = React.useState<"list" | "form">("list");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const openCreate = () => { setEditingId(null); setView("form"); };
  const openEdit = (id: string) => { setEditingId(id); setView("form"); };
  const backToList = () => { setView("list"); setEditingId(null); };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl flex flex-col max-h-[85vh]"
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold flex items-center gap-2">
            {view === "form" && (
              <button onClick={backToList} className="text-muted-foreground hover:text-foreground -ml-1">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Bot className="h-4 w-4 text-primary" />
            {view === "list" ? "Automations" : editingId ? "Edit automation" : "New automation"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {view === "list"
          ? <AutomationsList onCreate={openCreate} onEdit={openEdit} />
          : <AutomationForm editingId={editingId} onDone={backToList} />}
      </motion.div>
    </motion.div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

function AutomationsList({ onCreate, onEdit }: { onCreate: () => void; onEdit: (id: string) => void }) {
  const { data: rules, isLoading } = useAutomations(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<AutomationRuleSummaryDto | null>(null);

  const toggle = useToggleAutomation();
  const runNow = useRunAutomationNow();
  const del = useDeleteAutomation();

  return (
    <>
      <div className="p-4 overflow-y-auto space-y-2">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs text-muted-foreground">
            Scheduled tasks the assistant runs on its own, as a chosen user.
          </p>
          <Button size="sm" className="h-8 gap-1.5" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !rules || rules.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No automations yet. Create one to have the assistant run on a schedule.
          </div>
        ) : (
          rules.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-background/40">
              <div className="flex items-center gap-3 p-3">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  r.mode === "autopilot" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                  {r.mode === "autopilot" ? <Zap className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{r.name}</span>
                    {r.agentLabel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r.agentLabel}</span>}
                    {r.pendingCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                        {r.pendingCount} to approve
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" /> {r.scheduleLabel}
                    <span>·</span>
                    <span>as {r.runAsUserName}</span>
                    {r.enabled && r.nextRunAt && <><span>·</span><span>next {formatDate(r.nextRunAt)}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusDot status={r.lastStatus} />
                  <button title={r.enabled ? "Pause" : "Enable"}
                    onClick={() => toggle.mutate({ id: r.id, enabled: !r.enabled })}
                    className={cn("h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted",
                      r.enabled ? "text-emerald-500" : "text-muted-foreground")}>
                    {r.enabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                  </button>
                  <button title="Run now" disabled={runNow.isPending}
                    onClick={() => runNow.mutate(r.id)}
                    className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground">
                    {runNow.isPending && runNow.variables === r.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button title="Edit" onClick={() => onEdit(r.id)}
                    className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button title="Delete" onClick={() => setPendingDelete(r)}
                    className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {expandedId === r.id && <RuleHistory ruleId={r.id} />}
            </div>
          ))
        )}
      </div>

      {pendingDelete && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 rounded-2xl" onClick={() => setPendingDelete(null)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1">Delete automation?</p>
            <p className="text-xs text-muted-foreground mb-4">
              "{pendingDelete.name}" and its run history will be removed. This can't be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="h-8" disabled={del.isPending}
                onClick={() => del.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })}>
                {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusDot({ status }: { status: AutomationRunDto["status"] | null }) {
  if (!status) return <span className="h-2 w-2 rounded-full bg-muted-foreground/30" title="Never run" />;
  const map: Record<string, string> = {
    success: "bg-emerald-500", failed: "bg-destructive", pending_confirmation: "bg-amber-500",
    rejected: "bg-muted-foreground", running: "bg-blue-500",
  };
  return <span className={cn("h-2 w-2 rounded-full", map[status] ?? "bg-muted-foreground/30")} title={status} />;
}

// ── Rule run history (expanded) ────────────────────────────────────────────────

function RuleHistory({ ruleId }: { ruleId: string }) {
  const { data, isLoading } = useAutomation(ruleId);
  const resolve = useResolveAutomationRun();

  if (isLoading) return <div className="px-3 pb-3 pt-1 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const runs = data?.recentRuns ?? [];
  if (runs.length === 0) return <div className="px-3 pb-3 text-[11px] text-muted-foreground">No runs yet.</div>;

  return (
    <div className="border-t border-border px-3 py-2 space-y-2">
      {runs.map(run => (
        <div key={run.id} className="text-[11px]">
          <div className="flex items-center gap-2">
            <RunStatusIcon status={run.status} />
            <span className="text-muted-foreground">{formatDate(run.startedAt)}</span>
            <span className="text-muted-foreground">· {run.triggeredBy}</span>
            {run.toolsUsed && <span className="text-muted-foreground truncate">· {run.toolsUsed}</span>}
          </div>
          {run.summary && <p className="ml-5 mt-0.5 text-foreground/80 whitespace-pre-wrap line-clamp-4">{run.summary}</p>}
          {run.error && <p className="ml-5 mt-0.5 text-destructive">{run.error}</p>}
          {run.status === "pending_confirmation" && (
            <div className="ml-5 mt-1.5 flex gap-2">
              <Button size="sm" className="h-6 gap-1 text-[11px]" disabled={resolve.isPending}
                onClick={() => resolve.mutate({ runId: run.id, approve: true })}>
                <CheckCircle2 className="h-3 w-3" /> Approve{run.pendingToolName ? ` (${run.pendingToolName})` : ""}
              </Button>
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[11px]" disabled={resolve.isPending}
                onClick={() => resolve.mutate({ runId: run.id, approve: false })}>
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RunStatusIcon({ status }: { status: AutomationRunDto["status"] }) {
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (status === "pending_confirmation") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  if (status === "rejected") return <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
}

// ── Create / edit form ─────────────────────────────────────────────────────────

function AutomationForm({ editingId, onDone }: { editingId: string | null; onDone: () => void }) {
  const { data: existing, isLoading } = useAutomation(editingId);
  const { data: agents } = useAiAgents();
  const create = useCreateAutomation();
  const update = useUpdateAutomation();

  const meId = useAuthStore(s => s.user?.id ?? null);
  const meName = useAuthStore(s => s.user?.name ?? "Me");

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [agent, setAgent] = React.useState<string>("");
  const [instruction, setInstruction] = React.useState("");
  const [mode, setMode] = React.useState<AiRuleMode>("confirm");
  const [frequency, setFrequency] = React.useState<AiRuleFrequency>("daily");
  const [intervalMinutes, setIntervalMinutes] = React.useState(60);
  const [hourUtc, setHourUtc] = React.useState(8);
  const [minuteUtc, setMinuteUtc] = React.useState(0);
  const [dayOfWeekUtc, setDayOfWeekUtc] = React.useState(1);
  const [notifyTelegram, setNotifyTelegram] = React.useState(false);
  const [enabled, setEnabled] = React.useState(true);

  // Run-as user
  const [runAsUserId, setRunAsUserId] = React.useState<string | null>(null);
  const [runAsUserName, setRunAsUserName] = React.useState<string>("");
  const [userSearch, setUserSearch] = React.useState("");
  const { data: usersPage } = useUsers({ search: userSearch, pageSize: 8 });

  React.useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setDescription(existing.description ?? "");
    setAgent(existing.agent ?? "");
    setInstruction(existing.instruction);
    setMode(existing.mode);
    setFrequency(existing.frequency);
    setIntervalMinutes(existing.intervalMinutes ?? 60);
    setHourUtc(existing.hourUtc ?? 8);
    setMinuteUtc(existing.minuteUtc);
    setDayOfWeekUtc(existing.dayOfWeekUtc ?? 1);
    setNotifyTelegram(existing.notifyTelegram);
    setEnabled(existing.enabled);
    setRunAsUserId(existing.runAsUserId);
    setRunAsUserName(existing.runAsUserName);
  }, [existing]);

  const saving = create.isPending || update.isPending;
  const valid = name.trim().length > 0 && instruction.trim().length > 0;

  const buildPayload = (): SaveAutomationRulePayload => ({
    name: name.trim(),
    description: description.trim() || null,
    agent: agent || null,
    instruction: instruction.trim(),
    runAsUserId: runAsUserId ?? meId,
    runAsUserName: runAsUserId ? runAsUserName : meName,
    mode,
    frequency,
    intervalMinutes: frequency === "interval" ? intervalMinutes : null,
    hourUtc: frequency === "daily" || frequency === "weekly" ? hourUtc : null,
    minuteUtc,
    dayOfWeekUtc: frequency === "weekly" ? dayOfWeekUtc : null,
    notifyTelegram,
    enabled,
  });

  const submit = () => {
    if (!valid) return;
    const payload = buildPayload();
    if (editingId) update.mutate({ id: editingId, payload }, { onSuccess: onDone });
    else create.mutate(payload, { onSuccess: onDone });
  };

  if (editingId && isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 overflow-y-auto space-y-4">
      <Field label="Name">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning pipeline summary"
          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
      </Field>

      <Field label="Instruction" hint="What the assistant should do each run.">
        <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3}
          placeholder="e.g. Summarise today's new leads and flag any without an owner."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Agent scope">
          <select value={agent} onChange={e => setAgent(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm">
            <option value="">All modules</option>
            {(agents ?? []).map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={e => setMode(e.target.value as AiRuleMode)}
            className="w-full h-9 rounded-lg border border-border bg-card px-2 text-sm">
            <option value="confirm">Confirm — queue writes for approval</option>
            <option value="autopilot">Autopilot — run writes automatically</option>
          </select>
        </Field>
      </div>

      {/* Run as */}
      <Field label="Run as" hint="Tools run with this user's permissions and tenant access.">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-muted">{runAsUserId ? runAsUserName : `${meName} (you)`}</span>
            {runAsUserId && (
              <button className="text-primary hover:underline" onClick={() => { setRunAsUserId(null); setRunAsUserName(""); }}>
                reset to me
              </button>
            )}
          </div>
          <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users to run as…"
            className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs" />
          {userSearch && usersPage?.items && usersPage.items.length > 0 && (
            <div className="rounded-lg border border-border bg-card max-h-32 overflow-y-auto">
              {usersPage.items.map(u => (
                <button key={u.id} onClick={() => { setRunAsUserId(u.id); setRunAsUserName(u.fullName || u.username); setUserSearch(""); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex justify-between">
                  <span>{u.fullName || u.username}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Schedule */}
      <Field label="Schedule">
        <div className="flex flex-wrap items-center gap-2">
          <select value={frequency} onChange={e => setFrequency(e.target.value as AiRuleFrequency)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-sm">
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {frequency === "interval" && (
            <div className="flex items-center gap-1.5 text-sm">
              <input type="number" min={5} value={intervalMinutes}
                onChange={e => setIntervalMinutes(Math.max(5, Number(e.target.value) || 5))}
                className="h-9 w-20 rounded-lg border border-border bg-card px-2" />
              <span className="text-muted-foreground text-xs">minutes</span>
            </div>
          )}
          {frequency === "weekly" && (
            <select value={dayOfWeekUtc} onChange={e => setDayOfWeekUtc(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          )}
          {(frequency === "hourly" || frequency === "daily" || frequency === "weekly") && (
            <div className="flex items-center gap-1 text-sm">
              {frequency !== "hourly" && (
                <>
                  <input type="number" min={0} max={23} value={hourUtc}
                    onChange={e => setHourUtc(clamp(Number(e.target.value), 0, 23))}
                    className="h-9 w-14 rounded-lg border border-border bg-card px-2" />
                  <span className="text-muted-foreground">:</span>
                </>
              )}
              <input type="number" min={0} max={59} value={minuteUtc}
                onChange={e => setMinuteUtc(clamp(Number(e.target.value), 0, 59))}
                className="h-9 w-14 rounded-lg border border-border bg-card px-2" />
              <span className="text-muted-foreground text-xs ml-1">UTC</span>
            </div>
          )}
        </div>
      </Field>

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyTelegram} onChange={e => setNotifyTelegram(e.target.checked)} className="h-4 w-4 accent-primary" />
          <Send className="h-3.5 w-3.5 text-muted-foreground" /> Send the result to the run-as user's Telegram
        </label>
        {!editingId && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
            Enable immediately
          </label>
        )}
      </div>

      <Field label="Description (optional)">
        <input value={description} onChange={e => setDescription(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm" />
      </Field>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button size="sm" variant="outline" className="h-9" onClick={onDone}>Cancel</Button>
        <Button size="sm" className="h-9 gap-1.5" disabled={!valid || saving} onClick={submit}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {editingId ? "Save changes" : "Create automation"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return v < min ? min : v > max ? max : v;
}
