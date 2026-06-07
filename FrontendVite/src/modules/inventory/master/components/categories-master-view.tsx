import * as React from "react";
import { Plus, Search, Pencil, Trash2, FolderTree, ChevronRight, Loader2 } from "lucide-react";
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

// ── Dialog ────────────────────────────────────────────────────────────────────

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: ProductCategoryDto[];
  editing?: ProductCategoryDto | null;
}

function CategoryDialog({ open, onClose, categories, editing }: CategoryDialogProps) {
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

    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload, isActive });
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  if (!open) return null;

  // Exclude self and descendants from parent list
  const parentOptions = categories.filter(c => !editing || c.id !== editing.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold">{editing ? "Edit Category" : "New Category"}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" required className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Code</label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CAT-001" className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parent Category</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— None (top-level) —</option>
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Optional description…" />
          </div>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : (editing ? "Save Changes" : "Create")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function CategoriesMasterView() {
  const [search, setSearch]       = React.useState("");
  const [dialogOpen, setDialog]   = React.useState(false);
  const [editing, setEditing]     = React.useState<ProductCategoryDto | null>(null);

  const { data: categories = [], isLoading } = useInventoryCategories({ search: search || undefined });
  const deleteCategory = useDeleteInventoryCategory();

  const topLevel    = categories.filter(c => !c.parentId);
  const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);
  const pg = useClientPagination(topLevel, 15);

  const handleEdit   = (c: ProductCategoryDto) => { setEditing(c); setDialog(true); };
  const handleCreate = () => { setEditing(null); setDialog(true); };
  const handleDelete = (c: ProductCategoryDto) => {
    if (c.productCount > 0) {
      toast.error("Cannot delete a category that has products.");
      return;
    }
    if (!confirm(`Delete "${c.name}"?`)) return;
    deleteCategory.mutate(c.id);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Item Categories</h1>
            <p className="text-xs text-muted-foreground">Hierarchical product classification</p>
          </div>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Category
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search categories…" className="pl-8 h-9 text-sm" />
      </div>

      {/* Tree */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No categories found. Create the first one.</div>
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
                      {!cat.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{cat.productCount} product{cat.productCount !== 1 ? "s" : ""}{children.length > 0 ? ` · ${children.length} subcategori${children.length !== 1 ? "es" : "y"}` : ""}</p>
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
                        {!child.isActive && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inactive</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{child.productCount} product{child.productCount !== 1 ? "s" : ""}</p>
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
        label="top-level categories"
      />

      <CategoryDialog
        open={dialogOpen}
        onClose={() => { setDialog(false); setEditing(null); }}
        categories={categories}
        editing={editing}
      />
    </div>
  );
}

