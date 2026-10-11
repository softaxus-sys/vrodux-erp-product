import * as React from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useCopies, useMyBranches } from "@/hooks/library/use-library";
import { canEncode } from "@/lib/library/barcode";
import { LABEL_LAYOUTS, printLabels, printMemberCards } from "@/lib/library/print";
import type { MemberDto } from "@/lib/library/library.api";
import { Field, Modal, SearchBox, SELECT, num, useDebounced } from "./ui";

const NAME_KEY = "vrodux.library.printName";
const LAYOUT_KEY = "vrodux.library.labelLayout";
const MAX_LABELS = 500;

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private window */ } };

/**
 * The name printed on labels and cards. Starts as the workspace's name and remembers an edit on
 * this device — a branch that prints "Central Library" keeps printing that.
 */
function useLibraryName() {
  const tenantName = useAuthStore(s => s.tenant?.name) ?? "";
  const [name, setName] = React.useState(() => read(NAME_KEY) ?? tenantName);
  const update = (value: string) => { setName(value); write(NAME_KEY, value); };
  return [name, update] as const;
}

function ScaleNote() {
  const { t } = useTranslation("library");
  return <p className="text-[11px] text-muted-foreground">{t("print.scaleNote")}</p>;
}

/**
 * Choose copies and print their barcode labels. Opened for the whole catalogue (filter by branch
 * or by when the copies were added — the usual case after an import), or for one title.
 */
export function LabelsModal({ titleId, titleName, defaultBranchId, onClose }: {
  titleId?: string; titleName?: string; defaultBranchId?: string; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const { branches } = useMyBranches();
  const [libraryName, setLibraryName] = useLibraryName();

  const [branchId, setBranchId] = React.useState(titleId ? "" : (defaultBranchId ?? ""));
  const [addedFrom, setAddedFrom] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [layoutId, setLayoutId] = React.useState(() => read(LAYOUT_KEY) ?? LABEL_LAYOUTS[0].id);
  const [skip, setSkip] = React.useState("0");
  const [showTitle, setShowTitle] = React.useState(true);
  const [showShelf, setShowShelf] = React.useState(true);

  const term = useDebounced(search.trim());
  const { data, isLoading, isError, error } = useCopies({
    titleId, branchId: branchId || undefined, addedFrom: addedFrom || undefined, search: term || undefined, pageSize: MAX_LABELS,
  });
  const copies = data?.items ?? [];

  // A new filter is a new list; ticks from the old one would hide copies the user never saw.
  React.useEffect(() => { setExcluded(new Set()); }, [branchId, addedFrom, term]);

  const layout = LABEL_LAYOUTS.find(l => l.id === layoutId) ?? LABEL_LAYOUTS[0];
  const chosen = copies.filter(c => !excluded.has(c.id));
  const unreadable = chosen.filter(c => !canEncode(c.barcode)).length;
  const allTicked = copies.length > 0 && excluded.size === 0;

  const toggle = (id: string) => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const print = () => printLabels(
    chosen.map(c => ({ barcode: c.barcode, title: c.title, shelf: c.shelfLocation })),
    { layout, skip: layout.page === "A4" ? Math.max(0, Math.floor(num(skip))) : 0, libraryName: libraryName.trim() || null, showTitle, showShelf });

  return (
    <Modal title={t("print.labels.title")} subtitle={titleName} onClose={onClose} size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t("action.close")}</Button>
          <Button size="sm" className="gap-1.5" disabled={chosen.length === 0} onClick={print}>
            <Printer className="h-3.5 w-3.5" />{t("print.labels.print", { count: chosen.length })}
          </Button>
        </>
      }>
      {!titleId && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={t("field.branch")}>
            <select value={branchId} onChange={e => setBranchId(e.target.value)} className={SELECT}>
              <option value="">{t("allBranches")}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label={t("print.labels.addedFrom")}>
            <Input type="date" value={addedFrom} onChange={e => setAddedFrom(e.target.value)} className="h-9 text-sm" />
          </Field>
          <Field label={t("print.labels.find")}>
            <SearchBox value={search} onChange={setSearch} placeholder={t("print.labels.findPlaceholder")} />
          </Field>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <label className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={allTicked}
            onChange={() => setExcluded(allTicked ? new Set(copies.map(c => c.id)) : new Set())} />
          {t("print.labels.chosen", { count: chosen.length, total: copies.length })}
        </label>
        <div className="max-h-56 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t("loading")}</p>
          ) : isError ? (
            <p className="px-3 py-4 text-sm text-destructive">{(error as Error).message}</p>
          ) : copies.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t("print.labels.none")}</p>
          ) : copies.map(c => (
            <label key={c.id} className="flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/20">
              <input type="checkbox" checked={!excluded.has(c.id)} onChange={() => toggle(c.id)} />
              <span className="font-mono text-xs font-semibold w-32 shrink-0 truncate">{c.barcode}</span>
              <span className="flex-1 min-w-0 truncate">{c.title}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{c.branchName}</span>
            </label>
          ))}
        </div>
      </div>
      {(data?.total ?? 0) > copies.length && (
        <p className="text-[11px] text-amber-600">{t("print.labels.capped", { shown: copies.length, total: data?.total ?? 0 })}</p>
      )}
      {unreadable > 0 && <p className="text-[11px] text-amber-600">{t("print.labels.unreadable", { count: unreadable })}</p>}

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label={t("print.labels.stock")} className="sm:col-span-2">
          <select value={layout.id} onChange={e => { setLayoutId(e.target.value); write(LAYOUT_KEY, e.target.value); }} className={SELECT}>
            {LABEL_LAYOUTS.map(l => <option key={l.id} value={l.id}>{t(`print.labels.layout.${l.id}`)}</option>)}
          </select>
        </Field>
        <Field label={t("print.labels.skip")} hint={layout.page === "A4" ? t("print.labels.skipHint") : undefined}>
          <Input type="number" min={0} max={layout.cols * layout.rows - 1} value={skip} disabled={layout.page !== "A4"}
            onChange={e => setSkip(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label={t("print.libraryName")} className="sm:col-span-2">
          <Input value={libraryName} onChange={e => setLibraryName(e.target.value)} className="h-9 text-sm" />
        </Field>
        <div className="flex flex-col justify-end gap-1.5 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showTitle} onChange={e => setShowTitle(e.target.checked)} />{t("print.labels.showTitle")}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showShelf} onChange={e => setShowShelf(e.target.checked)} />{t("print.labels.showShelf")}
          </label>
        </div>
      </div>
      <ScaleNote />
    </Modal>
  );
}

/** Print library cards for the given members — one, or everyone on the list being looked at. */
export function CardsModal({ members, onClose }: { members: MemberDto[]; onClose: () => void }) {
  const { t } = useTranslation("library");
  const [libraryName, setLibraryName] = useLibraryName();
  const [layout, setLayout] = React.useState<"a4" | "card">("a4");
  const unreadable = members.filter(m => !canEncode(m.memberNumber)).length;

  const print = () => printMemberCards(
    members.map(m => ({ memberNumber: m.memberNumber, fullName: m.fullName, membershipType: m.membershipTypeName, expiresOn: m.expiresOn })),
    { layout, libraryName: libraryName.trim() || null, validUntilLabel: t("print.cards.validUntil"), formatDate: d => formatDate(d) });

  return (
    <Modal title={t("print.cards.title")} onClose={onClose} size="sm"
      subtitle={members.length === 1 ? members[0].fullName : t("print.cards.count", { count: members.length })}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>{t("action.close")}</Button>
          <Button size="sm" className="gap-1.5" disabled={members.length === 0} onClick={print}>
            <Printer className="h-3.5 w-3.5" />{t("print.cards.print", { count: members.length })}
          </Button>
        </>
      }>
      <Field label={t("print.libraryName")}>
        <Input value={libraryName} onChange={e => setLibraryName(e.target.value)} className="h-9 text-sm" />
      </Field>
      <Field label={t("print.cards.paper")}>
        <div className="grid grid-cols-2 gap-2">
          {(["a4", "card"] as const).map(x => (
            <button key={x} onClick={() => setLayout(x)}
              className={cn("rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                layout === x ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30")}>
              <span className="font-medium block">{t(`print.cards.layout.${x}`)}</span>
              <span className="text-[11px] text-muted-foreground">{t(`print.cards.layoutHint.${x}`)}</span>
            </button>
          ))}
        </div>
      </Field>
      {unreadable > 0 && <p className="text-[11px] text-amber-600">{t("print.cards.unreadable", { count: unreadable })}</p>}
      <ScaleNote />
    </Modal>
  );
}
