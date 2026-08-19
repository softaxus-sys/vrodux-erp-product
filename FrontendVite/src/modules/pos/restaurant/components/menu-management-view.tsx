import * as React from "react";
import { Link } from "react-router-dom";
import {
  Plus, X, Trash2, Pencil, ChevronDown, ChevronRight, Loader2, UtensilsCrossed,
  Layers, CheckCircle2, Ban, Sliders, ChefHat, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeftDrawer } from "@/components/ui/left-drawer";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCan } from "@/components/auth/can";
import {
  useMenu, useMenuSummary, useKitchenStations,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useSetItemAvailability,
  useModifierGroups, useCreateModifierGroup, useUpdateModifierGroup, useDeleteModifierGroup,
  useItemModifierGroups, useAssignItemModifierGroups,
} from "@/hooks/restaurant/use-restaurant";
import { useRecipes } from "@/hooks/recipe/use-recipe";
import type { MenuCategory, MenuItem, ModifierGroup } from "@/lib/restaurant/restaurant.api";
import { useTranslation } from "react-i18next";

type Tab = "menu" | "modifiers";

export function MenuManagementView() {
  const { t } = useTranslation("restaurant");
  const [tab, setTab] = React.useState<Tab>("menu");

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-primary" /> {t("menuMgmt.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("menuMgmt.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")} icon={Layers}>{t("menuMgmt.tabMenu")}</TabButton>
        <TabButton active={tab === "modifiers"} onClick={() => setTab("modifiers")} icon={Sliders}>{t("menuMgmt.tabModifiers")}</TabButton>
      </div>

      {tab === "menu" ? <MenuTab /> : <ModifierGroupsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: {
  active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={cn("px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function ConfirmModal({ title, message, onCancel, onConfirm, pending }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void; pending?: boolean;
}) {
  const { t } = useTranslation("restaurant");
  return (
    <LeftDrawer onClose={onCancel} widthClassName="max-w-sm" zIndexClassName="z-[60]">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("menuMgmt.cancel")}</Button>
        <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
          {pending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} {t("menuMgmt.delete")}
        </Button>
      </div>
    </LeftDrawer>
  );
}

// ─── Menu tab (categories + items) ────────────────────────────────────────────

function MenuTab() {
  const { t } = useTranslation("restaurant");
  const { data: categories = [], isLoading } = useMenu();
  const { data: summary } = useMenuSummary();
  const { data: stations = [] } = useKitchenStations();
  const { data: recipes = [] } = useRecipes();
  const currency = useAuthStore(s => s.tenant?.currency) || "AED";
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

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = React.useState<MenuCategory | "new" | null>(null);
  const [editingItem, setEditingItem] = React.useState<{ item: MenuItem | null; categoryId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ kind: "category" | "item"; id: string; name: string } | null>(null);

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const stationName = (id: string | null) => id ? (stations.find(s => s.id === id)?.displayName ?? stations.find(s => s.id === id)?.name ?? "—") : null;

  const linkedMenuItemIds = React.useMemo(() => new Set(recipes.map(r => r.menuItemId)), [recipes]);
  const totalItemCount = React.useMemo(() => categories.reduce((n, c) => n + c.items.length, 0), [categories]);
  const unlinkedItemCount = React.useMemo(
    () => categories.reduce((n, c) => n + c.items.filter(i => !linkedMenuItemIds.has(i.id)).length, 0),
    [categories, linkedMenuItemIds],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "category") await deleteCategory.mutateAsync(deleteTarget.id);
      else await deleteItem.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // hook's onError already toasted; keep the modal open for retry
    }
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label={t("menuMgmt.stat.categories")} value={summary.totalCategories} />
          <StatCard label={t("menuMgmt.stat.totalItems")} value={summary.totalItems} />
          <StatCard label={t("menuMgmt.stat.available")} value={summary.availableItems} />
          <StatCard label={t("menuMgmt.stat.unavailable")} value={summary.unavailableItems} />
          <StatCard label={t("menuMgmt.stat.avgPrice")} value={formatCurrency(summary.avgPrice, currency)} />
          <StatCard label={t("menuMgmt.stat.priceRange")} value={`${formatCurrency(summary.minPrice, currency)} – ${formatCurrency(summary.maxPrice, currency)}`} />
        </div>
      )}

      {totalItemCount > 0 && unlinkedItemCount > 0 && (
        <Link to="/recipe/recipes" className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning hover:bg-warning/15 transition-colors">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t("menuMgmt.recipeWarning", { unlinked: unlinkedItemCount, total: totalItemCount })}</span>
        </Link>
      )}

      {canCreate && (
        <Button size="sm" onClick={() => setEditingCategory("new")}>
          <Plus className="w-4 h-4 mr-1" /> {t("menuMgmt.addCategory")}
        </Button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> {t("menuMgmt.loading")}</div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">{t("menuMgmt.emptyCategories")}</p>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const isOpen = expanded.has(cat.id);
            return (
              <div key={cat.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggleExpanded(cat.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <p className="font-semibold text-foreground truncate">{cat.name}</p>
                    <span className="text-xs text-muted-foreground">({cat.items.length})</span>
                    {stationName(cat.kitchenStationId) && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground">{stationName(cat.kitchenStationId)}</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingItem({ item: null, categoryId: cat.id })} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {t("menuMgmt.addItemShort")}
                      </button>
                      <button onClick={() => setEditingCategory(cat)} className="p-1 rounded hover:bg-muted/40">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeleteTarget({ kind: "category", id: cat.id, name: cat.name })} className="p-1 rounded hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-border">
                    {cat.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-4 py-4">{t("menuMgmt.emptyItems")}</p>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {cat.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                                {item.modifierGroups.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{t("menuMgmt.modifierCount", { count: item.modifierGroups.length })}</span>
                                )}
                                <Link to="/recipe/recipes" title={linkedMenuItemIds.has(item.id) ? t("menuMgmt.recipeLinked") : t("menuMgmt.recipeMissing")}
                                  className={cn("shrink-0", linkedMenuItemIds.has(item.id) ? "text-success" : "text-muted-foreground/50 hover:text-warning")}>
                                  <ChefHat className="w-3 h-3" />
                                </Link>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {formatCurrency(item.price, currency)} · {t("menuMgmt.prepMinutes", { n: item.prepTimeMinutes })}
                                {item.allergens ? ` · ${item.allergens}` : ""}
                                {stationName(item.kitchenStationId) ? ` · ${stationName(item.kitchenStationId)}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => canEdit && setAvailability.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                                disabled={!canEdit}
                                className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1",
                                  item.isAvailable ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground")}>
                                {item.isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                {item.isAvailable ? t("menuMgmt.available86") : t("menuMgmt.unavailable86")}
                              </button>
                              {canEdit && (
                                <>
                                  <button onClick={() => setEditingItem({ item, categoryId: cat.id })} className="p-1 rounded hover:bg-muted/40">
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                  <button onClick={() => setDeleteTarget({ kind: "item", id: item.id, name: item.name })} className="p-1 rounded hover:bg-destructive/10">
                                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory === "new" ? null : editingCategory}
          stations={stations}
          onClose={() => setEditingCategory(null)}
          onSave={async p => {
            try {
              if (editingCategory === "new") await createCategory.mutateAsync(p);
              else await updateCategory.mutateAsync({ id: editingCategory.id, name: p.name, description: p.description, sortOrder: p.sortOrder });
              setEditingCategory(null);
            } catch { /* hook's onError already toasted */ }
          }}
        />
      )}

      {editingItem && (
        <ItemModal
          item={editingItem.item}
          categoryId={editingItem.categoryId}
          stations={stations}
          onClose={() => setEditingItem(null)}
          onSave={async (p, modifierGroupIds) => {
            try {
              let itemId = editingItem.item?.id;
              if (editingItem.item) {
                await updateItem.mutateAsync({ id: editingItem.item.id, ...p });
              } else {
                const created = await createItem.mutateAsync({ categoryId: editingItem.categoryId, ...p });
                itemId = created.id;
              }
              if (itemId) await assignGroups.mutateAsync({ itemId, modifierGroupIds });
              setEditingItem(null);
            } catch { /* hook's onError already toasted */ }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t(deleteTarget.kind === "category" ? "menuMgmt.confirm.deleteCategoryTitle" : "menuMgmt.confirm.deleteItemTitle")}
          message={t("menuMgmt.confirm.deleteMessage", { name: deleteTarget.name })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          pending={deleteCategory.isPending || deleteItem.isPending}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, stations, onClose, onSave }: {
  category: MenuCategory | null;
  stations: { id: string; name: string; displayName: string | null }[];
  onClose: () => void;
  onSave: (p: { name: string; description?: string | null; sortOrder: number; kitchenStationId?: string | null }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(category?.name ?? "");
  const [description, setDescription] = React.useState(category?.description ?? "");
  const [sortOrder, setSortOrder] = React.useState(category?.sortOrder?.toString() ?? "0");
  const [kitchenStationId, setKitchenStationId] = React.useState(category?.kitchenStationId ?? "");

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(category ? "menuMgmt.category.editTitle" : "menuMgmt.category.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.category.namePlaceholder")} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.description")}</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.sortOrder")}</label>
          <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.kitchenStation")}</label>
          <select value={kitchenStationId} onChange={e => setKitchenStationId(e.target.value)}
            className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
            <option value="">{t("menuMgmt.field.none")}</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.displayName ?? s.name}</option>)}
          </select></div>
      </div>
      <Button className="w-full" disabled={!name.trim()}
        onClick={() => onSave({
          name: name.trim(), description: description.trim() || null,
          sortOrder: Number(sortOrder) || 0, kitchenStationId: kitchenStationId || null,
        })}>
        {t("menuMgmt.category.save")}
      </Button>
    </LeftDrawer>
  );
}

function ItemModal({ item, categoryId, stations, onClose, onSave }: {
  item: MenuItem | null; categoryId: string;
  stations: { id: string; name: string; displayName: string | null }[];
  onClose: () => void;
  onSave: (
    p: { name: string; description?: string | null; price: number; prepTimeMinutes: number; allergens?: string | null; kitchenStationId?: string | null; isOnlineOrderable: boolean },
    modifierGroupIds: string[],
  ) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(item?.name ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [price, setPrice] = React.useState(item?.price?.toString() ?? "");
  const [prepTimeMinutes, setPrepTimeMinutes] = React.useState(item?.prepTimeMinutes?.toString() ?? "10");
  const [allergens, setAllergens] = React.useState(item?.allergens ?? "");
  const [kitchenStationId, setKitchenStationId] = React.useState(item?.kitchenStationId ?? "");
  const [isOnlineOrderable, setIsOnlineOrderable] = React.useState(item?.isOnlineOrderable ?? true);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>(item?.modifierGroups.map(g => g.id) ?? []);
  const [saving, setSaving] = React.useState(false);

  const { data: allGroups = [] } = useModifierGroups();
  const { data: assignedIds } = useItemModifierGroups(item?.id ?? null);

  React.useEffect(() => {
    if (assignedIds) setSelectedGroupIds(assignedIds);
  }, [assignedIds]);

  const toggleGroup = (id: string) => setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const valid = name.trim() && Number(price) >= 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(), description: description.trim() || null, price: Number(price),
        prepTimeMinutes: Number(prepTimeMinutes) || 0, allergens: allergens.trim() || null,
        kitchenStationId: kitchenStationId || null, isOnlineOrderable,
      }, selectedGroupIds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(item ? "menuMgmt.item.editTitle" : "menuMgmt.item.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.item.namePlaceholder")} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.description")}</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.price")}</label>
          <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.prepTime")}</label>
          <Input type="number" min={0} value={prepTimeMinutes} onChange={e => setPrepTimeMinutes(e.target.value)} className="h-9 text-sm" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.allergens")}</label>
        <Input value={allergens} onChange={e => setAllergens(e.target.value)} placeholder={t("menuMgmt.item.allergensPlaceholder")} className="h-9 text-sm" /></div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.kitchenStation")}</label>
        <select value={kitchenStationId} onChange={e => setKitchenStationId(e.target.value)}
          className="w-full h-9 text-sm rounded-md border border-border bg-card px-2">
          <option value="">{t("menuMgmt.field.useCategoryDefault")}</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.displayName ?? s.name}</option>)}
        </select></div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={isOnlineOrderable} onChange={e => setIsOnlineOrderable(e.target.checked)} />
        {t("menuMgmt.item.onlineOrderable")}
      </label>

      {allGroups.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">{t("menuMgmt.item.modifierGroups")}</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {allGroups.map((g: ModifierGroup) => {
              const active = selectedGroupIds.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                  className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border",
                    active ? "bg-primary/10 border-primary text-primary" : "bg-muted/30 border-border text-muted-foreground")}>
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!valid || saving} onClick={handleSave}>
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {t("menuMgmt.item.save")}
      </Button>
    </LeftDrawer>
  );
}

// ─── Modifier Groups tab ───────────────────────────────────────────────────────

interface ModifierRow { id: string | null; name: string; priceDelta: string; isActive: boolean }

function ModifierGroupsTab() {
  const { t } = useTranslation("restaurant");
  const { data: groups = [], isLoading } = useModifierGroups();
  const create = useCreateModifierGroup();
  const update = useUpdateModifierGroup();
  const del = useDeleteModifierGroup();
  const canCreate = useCan("restaurant.menu.create");
  const canEdit = useCan("restaurant.menu.edit");
  const currency = useAuthStore(s => s.tenant?.currency) || "AED";

  const [editing, setEditing] = React.useState<ModifierGroup | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch { /* hook's onError already toasted */ }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("menuMgmt.modifiers.intro")}
      </p>
      {canCreate && <Button size="sm" onClick={() => setEditing("new")}><Plus className="w-4 h-4 mr-1" /> {t("menuMgmt.modifiers.add")}</Button>}

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="animate-spin mr-2 h-5 w-5" /> {t("menuMgmt.loading")}</div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">{t("menuMgmt.modifiers.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(g => (
            <div key={g.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{g.name}</p>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(g)} className="p-1 rounded hover:bg-muted/40">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setDeleteTarget({ id: g.id, name: g.name })} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {g.minSelect === 0 ? t("menuMgmt.modifiers.optional") : t("menuMgmt.modifiers.requires", { n: g.minSelect })} · {t("menuMgmt.modifiers.max", { n: g.maxSelect })}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {g.modifiers.map(m => (
                  <span key={m.id} className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground">
                    {m.name}{m.priceDelta !== 0 ? ` (+${formatCurrency(m.priceDelta, currency)})` : ""}
                  </span>
                ))}
                {g.modifiers.length === 0 && <span className="text-[11px] text-muted-foreground">{t("menuMgmt.modifiers.noModifiers")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ModifierGroupModal
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async p => {
            try {
              if (editing === "new") await create.mutateAsync(p);
              else await update.mutateAsync({ id: editing.id, ...p });
              setEditing(null);
            } catch { /* hook's onError already toasted */ }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t("menuMgmt.confirm.deleteGroupTitle")}
          message={t("menuMgmt.confirm.deleteGroupMessage", { name: deleteTarget.name })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          pending={del.isPending}
        />
      )}
    </div>
  );
}

function ModifierGroupModal({ group, onClose, onSave }: {
  group: ModifierGroup | null;
  onClose: () => void;
  onSave: (p: { name: string; minSelect: number; maxSelect: number; modifiers: { id?: string | null; name: string; priceDelta: number; sortOrder: number; isActive?: boolean }[] }) => void;
}) {
  const { t } = useTranslation("restaurant");
  const [name, setName] = React.useState(group?.name ?? "");
  const [minSelect, setMinSelect] = React.useState(group?.minSelect?.toString() ?? "0");
  const [maxSelect, setMaxSelect] = React.useState(group?.maxSelect?.toString() ?? "1");
  const [rows, setRows] = React.useState<ModifierRow[]>(
    group?.modifiers.map(m => ({ id: m.id, name: m.name, priceDelta: m.priceDelta.toString(), isActive: m.isActive })) ??
    [{ id: null, name: "", priceDelta: "0", isActive: true }],
  );

  const updateRow = (idx: number, patch: Partial<ModifierRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const valid = name.trim() && Number(minSelect) >= 0 && Number(maxSelect) >= 1 &&
    Number(maxSelect) >= Number(minSelect) && rows.every(r => r.name.trim());

  const handleSave = () => onSave({
    name: name.trim(), minSelect: Number(minSelect) || 0, maxSelect: Number(maxSelect) || 1,
    modifiers: rows.map((r, i) => ({ id: r.id, name: r.name.trim(), priceDelta: Number(r.priceDelta) || 0, sortOrder: i, isActive: r.isActive })),
  });

  return (
    <LeftDrawer onClose={onClose} widthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{t(group ? "menuMgmt.modifiers.editTitle" : "menuMgmt.modifiers.addTitle")}</p>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.name")}</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("menuMgmt.modifiers.namePlaceholder")} className="h-9 text-sm" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.minSelect")}</label>
          <Input type="number" min={0} value={minSelect} onChange={e => setMinSelect(e.target.value)} className="h-9 text-sm" /></div>
        <div><label className="text-xs text-muted-foreground">{t("menuMgmt.field.maxSelect")}</label>
          <Input type="number" min={1} value={maxSelect} onChange={e => setMaxSelect(e.target.value)} className="h-9 text-sm" /></div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground">{t("menuMgmt.modifiers.listLabel")}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 border border-border rounded-lg p-2">
            <Input value={r.name} onChange={e => updateRow(i, { name: e.target.value })} placeholder={t("menuMgmt.modifiers.rowNamePlaceholder")} className="h-8 text-xs flex-1" />
            <Input type="number" step="0.01" value={r.priceDelta} onChange={e => updateRow(i, { priceDelta: e.target.value })} placeholder={t("menuMgmt.modifiers.rowPricePlaceholder")} className="h-8 w-20 text-xs" />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <input type="checkbox" checked={r.isActive} onChange={e => updateRow(i, { isActive: e.target.checked })} /> {t("menuMgmt.field.active")}
            </label>
            <button onClick={() => setRows(prev => prev.filter((_, x) => x !== i))}>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline"
        onClick={() => setRows(prev => [...prev, { id: null, name: "", priceDelta: "0", isActive: true }])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> {t("menuMgmt.modifiers.addRow")}
      </Button>

      <Button className="w-full" disabled={!valid} onClick={handleSave}>{t("menuMgmt.modifiers.save")}</Button>
    </LeftDrawer>
  );
}
