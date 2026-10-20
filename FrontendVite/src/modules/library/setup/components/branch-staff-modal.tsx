import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/identity/use-users";
import { useSetBranchStaff } from "@/hooks/library/use-library";
import type { BranchDto } from "@/lib/library/library.api";
import { Field, Modal, SearchBox, useDebounced } from "../../shared/ui";

/**
 * Who works at a branch. Anyone listed here is limited to this branch (and any other they are
 * listed under); staff listed nowhere can work at every branch.
 */
export function BranchStaffModal({ branch, onClose }: { branch: BranchDto; onClose: () => void }) {
  const { t } = useTranslation("library");
  const save = useSetBranchStaff();
  const [staff, setStaff] = React.useState(branch.staff);
  const [search, setSearch] = React.useState("");
  const term = useDebounced(search.trim());
  const { data, isFetching } = useUsers({ search: term, pageSize: 8 }, term.length >= 2);

  const found = (data?.items ?? []).filter(u => !staff.some(s => s.userId === u.id));
  const dirty = staff.length !== branch.staff.length || staff.some(s => !branch.staff.some(b => b.userId === s.userId));

  return (
    <Modal title={t("setup.staff.title")} subtitle={branch.name} onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={save.isPending}>{t("action.cancel")}</Button>
          <Button size="sm" className="gap-1.5" disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ branchId: branch.id, staff }, { onSuccess: onClose })}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t("action.save")}
          </Button>
        </>
      }>
      <p className="text-sm text-muted-foreground">{t("setup.staff.explain")}</p>

      <Field label={t("setup.staff.assigned", { count: staff.length })}>
        {staff.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">{t("setup.staff.none")}</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {staff.map(s => (
              <li key={s.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{s.userName}</span>
                <button onClick={() => setStaff(prev => prev.filter(x => x.userId !== s.userId))}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={t("setup.staff.remove")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field label={t("setup.staff.add")}>
        <SearchBox value={search} onChange={setSearch} placeholder={t("setup.staff.search")} />
        {term.length >= 2 && (
          <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y divide-border mt-1.5">
            {isFetching ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("loading")}</p>
            ) : found.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{t("setup.staff.noUsers")}</p>
            ) : found.map(u => (
              <button key={u.id} className="w-full text-start px-3 py-2 text-sm hover:bg-muted/40"
                onClick={() => { setStaff(prev => [...prev, { userId: u.id, userName: u.fullName || u.username }]); setSearch(""); }}>
                <p className="font-medium truncate">{u.fullName || u.username}</p>
                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
              </button>
            ))}
          </div>
        )}
      </Field>
    </Modal>
  );
}
