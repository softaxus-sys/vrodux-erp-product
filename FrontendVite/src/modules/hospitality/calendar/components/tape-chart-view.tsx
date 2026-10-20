import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/auth/can";
import { cn } from "@/lib/utils";
import { localToday, type TapeBookingDto } from "@/lib/hospitality/hospitality.api";
import { useTapeChart } from "@/hooks/hospitality/use-hospitality";
import { addDays, nightsBetween, dayLabel, bookingStatus, roomStatus, Empty } from "../../shared/hotel-ui";
import { BookingDrawer } from "../../bookings/components/booking-drawer";
import { NewBookingDrawer, type NewBookingPrefill } from "../../bookings/components/new-booking-drawer";

const DAY_W = 46;       // px per night column
const ROOM_W = 120;     // px for the sticky room column
const RANGES = [7, 14, 30];

/**
 * Rooms down the side, nights across the top. A stay is drawn from the middle of its arrival night
 * to the middle of its departure day, as hotels draw it, so a departure and an arrival on the same
 * day sit side by side in the cell instead of overlapping. Click an empty night to book it.
 */
export function TapeChartView() {
  const [from, setFrom] = React.useState(() => addDays(localToday(), -1));
  const [days, setDays] = React.useState(14);
  const { data, isLoading } = useTapeChart(from, days);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState<NewBookingPrefill | null>(null);
  const canBook = useCan("hospitality.bookings.create");
  const today = localToday();

  const dates = React.useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days]);
  const byRoom = React.useMemo(() => {
    const m = new Map<string, TapeBookingDto[]>();
    for (const b of data?.bookings ?? []) m.set(b.roomId, [...(m.get(b.roomId) ?? []), b]);
    return m;
  }, [data]);

  const offset = (date: string) => nightsBetween(from, date);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Room calendar</h1>
          <p className="text-sm text-muted-foreground">Who is in which room, night by night.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setFrom(f => addDays(f, -Math.max(7, Math.floor(days / 2))))} aria-label="Earlier"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
          <Button variant="outline" className="h-9" onClick={() => setFrom(addDays(today, -1))}>Today</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setFrom(f => addDays(f, Math.max(7, Math.floor(days / 2))))} aria-label="Later"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
          <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} className="h-9 px-2 rounded-lg border border-input bg-card text-sm" aria-label="Start date" />
          <div className="flex rounded-lg border border-border overflow-hidden">
            {RANGES.map(r => (
              <button key={r} onClick={() => setDays(r)} className={cn("px-3 h-9 text-sm", days === r ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{r}d</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["confirmed", "checked_in", "checked_out"] as const).map(s => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn("h-3 w-5 rounded", bookingStatus(s).bar)} />{bookingStatus(s).label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-[repeating-linear-gradient(45deg,hsl(var(--destructive)/0.35)_0_4px,transparent_4px_8px)]" />Out of order</span>
      </div>

      {isLoading && !data ? (
        <div className="h-72 rounded-xl bg-muted/40 animate-pulse" />
      ) : !data || data.rooms.length === 0 ? (
        <Empty icon={CalendarDays} title="No rooms yet" hint="Add room types and rooms under Rooms to see the calendar." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-auto max-h-[70dvh]">
          <div style={{ width: ROOM_W + days * DAY_W }} className="relative">
            {/* Header */}
            <div className="flex sticky top-0 z-20 bg-card border-b border-border">
              <div style={{ width: ROOM_W }} className="sticky start-0 z-30 bg-card border-e border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Room</div>
              {dates.map(d => {
                const isToday = d === today;
                const dow = new Date(d + "T00:00:00Z").getUTCDay();
                return (
                  <div key={d} style={{ width: DAY_W }} className={cn("text-center py-1.5 border-e border-border/60 shrink-0",
                    isToday && "bg-primary/10", (dow === 5 || dow === 6) && !isToday && "bg-muted/40")}>
                    <p className="text-[10px] text-muted-foreground leading-none">{dayLabel(d, { weekday: "short" })}</p>
                    <p className={cn("text-xs font-semibold", isToday && "text-primary")}>{dayLabel(d, { day: "numeric" })}</p>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {data.rooms.map(room => {
              const rs = roomStatus(room.status);
              return (
                <div key={room.id} className="flex relative border-b border-border/60 h-11">
                  <div style={{ width: ROOM_W }} className="sticky start-0 z-10 bg-card border-e border-border px-3 flex flex-col justify-center shrink-0">
                    <p className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", rs.dot)} title={rs.label} />{room.roomNumber}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{room.roomType}{room.housekeepingStatus === "dirty" ? " · dirty" : ""}</p>
                  </div>
                  {dates.map(d => (
                    <button key={d} style={{ width: DAY_W }} disabled={!canBook || room.status === "maintenance" || d < today}
                      onClick={() => setPrefill({ roomId: room.id, checkIn: d, checkOut: addDays(d, 1) })}
                      className={cn("shrink-0 border-e border-border/40 h-full", d === today && "bg-primary/5",
                        canBook && d >= today && room.status !== "maintenance" && "hover:bg-primary/10")}
                      aria-label={`Book room ${room.roomNumber} on ${d}`} />
                  ))}

                  {/* Out-of-order blocks */}
                  {data.blocks.filter(bl => bl.roomId === room.id).map(bl => {
                    const start = Math.max(0, offset(bl.fromDate));
                    const end = Math.min(days, offset(bl.toDate));
                    if (end <= 0 || start >= days) return null;
                    return (
                      <div key={bl.id} title={`Out of order: ${bl.reason}`}
                        style={{ insetInlineStart: ROOM_W + start * DAY_W, width: (end - start) * DAY_W }}
                        className="absolute top-1 bottom-1 rounded bg-[repeating-linear-gradient(45deg,hsl(var(--destructive)/0.25)_0_6px,transparent_6px_12px)] border border-destructive/30 flex items-center px-1.5 text-[10px] text-destructive pointer-events-none overflow-hidden">
                        <Wrench className="h-3 w-3 shrink-0 me-1" /><span className="truncate">{bl.reason}</span>
                      </div>
                    );
                  })}

                  {/* Stays */}
                  {(byRoom.get(room.id) ?? []).map(b => {
                    const start = offset(b.checkIn) + 0.5;
                    const end = offset(b.checkOut) + 0.5;
                    const s = Math.max(0, start), e = Math.min(days, end);
                    if (e <= 0 || s >= days) return null;
                    const st = bookingStatus(b.status);
                    return (
                      <button key={b.id} onClick={() => setOpenId(b.id)}
                        style={{ insetInlineStart: ROOM_W + s * DAY_W + 1, width: (e - s) * DAY_W - 2 }}
                        title={`${b.guestName} · ${b.bookingNumber} · ${b.checkIn} → ${b.checkOut}${b.balance > 0.005 ? " · balance due" : ""}`}
                        className={cn("absolute top-1.5 bottom-1.5 z-[5] rounded-md px-2 text-start text-[11px] font-medium truncate shadow-sm hover:ring-2 hover:ring-ring", st.bar,
                          start < 0 && "rounded-s-none", end > days && "rounded-e-none")}>
                        {b.guestName}{b.balance > 0.005 && <span className="ms-1 opacity-80">·$</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openId && <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />}
      {prefill && <NewBookingDrawer prefill={prefill} onClose={() => setPrefill(null)} onCreated={setOpenId} />}
    </div>
  );
}
