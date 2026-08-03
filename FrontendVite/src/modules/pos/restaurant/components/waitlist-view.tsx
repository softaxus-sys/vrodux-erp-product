import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn } from "@/lib/utils";
import { Plus, X, Clock, Users, Phone, CheckCircle2, Ban, UserX, Loader2 } from "lucide-react";
import {
  useWaitlist, useWaitlistSummary, useAddToWaitlist, useSeatWaitlistEntry,
  useCancelWaitlistEntry, useNoShowWaitlistEntry, useTables,
} from "@/hooks/restaurant/use-restaurant";
import type { WaitlistEntry, WaitlistStatus } from "@/lib/restaurant/restaurant.api";
import { Can } from "@/components/auth/can";

const STATUS_FILTERS: { value: WaitlistStatus | "all"; label: string }[] = [
  { value: "waiting", label: "Waiting" },
  { value: "seated", label: "Seated" },
  { value: "no_show", label: "No-shows" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-2`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function WaitlistView() {
  const [filter, setFilter] = React.useState<WaitlistStatus | "all">("waiting");
  const { data: entries = [], isLoading } = useWaitlist(filter === "all" ? undefined : filter);
  const { data: summary } = useWaitlistSummary();
  const { data: tables = [] } = useTables();
  const addToWaitlist = useAddToWaitlist();
  const seat = useSeatWaitlistEntry();
  const cancel = useCancelWaitlistEntry();
  const noShow = useNoShowWaitlistEntry();

  const [showAdd, setShowAdd] = React.useState(false);
  const [seatingId, setSeatingId] = React.useState<string | null>(null);

  const availableTables = tables.filter(t => t.status === "available" && !t.mergedIntoTableId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Clock className="w-5 h-5" /> Waitlist</h1>
          <p className="text-sm text-muted-foreground">Walk-in parties waiting for a table.</p>
        </div>
        <Can permission="restaurant.tables.create">
          <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add Walk-in</Button>
        </Can>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={summary.total} />
          <StatCard label="Waiting" value={summary.waiting} accent="bg-amber-500" />
          <StatCard label="Seated" value={summary.seated} accent="bg-success" />
          <StatCard label="No-shows" value={summary.noShow} accent="bg-destructive" />
          <StatCard label="Avg Quoted Wait" value={`${Math.round(summary.averageQuotedWaitMinutes)}m`} />
        </div>
      )}

      <div className="flex gap-2 border-b border-border pb-2">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium",
              filter === f.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">No entries here.</div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <WaitlistRow key={e.id} entry={e}
              onSeat={() => setSeatingId(e.id)}
              onCancel={() => cancel.mutate(e.id)}
              onNoShow={() => noShow.mutate(e.id)} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddWalkInModal onClose={() => setShowAdd(false)}
          onCreate={(p) => { addToWaitlist.mutate(p); setShowAdd(false); }} />
      )}

      {seatingId && (
        <SeatTableModal
          tables={availableTables}
          busy={seat.isPending}
          onClose={() => setSeatingId(null)}
          onSeat={(tableId) => seat.mutate({ id: seatingId, tableId }, { onSuccess: () => setSeatingId(null) })}
        />
      )}
    </div>
  );
}

function WaitlistRow({ entry, onSeat, onCancel, onNoShow }: {
  entry: WaitlistEntry; onSeat: () => void; onCancel: () => void; onNoShow: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-foreground truncate">{entry.guestName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{entry.guestPhone}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entry.partySize}</span>
          <span>Quoted {entry.quotedWaitMinutes}m</span>
          {entry.status === "waiting" && <span className="font-medium text-amber-500">Waited {entry.waitedMinutes}m</span>}
        </div>
        {entry.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{entry.notes}</p>}
      </div>
      {entry.status === "waiting" && (
        <div className="flex gap-2 shrink-0">
          <Can permission="restaurant.tables.edit">
            <Button size="sm" onClick={onSeat}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Seat</Button>
            <Button size="sm" variant="outline" onClick={onNoShow}><UserX className="w-3.5 h-3.5 mr-1" /> No-show</Button>
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={onCancel}>
              <Ban className="w-3.5 h-3.5" />
            </Button>
          </Can>
        </div>
      )}
    </div>
  );
}

function AddWalkInModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (p: { guestName: string; guestPhone: string; partySize: number; quotedWaitMinutes: number; notes?: string | null }) => void;
}) {
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [partySize, setPartySize] = React.useState(2);
  const [quotedWaitMinutes, setQuotedWaitMinutes] = React.useState(15);
  const [notes, setNotes] = React.useState("");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Add Walk-in</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">Guest Name</label>
        <Input value={guestName} onChange={e => setGuestName(e.target.value)} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">Phone</label>
        <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">Party Size</label>
          <Input type="number" min={1} value={partySize} onChange={e => setPartySize(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">Quoted Wait (min)</label>
          <Input type="number" min={0} value={quotedWaitMinutes} onChange={e => setQuotedWaitMinutes(Number(e.target.value))} className="h-9 text-sm" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">Notes</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className="h-9 text-sm" /></div>
      <Button className="w-full" disabled={!guestName.trim() || !guestPhone.trim()}
        onClick={() => onCreate({ guestName: guestName.trim(), guestPhone: guestPhone.trim(), partySize, quotedWaitMinutes, notes: notes.trim() || undefined })}>
        <Plus className="w-4 h-4 mr-1" /> Add to Waitlist
      </Button>
    </LeftDrawer>
  );
}

function SeatTableModal({ tables, busy, onClose, onSeat }: {
  tables: { id: string; tableNumber: string; capacity: number; section: string }[];
  busy: boolean;
  onClose: () => void;
  onSeat: (tableId: string) => void;
}) {
  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Seat at which table?</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      {tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">No available tables right now.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
          {tables.map(t => (
            <button key={t.id} disabled={busy} onClick={() => onSeat(t.id)}
              className="border border-border rounded-lg p-2 text-center hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50">
              <p className="text-sm font-semibold text-foreground">{t.tableNumber}</p>
              <p className="text-[10px] text-muted-foreground">{t.capacity} seats</p>
            </button>
          ))}
        </div>
      )}
      {busy && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
    </LeftDrawer>
  );
}
