import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Dumbbell, Plus, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/components/auth/can";
import { cn, formatDate } from "@/lib/utils";
import { fitnessApi, localToday, type ProgramDto } from "@/lib/fitness/fitness.api";
import { useAct, usePrograms, useTrainers } from "@/hooks/fitness/use-fitness";
import { ConfirmDialog, Field, LABEL, Modal, SELECT, TEXTAREA, TableState, orUndef } from "../../shared/ui";

// A program is a list of blocks: a workout day ("Day 1 - Push") or a diet meal ("Breakfast"), each with free text lines.
interface Block { label: string; text: string }

function parseItems(json: string): Block[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(b => ({ label: String(b?.label ?? ""), text: String(b?.text ?? "") })) : [];
  } catch { return []; }
}

const TYPE_LABEL: Record<string, string> = { workout: "Workout plan", diet: "Diet plan" };

function ProgramForm({ program, memberId, isTemplate, onClose }: {
  program?: ProgramDto; memberId?: string; isTemplate: boolean; onClose: () => void;
}) {
  const { data: trainers = [] } = useTrainers(true);
  const [type, setType] = React.useState(program?.type ?? "workout");
  const [name, setName] = React.useState(program?.name ?? "");
  const [goal, setGoal] = React.useState(program?.goal ?? "");
  const [level, setLevel] = React.useState(program?.level ?? "");
  const [weeks, setWeeks] = React.useState(program?.weeks ? String(program.weeks) : "");
  const [description, setDescription] = React.useState(program?.description ?? "");
  const [trainerId, setTrainerId] = React.useState(program?.trainerId ?? "");
  const [startDate, setStartDate] = React.useState(program?.startDate ?? localToday());
  const [blocks, setBlocks] = React.useState<Block[]>(program ? parseItems(program.itemsJson) : [{ label: type === "diet" ? "Breakfast" : "Day 1", text: "" }]);
  const save = useAct((b: Record<string, unknown>) => fitnessApi.saveProgram(program?.id ?? null, b), "Program saved.", ["programs"]);
  const setBlock = (i: number, patch: Partial<Block>) => setBlocks(bs => bs.map((b, k) => k === i ? { ...b, ...patch } : b));
  const valid = name.trim().length > 0;

  return (
    <Modal size="lg" title={program ? `Edit ${program.name}` : isTemplate ? "New template" : "New program"} onClose={onClose}
      footer={<><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate({
          type, name: name.trim(), goal: orUndef(goal), level: orUndef(level), weeks: weeks ? Math.max(1, parseInt(weeks, 10) || 1) : undefined,
          description: orUndef(description), itemsJson: JSON.stringify(blocks.filter(b => b.label.trim() || b.text.trim())),
          memberId: isTemplate ? undefined : memberId, trainerId: orUndef(trainerId), startDate: isTemplate ? undefined : orUndef(startDate), isActive: true,
        }, { onSuccess: onClose })}>Save</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Type"><select className={SELECT} value={type} onChange={e => setType(e.target.value)} disabled={!!program}>
          <option value="workout">Workout plan</option><option value="diet">Diet plan</option></select></Field>
        <Field label="Name"><Input value={name} onChange={e => setName(e.target.value)} className="h-9" placeholder={type === "diet" ? "e.g. Lean bulk, 2,800 kcal" : "e.g. Beginner full body"} /></Field>
        <Field label="Goal"><Input value={goal} onChange={e => setGoal(e.target.value)} className="h-9" /></Field>
        <Field label="Level"><select className={SELECT} value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">Any</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
        <Field label="Weeks"><Input type="number" min={1} value={weeks} onChange={e => setWeeks(e.target.value)} className="h-9" /></Field>
        <Field label="Coach"><select className={SELECT} value={trainerId} onChange={e => setTrainerId(e.target.value)}>
          <option value="">—</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        {!isTemplate && <Field label="Starts on"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" /></Field>}
      </div>
      <Field label="Notes" className="mt-3"><textarea className={TEXTAREA} value={description} onChange={e => setDescription(e.target.value)} /></Field>

      <p className={cn(LABEL, "mt-4 mb-2")}>{type === "diet" ? "Meals" : "Training days"}</p>
      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex gap-2">
              <Input value={b.label} onChange={e => setBlock(i, { label: e.target.value })} className="h-9" placeholder={type === "diet" ? "Meal, e.g. Lunch" : "Day, e.g. Day 2 — Legs"} />
              <button type="button" className="px-2 text-red-600" aria-label="Remove" onClick={() => setBlocks(bs => bs.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></button>
            </div>
            <textarea className={TEXTAREA} value={b.text} onChange={e => setBlock(i, { text: e.target.value })}
              placeholder={type === "diet" ? "One item per line, e.g. 150 g chicken breast" : "One exercise per line, e.g. Squat 4 x 8"} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBlocks(bs => [...bs, { label: "", text: "" }])}><Plus className="h-3.5 w-3.5" />Add {type === "diet" ? "meal" : "day"}</Button>
      </div>
    </Modal>
  );
}

function ProgramCard({ p, onEdit, onDelete, extra }: { p: ProgramDto; onEdit: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  const blocks = parseItems(p.itemsJson);
  const Icon = p.type === "diet" ? Utensils : Dumbbell;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground">{[TYPE_LABEL[p.type], p.level, p.weeks ? `${p.weeks} weeks` : null, p.trainerName, p.startDate ? `from ${formatDate(p.startDate)}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <Can permission="fitness.members.edit">
          <div className="flex gap-2 text-xs shrink-0">{extra}<button className="text-primary" onClick={onEdit}>Edit</button><button className="text-red-600" onClick={onDelete}>Delete</button></div>
        </Can>
      </div>
      {p.goal && <p className="text-sm">{p.goal}</p>}
      {blocks.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {blocks.map((b, i) => (
            <div key={i} className="rounded-lg bg-muted/40 p-2.5"><p className="text-xs font-semibold">{b.label || "—"}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{b.text}</p></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Templates (no memberId) or one member's programs (with "Use a template"). */
export function ProgramsPanel({ memberId }: { memberId?: string }) {
  const isTemplate = !memberId;
  const { data = [], isLoading, error } = usePrograms(isTemplate ? { templatesOnly: true } : { memberId });
  const { data: templates = [] } = usePrograms({ templatesOnly: true }, !isTemplate);
  const [editing, setEditing] = React.useState<ProgramDto | "new" | null>(null);
  const [toDelete, setToDelete] = React.useState<ProgramDto | null>(null);
  const [picking, setPicking] = React.useState(false);
  const del = useAct((id: string) => fitnessApi.deleteProgram(id), "Program deleted.", ["programs"]);
  const assign = useAct((a: { id: string }) => fitnessApi.assignProgram(a.id, { memberId: memberId!, startDate: localToday() }), "Program assigned.", ["programs"]);

  return (
    <div className="space-y-3">
      <Can permission="fitness.members.edit">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" />{isTemplate ? "New template" : "New program"}</Button>
          {!isTemplate && <Button size="sm" variant="outline" onClick={() => setPicking(true)} disabled={templates.length === 0}>Use a template</Button>}
        </div>
      </Can>
      <TableState loading={isLoading} error={error as Error | null} empty={data.length === 0}
        emptyText={isTemplate ? "No templates yet. Make one once, then give it to any member." : "No programs for this member yet."} icon={Dumbbell} />
      <div className="space-y-3">{data.map(p => <ProgramCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => setToDelete(p)} />)}</div>

      <AnimatePresence>
        {editing && <ProgramForm key="f" program={editing === "new" ? undefined : editing} memberId={memberId} isTemplate={isTemplate} onClose={() => setEditing(null)} />}
        {picking && (
          <Modal key="p" size="md" title="Use a template" onClose={() => setPicking(false)}>
            <div className="space-y-2">{templates.map(t => (
              <button key={t.id} className="w-full text-start rounded-lg border border-border p-3 hover:bg-muted/40" disabled={assign.isPending}
                onClick={() => assign.mutate({ id: t.id }, { onSuccess: () => setPicking(false) })}>
                <p className="font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{TYPE_LABEL[t.type]}{t.goal ? ` · ${t.goal}` : ""}</p></button>))}</div>
          </Modal>
        )}
        {toDelete && <ConfirmDialog key="d" title="Delete this program?" body={`"${toDelete.name}" will be removed.`} confirmLabel="Delete" pending={del.isPending}
          onConfirm={() => del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })} onClose={() => setToDelete(null)} />}
      </AnimatePresence>
    </div>
  );
}
