import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, X, Trash2, Printer, ChefHat, UtensilsCrossed, Clock, Loader2 } from "lucide-react";
import {
  useKitchenStations, useCreateKitchenStation, useUpdateKitchenStation, useDeleteKitchenStation,
  usePrinterProfiles, useCreatePrinterProfile, useUpdatePrinterProfile, useDeletePrinterProfile,
  useCombos, useCreateCombo, useUpdateCombo, useDeleteCombo,
  useHappyHourRules, useCreateHappyHourRule, useUpdateHappyHourRule, useDeleteHappyHourRule,
  useMenu,
} from "@/hooks/restaurant/use-restaurant";
import type { KitchenStation, PrinterProfile, Combo, ComboItemInput, HappyHourRule } from "@/lib/restaurant/restaurant.api";
import { useAuthStore } from "@/store/auth.store";
import { Can, useCan } from "@/components/auth/can";
import { useTranslation } from "react-i18next";

const TABS = [
  { id: "stations", icon: ChefHat },
  { id: "printers", icon: Printer },
  { id: "combos", icon: UtensilsCrossed },
  { id: "happyhour", icon: Clock },
] as const;

// `key` indexes kitchenConfig.day.*; `bit` is the persisted daysOfWeekMask value.
const DAYS = [
  { bit: 1, key: "sun" }, { bit: 2, key: "mon" }, { bit: 4, key: "tue" }, { bit: 8, key: "wed" },
  { bit: 16, key: "thu" }, { bit: 32, key: "fri" }, { bit: 64, key: "sat" },
];

export function KitchenConfigView() {
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<typeof TABS[number]["id"]>("stations");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("kitchenConfig.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("kitchenConfig.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5",
              tab === tb.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
            <tb.icon className="w-3.5 h-3.5" /> {t(`kitchenConfig.tab.${tb.id}`)}
          </button>
        ))}
      </div>

      {tab === "stations" && <StationsTab />}
      {tab === "printers" && <PrintersTab />}
      {tab === "combos" && <CombosTab />}
      {tab === "happyhour" && <HappyHourTab />}
    </div>
  );
}

// ─── Kitchen Stations ──────────────────────────────────────────────────────────
function StationsTab() {
  const { t } = useTranslation("restaurant");
  const { data: stations = [] } = useKitchenStations();
  const { data: printers = [] } = usePrinterProfiles();
  const create = useCreateKitchenStation();
  const update = useUpdateKitchenStation();
  const del = useDeleteKitchenStation();
  const [editing, setEditing] = React.useState<KitchenStation | "new" | null>(null);
  const canEdit = useCan("restaurant.kitchen.edit");

  return (
    <div className="space-y-3">
      {canEdit && (
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("kitchenConfig.stations.add")}</Button>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stations.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {s.colorTag && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.colorTag }} />}
                <p className="font-semibold text-foreground">{s.displayName ?? s.name}</p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(s)} className="text-xs text-primary hover:underline">{t("kitchenConfig.edit")}</button>
                  <button onClick={() => del.mutate(s.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {printers.find(p => p.id === s.printerProfileId)?.name ?? t("kitchenConfig.stations.noPrinter")}
            </p>
          </div>
        ))}
        {stations.length === 0 && <p className="text-sm text-muted-foreground">{t("kitchenConfig.stations.empty")}</p>}
      </div>

      {editing && (
        <StationModal station={editing === "new" ? null : editing} printers={printers}
          onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

function StationModal({ station, printers, onClose, onSave }: {
  station: KitchenStation | null; printers: PrinterProfile[]; onClose: () => void;
  onSave: (p: { name: string; displayName?: string | null; colorTag?: string | null; sortOrder: number; printerProfileId?: string | null }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(station?.name ?? "");
  const [displayName, setDisplayName] = React.useState(station?.displayName ?? "");
  const [colorTag, setColorTag] = React.useState(station?.colorTag ?? "#f97316");
  const [printerProfileId, setPrinterProfileId] = React.useState(station?.printerProfileId ?? "");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(station ? "kitchenConfig.stations.editTitle" : "kitchenConfig.stations.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.stations.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("kitchenConfig.stations.namePlaceholder")} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.stations.displayName")}</label>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-9 text-sm" /></div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">{t("kitchenConfig.stations.color")}</label>
        <input type="color" value={colorTag} onChange={e => setColorTag(e.target.value)} className="h-8 w-12" />
      </div>
      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.stations.printer")}</label>
        <select value={printerProfileId} onChange={e => setPrinterProfileId(e.target.value)}
          className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
          <option value="">{t("kitchenConfig.stations.none")}</option>
          {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <Button className="w-full" disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), displayName: displayName.trim() || null, colorTag, sortOrder: 0, printerProfileId: printerProfileId || null })}>
        {t("kitchenConfig.stations.save")}
      </Button>
    </LeftDrawer>
  );
}

// ─── Printer Profiles ──────────────────────────────────────────────────────────
function PrintersTab() {
  const { t } = useTranslation("restaurant");
  const { data: printers = [] } = usePrinterProfiles();
  const create = useCreatePrinterProfile();
  const update = useUpdatePrinterProfile();
  const del = useDeletePrinterProfile();
  const [editing, setEditing] = React.useState<PrinterProfile | "new" | null>(null);
  const canEdit = useCan("restaurant.kitchen.edit");

  return (
    <div className="space-y-3">
      {canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("kitchenConfig.printers.add")}</Button>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {printers.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{p.name}</p>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(p)} className="text-xs text-primary hover:underline">{t("kitchenConfig.edit")}</button>
                  <button onClick={() => del.mutate(p.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">{p.type} · {p.connectionType}{p.isDefault ? t("kitchenConfig.printers.defaultSuffix") : ""}</p>
            {p.ipAddress && <p className="text-xs text-muted-foreground">{p.ipAddress}{p.port ? `:${p.port}` : ""}</p>}
          </div>
        ))}
        {printers.length === 0 && <p className="text-sm text-muted-foreground">{t("kitchenConfig.printers.empty")}</p>}
      </div>

      {editing && (
        <PrinterModal printer={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

function PrinterModal({ printer, onClose, onSave }: {
  printer: PrinterProfile | null; onClose: () => void;
  onSave: (p: { name: string; type: string; connectionType: string; ipAddress?: string | null; port?: number | null; isDefault: boolean }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(printer?.name ?? "");
  const [type, setType] = React.useState(printer?.type ?? "kitchen");
  const [connectionType, setConnectionType] = React.useState(printer?.connectionType ?? "network");
  const [ipAddress, setIpAddress] = React.useState(printer?.ipAddress ?? "");
  const [port, setPort] = React.useState(printer?.port?.toString() ?? "9100");
  const [isDefault, setIsDefault] = React.useState(printer?.isDefault ?? false);

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(printer ? "kitchenConfig.printers.editTitle" : "kitchenConfig.printers.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.printers.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("kitchenConfig.printers.namePlaceholder")} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.printers.type")}</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="kitchen">{t("kitchenConfig.printers.typeKitchen")}</option><option value="receipt">{t("kitchenConfig.printers.typeReceipt")}</option>
          </select></div>
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.printers.connection")}</label>
          <select value={connectionType} onChange={e => setConnectionType(e.target.value)} className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="network">{t("kitchenConfig.printers.connNetwork")}</option><option value="usb">{t("kitchenConfig.printers.connUsb")}</option><option value="bluetooth">{t("kitchenConfig.printers.connBluetooth")}</option>
          </select></div>
      </div>
      {connectionType === "network" && (
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.printers.ip")}</label>
            <Input value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder={t("kitchenConfig.printers.ipPlaceholder")} className="h-9 text-sm" /></div>
          <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.printers.port")}</label>
            <Input value={port} onChange={e => setPort(e.target.value)} className="h-9 text-sm" /></div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> {t("kitchenConfig.printers.isDefault")}
      </label>
      <Button className="w-full" disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), type, connectionType, ipAddress: ipAddress.trim() || null, port: port ? Number(port) : null, isDefault })}>
        {t("kitchenConfig.printers.save")}
      </Button>
    </LeftDrawer>
  );
}

// ─── Combos ────────────────────────────────────────────────────────────────────
function CombosTab() {
  const { t } = useTranslation("restaurant");
  const { data: combos = [] } = useCombos();
  const { data: menu = [] } = useMenu();
  const create = useCreateCombo();
  const update = useUpdateCombo();
  const del = useDeleteCombo();
  const [editing, setEditing] = React.useState<Combo | "new" | null>(null);
  const canEdit = useCan("restaurant.menu.edit");
  const currency = useAuthStore(s => s.tenant?.currency) || "AED";

  return (
    <div className="space-y-3">
      {canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("kitchenConfig.combos.add")}</Button>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {combos.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{c.name}</p>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} className="text-xs text-primary hover:underline">{t("kitchenConfig.edit")}</button>
                  <button onClick={() => del.mutate(c.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-primary">{formatCurrency(c.price, currency)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("kitchenConfig.combos.slots", { n: c.items.length })}{!c.isActive && t("kitchenConfig.combos.inactiveSuffix")}</p>
          </div>
        ))}
        {combos.length === 0 && <p className="text-sm text-muted-foreground">{t("kitchenConfig.combos.empty")}</p>}
      </div>

      {editing && (
        <ComboModal combo={editing === "new" ? null : editing} menu={menu} onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p, isActive: p.isActive ?? true }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

interface ComboSlotForm { key: string; menuItemId: string; categoryId: string; mode: "fixed" | "choice"; quantity: number }

function ComboModal({ combo, menu, onClose, onSave }: {
  combo: Combo | null; menu: { id: string; name: string; items: { id: string; name: string }[] }[]; onClose: () => void;
  onSave: (p: { name: string; price: number; items: ComboItemInput[]; isActive?: boolean }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(combo?.name ?? "");
  const [price, setPrice] = React.useState(combo?.price?.toString() ?? "");
  const [isActive, setIsActive] = React.useState(combo?.isActive ?? true);
  const [slots, setSlots] = React.useState<ComboSlotForm[]>(
    combo?.items.map(i => ({
      key: i.id, menuItemId: i.menuItemId ?? "", categoryId: i.categoryId ?? "",
      mode: i.categoryId ? "choice" : "fixed", quantity: i.quantity,
    })) ?? [{ key: `s-${Date.now()}`, menuItemId: "", categoryId: "", mode: "fixed", quantity: 1 }],
  );

  const allItems = menu.flatMap(c => c.items.map(i => ({ ...i, categoryId: c.id, categoryName: c.name })));

  const updateSlot = (key: string, patch: Partial<ComboSlotForm>) =>
    setSlots(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s));

  const valid = name.trim() && Number(price) >= 0 && slots.length > 0 &&
    slots.every(s => s.mode === "fixed" ? !!s.menuItemId : !!s.categoryId);

  const handleSave = () => {
    onSave({
      name: name.trim(), price: Number(price), isActive,
      items: slots.map((s, i) => ({
        menuItemId: s.mode === "fixed" ? s.menuItemId : null,
        categoryId: s.mode === "choice" ? s.categoryId : null,
        quantity: s.quantity, sortOrder: i,
      })),
    });
  };

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(combo ? "kitchenConfig.combos.editTitle" : "kitchenConfig.combos.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.combos.name")}</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("kitchenConfig.combos.namePlaceholder")} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.combos.price")}</label>
          <Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className="h-9 text-sm" /></div>
      </div>
      {combo && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> {t("kitchenConfig.combos.active")}
        </label>
      )}

      <p className="text-xs font-semibold text-muted-foreground">{t("kitchenConfig.combos.slotsLabel")}</p>
      <div className="space-y-2">
        {slots.map(s => (
          <div key={s.key} className="flex items-center gap-2 border border-border rounded-lg p-2">
            <Input type="number" min={1} value={s.quantity} onChange={e => updateSlot(s.key, { quantity: Number(e.target.value) })}
              className="h-8 w-14 text-xs" />
            <select value={s.mode} onChange={e => updateSlot(s.key, { mode: e.target.value as "fixed" | "choice" })}
              className="h-8 text-xs rounded-md border border-border bg-card px-1">
              <option value="fixed">{t("kitchenConfig.combos.modeFixed")}</option>
              <option value="choice">{t("kitchenConfig.combos.modeChoice")}</option>
            </select>
            {s.mode === "fixed" ? (
              <select value={s.menuItemId} onChange={e => updateSlot(s.key, { menuItemId: e.target.value })}
                className="flex-1 h-8 text-xs rounded-md border border-border bg-card px-1">
                <option value="">{t("kitchenConfig.combos.selectItem")}</option>
                {allItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            ) : (
              <select value={s.categoryId} onChange={e => updateSlot(s.key, { categoryId: e.target.value })}
                className="flex-1 h-8 text-xs rounded-md border border-border bg-card px-1">
                <option value="">{t("kitchenConfig.combos.selectCategory")}</option>
                {menu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button onClick={() => setSlots(prev => prev.filter(x => x.key !== s.key))}>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline"
        onClick={() => setSlots(prev => [...prev, { key: `s-${Date.now()}`, menuItemId: "", categoryId: "", mode: "fixed", quantity: 1 }])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> {t("kitchenConfig.combos.addSlot")}
      </Button>

      <Button className="w-full" disabled={!valid} onClick={handleSave}>{t("kitchenConfig.combos.save")}</Button>
    </LeftDrawer>
  );
}

// ─── Happy Hour Rules ──────────────────────────────────────────────────────────
function HappyHourTab() {
  const { t } = useTranslation("restaurant");
  const { data: rules = [] } = useHappyHourRules();
  const { data: menu = [] } = useMenu();
  const create = useCreateHappyHourRule();
  const update = useUpdateHappyHourRule();
  const del = useDeleteHappyHourRule();
  const [editing, setEditing] = React.useState<HappyHourRule | "new" | null>(null);
  const canEdit = useCan("restaurant.menu.edit");

  return (
    <div className="space-y-3">
      {canEdit && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("kitchenConfig.happyHour.add")}</Button>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rules.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{r.name}</p>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(r)} className="text-xs text-primary hover:underline">{t("kitchenConfig.edit")}</button>
                  <button onClick={() => del.mutate(r.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {DAYS.filter(d => (r.daysOfWeekMask & d.bit) !== 0).map(d => t(`kitchenConfig.day.${d.key}`)).join(", ")} · {r.startTime}–{r.endTime}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.discountType === "percentage"
                ? t("kitchenConfig.happyHour.percentOff", { value: r.discountValue })
                : t("kitchenConfig.happyHour.flatOff", { value: r.discountValue })}
              {r.categoryId
                ? ` · ${menu.find(c => c.id === r.categoryId)?.name ?? t("kitchenConfig.happyHour.categoryFallback")}`
                : t("kitchenConfig.happyHour.wholeOrderSuffix")}
              {!r.isActive && t("kitchenConfig.happyHour.inactiveSuffix")}
            </p>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-muted-foreground">{t("kitchenConfig.happyHour.empty")}</p>}
      </div>

      {editing && (
        <HappyHourModal rule={editing === "new" ? null : editing} menu={menu} onClose={() => setEditing(null)}
          onSave={p => {
            if (editing === "new") create.mutate(p, { onSuccess: () => setEditing(null) });
            else update.mutate({ id: editing.id, ...p }, { onSuccess: () => setEditing(null) });
          }} />
      )}
    </div>
  );
}

function HappyHourModal({ rule, menu, onClose, onSave }: {
  rule: HappyHourRule | null; menu: { id: string; name: string }[]; onClose: () => void;
  onSave: (p: Omit<HappyHourRule, "id">) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(rule?.name ?? "");
  const [mask, setMask] = React.useState(rule?.daysOfWeekMask ?? 62); // Mon-Fri default
  const [startTime, setStartTime] = React.useState(rule?.startTime ?? "17:00");
  const [endTime, setEndTime] = React.useState(rule?.endTime ?? "19:00");
  const [discountType, setDiscountType] = React.useState<"percentage" | "flat">(rule?.discountType ?? "percentage");
  const [discountValue, setDiscountValue] = React.useState(rule?.discountValue?.toString() ?? "20");
  const [categoryId, setCategoryId] = React.useState(rule?.categoryId ?? "");
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);

  const toggleDay = (bit: number) => setMask(prev => (prev & bit) !== 0 ? prev & ~bit : prev | bit);
  const valid = name.trim() && mask > 0 && Number(discountValue) > 0;

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(rule ? "kitchenConfig.happyHour.editTitle" : "kitchenConfig.happyHour.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("kitchenConfig.happyHour.namePlaceholder")} className="h-9 text-sm" /></div>

      <div>
        <label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.days")}</label>
        <div className="flex gap-1 mt-1">
          {DAYS.map(d => (
            <button key={d.bit} onClick={() => toggleDay(d.bit)}
              className={cn("px-2 py-1 rounded text-xs font-medium", (mask & d.bit) !== 0 ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground")}>
              {t(`kitchenConfig.day.${d.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.start")}</label>
          <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.end")}</label>
          <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-9 text-sm" /></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.discountType")}</label>
          <select value={discountType} onChange={e => setDiscountType(e.target.value as "percentage" | "flat")}
            className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="percentage">{t("kitchenConfig.happyHour.percentage")}</option><option value="flat">{t("kitchenConfig.happyHour.flat")}</option>
          </select></div>
        <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.value")}</label>
          <Input type="number" min={0} value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="h-9 text-sm" /></div>
      </div>

      <div><label className="text-xs text-muted-foreground">{t("kitchenConfig.happyHour.appliesTo")}</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
          <option value="">{t("kitchenConfig.happyHour.wholeOrder")}</option>
          {menu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>

      {rule && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> {t("kitchenConfig.happyHour.active")}
        </label>
      )}

      <Button className="w-full" disabled={!valid}
        onClick={() => onSave({
          name: name.trim(), daysOfWeekMask: mask, startTime, endTime,
          discountType, discountValue: Number(discountValue), categoryId: categoryId || null,
          isActive, branchId: null,
        })}>
        {t("kitchenConfig.happyHour.save")}
      </Button>
    </LeftDrawer>
  );
}
