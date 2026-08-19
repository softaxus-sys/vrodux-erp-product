import * as React from "react";
import { useTranslation } from "react-i18next";
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

/** Filter values are the API/enum values; labels come from i18n (waitlist.filters.*). */
const STATUS_FILTERS: (WaitlistStatus | "all")[] = ["waiting", "seated", "no_show", "cancelled", "all"];

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
  const { t } = useTranslation("restaurant");
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

  const availableTables = tables.filter(tb => tb.status === "available" && !tb.mergedIntoTableId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Clock className="w-5 h-5" /> {t("waitlist.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("waitlist.description")}</p>
        </div>
        <Can permission="restaurant.tables.create">
          <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> {t("waitlist.add")}</Button>
        </Can>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label={t("waitlist.stats.total")} value={summary.total} />
          <StatCard label={t("waitlist.stats.waiting")} value={summary.waiting} accent="bg-amber-500" />
          <StatCard label={t("waitlist.stats.seated")} value={summary.seated} accent="bg-success" />
          <StatCard label={t("waitlist.stats.noShows")} value={summary.noShow} accent="bg-destructive" />
          <StatCard label={t("waitlist.stats.avgWait")} value={t("kitchen.minutes", { count: Math.round(summary.averageQuotedWaitMinutes) })} />
        </div>
      )}

      <div className="flex gap-2 border-b border-border pb-2">
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium",
              filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {t(`waitlist.filters.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("waitlist.loading")}</div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">{t("waitlist.empty")}</div>
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
  const { t } = useTranslation("restaurant");
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-foreground truncate">{entry.guestName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{entry.guestPhone}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{entry.partySize}</span>
          <span>{t("waitlist.quoted", { count: entry.quotedWaitMinutes })}</span>
          {entry.status === "waiting" && <span className="font-medium text-amber-500">{t("waitlist.waited", { count: entry.waitedMinutes })}</span>}
        </div>
        {entry.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{entry.notes}</p>}
      </div>
      {entry.status === "waiting" && (
        <div className="flex gap-2 shrink-0">
          <Can permission="restaurant.tables.edit">
            <Button size="sm" onClick={onSeat}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("waitlist.seat")}</Button>
            <Button size="sm" variant="outline" onClick={onNoShow}><UserX className="w-3.5 h-3.5 mr-1" /> {t("waitlist.noShow")}</Button>
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
  const { t } = useTranslation("restaurant");
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [partySize, setPartySize] = React.useState(2);
  const [quotedWaitMinutes, setQuotedWaitMinutes] = React.useState(15);
  const [notes, setNotes] = React.useState("");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("waitlist.form.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("waitlist.form.guestName")}</label>
        <Input value={guestName} onChange={e => setGuestName(e.target.value)} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("waitlist.form.phone")}</label>
        <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("waitlist.form.partySize")}</label>
          <Input type="number" min={1} value={partySize} onChange={e => setPartySize(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("waitlist.form.quotedWait")}</label>
          <Input type="number" min={0} value={quotedWaitMinutes} onChange={e => setQuotedWaitMinutes(Number(e.target.value))} className="h-9 text-sm" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("waitlist.form.notes")}</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("waitlist.form.optional")} className="h-9 text-sm" /></div>
      <Button className="w-full" disabled={!guestName.trim() || !guestPhone.trim()}
        onClick={() => onCreate({ guestName: guestName.trim(), guestPhone: guestPhone.trim(), partySize, quotedWaitMinutes, notes: notes.trim() || undefined })}>
        <Plus className="w-4 h-4 mr-1" /> {t("waitlist.form.submit")}
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
  const { t } = useTranslation("restaurant");
  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("waitlist.seatModal.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      {tables.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("waitlist.seatModal.noTables")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
          {tables.map(tb => (
            <button key={tb.id} disabled={busy} onClick={() => onSeat(tb.id)}
              className="border border-border rounded-lg p-2 text-center hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50">
              <p className="text-sm font-semibold text-foreground">{tb.tableNumber}</p>
              <p className="text-[10px] text-muted-foreground">{t("waitlist.seatModal.seats", { count: tb.capacity })}</p>
            </button>
          ))}
        </div>
      )}
      {busy && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
    </LeftDrawer>
  );
}
