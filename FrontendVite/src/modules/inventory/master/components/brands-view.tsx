import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, Tag, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from "@/hooks/inventory/use-brands";
import type { BrandDto } from "@/lib/inventory/types";
import { ClientPagination, useClientPagination } from "@/components/ui/client-pagination";
import { Can } from "@/components/auth/can";
import { toast } from "sonner";

// ── Dialog ────────────────────────────────────────────────────────────────────

interface BrandDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: BrandDto | null;
}

function BrandDialog({ open, onClose, editing }: BrandDialogProps) {
  const { t } = useTranslation("inventory");
  const [name, setName]         = React.useState("");
  const [code, setCode]         = React.useState("");
  const [description, setDesc]  = React.useState("");
  const [logoUrl, setLogoUrl]   = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  const create = useCreateBrand();
  const update = useUpdateBrand();

  React.useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCode(editing.code ?? "");
      setDesc(editing.description ?? "");
      setLogoUrl(editing.logoUrl ?? "");
      setIsActive(editing.isActive);
    } else {
      setName(""); setCode(""); setDesc(""); setLogoUrl(""); setIsActive(true);
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
      logoUrl:     logoUrl.trim() || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold">{editing ? t("brands.editTitle") : t("brands.newTitle")}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.name")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("brands.namePlaceholder")} required className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.code")}</label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="BRD-001" className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("master.description")}</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={t("master.optionalDescription")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("brands.logoUrl")}</label>
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" className="h-9 text-sm" />
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

export function BrandsView() {
  const { t } = useTranslation("inventory");
  const [search, setSearch]     = React.useState("");
  const [dialogOpen, setDialog] = React.useState(false);
  const [editing, setEditing]   = React.useState<BrandDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<BrandDto | null>(null);

  const { data: brands = [], isLoading } = useBrands({ search: search || undefined });
  const deleteBrand = useDeleteBrand();
  const pg = useClientPagination(brands, 20);

  const handleEdit   = (b: BrandDto) => { setEditing(b); setDialog(true); };
  const handleCreate = () => { setEditing(null); setDialog(true); };
  const handleDelete = (b: BrandDto) => {
    if (b.productCount > 0) {
      toast.error(t("brands.cannotDelete"));
      return;
    }
    setPendingDelete(b);
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteBrand.mutate(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{t("brands.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("brands.subtitle")}</p>
          </div>
        </div>
        <Can permission="inventory.stock.create">
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("brands.newBrand")}
          </Button>
        </Can>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("brands.search")} className="pl-8 h-9 text-sm" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">{t("brands.empty")}</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("brands.colBrand")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("master.code")}</th>
                <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("master.products")}</th>
                <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("master.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pg.pageItems.map(b => (
                <tr key={b.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {b.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logoUrl} alt={b.name} className="w-6 h-6 rounded object-contain" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                          <Tag className="w-3 h-3 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{b.name}</p>
                        {b.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{b.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.code ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{b.productCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${b.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {b.isActive ? t("master.active") : t("master.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(b)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientPagination
        page={pg.page} totalPages={pg.totalPages} totalCount={pg.totalCount}
        hasPrev={pg.hasPrev} hasNext={pg.hasNext}
        onPrev={() => pg.setPage(p => p - 1)} onNext={() => pg.setPage(p => p + 1)}
        label={t("brands.label")}
      />

      <BrandDialog open={dialogOpen} onClose={() => { setDialog(false); setEditing(null); }} editing={editing} />

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t("brands.deleteTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("master.willBeRemoved", { name: pendingDelete.name })}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>{t("master.cancel")}</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleteBrand.isPending}>
                {deleteBrand.isPending ? t("master.deleting") : t("master.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

