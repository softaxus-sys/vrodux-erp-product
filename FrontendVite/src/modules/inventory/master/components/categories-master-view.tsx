import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, FolderTree, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useInventoryCategories,
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  useDeleteInventoryCategory,
} from "@/hooks/inventory/use-inventory-categories";
import type { ProductCategoryDto } from "@/lib/inventory/types";
import { ClientPagination, useClientPagination } from "@/components/ui/client-pagination";
import { Can } from "@/components/auth/can";

// ── Dialog ────────────────────────────────────────────────────────────────────

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: ProductCategoryDto[];
  editing?: ProductCategoryDto | null;
}

function CategoryDialog({ open, onClose, categories, editing }: CategoryDialogProps) {
  const { t } = useTranslation("inventory");
  const [name, setName]         = React.useState("");
  const [code, setCode]         = React.useState("");
  const [description, setDesc]  = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  const create = useCreateInventoryCategory();
  const update = useUpdateInventoryCategory();

  React.useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCode(editing.code ?? "");
      setDesc(editing.description ?? "");
      setParentId(editing.parentId ?? "");
      setIsActive(editing.isActive);
    } else {
      setName(""); setCode(""); setDesc(""); setParentId(""); setIsActive(true);
    }
  }, [editing, open]);

  const isPending = create.isPending || update.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name:        name.trim(),
      code:        code.trim() || null,
      description: description.trim() || null,
      parentId:    parentId || null,
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload, isActive });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      // Error is handled by the hook's onError toast — keep dialog open for retry
    }
  };

  if (!open) return null;

  // Exclude self and descendants from parent list
  const parentOptions = categories.filter(c => !editing || c.id !== editing.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold">{editing ? t("categories.editTitle") : t("categories.newTitle")}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.name")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("categories.namePlaceholder")} required className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.code")}</label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CAT-001" className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("categories.parentCategory")}</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">{t("categories.topLevelNone")}</option>
              {parentOptions.filter(c => !c.parentId).map(c => (
                <React.Fragment key={c.id}>
                  <option value={c.id}>{c.name}</option>
                  {parentOptions.filter(sub => sub.parentId === c.id).map(sub => (
                    <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                  ))}
                </React.Fragment>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.description")}</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={t("master.optionalDescription")} />
          </div>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
              <span className="text-sm">{t("master.active")}</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t("master.cancel")}</Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t("master.saving")}</> : (editing ? t("master.saveChanges") : t("master.create"))}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function CategoriesMasterView() {
  const { t } = useTranslation("inventory");
  const [search, setSearch]       = React.useState("");
  const [dialogOpen, setDialog]   = React.useState(false);
  const [editing, setEditing]     = React.useState<ProductCategoryDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ProductCategoryDto | null>(null);

  const { data: categories = [], isLoading } = useInventoryCategories({ search: search || undefined });
  const deleteCategory = useDeleteInventoryCategory();

  const topLevel    = categories.filter(c => !c.parentId);
  const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);
  const pg = useClientPagination(topLevel, 15);

  const handleEdit   = (c: ProductCategoryDto) => { setEditing(c); setDialog(true); };
  const handleCreate = () => { setEditing(null); setDialog(true); };
  const handleDelete = (c: ProductCategoryDto) => {
    if (c.productCount > 0) {
      toast.error(t("categories.cannotDelete"));
      return;
    }
    setPendingDelete(c);
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCategory.mutate(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{t("categories.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("categories.subtitle")}</p>
          </div>
        </div>
        <Can permission="inventory.stock.create">
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("categories.newCategory")}
          </Button>
        </Can>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("categories.search")} className="pl-8 h-9 text-sm" />
      </div>

      {/* Tree */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">{t("categories.empty")}</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {pg.pageItems.map(cat => {
            const children = getChildren(cat.id);
            return (
              <div key={cat.id}>
                {/* Parent row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors group">
                  <FolderTree className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{cat.name}</span>
                      {cat.code && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{cat.code}</span>}
                      {!cat.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{t("master.inactive")}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t("categories.productCount", { count: cat.productCount })}{children.length > 0 ? ` · ${t("categories.subcategoryCount", { count: children.length })}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(cat)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {/* Children rows */}
                {children.map(child => (
                  <div key={child.id} className="flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-muted/20 transition-colors group border-t border-border/50">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{child.name}</span>
                        {child.code && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{child.code}</span>}
                        {!child.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">{t("master.inactive")}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t("categories.productCount", { count: child.productCount })}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(child)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(child)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <ClientPagination
        page={pg.page} totalPages={pg.totalPages} totalCount={pg.totalCount}
        hasPrev={pg.hasPrev} hasNext={pg.hasNext}
        onPrev={() => pg.setPage(p => p - 1)} onNext={() => pg.setPage(p => p + 1)}
        label={t("categories.label")}
      />

      <CategoryDialog
        open={dialogOpen}
        onClose={() => { setDialog(false); setEditing(null); }}
        categories={categories}
        editing={editing}
      />

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t("categories.deleteTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("master.willBeRemoved", { name: pendingDelete.name })}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>{t("master.cancel")}</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteCategory.isPending}>
                {deleteCategory.isPending ? t("master.deleting") : t("master.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

