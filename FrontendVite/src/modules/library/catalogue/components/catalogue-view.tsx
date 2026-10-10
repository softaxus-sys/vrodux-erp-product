import * as React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { ArrowLeftRight, BookOpen, PackageCheck, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import {
  useCategories, useDeleteCopy, useDeleteTitle, useReceiveCopy, useTitle, useTitles, useWorkingBranch,
} from "@/hooks/library/use-library";
import { copyStatusMeta, type CopyDto } from "@/lib/library/library.api";
import {
  ConfirmDialog, Modal, PageHeader, Pager, Pill, SearchBox, SELECT, TableState, TH, useCanAny, useDebounced,
} from "../../shared/ui";
import { ImportModal } from "../../shared/import-modal";
import { AddCopiesForm, CopyForm, TitleForm, TransferForm } from "./title-forms";

const PAGE_SIZE = 50;
const TRANSFER_PERMS = ["library.catalog.edit", "library.circulation.edit"];

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

function TitleDrawer({ id, branchId, onClose }: { id: string; branchId: string; onClose: () => void }) {
  const { t } = useTranslation("library");
  const { data: title, isLoading, isError, error } = useTitle(id);
  const deleteTitle = useDeleteTitle();
  const deleteCopy = useDeleteCopy();
  const receive = useReceiveCopy();

  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [editCopy, setEditCopy] = React.useState<CopyDto | null>(null);
  const [transferCopy, setTransferCopy] = React.useState<CopyDto | null>(null);
  const [pendingCopy, setPendingCopy] = React.useState<CopyDto | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const iconBtn = "p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-40";

  return (
    <>
      <Modal side size="lg" onClose={onClose}
        title={title?.title ?? t("loading")}
        subtitle={title ? [title.authors, title.publicationYear].filter(Boolean).join(" · ") : undefined}
        footer={title && (
          <>
            <Can permission="library.catalog.delete">
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive me-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />{t("action.delete")}
              </Button>
            </Can>
            <Can permission="library.catalog.edit">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />{t("action.edit")}
              </Button>
            </Can>
            <Can permission="library.catalog.create">
              <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" />{t("catalogue.addCopies")}
              </Button>
            </Can>
          </>
        )}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : isError || !title ? (
          <p className="text-sm text-destructive">{(error as Error)?.message ?? t("loadFailed")}</p>
        ) : (
          <>
            {title.subtitle && <p className="text-sm text-muted-foreground">{title.subtitle}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Detail label={t("field.isbn")} value={title.isbn} />
              <Detail label={t("field.category")} value={title.category} />
              <Detail label={t("field.materialType")} value={t(`material.${title.materialType}`, { defaultValue: title.materialType })} />
              <Detail label={t("field.publisher")} value={title.publisher} />
              <Detail label={t("field.edition")} value={title.edition} />
              <Detail label={t("field.language")} value={title.language} />
            </div>
            {title.description && <p className="text-sm whitespace-pre-wrap">{title.description}</p>}

            {title.waitingReservations > 0 && (
              <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm px-3 py-2">
                {t("catalogue.waitingNote", { count: title.waitingReservations })}
              </p>
            )}

            <div>
              <h3 className="text-sm font-bold mb-2">{t("catalogue.copiesHeading", { count: title.copies.length })}</h3>
              {title.copies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("catalogue.noCopies")}</p>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className={TH}>{t("field.barcode")}</th>
                        <th className={TH}>{t("col.branch")}</th>
                        <th className={TH}>{t("field.status")}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {title.copies.map(c => {
                        const here = c.branchId === branchId;
                        return (
                          <tr key={c.id} className="border-t border-border align-top">
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs font-semibold">{c.barcode}</p>
                              {c.shelfLocation && <p className="text-[11px] text-muted-foreground">{c.shelfLocation}</p>}
                            </td>
                            <td className={cn("px-4 py-3", here && "font-medium")}>
                              {c.branchName}
                              {c.transitToBranchName && <p className="text-[11px] text-muted-foreground">→ {c.transitToBranchName}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <Pill meta={copyStatusMeta(c.status)}>{t(`copyStatus.${c.status}`, { defaultValue: c.status })}</Pill>
                              {c.memberName && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {c.memberName}{c.dueDate && ` · ${t("catalogue.copy.due", { date: formatDate(c.dueDate) })}`}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {c.status === "in_transit" && (
                                  <Can anyOf={TRANSFER_PERMS}>
                                    <button className={iconBtn} title={t("catalogue.copy.receive")} aria-label={t("catalogue.copy.receive")}
                                      disabled={receive.isPending} onClick={() => receive.mutate(c.id)}>
                                      <PackageCheck className="h-3.5 w-3.5" />
                                    </button>
                                  </Can>
                                )}
                                {c.status === "available" && (
                                  <Can anyOf={TRANSFER_PERMS}>
                                    <button className={iconBtn} title={t("catalogue.copy.transfer")} aria-label={t("catalogue.copy.transfer")}
                                      onClick={() => setTransferCopy(c)}>
                                      <ArrowLeftRight className="h-3.5 w-3.5" />
                                    </button>
                                  </Can>
                                )}
                                <Can permission="library.catalog.edit">
                                  <button className={iconBtn} title={t("action.edit")} aria-label={t("action.edit")} onClick={() => setEditCopy(c)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </Can>
                                <Can permission="library.catalog.delete">
                                  <button className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")} title={t("action.delete")}
                                    aria-label={t("action.delete")} onClick={() => setPendingCopy(c)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </Can>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      <AnimatePresence>
        {editing && title && <TitleForm key="edit" editing={title} defaultBranchId={branchId} onClose={() => setEditing(false)} />}
        {adding && title && <AddCopiesForm key="add" title={title} defaultBranchId={branchId} onClose={() => setAdding(false)} />}
        {editCopy && <CopyForm key="copy" copy={editCopy} onClose={() => setEditCopy(null)} />}
        {transferCopy && <TransferForm key="transfer" copy={transferCopy} onClose={() => setTransferCopy(null)} />}
        {pendingCopy && (
          <ConfirmDialog key="del-copy" title={t("catalogue.copy.deleteTitle")} confirmLabel={t("action.delete")}
            body={t("catalogue.copy.deleteBody", { barcode: pendingCopy.barcode })} pending={deleteCopy.isPending}
            onClose={() => setPendingCopy(null)}
            onConfirm={() => deleteCopy.mutate(pendingCopy.id, { onSettled: () => setPendingCopy(null) })} />
        )}
        {confirmDelete && title && (
          <ConfirmDialog key="del-title" title={t("catalogue.deleteTitle")} confirmLabel={t("action.delete")}
            body={t("catalogue.deleteBody", { title: title.title })} pending={deleteTitle.isPending}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => deleteTitle.mutate(title.id, { onSuccess: onClose, onSettled: () => setConfirmDelete(false) })} />
        )}
      </AnimatePresence>
    </>
  );
}

export function CatalogueView() {
  const { t } = useTranslation("library");
  const canView = useCanAny(["library.catalog.view", "library.circulation.view"]);
  const { branchId: workingBranch, branches } = useWorkingBranch();
  const { data: categories = [] } = useCategories(canView);

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [availableOnly, setAvailableOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const term = useDebounced(search.trim());
  React.useEffect(() => { setPage(1); }, [term, category, branchId, availableOnly]);

  const { data, isLoading, isError, error } = useTitles(
    { search: term, category, branchId, availableOnly, page, pageSize: PAGE_SIZE }, canView);
  const rows = data?.items ?? [];

  if (!canView) return <div className="p-12 text-center text-sm text-muted-foreground">{t("noAccess")}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("catalogue.title")} description={t("catalogue.description")}>
        <Can permission="library.catalog.create">
          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-sm" onClick={() => setImporting(true)}>
            <UploadCloud className="h-4 w-4" />{t("import.button")}
          </Button>
          <Button size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />{t("catalogue.add")}
          </Button>
        </Can>
      </PageHeader>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder={t("catalogue.search")} className="flex-1" />
        <select value={category} onChange={e => setCategory(e.target.value)} className={cn(SELECT, "lg:w-48")} aria-label={t("field.category")}>
          <option value="">{t("catalogue.allCategories")}</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={branchId} onChange={e => setBranchId(e.target.value)} className={cn(SELECT, "lg:w-48")} aria-label={t("field.branch")}>
          <option value="">{t("allBranches")}</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer px-1">
          <input type="checkbox" checked={availableOnly} onChange={e => setAvailableOnly(e.target.checked)} />
          {t("catalogue.availableOnly")}
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          <TableState loading={isLoading} error={isError ? (error as Error) : null} empty={rows.length === 0}
            emptyText={term || category || branchId || availableOnly ? t("catalogue.noMatch") : t("catalogue.empty")} icon={BookOpen} />
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className={TH}>{t("field.title")}</th>
                    <th className={TH}>{t("field.category")}</th>
                    <th className={TH}>{t("field.isbn")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.available")}</th>
                    <th className="text-end font-semibold px-4 py-3">{t("col.waiting")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t border-border hover:bg-muted/20 cursor-pointer">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[r.authors, r.publicationYear].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.isbn ?? "—"}</td>
                      <td className="px-4 py-3 text-end tabular-nums">
                        <span className={cn("font-semibold", r.availableCopies > 0 ? "text-success" : "text-muted-foreground")}>{r.availableCopies}</span>
                        <span className="text-muted-foreground"> / {r.totalCopies}</span>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.waitingReservations || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
        </CardContent>
      </Card>

      <AnimatePresence>
        {openId && <TitleDrawer key={openId} id={openId} branchId={workingBranch} onClose={() => setOpenId(null)} />}
        {creating && (
          <TitleForm key="new" editing={null} defaultBranchId={workingBranch} onClose={() => setCreating(false)} />
        )}
        {importing && <ImportModal key="import" kind="titles" defaultBranchId={workingBranch} onClose={() => setImporting(false)} />}
      </AnimatePresence>
    </div>
  );
}
