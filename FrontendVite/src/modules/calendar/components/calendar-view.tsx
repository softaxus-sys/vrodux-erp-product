import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, MapPin, Plus, RefreshCw, Users, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEventDto } from "@/lib/calendar/calendar.api";
import {
  useCalendarEvents, useConnectGoogle, useDisconnectGoogle, useGoogleConnection, useSyncGoogle,
} from "@/hooks/calendar/use-calendar";
import { EventDialog, type EventDraft } from "./event-dialog";
import { eventLocalRange, sameDay, startOfDay, fmtTime } from "./calendar-dates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first grid of 6 weeks that contains the whole month. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const chipColour = (e: CalendarEventDto) =>
  !e.canEdit ? "bg-muted text-muted-foreground border-border"
  : e.source === "google" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800";

export function CalendarView() {
  const [month, setMonth] = React.useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [mode, setMode] = React.useState<"month" | "agenda">("month");
  const [draft, setDraft] = React.useState<EventDraft | null>(null);
  const [params, setParams] = useSearchParams();

  const grid = React.useMemo(() => monthGrid(month), [month]);
  const from = grid[0];
  const to = new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate() + 1);
  const events = useCalendarEvents(from.toISOString(), to.toISOString());
  const connection = useGoogleConnection();
  const sync = useSyncGoogle();

  // Returning from Google's consent screen: run the first sync from an authenticated request (the
  // anonymous callback cannot write events), then drop the query string so a refresh doesn't repeat it.
  const handled = React.useRef(false);
  React.useEffect(() => {
    const g = params.get("google");
    if (!g || handled.current) return;
    handled.current = true;
    if (g === "connected") { toast.success("Google account connected."); sync.mutate(); }
    else toast.error("Google did not finish connecting. Please try again.");
    const next = new URLSearchParams(params); next.delete("google"); setParams(next, { replace: true });
  }, [params, setParams, sync]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEventDto[]>();
    for (const e of events.data ?? []) {
      const [s, en] = eventLocalRange(e);
      for (const day of grid) {
        const d0 = startOfDay(day).getTime();
        const d1 = d0 + 86_400_000;
        if (s.getTime() < d1 && en.getTime() > d0) {
          const k = day.toDateString();
          map.set(k, [...(map.get(k) ?? []), e]);
        }
      }
    }
    for (const list of map.values())
      list.sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || eventLocalRange(a)[0].getTime() - eventLocalRange(b)[0].getTime());
    return map;
  }, [events.data, grid]);

  const agenda = React.useMemo(() => {
    const now = startOfDay(new Date()).getTime();
    return [...(events.data ?? [])]
      .filter(e => eventLocalRange(e)[1].getTime() > now)
      .sort((a, b) => eventLocalRange(a)[0].getTime() - eventLocalRange(b)[0].getTime());
  }, [events.data]);

  const today = new Date();
  const title = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Calendar</h1>
            <p className="text-xs text-muted-foreground">Your meetings, in one place — including Google Calendar.</p>
          </div>
        </div>
        <Button onClick={() => setDraft({ date: new Date() })}><Plus className="me-1.5 h-4 w-4" />New event</Button>
      </div>

      <GoogleCard connection={connection.data} loading={connection.isLoading} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
          <Button variant="outline" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button>
          <h2 className="ms-2 text-lg font-semibold">{title}</h2>
          {events.isFetching && <Loader2 className="ms-1 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["month", "agenda"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1 font-medium capitalize transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{m}</button>
          ))}
        </div>
      </div>

      {events.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load your calendar. {(events.error as Error)?.message}
          <Button variant="outline" size="sm" className="ms-3" onClick={() => events.refetch()}>Retry</Button>
        </div>
      )}

      {mode === "month" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map(d => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(day => {
              const list = byDay.get(day.toDateString()) ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = sameDay(day, today);
              return (
                <div key={day.toISOString()}
                  onClick={() => setDraft({ date: day })}
                  className={cn("min-h-[104px] cursor-pointer border-b border-e border-border p-1.5 transition-colors hover:bg-muted/30",
                    !inMonth && "bg-muted/20")}>
                  <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/60")}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map(e => (
                      <button key={e.id} onClick={ev => { ev.stopPropagation(); setDraft({ event: e }); }}
                        className={cn("flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-start text-[11px] font-medium", chipColour(e))}>
                        {!e.isAllDay && <span className="shrink-0 opacity-70">{fmtTime(eventLocalRange(e)[0])}</span>}
                        <span className="truncate">{e.title}</span>
                      </button>
                    ))}
                    {list.length > 3 && <p className="px-1 text-[11px] font-medium text-muted-foreground">+{list.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <AgendaList events={agenda} onOpen={e => setDraft({ event: e })} loading={events.isLoading} />
      )}

      <Legend />
      {draft && <EventDialog draft={draft} connected={connection.data?.status === "connected"} onClose={() => setDraft(null)} />}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Created in Vrodux</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />From Google Calendar</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />Invitation — view only</span>
    </div>
  );
}

function AgendaList({ events, onOpen, loading }: { events: CalendarEventDto[]; onOpen: (e: CalendarEventDto) => void; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (events.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Nothing coming up in this period.
      </div>
    );
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {events.map(e => {
        const [s, en] = eventLocalRange(e);
        return (
          <button key={e.id} onClick={() => onOpen(e)} className="flex w-full items-start gap-4 p-3.5 text-start transition-colors hover:bg-muted/40">
            <div className="w-16 shrink-0 text-center">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">{s.toLocaleDateString(undefined, { month: "short" })}</p>
              <p className="text-xl font-bold leading-none">{s.getDate()}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {e.isAllDay ? "All day" : `${fmtTime(s)} – ${fmtTime(en)}`}
                {e.location && <span className="ms-3 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                {e.attendees.length > 0 && <span className="ms-3 inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.attendees.length}</span>}
              </p>
            </div>
            {e.meetUrl && <Video className="mt-1 h-4 w-4 shrink-0 text-blue-600" />}
          </button>
        );
      })}
    </div>
  );
}

function GoogleCard({ connection, loading }: { connection?: import("@/lib/calendar/calendar.api").ConnectionDto; loading: boolean }) {
  const connect = useConnectGoogle();
  const disconnect = useDisconnectGoogle();
  const sync = useSyncGoogle();
  const [confirm, setConfirm] = React.useState(false);

  if (loading || !connection) return null;

  if (connection.status === "disconnected")
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sync with Google Calendar</p>
          <p className="text-xs text-muted-foreground">
            {connection.configured
              ? "Meetings you add here appear in Google, and Google events appear here — no need to open both."
              : "Google Calendar is not set up on this server yet. Ask your administrator to add the Google client ID and secret."}
          </p>
        </div>
        <Button disabled={!connection.configured || connect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}Connect Google
        </Button>
      </div>
    );

  const failing = connection.status === "error";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
      failing ? "border-destructive/30 bg-destructive/5" : "border-border bg-card")}>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {failing ? "Google sync needs attention" : "Synced with Google Calendar"}
          {connection.accountEmail && <span className="ms-2 font-normal text-muted-foreground">{connection.accountEmail}</span>}
        </p>
        <p className={cn("text-xs", failing ? "text-destructive" : "text-muted-foreground")}>
          {failing ? connection.lastError ?? "Reconnect your Google account."
            : connection.lastSyncAt ? `Last synced ${new Date(connection.lastSyncAt).toLocaleString()}. Changes sync automatically every few minutes.` : "Waiting for the first sync."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {failing
          ? <Button onClick={() => connect.mutate()} disabled={connect.isPending}>Reconnect</Button>
          : <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={cn("me-1.5 h-4 w-4", sync.isPending && "animate-spin")} />Sync now
            </Button>}
        {confirm
          ? <>
              <Button variant="destructive" size="sm" disabled={disconnect.isPending}
                onClick={() => disconnect.mutate(undefined, { onSettled: () => setConfirm(false) })}>Disconnect</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancel</Button>
            </>
          : <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>Disconnect</Button>}
      </div>
    </div>
  );
}
