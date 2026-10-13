import * as React from "react";
import { ExternalLink, Loader2, MapPin, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CalendarEventDto, EventRequest } from "@/lib/calendar/calendar.api";
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from "@/hooks/calendar/use-calendar";
import { allDayUtc, eventLocalRange, localToUtc, toDateInput, toTimeInput } from "./calendar-dates";

/** Either an existing event, or a blank one starting on a clicked day. */
export type EventDraft = { event?: CalendarEventDto; date?: Date };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const label = "mb-1 block text-xs font-semibold text-muted-foreground";

function initial(draft: EventDraft) {
  if (draft.event) {
    const e = draft.event;
    const [s, en] = eventLocalRange(e);
    // An all-day end is exclusive, so the last day shown to the user is one before it.
    const lastDay = e.isAllDay ? new Date(en.getFullYear(), en.getMonth(), en.getDate() - 1) : en;
    return {
      title: e.title, description: e.description ?? "", location: e.location ?? "", allDay: e.isAllDay,
      startDate: toDateInput(s), startTime: e.isAllDay ? "09:00" : toTimeInput(s),
      endDate: toDateInput(lastDay), endTime: e.isAllDay ? "10:00" : toTimeInput(en),
      guests: e.attendees.map(a => a.email), addMeet: false,
    };
  }
  const base = draft.date ?? new Date();
  const d = toDateInput(base);
  // A click on a day starts at the next full hour if that day is today, otherwise 09:00.
  const now = new Date();
  const hour = toDateInput(now) === d ? Math.min(now.getHours() + 1, 22) : 9;
  const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return {
    title: "", description: "", location: "", allDay: false,
    startDate: d, startTime: h(hour), endDate: d, endTime: h(hour + 1), guests: [] as string[], addMeet: false,
  };
}

export function EventDialog({ draft, connected, onClose }: { draft: EventDraft; connected: boolean; onClose: () => void }) {
  const existing = draft.event;
  const readOnly = !!existing && !existing.canEdit;
  const [f, setF] = React.useState(() => initial(draft));
  const [guestText, setGuestText] = React.useState("");
  const [guestError, setGuestError] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const busy = create.isPending || update.isPending || remove.isPending;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));

  const startMs = f.allDay ? Date.parse(f.startDate) : new Date(`${f.startDate}T${f.startTime}`).getTime();
  const endMs = f.allDay ? Date.parse(f.endDate) : new Date(`${f.endDate}T${f.endTime}`).getTime();
  const rangeOk = Number.isFinite(startMs) && Number.isFinite(endMs) && (f.allDay ? endMs >= startMs : endMs > startMs);
  const valid = f.title.trim().length > 0 && rangeOk;

  const addGuests = (text: string) => {
    const parts = text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const bad = parts.find(p => !EMAIL.test(p));
    if (bad) { setGuestError(`"${bad}" is not a valid email address.`); return; }
    setGuestError("");
    setF(p => ({ ...p, guests: [...new Set([...p.guests, ...parts.map(x => x.toLowerCase())])] }));
    setGuestText("");
  };

  const submit = () => {
    if (!valid || busy) return;
    // Pending text in the guest box counts: people type an address and press Save without Enter.
    const pending = guestText.trim();
    if (pending && !EMAIL.test(pending)) { setGuestError(`"${pending}" is not a valid email address.`); return; }
    const guests = pending ? [...new Set([...f.guests, pending.toLowerCase()])] : f.guests;

    const req: EventRequest = {
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      location: f.location.trim() || undefined,
      isAllDay: f.allDay,
      startUtc: f.allDay ? allDayUtc(f.startDate) : localToUtc(f.startDate, f.startTime),
      endUtc: f.allDay ? allDayUtc(f.endDate, 1) : localToUtc(f.endDate, f.endTime),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      attendees: guests.map(email => ({ email })),
      addMeet: f.addMeet,
    };
    if (existing) update.mutate({ id: existing.id, request: req }, { onSuccess: onClose });
    else create.mutate(req, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Event" : existing ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {readOnly ? `Invitation${existing?.ownerName ? ` from ${existing.ownerName}` : ""}. Only the organiser can change it.`
              : connected ? "Saved here and on your Google Calendar." : "Saved to your Vrodux calendar."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={label}>Title</label>
            <Input autoFocus value={f.title} disabled={readOnly} maxLength={300} placeholder="e.g. Client kickoff"
              onChange={e => set("title", e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.allDay} disabled={readOnly} onChange={e => set("allDay", e.target.checked)} />
            All-day event
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Starts</label>
              <Input type="date" value={f.startDate} disabled={readOnly}
                onChange={e => setF(p => ({ ...p, startDate: e.target.value, endDate: p.endDate < e.target.value ? e.target.value : p.endDate }))} />
              {!f.allDay && <Input type="time" className="mt-1.5" value={f.startTime} disabled={readOnly} onChange={e => set("startTime", e.target.value)} />}
            </div>
            <div>
              <label className={label}>Ends</label>
              <Input type="date" value={f.endDate} min={f.startDate} disabled={readOnly} onChange={e => set("endDate", e.target.value)} />
              {!f.allDay && <Input type="time" className="mt-1.5" value={f.endTime} disabled={readOnly} onChange={e => set("endTime", e.target.value)} />}
            </div>
          </div>
          {!rangeOk && <p className="text-xs text-destructive">The event must end after it starts.</p>}

          <div>
            <label className={label}>Location</label>
            <Input value={f.location} disabled={readOnly} maxLength={300} placeholder="Office, address or link"
              onChange={e => set("location", e.target.value)} />
          </div>

          <div>
            <label className={label}>Guests</label>
            <div className="flex flex-wrap gap-1.5">
              {f.guests.map(g => (
                <span key={g} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                  {g}
                  {!readOnly && <button type="button" aria-label={`Remove ${g}`} onClick={() => set("guests", f.guests.filter(x => x !== g))}><X className="h-3 w-3" /></button>}
                </span>
              ))}
            </div>
            {!readOnly && (
              <Input className="mt-1.5" value={guestText} placeholder="Add an email, press Enter"
                onChange={e => { setGuestText(e.target.value); setGuestError(""); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addGuests(guestText); } }}
                onBlur={() => guestText.trim() && addGuests(guestText)} />
            )}
            {guestError && <p className="mt-1 text-xs text-destructive">{guestError}</p>}
            {!readOnly && !connected && f.guests.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Guests who use Vrodux see this on their calendar. Connect Google to also email invitations.</p>
            )}
          </div>

          <div>
            <label className={label}>Description</label>
            <textarea value={f.description} disabled={readOnly} rows={3} maxLength={4000}
              onChange={e => set("description", e.target.value)}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          {existing?.meetUrl ? (
            <a href={existing.meetUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              <Video className="h-4 w-4" />Join Google Meet<ExternalLink className="ms-auto h-3.5 w-3.5" />
            </a>
          ) : !readOnly && (
            <label className={cn("flex items-center gap-2 text-sm", !connected && "opacity-60")}>
              <input type="checkbox" checked={f.addMeet} disabled={!connected} onChange={e => set("addMeet", e.target.checked)} />
              <Video className="h-4 w-4 text-blue-600" />Add a Google Meet video link
              {!connected && <span className="text-xs text-muted-foreground">— connect Google first</span>}
            </label>
          )}

          {existing?.syncStatus === "error" && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Saved here, but not on Google: {existing.syncError ?? "sync failed"}. Use “Sync now” to retry.
            </p>
          )}
          {readOnly && existing?.location && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{existing.location}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {existing && !readOnly ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" disabled={busy}
                  onClick={() => remove.mutate(existing.id, { onSuccess: onClose })}>
                  {remove.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}Delete event
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="me-1.5 h-3.5 w-3.5" />Delete
              </Button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</Button>
            {!readOnly && (
              <Button onClick={submit} disabled={!valid || busy}>
                {(create.isPending || update.isPending) && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
                {existing ? "Save" : "Add event"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
