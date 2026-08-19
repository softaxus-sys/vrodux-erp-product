import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, Trash2, Truck, User, Phone, MapPin, Loader2, Copy } from "lucide-react";
import {
  useDeliveryZones, useCreateDeliveryZone, useUpdateDeliveryZone, useDeleteDeliveryZone,
  useDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver,
  useDeliveryOrders, useDeliverySummary, useAssignDriverToDelivery, useChangeDeliveryStatus,
} from "@/hooks/restaurant/use-restaurant";
import type { DeliveryZone, Driver, DeliveryOrder, DeliveryStatus } from "@/lib/restaurant/restaurant.api";
import { useAuthStore } from "@/store/auth.store";
import { Can, useCan } from "@/components/auth/can";
import { toast } from "sonner";

/** Ids double as translation keys (delivery.tabs.*). */
const TABS = ["board", "zones", "drivers"] as const;

/** Styling + workflow only — labels come from i18n: t(`delivery.status.${s}`). */
const STATUS_META: Record<DeliveryStatus, { color: string; bg: string; next: DeliveryStatus | null }> = {
  assigned:  { color: "text-muted-foreground", bg: "bg-muted/30",     next: "picked_up" },
  picked_up: { color: "text-warning",          bg: "bg-warning/10",   next: "enroute" },
  enroute:   { color: "text-primary",          bg: "bg-primary/10",   next: "delivered" },
  delivered: { color: "text-success",          bg: "bg-success/10",   next: null },
  failed:    { color: "text-destructive",      bg: "bg-destructive/10", next: null },
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

export function DeliveryView() {
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<typeof TABS[number]>("board");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Truck className="w-5 h-5" /> {t("delivery.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("delivery.description")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium",
              tab === tabKey ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {t(`delivery.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === "board" && <DeliveryBoardTab />}
      {tab === "zones" && <ZonesTab />}
      {tab === "drivers" && <DriversTab />}
    </div>
  );
}

function DeliveryBoardTab() {
  const { t } = useTranslation("restaurant");
  const [status, setStatus] = React.useState<string | undefined>(undefined);
  const { data: deliveries = [], isLoading } = useDeliveryOrders(status);
  const { data: summary } = useDeliverySummary();
  const { data: drivers = [] } = useDrivers(true);
  const assignDriver = useAssignDriverToDelivery();
  const changeStatus = useChangeDeliveryStatus();
  const currency = useAuthStore(s => s.tenant?.currency) || "AED";
  const canEdit = useCan("restaurant.delivery.edit");

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label={t("delivery.stats.total")} value={summary.total} />
          <StatCard label={t("delivery.stats.assigned")} value={summary.assigned} />
          <StatCard label={t("delivery.stats.pickedUp")} value={summary.pickedUp} accent="bg-warning" />
          <StatCard label={t("delivery.stats.enroute")} value={summary.enroute} accent="bg-blue-500" />
          <StatCard label={t("delivery.stats.delivered")} value={summary.delivered} accent="bg-success" />
        </div>
      )}

      <div className="flex gap-2">
        {(["", "assigned", "picked_up", "enroute", "delivered", "failed"] as const).map(s => (
          <button key={s} onClick={() => setStatus(s || undefined)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium",
              (status ?? "") === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            {s ? t(`delivery.status.${s}`) : t("delivery.all")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t("delivery.loading")}</div>
      ) : deliveries.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">{t("delivery.empty")}</div>
      ) : (
        <div className="space-y-2">
          {deliveries.map(d => (
            <DeliveryRow key={d.id} delivery={d} drivers={drivers} currency={currency} canEdit={canEdit}
              onAssign={driverId => assignDriver.mutate({ id: d.id, driverId })}
              onAdvance={() => { const next = STATUS_META[d.status].next; if (next) changeStatus.mutate({ id: d.id, status: next }); }}
              onFail={() => changeStatus.mutate({ id: d.id, status: "failed" })} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ delivery, drivers, currency, canEdit, onAssign, onAdvance, onFail }: {
  delivery: DeliveryOrder; drivers: Driver[]; currency: string; canEdit: boolean;
  onAssign: (driverId: string) => void; onAdvance: () => void; onFail: () => void;
}) {
  const { t } = useTranslation("restaurant");
  const meta = STATUS_META[delivery.status];
  const trackUrl = `${window.location.origin}/track/${delivery.trackingToken}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground truncate">{delivery.orderNumber}</p>
          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", meta.bg, meta.color)}>{t(`delivery.status.${delivery.status}`)}</span>
          {delivery.thirdPartyProvider && <span className="text-[10px] text-muted-foreground">{t("delivery.via", { provider: delivery.thirdPartyProvider })}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{delivery.address}</span>
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{delivery.phone}</span>
          <span>{formatCurrency(delivery.orderTotal, currency)}</span>
          {delivery.deliveryZoneName && <span>{delivery.deliveryZoneName}</span>}
        </div>
        <button onClick={() => { navigator.clipboard.writeText(trackUrl); toast.success(t("delivery.trackingCopied")); }}
          className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1">
          <Copy className="w-3 h-3" /> {t("delivery.copyTracking")}
        </button>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 shrink-0">
          <select value={delivery.driverId ?? ""} onChange={e => e.target.value && onAssign(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-card px-2">
            <option value="">{delivery.driverName ?? t("delivery.assignDriver")}</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {meta.next && (
            <Button size="sm" onClick={onAdvance}>{t("delivery.markNext", { status: t(`delivery.status.${meta.next}`) })}</Button>
          )}
          {delivery.status !== "delivered" && delivery.status !== "failed" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={onFail}>{t("delivery.failed")}</Button>
          )}
        </div>
      )}
    </div>
  );
}

function ZonesTab() {
  const { t } = useTranslation("restaurant");
  const { data: zones = [] } = useDeliveryZones();
  const create = useCreateDeliveryZone();
  const update = useUpdateDeliveryZone();
  const del = useDeleteDeliveryZone();
  const [editing, setEditing] = React.useState<DeliveryZone | "new" | null>(null);
  const currency = useAuthStore(s => s.tenant?.currency) || "AED";
  const canEdit = useCan("restaurant.delivery.edit");

  return (
    <div className="space-y-3">
      <Can permission="restaurant.delivery.create">
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("delivery.zones.add")}</Button>
      </Can>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {zones.map(z => (
          <div key={z.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{z.name}</p>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(z)} className="text-xs text-primary hover:underline">{t("delivery.zones.edit")}</button>
                  <button onClick={() => del.mutate(z.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-primary">{t("delivery.zones.fee", { amount: formatCurrency(z.deliveryFee, currency) })}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("delivery.zones.meta", { min: formatCurrency(z.minOrderAmount, currency), minutes: z.estimatedMinutes })}
              {!z.isActive && t("delivery.zones.inactiveSuffix")}
            </p>
          </div>
        ))}
        {zones.length === 0 && <p className="text-sm text-muted-foreground">{t("delivery.zones.empty")}</p>}
      </div>

      {editing && (
        <ZoneModal zone={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p, isActive: p.isActive ?? true }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

function ZoneModal({ zone, onClose, onSave }: {
  zone: DeliveryZone | null; onClose: () => void;
  onSave: (p: { name: string; postalCodesJson?: string | null; deliveryFee: number; minOrderAmount: number; estimatedMinutes: number; isActive?: boolean }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(zone?.name ?? "");
  const [postalCodes, setPostalCodes] = React.useState(zone?.postalCodesJson ?? "");
  const [deliveryFee, setDeliveryFee] = React.useState(zone?.deliveryFee?.toString() ?? "0");
  const [minOrderAmount, setMinOrderAmount] = React.useState(zone?.minOrderAmount?.toString() ?? "0");
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(zone?.estimatedMinutes?.toString() ?? "30");
  const [isActive, setIsActive] = React.useState(zone?.isActive ?? true);

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{zone ? t("delivery.zones.editTitle") : t("delivery.zones.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("delivery.zones.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("delivery.zones.namePlaceholder")} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("delivery.zones.postalCodes")}</label>
        <Input value={postalCodes} onChange={e => setPostalCodes(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("delivery.zones.feeLabel")}</label>
          <Input type="number" min={0} value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("delivery.zones.minOrder")}</label>
          <Input type="number" min={0} value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("delivery.zones.eta")}</label>
          <Input type="number" min={1} value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)} className="h-9 text-sm" /></div>
      </div>
      {zone && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> {t("delivery.zones.active")}
        </label>
      )}
      <Button className="w-full" disabled={!name.trim()}
        onClick={() => onSave({
          name: name.trim(), postalCodesJson: postalCodes.trim() || null,
          deliveryFee: Number(deliveryFee), minOrderAmount: Number(minOrderAmount),
          estimatedMinutes: Number(estimatedMinutes), isActive,
        })}>
        {t("delivery.zones.save")}
      </Button>
    </LeftDrawer>
  );
}

function DriversTab() {
  const { t } = useTranslation("restaurant");
  const { data: drivers = [] } = useDrivers();
  const create = useCreateDriver();
  const update = useUpdateDriver();
  const del = useDeleteDriver();
  const [editing, setEditing] = React.useState<Driver | "new" | null>(null);
  const canEdit = useCan("restaurant.delivery.edit");

  return (
    <div className="space-y-3">
      <Can permission="restaurant.delivery.create">
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("delivery.drivers.add")}</Button>
      </Can>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {drivers.map(d => (
          <div key={d.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{d.name}</p>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(d)} className="text-xs text-primary hover:underline">{t("delivery.drivers.edit")}</button>
                  <button onClick={() => del.mutate(d.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{d.phone}{d.vehicleInfo ? ` · ${d.vehicleInfo}` : ""}{!d.isActive && t("delivery.zones.inactiveSuffix")}</p>
          </div>
        ))}
        {drivers.length === 0 && <p className="text-sm text-muted-foreground">{t("delivery.drivers.empty")}</p>}
      </div>

      {editing && (
        <DriverModal driver={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p, isActive: p.isActive ?? true }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

function DriverModal({ driver, onClose, onSave }: {
  driver: Driver | null; onClose: () => void;
  onSave: (p: { name: string; phone: string; vehicleInfo?: string | null; isActive?: boolean }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(driver?.name ?? "");
  const [phone, setPhone] = React.useState(driver?.phone ?? "");
  const [vehicleInfo, setVehicleInfo] = React.useState(driver?.vehicleInfo ?? "");
  const [isActive, setIsActive] = React.useState(driver?.isActive ?? true);

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{driver ? t("delivery.drivers.editTitle") : t("delivery.drivers.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("delivery.drivers.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("delivery.drivers.phone")}</label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("delivery.drivers.vehicle")}</label>
        <Input value={vehicleInfo} onChange={e => setVehicleInfo(e.target.value)} placeholder={t("delivery.drivers.vehiclePlaceholder")} className="h-9 text-sm" /></div>
      {driver && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> {t("delivery.drivers.active")}
        </label>
      )}
      <Button className="w-full" disabled={!name.trim() || !phone.trim()}
        onClick={() => onSave({ name: name.trim(), phone: phone.trim(), vehicleInfo: vehicleInfo.trim() || null, isActive })}>
        {t("delivery.drivers.save")}
      </Button>
    </LeftDrawer>
  );
}
