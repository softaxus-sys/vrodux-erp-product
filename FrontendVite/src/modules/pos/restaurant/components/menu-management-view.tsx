import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus, X, Trash2, Pencil, Loader2, UtensilsCrossed, Layers, Sliders, ChefHat, AlertTriangle,
  Search, Minus, Clock, Check, FileSpreadsheet,
} from "lucide-react";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useCan } from "@/components/auth/can";
import {
  useMenu, useMenuSummary, useKitchenStations,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useSetItemAvailability,
  useModifierGroups, useCreateModifierGroup, useUpdateModifierGroup, useDeleteModifierGroup,
  useItemModifierGroups, useAssignItemModifierGroups, useAddItemImages,
} from "@/hooks/restaurant/use-restaurant";
import { ImportMenuModal } from "./import-menu-modal";
import { DishPhoto, DishPhotosEditor, coverOf, type NewPhoto } from "./dish-photos";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import type { MenuCategory, MenuItem, ModifierGroup } from "@/lib/restaurant/restaurant.api";

/**
 * Menu set-up. Laid out like the till it feeds — categories down the side, dishes as the same tiles
 * staff will tap — so what you build here is recognisably what they will see.
 */

type Tab = "menu" | "modifiers";
type Station = { id: string; name: string; displayName: string | null };

// Same order and palette as the till, so a category keeps its colour on both screens.
const CATEGORY_ACCENT = [
  "border-s-emerald-500", "border-s-sky-500", "border-s-amber-500", "border-s-rose-500",
  "border-s-violet-500", "border-s-teal-500", "border-s-orange-500", "border-s-indigo-500",
];
const CATEGORY_DOT = [
  "bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500",
  "bg-violet-500", "bg-teal-500", "bg-orange-500", "bg-indigo-500",
];

const input = "w-full h-12 px-3.5 rounded-xl border-2 border-border bg-card text-base font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-medium focus:outline-none focus:border-primary";
const primaryBtn = "h-12 px-5 rounded-xl bg-primary text-primary-foreground text-base font-extrabold flex items-center justify-center gap-2 whitespace-nowrap hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all";
const outlineBtn = "h-12 px-4 rounded-xl border-2 border-border bg-card text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap hover:border-primary transition-colors disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-sm font-bold text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  const btn = "h-12 w-12 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}><Minus className="h-4 w-4" strokeWidth={3} /></button>
      <span className="w-10 text-center text-xl font-black tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className={btn}><Plus className="h-4 w-4" strokeWidth={3} /></button>
    </div>
  );
}

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={cn("w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 text-start transition-colors",
        on ? "border-primary bg-primary/5" : "border-border")}>
      <span>
        <span className="block text-base font-bold text-foreground">{label}</span>
        {hint && <span className="block text-sm font-medium text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("h-7 w-12 rounded-full p-0.5 transition-colors shrink-0", on ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("block h-6 w-6 rounded-full bg-white shadow transition-transform", on && "translate-x-5 rtl:-translate-x-5")} />
      </span>
    </button>
  );
}

function DrawerTitle({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-2xl font-black text-foreground">{children}</p>
      <button onClick={onClose} className="h-11 w-11 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="h-6 w-6" /></button>
    </div>
  );
}

/** Delete lives at the bottom of the edit form, and asks once more before it happens. */
function DeleteButton({ label, message, pending, onConfirm }: { label: string; message: string; pending?: boolean; onConfirm: () => void }) {
  const { t } = useTranslation("restaurant");
  const [asking, setAsking] = React.useState(false);
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className="w-full h-12 rounded-xl text-base font-bold text-destructive hover:bg-destructive/10 flex items-center justify-center gap-2">
        <Trash2 className="h-5 w-5" />{label}
      </button>
    );
  }
  return (
    <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 space-y-3">
      <p className="text-sm font-bold text-foreground">{message}</p>
      <div className="flex gap-2">
        <button onClick={() => setAsking(false)} className={cn(outlineBtn, "flex-1")}>{t("menuMgmt.cancel")}</button>
        <button disabled={pending} onClick={onConfirm} className="flex-1 h-12 rounded-xl bg-destructive text-white text-base font-extrabold flex items-center justify-center gap-2 disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}{t("menuMgmt.delete")}
        </button>
      </div>
    </div>
  );
}

export function MenuManagementView() {
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<Tab>("menu");
  const tabs = [
    { id: "menu" as const, icon: Layers, label: t("menuMgmt.tabMenu") },
    { id: "modifiers" as const, icon: Sliders, label: t("menuMgmt.tabModifiers") },
  ];
  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-border bg-card shrink-0 flex-wrap">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
          <UtensilsCrossed className="h-7 w-7" />{t("menuMgmt.title")}
        </h1>
        <div className="flex rounded-xl border-2 border-border p-1 bg-muted/40">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={cn("h-10 px-4 rounded-lg text-base font-extrabold flex items-center gap-2",
                tab === tb.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <tb.icon className="h-5 w-5" />{tb.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "menu" ? <MenuTab /> : <ModifierGroupsTab />}
    </div>
  );
}

// ─── Menu tab ─────────────────────────────────────────────────────────────────

function MenuTab() {
  const { t } = useTranslation("restaurant");
  const { data: categories = [], isLoading } = useMenu();
  const { data: summary } = useMenuSummary();
  const { data: stations = [] } = useKitchenStations();
  const { data: recipes = [] } = useRecipes();
  const currency = useCurrency();
  const canCreate = useCan("restaurant.menu.create");
  const canEdit = useCan("restaurant.menu.edit");

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const setAvailability = useSetItemAvailability();
  const assignGroups = useAssignItemModifierGroups();
  const addImages = useAddItemImages();

  const [catId, setCatId] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [editingCategory, setEditingCategory] = React.useState<MenuCategory | "new" | null>(null);
  const [editingItem, setEditingItem] = React.useState<{ item: MenuItem | null; categoryId: string } | null>(null);
  const [importing, setImporting] = React.useState(false);

  const linked = React.useMemo(() => new Set(recipes.map(r => r.menuItemId)), [recipes]);
  const allItems = React.useMemo(
    () => categories.flatMap((c, idx) => c.items.map(item => ({ item, categoryId: c.id, idx }))), [categories]);
  const unlinkedCount = allItems.filter(x => !linked.has(x.item.id)).length;
  const selected = categories.find(c => c.id === catId) ?? null;

  const q = search.trim().toLowerCase();
  // Searching looks across the whole menu, whichever category is open.
  const shown = allItems.filter(x => q ? x.item.name.toLowerCase().includes(q) : (catId === "all" || x.categoryId === catId));
  const stationName = (id: string | null) => {
    const s = id ? stations.find(st => st.id === id) : null;
    return s ? (s.displayName ?? s.name) : null;
  };
  const addTarget = selected?.id ?? categories[0]?.id ?? null;

  const railBtn = (active: boolean) => cn(
    "w-full h-14 px-3.5 rounded-xl border-2 flex items-center gap-3 text-start transition-colors",
    active ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Categories */}
      <div className="w-[280px] shrink-0 flex flex-col border-e-2 border-border bg-card">
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <button onClick={() => setCatId("all")} className={railBtn(catId === "all")}>
            <span className="h-3 w-3 rounded-full bg-foreground shrink-0" />
            <span className="flex-1 text-base font-bold text-foreground truncate">{t("menuMgmt.allItems")}</span>
            <span className="text-sm font-bold text-muted-foreground tabular-nums">{allItems.length}</span>
          </button>
          {categories.map((c, i) => (
            <button key={c.id} onClick={() => setCatId(c.id)} className={railBtn(catId === c.id)}>
              <span className={cn("h-3 w-3 rounded-full shrink-0", CATEGORY_DOT[i % CATEGORY_DOT.length])} />
              <span className="flex-1 text-base font-bold text-foreground truncate">{c.name}</span>
              <span className="text-sm font-bold text-muted-foreground tabular-nums">{c.items.length}</span>
            </button>
          ))}
        </div>
        {canCreate && (
          <div className="p-3 border-t-2 border-border">
            <button onClick={() => setEditingCategory("new")} className={cn(outlineBtn, "w-full")}>
              <Plus className="h-5 w-5" />{t("menuMgmt.addCategory")}
            </button>
          </div>
        )}
      </div>

      {/* Dishes */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("menuMgmt.search")} className={cn(input, "ps-12")} />
          </div>
          {selected && canEdit && !q && (
            <button onClick={() => setEditingCategory(selected)} className={outlineBtn}>
              <Pencil className="h-4 w-4" />{t("menuMgmt.category.editTitle")}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setImporting(true)} className={outlineBtn}>
              <FileSpreadsheet className="h-5 w-5" />{t("menuMgmt.import.button")}
            </button>
          )}
          {canCreate && addTarget && (
            <button onClick={() => setEditingItem({ item: null, categoryId: addTarget })} className={primaryBtn}>
              <Plus className="h-5 w-5" />{t("menuMgmt.addItem")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 pt-3 flex-wrap text-sm font-bold">
          {summary && (
            <>
              <span className="px-3 py-1.5 rounded-lg bg-success/15 text-success">{summary.availableItems} {t("menuMgmt.stat.available")}</span>
              {summary.unavailableItems > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive">{summary.unavailableItems} {t("menuMgmt.soldOut")}</span>
              )}
              <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground tabular-nums">
                {formatCurrency(summary.minPrice, currency)} – {formatCurrency(summary.maxPrice, currency)}
              </span>
            </>
          )}
          {unlinkedCount > 0 && (
            <Link to="/recipe/recipes" className="px-3 py-1.5 rounded-lg bg-warning/15 text-warning flex items-center gap-1.5 hover:bg-warning/25">
              <AlertTriangle className="h-4 w-4 shrink-0" />{t("menuMgmt.recipeWarning", { unlinked: unlinkedCount, total: allItems.length })}
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : categories.length === 0 ? (
            <Empty title={t("menuMgmt.emptyCategories")} />
          ) : shown.length === 0 ? (
            <Empty title={q ? t("menuMgmt.noMatch") : t("menuMgmt.emptyItems")} />
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {shown.map(({ item, categoryId, idx }) => {
                const off = !item.isAvailable;
                const station = stationName(item.kitchenStationId);
                return (
                  <div key={item.id}
                    className={cn("rounded-2xl border-2 border-s-[6px] bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-lg",
                      CATEGORY_ACCENT[idx % CATEGORY_ACCENT.length], off ? "border-border opacity-70" : "border-border")}>
                    {coverOf(item) && (
                      <button disabled={!canEdit} onClick={() => setEditingItem({ item, categoryId })} className="block relative">
                        <DishPhoto itemId={item.id} imageId={coverOf(item)!.id} alt={item.name} className="h-32 w-full" />
                        {(item.images?.length ?? 0) > 1 && (
                          <span className="absolute bottom-1.5 end-1.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs font-bold tabular-nums">+{item.images!.length - 1}</span>
                        )}
                      </button>
                    )}
                    <button disabled={!canEdit} onClick={() => setEditingItem({ item, categoryId })} className="flex-1 p-3.5 text-start">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-base font-bold text-foreground leading-snug line-clamp-2">{item.name}</p>
                        <span title={linked.has(item.id) ? t("menuMgmt.recipeLinked") : t("menuMgmt.recipeMissing")} className="shrink-0">
                          <ChefHat className={cn("h-5 w-5", linked.has(item.id) ? "text-success" : "text-muted-foreground/30")} />
                        </span>
                      </div>
                      <p className="text-xl font-black text-foreground tabular-nums mt-1.5">{formatCurrency(item.price, currency)}</p>
                      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-sm font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("menuMgmt.prepMinutes", { n: item.prepTimeMinutes })}</span>
                        {item.modifierGroups.length > 0 && <span className="text-primary">{t("menuMgmt.modifierCount", { count: item.modifierGroups.length })}</span>}
                        {station && <span className="truncate">{station}</span>}
                      </div>
                      {item.allergens && <p className="text-sm font-semibold text-warning mt-1 truncate">{item.allergens}</p>}
                    </button>
                    <button disabled={!canEdit || setAvailability.isPending}
                      onClick={() => setAvailability.mutate({ id: item.id, isAvailable: off })}
                      className={cn("h-11 flex items-center justify-center gap-2 text-sm font-extrabold border-t-2 transition-colors",
                        off ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                            : "border-border bg-muted/40 text-success hover:bg-success/10")}>
                      {off ? t("menuMgmt.soldOut") : <><Check className="h-4 w-4" strokeWidth={3} />{t("menuMgmt.onSale")}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ImportMenuModal open={importing} onClose={() => setImporting(false)} />

      {editingCategory && (
        <CategoryDrawer
          category={editingCategory === "new" ? null : editingCategory}
          stations={stations}
          deleting={deleteCategory.isPending}
          onClose={() => setEditingCategory(null)}
          onDelete={async () => {
            if (editingCategory === "new") return;
            try { await deleteCategory.mutateAsync(editingCategory.id); setEditingCategory(null); setCatId("all"); } catch { /* hook toasts */ }
          }}
          onSave={async p => {
            try {
              if (editingCategory === "new") await createCategory.mutateAsync(p);
              else await updateCategory.mutateAsync({ id: editingCategory.id, name: p.name, description: p.description, sortOrder: p.sortOrder });
              setEditingCategory(null);
            } catch { /* hook toasts */ }
          }}
        />
      )}

      {editingItem && (
        <ItemDrawer
          item={editingItem.item ? allItems.find(x => x.item.id === editingItem.item!.id)?.item ?? editingItem.item : null}
          stations={stations}
          deleting={deleteItem.isPending}
          onClose={() => setEditingItem(null)}
          onDelete={async () => {
            if (!editingItem.item) return;
            try { await deleteItem.mutateAsync(editingItem.item.id); setEditingItem(null); } catch { /* hook toasts */ }
          }}
          onSave={async (p, modifierGroupIds, photos) => {
            try {
              let itemId = editingItem.item?.id;
              if (editingItem.item) {
                await updateItem.mutateAsync({ id: editingItem.item.id, ...p });
              } else {
                const created = await createItem.mutateAsync({ categoryId: editingItem.categoryId, ...p });
                itemId = created.id;
              }
              if (itemId) await assignGroups.mutateAsync({ itemId, modifierGroupIds });
              // A new dish only gets an id once it is saved, so its photos follow it. The dish is
              // already created by now — a failed upload is reported by the hook and can be redone.
              if (itemId && photos.length) await addImages.mutateAsync({ itemId, images: photos }).catch(() => {});
              setEditingItem(null);
            } catch { /* hook toasts */ }
          }}
        />
      )}
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <UtensilsCrossed className="h-14 w-14 text-muted-foreground/30 mb-3" />
      <p className="text-xl font-extrabold text-foreground max-w-md">{title}</p>
    </div>
  );
}

function CategoryDrawer({ category, stations, deleting, onClose, onSave, onDelete }: {
  category: MenuCategory | null; stations: Station[]; deleting: boolean;
  onClose: () => void; onDelete: () => void;
  onSave: (p: { name: string; description?: string | null; sortOrder: number; kitchenStationId?: string | null }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const canEdit = useCan("restaurant.menu.edit");
  const [name, setName] = React.useState(category?.name ?? "");
  const [description, setDescription] = React.useState(category?.description ?? "");
  const [sortOrder, setSortOrder] = React.useState(category?.sortOrder?.toString() ?? "0");
  const [kitchenStationId, setKitchenStationId] = React.useState(category?.kitchenStationId ?? "");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <DrawerTitle onClose={onClose}>{t(category ? "menuMgmt.category.editTitle" : "menuMgmt.category.addTitle")}</DrawerTitle>
      <Field label={t("menuMgmt.field.name")}>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.category.namePlaceholder")} className={input} />
      </Field>
      <Field label={t("menuMgmt.field.description")}>
        <input value={description} onChange={e => setDescription(e.target.value)} className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("menuMgmt.field.sortOrder")}>
          <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={input} />
        </Field>
        <Field label={t("menuMgmt.field.kitchenStation")}>
          <select value={kitchenStationId} onChange={e => setKitchenStationId(e.target.value)} className={input}>
            <option value="">{t("menuMgmt.field.none")}</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.displayName ?? s.name}</option>)}
          </select>
        </Field>
      </div>
      <button className={cn(primaryBtn, "w-full h-14")} disabled={!name.trim()}
        onClick={() => onSave({ name: name.trim(), description: description.trim() || null, sortOrder: Number(sortOrder) || 0, kitchenStationId: kitchenStationId || null })}>
        {t("menuMgmt.category.save")}
      </button>
      {category && canEdit && (
        <DeleteButton label={t("menuMgmt.confirm.deleteCategoryTitle")} pending={deleting}
          message={t("menuMgmt.confirm.deleteMessage", { name: category.name })} onConfirm={onDelete} />
      )}
    </LeftDrawer>
  );
}

function ItemDrawer({ item, stations, deleting, onClose, onSave, onDelete }: {
  item: MenuItem | null; stations: Station[]; deleting: boolean;
  onClose: () => void; onDelete: () => void;
  onSave: (
    p: { name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; kitchenStationId?: string | null; isOnlineOrderable: boolean },
    modifierGroupIds: string[],
    photos: NewPhoto[],
  ) => void | Promise<void>;
}) {
  const { t } = useTranslation("restaurant");
  const currency = useCurrency();
  const [name, setName] = React.useState(item?.name ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [price, setPrice] = React.useState(item?.price?.toString() ?? "");
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState(item?.prepTimeMinutes?.toString() ?? "10");
  const [allergens, setAllergens] = React.useState(item?.allergens ?? "");
  const [kitchenStationId, setKitchenStationId] = React.useState(item?.kitchenStationId ?? "");
  const [isOnlineOrderable, setIsOnlineOrderable] = React.useState(item?.isOnlineOrderable ?? true);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>(item?.modifierGroups.map(g => g.id) ?? []);
  const [saving, setSaving] = React.useState(false);
  const [queuedPhotos, setQueuedPhotos] = React.useState<NewPhoto[]>([]);

  const { data: allGroups = [] } = useModifierGroups();
  const { data: assignedIds } = useItemModifierGroups(item?.id ?? null);
  React.useEffect(() => { if (assignedIds) setSelectedGroupIds(assignedIds); }, [assignedIds]);

  const toggleGroup = (id: string) => setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const valid = name.trim() && price !== "" && Number(price) >= 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), description: description.trim() || null, price: Number(price),
        prepTimeMinutes: Number(prepTimeMinutes) || 0, allergens: allergens.trim() || null,
        kitchenStationId: kitchenStationId || null, isOnlineOrderable,
      }, selectedGroupIds, queuedPhotos);
    } finally { setSaving(false); }
  };

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-lg">
      <DrawerTitle onClose={onClose}>{t(item ? "menuMgmt.item.editTitle" : "menuMgmt.item.addTitle")}</DrawerTitle>
      <Field label={t("menuMgmt.field.name")}>
        <input autoFocus={!item} value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.item.namePlaceholder")} className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t("menuMgmt.field.price")} (${currency})`}>
          <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className={cn(input, "text-xl font-black")} />
        </Field>
        <Field label={t("menuMgmt.field.prepTime")}>
          <input inputMode="numeric" value={prepTimeMinutes} onChange={e => setPrepTimeMinutes(e.target.value.replace(/\D/g, ""))} className={input} />
        </Field>
      </div>
      <DishPhotosEditor item={item} queued={queuedPhotos} onQueuedChange={setQueuedPhotos} />
      <Field label={t("menuMgmt.field.description")}>
        <input value={description} onChange={e => setDescription(e.target.value)} className={input} />
      </Field>
      <Field label={t("menuMgmt.field.allergens")}>
        <input value={allergens} onChange={e => setAllergens(e.target.value)} placeholder={t("menuMgmt.item.allergensPlaceholder")} className={input} />
      </Field>
      <Field label={t("menuMgmt.field.kitchenStation")}>
        <select value={kitchenStationId} onChange={e => setKitchenStationId(e.target.value)} className={input}>
          <option value="">{t("menuMgmt.field.useCategoryDefault")}</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.displayName ?? s.name}</option>)}
        </select>
      </Field>

      {allGroups.length > 0 && (
        <div>
          <span className="block text-sm font-bold text-muted-foreground mb-1.5">{t("menuMgmt.item.modifierGroups")}</span>
          <div className="grid grid-cols-2 gap-2">
            {allGroups.map((g: ModifierGroup) => {
              const active = selectedGroupIds.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                  className={cn("min-h-12 px-3 py-2 rounded-xl border-2 text-start flex items-center gap-2 text-base font-bold",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/50")}>
                  <span className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0", active ? "bg-primary border-primary" : "border-muted-foreground/50")}>
                    {active && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3.5} />}
                  </span>
                  <span className="truncate">{g.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Switch on={isOnlineOrderable} onChange={setIsOnlineOrderable} label={t("menuMgmt.item.onlineOrderable")} />

      <button className={cn(primaryBtn, "w-full h-14")} disabled={!valid || saving} onClick={handleSave}>
        {saving && <Loader2 className="h-5 w-5 animate-spin" />}{t("menuMgmt.item.save")}
      </button>
      {item && (
        <DeleteButton label={t("menuMgmt.confirm.deleteItemTitle")} pending={deleting}
          message={t("menuMgmt.confirm.deleteMessage", { name: item.name })} onConfirm={onDelete} />
      )}
    </LeftDrawer>
  );
}

// ─── Modifier groups tab ──────────────────────────────────────────────────────

interface ModifierRow { id: string | null; name: string; priceDelta: string; isActive: boolean }

function ModifierGroupsTab() {
  const { t } = useTranslation("restaurant");
  const { data: groups = [], isLoading } = useModifierGroups();
  const create = useCreateModifierGroup();
  const update = useUpdateModifierGroup();
  const del = useDeleteModifierGroup();
  const canCreate = useCan("restaurant.menu.create");
  const canEdit = useCan("restaurant.menu.edit");
  const currency = useCurrency();
  const [editing, setEditing] = React.useState<ModifierGroup | "new" | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-base font-medium text-muted-foreground max-w-2xl">{t("menuMgmt.modifiers.intro")}</p>
        {canCreate && <button onClick={() => setEditing("new")} className={primaryBtn}><Plus className="h-5 w-5" />{t("menuMgmt.modifiers.add")}</button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : groups.length === 0 ? (
        <Empty title={t("menuMgmt.modifiers.empty")} />
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {groups.map(g => (
            <button key={g.id} disabled={!canEdit} onClick={() => setEditing(g)}
              className="rounded-2xl border-2 border-border bg-card p-4 text-start hover:border-primary hover:shadow-lg transition-all">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xl font-black text-foreground">{g.name}</p>
                <span className={cn("text-xs font-extrabold uppercase px-2 py-1 rounded-lg whitespace-nowrap",
                  g.minSelect > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                  {g.minSelect === 0 ? t("menuMgmt.modifiers.optional") : t("menuMgmt.modifiers.requires", { n: g.minSelect })}
                </span>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{t("menuMgmt.modifiers.max", { n: g.maxSelect })}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {g.modifiers.map(m => (
                  <span key={m.id} className={cn("text-sm font-bold px-2.5 py-1 rounded-lg bg-muted text-foreground", !m.isActive && "opacity-40 line-through")}>
                    {m.name}{m.priceDelta !== 0 && <span className="text-muted-foreground"> {m.priceDelta > 0 ? "+" : ""}{formatCurrency(m.priceDelta, currency)}</span>}
                  </span>
                ))}
                {g.modifiers.length === 0 && <span className="text-sm font-semibold text-muted-foreground">{t("menuMgmt.modifiers.noModifiers")}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <ModifierGroupDrawer
          group={editing === "new" ? null : editing}
          deleting={del.isPending}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            if (editing === "new") return;
            try { await del.mutateAsync(editing.id); setEditing(null); } catch { /* hook toasts */ }
          }}
          onSave={async p => {
            try {
              if (editing === "new") await create.mutateAsync(p);
              else await update.mutateAsync({ id: editing.id, ...p });
              setEditing(null);
            } catch { /* hook toasts */ }
          }}
        />
      )}
    </div>
  );
}

function ModifierGroupDrawer({ group, deleting, onClose, onSave, onDelete }: {
  group: ModifierGroup | null; deleting: boolean; onClose: () => void; onDelete: () => void;
  onSave: (p: { name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(group?.name ?? "");
  const [minSelect, setMinSelect] = React.useState(group?.minSelect ?? 0);
  const [maxSelect, setMaxSelect] = React.useState(group?.maxSelect ?? 1);
  const [rows, setRows] = React.useState<ModifierRow[]>(
    group?.modifiers.map(m => ({ id: m.id, name: m.name, priceDelta: m.priceDelta.toString(), isActive: m.isActive })) ??
    [{ id: null, name: "", priceDelta: "", isActive: true }],
  );

  const updateRow = (idx: number, patch: Partial<ModifierRow>) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const valid = name.trim() && maxSelect >= 1 && maxSelect >= minSelect && rows.length > 0 && rows.every(r => r.name.trim());

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-lg">
      <DrawerTitle onClose={onClose}>{t(group ? "menuMgmt.modifiers.editTitle" : "menuMgmt.modifiers.addTitle")}</DrawerTitle>
      <Field label={t("menuMgmt.field.name")}>
        <input autoFocus={!group} value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.modifiers.namePlaceholder")} className={input} />
      </Field>

      {/* Plain questions instead of "min select / max select" */}
      <Switch on={minSelect > 0} label={t("menuMgmt.modifiers.mustChoose")} hint={t("menuMgmt.modifiers.mustChooseHint")}
        onChange={on => { const m = on ? 1 : 0; setMinSelect(m); if (maxSelect < m) setMaxSelect(m); }} />
      {minSelect > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-foreground">{t("menuMgmt.modifiers.atLeast")}</span>
          <Stepper value={minSelect} min={1} onChange={v => { setMinSelect(v); if (maxSelect < v) setMaxSelect(v); }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-bold text-foreground">{t("menuMgmt.modifiers.atMost")}</span>
        <Stepper value={maxSelect} min={Math.max(1, minSelect)} onChange={setMaxSelect} />
      </div>

      <span className="block text-sm font-bold text-muted-foreground pt-1">{t("menuMgmt.modifiers.listLabel")}</span>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className={cn("flex items-center gap-2", !r.isActive && "opacity-50")}>
            <input value={r.name} onChange={e => updateRow(i, { name: e.target.value })} placeholder={t("menuMgmt.modifiers.rowNamePlaceholder")} className={cn(input, "flex-1")} />
            <input inputMode="decimal" value={r.priceDelta} onChange={e => updateRow(i, { priceDelta: e.target.value.replace(/[^\d.-]/g, "") })}
              placeholder={t("menuMgmt.modifiers.rowPricePlaceholder")} className={cn(input, "w-24 text-end tabular-nums")} />
            <button type="button" onClick={() => updateRow(i, { isActive: !r.isActive })} title={t("menuMgmt.field.active")}
              className={cn("h-12 w-12 rounded-xl border-2 flex items-center justify-center shrink-0", r.isActive ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground")}>
              <Check className="h-5 w-5" strokeWidth={3} />
            </button>
            <button type="button" onClick={() => setRows(prev => prev.filter((_, x) => x !== i))}
              className="h-12 w-12 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows(prev => [...prev, { id: null, name: "", priceDelta: "", isActive: true }])} className={cn(outlineBtn, "w-full")}>
        <Plus className="h-5 w-5" />{t("menuMgmt.modifiers.addRow")}
      </button>

      <button className={cn(primaryBtn, "w-full h-14")} disabled={!valid}
        onClick={() => onSave({
          name: name.trim(), minSelect, maxSelect,
          modifiers: rows.map((r, i) => ({ id: r.id, name: r.name.trim(), priceDelta: Number(r.priceDelta) || 0, sortOrder: i, isActive: r.isActive })),
        })}>
        {t("menuMgmt.modifiers.save")}
      </button>
      {group && (
        <DeleteButton label={t("menuMgmt.confirm.deleteGroupTitle")} pending={deleting}
          message={t("menuMgmt.confirm.deleteGroupMessage", { name: group.name })} onConfirm={onDelete} />
      )}
    </LeftDrawer>
  );
}
