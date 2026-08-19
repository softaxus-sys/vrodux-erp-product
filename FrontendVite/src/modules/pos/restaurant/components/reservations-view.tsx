import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn } from "@/lib/utils";
import { Plus, X, CalendarClock, Users, Phone, Mail, CheckCircle2, Ban, Settings, Loader2 } from "lucide-react";
import {
  useReservations, useReservationsSummary, useCreateReservation, useSeatReservation,
  useCancelReservation, useReservationRule, useSaveReservationRule, useTables,
} from "@/hooks/restaurant/use-restaurant";
import type { Reservation, ReservationStatus } from "@/lib/restaurant/restaurant.api";
import { Can, useCan } from "@/components/auth/can";

const TODAY = new Date().toISOString().split("T")[0];

/** Styling only — labels come from i18n: t(`reservations.status.${status}`). */
const STATUS_META: Record<ReservationStatus, { color: string; bg: string }> = {
  confirmed: { color: "text-primary", bg: "bg-primary/10" },
  seated:    { color: "text-success", bg: "bg-success/10" },
  completed: { color: "text-muted-foreground", bg: "bg-muted/20" },
  cancelled: { color: "text-destructive", bg: "bg-destructive/10" },
  no_show:   { color: "text-amber-500", bg: "bg-amber-500/10" },
};

function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-2`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ReservationsView() {
  const { t } = useTranslation("restaurant");
  const [date, setDate] = React.useState(TODAY);
  const { data: reservations = [], isLoading } = useReservations(date);
  const { data: summary } = useReservationsSummary();
  const { data: tables = [] } = useTables();
  const seat = useSeatReservation();
  const cancel = useCancelReservation();

  const [showAdd, setShowAdd] = React.useState(false);
  const [showRules, setShowRules] = React.useState(false);
  const canEdit = useCan("restaurant.reservations.edit");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><CalendarClock className="w-5 h-5" /> {t("reservations.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("reservations.description")}</p>
        </div>
        <div className="flex gap-2">
          <Can permission="restaurant.reservations.edit">
            <Button variant="outline" onClick={() => setShowRules(true)}><Settings className="w-4 h-4 mr-1" /> {t("reservations.policy")}</Button>
          </Can>
          <Can permission="restaurant.reservations.create">
            <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> {t("reservations.new")}</Button>
          </Can>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t("reservations.stats.today")} value={summary.today} />
          <StatCard label={t("reservations.stats.todayCovers")} value={summary.todayCovers} />
          <StatCard label={t("reservations.stats.confirmed")} value={summary.confirmed} accent="bg-primary" />
          <StatCard label={t("reservations.stats.noShows")} value={summary.noShow} accent="bg-amber-500" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">{t("reservations.date")}</label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-44 text-sm" />
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("reservations.loading")}</div>
      ) : reservations.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">{t("reservations.empty")}</div>
      ) : (
        <div className="space-y-2">
          {reservations.map(r => {
            const meta = STATUS_META[r.status];
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground truncate">{r.guestName}</p>
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", meta.bg, meta.color)}>{t(`reservations.status.${r.status}`)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span>{r.reservationTime}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{r.covers}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.guestPhone}</span>
                    {r.guestEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.guestEmail}</span>}
                    {r.tableNumber && <span>{t("reservations.tableLabel", { number: r.tableNumber })}</span>}
                  </div>
                  {r.specialRequests && <p className="text-xs text-muted-foreground mt-1">{r.specialRequests}</p>}
                </div>
                {r.status === "confirmed" && canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => seat.mutate(r.id)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("reservations.seat")}</Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => cancel.mutate(r.id)}>
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddReservationModal tables={tables.filter(tb => !tb.mergedIntoTableId)} defaultDate={date} onClose={() => setShowAdd(false)} />
      )}
      {showRules && <ReservationRuleModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function AddReservationModal({ tables, defaultDate, onClose }: {
  tables: { id: string; tableNumber: string; capacity: number }[]; defaultDate: string; onClose: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const createReservation = useCreateReservation();
  const [guestName, setGuestName] = React.useState("");
  const [guestPhone, setGuestPhone] = React.useState("");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [covers, setCovers] = React.useState(2);
  const [reservationDate, setReservationDate] = React.useState(defaultDate);
  const [reservationTime, setReservationTime] = React.useState("19:00");
  const [specialRequests, setSpecialRequests] = React.useState("");
  const [tableId, setTableId] = React.useState("");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("reservations.form.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("reservations.form.guestName")}</label>
        <Input value={guestName} onChange={e => setGuestName(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.phone")}</label>
          <Input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.email")}</label>
          <Input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="h-9 text-sm" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.date")}</label>
          <Input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.time")}</label>
          <Input type="time" value={reservationTime} onChange={e => setReservationTime(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.covers")}</label>
          <Input type="number" min={1} value={covers} onChange={e => setCovers(Number(e.target.value))} className="h-9 text-sm" /></div>
      </div>
      {tables.length > 0 && (
        <div><label className="text-xs text-muted-foreground">{t("reservations.form.table")}</label>
          <select value={tableId} onChange={e => setTableId(e.target.value)}
            className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="">{t("reservations.form.notAssigned")}</option>
            {tables.map(tb => <option key={tb.id} value={tb.id}>{t("reservations.form.tableOption", { number: tb.tableNumber, seats: tb.capacity })}</option>)}
          </select></div>
      )}
      <div><label className="text-xs text-muted-foreground">{t("reservations.form.specialRequests")}</label>
        <Input value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder={t("reservations.form.optional")} className="h-9 text-sm" /></div>
      <Button className="w-full" disabled={!guestName.trim() || !guestPhone.trim() || createReservation.isPending}
        onClick={() => createReservation.mutate({
          guestName: guestName.trim(), guestPhone: guestPhone.trim(), guestEmail: guestEmail.trim() || undefined,
          covers, reservationDate, reservationTime, specialRequests: specialRequests.trim() || undefined,
          tableId: tableId || undefined,
        }, { onSuccess: onClose })}>
        {createReservation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} {t("reservations.form.submit")}
      </Button>
    </LeftDrawer>
  );
}

function ReservationRuleModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("restaurant");
  const { data: rule } = useReservationRule(null);
  const saveRule = useSaveReservationRule();

  const [slotDurationMinutes, setSlotDurationMinutes] = React.useState(rule?.slotDurationMinutes ?? 90);
  const [maxCoversPerSlot, setMaxCoversPerSlot] = React.useState(rule?.maxCoversPerSlot ?? 50);
  const [maxAdvanceDays, setMaxAdvanceDays] = React.useState(rule?.maxAdvanceDays ?? 60);
  const [minNoticeMinutes, setMinNoticeMinutes] = React.useState(rule?.minNoticeMinutes ?? 30);
  const [autoNoShowMinutes, setAutoNoShowMinutes] = React.useState(rule?.autoNoShowMinutes ?? 15);
  const [depositRequired, setDepositRequired] = React.useState(rule?.depositRequired ?? false);
  const [depositAmount, setDepositAmount] = React.useState(rule?.depositAmount ?? 0);

  React.useEffect(() => {
    if (!rule) return;
    setSlotDurationMinutes(rule.slotDurationMinutes); setMaxCoversPerSlot(rule.maxCoversPerSlot);
    setMaxAdvanceDays(rule.maxAdvanceDays); setMinNoticeMinutes(rule.minNoticeMinutes);
    setAutoNoShowMinutes(rule.autoNoShowMinutes); setDepositRequired(rule.depositRequired); setDepositAmount(rule.depositAmount);
  }, [rule]);

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t("reservations.rules.title")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("reservations.rules.hint")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.slotDuration")}</label>
          <Input type="number" min={1} value={slotDurationMinutes} onChange={e => setSlotDurationMinutes(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.maxCovers")}</label>
          <Input type="number" min={1} value={maxCoversPerSlot} onChange={e => setMaxCoversPerSlot(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.maxAdvance")}</label>
          <Input type="number" min={0} value={maxAdvanceDays} onChange={e => setMaxAdvanceDays(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.minNotice")}</label>
          <Input type="number" min={0} value={minNoticeMinutes} onChange={e => setMinNoticeMinutes(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.autoNoShow")}</label>
          <Input type="number" min={0} value={autoNoShowMinutes} onChange={e => setAutoNoShowMinutes(Number(e.target.value))} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("reservations.rules.depositAmount")}</label>
          <Input type="number" min={0} value={depositAmount} onChange={e => setDepositAmount(Number(e.target.value))} className="h-9 text-sm" disabled={!depositRequired} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={depositRequired} onChange={e => setDepositRequired(e.target.checked)} />
        {t("reservations.rules.requireDeposit")}
      </label>
      <Button className="w-full" disabled={saveRule.isPending}
        onClick={() => saveRule.mutate({
          branchId: null, slotDurationMinutes, maxCoversPerSlot, maxAdvanceDays,
          minNoticeMinutes, autoNoShowMinutes, depositRequired, depositAmount,
        }, { onSuccess: onClose })}>
        {saveRule.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} {t("reservations.rules.submit")}
      </Button>
    </LeftDrawer>
  );
}
