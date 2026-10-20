import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import {
  useAddCopies, useBranches, useCategories, useCreateTitle, useMyBranches, useTransferCopy, useUpdateCopy, useUpdateTitle,
} from "@/hooks/library/use-library";
import {
  MANUAL_COPY_STATUSES, MATERIAL_TYPES, type CopyDto, type TitleDetailDto,
} from "@/lib/library/library.api";
import { Field, Modal, SELECT, num } from "../../shared/ui";

const CONDITIONS = ["new", "good", "fair", "poor", "damaged"] as const;

function SaveButtons({ saving, disabled, onClose, onSave, label }: {
  saving: boolean; disabled?: boolean; onClose: () => void; onSave: () => void; label?: string;
}) {
  const { t } = useTranslation("library");
  return (
    <>
      <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
      <Button size="sm" className="gap-1.5" onClick={onSave} disabled={disabled || saving}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{label ?? t("action.save")}
      </Button>
    </>
  );
}

/** Create or edit a catalogue title. On create it can add the first copies in the same step. */
export function TitleForm({ editing, defaultBranchId, onClose }: {
  editing: TitleDetailDto | null; defaultBranchId: string; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const create = useCreateTitle();
  const update = useUpdateTitle();
  const { branches } = useMyBranches();
  const { data: categories = [] } = useCategories();
  const saving = create.isPending || update.isPending;

  const [f, setF] = React.useState({
    title: editing?.title ?? "", subtitle: editing?.subtitle ?? "", authors: editing?.authors ?? "",
    isbn: editing?.isbn ?? "", publisher: editing?.publisher ?? "",
    year: editing?.publicationYear ? String(editing.publicationYear) : "",
    edition: editing?.edition ?? "", language: editing?.language ?? "", category: editing?.category ?? "",
    materialType: editing?.materialType ?? "book", description: editing?.description ?? "",
    replacementCost: editing ? String(editing.replacementCost || "") : "",
    copies: "1", branchId: defaultBranchId, shelf: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  // The default branch arrives after the first render on a cold load.
  React.useEffect(() => {
    if (!editing && !f.branchId && defaultBranchId) setF(prev => ({ ...prev, branchId: defaultBranchId }));
  }, [defaultBranchId, editing, f.branchId]);

  const copies = editing ? 0 : Math.max(0, Math.floor(num(f.copies)));
  const valid = f.title.trim().length > 0 && (copies === 0 || !!f.branchId);

  const save = () => {
    if (!valid) return;
    const body = {
      title: f.title.trim(), subtitle: f.subtitle || null, authors: f.authors || null, isbn: f.isbn || null,
      publisher: f.publisher || null, publicationYear: f.year ? Math.floor(num(f.year)) : null,
      edition: f.edition || null, language: f.language || null, category: f.category || null,
      materialType: f.materialType, description: f.description || null, replacementCost: num(f.replacementCost),
    };
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: onClose });
    else create.mutate({ ...body, copies, branchId: copies > 0 ? f.branchId : null, shelfLocation: f.shelf || null }, { onSuccess: onClose });
  };

  return (
    <Modal title={editing ? t("catalogue.form.edit") : t("catalogue.form.new")} onClose={onClose} size="lg"
      footer={<SaveButtons saving={saving} disabled={!valid} onClose={onClose} onSave={save} />}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("field.title")} className="sm:col-span-2">
          <Input value={f.title} onChange={set("title")} className="h-9 text-sm" autoFocus />
        </Field>
        <Field label={t("field.subtitle")} className="sm:col-span-2">
          <Input value={f.subtitle} onChange={set("subtitle")} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.authors")} hint={t("field.authorsHint")} className="sm:col-span-2">
          <Input value={f.authors} onChange={set("authors")} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.isbn")}><Input value={f.isbn} onChange={set("isbn")} className="h-9 text-sm" /></Field>
        <Field label={t("field.category")}>
          <Input value={f.category} onChange={set("category")} list="library-categories" className="h-9 text-sm"
            placeholder={t("field.categoryPlaceholder")} />
          <datalist id="library-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label={t("field.publisher")}><Input value={f.publisher} onChange={set("publisher")} className="h-9 text-sm" /></Field>
        <Field label={t("field.year")}>
          <Input type="number" min={1000} max={2200} value={f.year} onChange={set("year")} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.edition")}><Input value={f.edition} onChange={set("edition")} className="h-9 text-sm" /></Field>
        <Field label={t("field.language")}><Input value={f.language} onChange={set("language")} className="h-9 text-sm" /></Field>
        <Field label={t("field.materialType")}>
          <select value={f.materialType} onChange={set("materialType")} className={SELECT}>
            {MATERIAL_TYPES.map(m => <option key={m} value={m}>{t(`material.${m}`)}</option>)}
          </select>
        </Field>
        <Field label={t("field.replacementCost", { currency })} hint={t("field.replacementHint")}>
          <Input type="number" min={0} step="any" value={f.replacementCost} onChange={set("replacementCost")} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.description")} className="sm:col-span-2">
          <textarea value={f.description} onChange={set("description")} rows={3}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
        </Field>
      </div>

      {!editing && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-sm font-semibold">{t("catalogue.form.firstCopies")}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label={t("field.copies")}>
              <Input type="number" min={0} max={500} value={f.copies} onChange={set("copies")} className="h-9 text-sm" />
            </Field>
            <Field label={t("field.branch")}>
              <select value={f.branchId} onChange={set("branchId")} className={SELECT} disabled={copies === 0}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label={t("field.shelf")}>
              <Input value={f.shelf} onChange={set("shelf")} className="h-9 text-sm" disabled={copies === 0} />
            </Field>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("catalogue.form.firstCopiesHint")}</p>
        </div>
      )}
    </Modal>
  );
}

/** Add copies to a title: either a count (barcodes are generated) or the barcodes already on the books. */
export function AddCopiesForm({ title, defaultBranchId, onClose }: {
  title: TitleDetailDto; defaultBranchId: string; onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const add = useAddCopies();
  const { branches } = useMyBranches();

  const [chosenBranch, setBranchId] = React.useState(defaultBranchId);
  // Opened from another branch's title, the default may not be one this user can add to.
  const branchId = branches.some(b => b.id === chosenBranch) ? chosenBranch : (branches[0]?.id ?? "");
  const [count, setCount] = React.useState("1");
  const [barcodes, setBarcodes] = React.useState("");
  const [shelf, setShelf] = React.useState("");
  const [price, setPrice] = React.useState(title.replacementCost ? String(title.replacementCost) : "");
  const [acquiredOn, setAcquiredOn] = React.useState("");

  const typed = barcodes.split(/[\n,;]+/).map(b => b.trim()).filter(Boolean);
  const total = typed.length > 0 ? typed.length : Math.floor(num(count));
  const valid = !!branchId && total >= 1 && total <= 500;

  const save = () => valid && add.mutate({
    titleId: title.id,
    body: {
      branchId, count: total, barcodes: typed.length > 0 ? typed : null, shelfLocation: shelf || null,
      price: num(price), acquiredOn: acquiredOn || null,
    },
  }, { onSuccess: onClose });

  return (
    <Modal title={t("catalogue.addCopies")} subtitle={title.title} onClose={onClose}
      footer={<SaveButtons saving={add.isPending} disabled={!valid} onClose={onClose} onSave={save}
        label={t("catalogue.addCopiesCount", { count: Math.max(total, 0) })} />}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("field.branch")}>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className={SELECT}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label={t("field.copies")}>
          <Input type="number" min={1} max={500} value={typed.length > 0 ? String(typed.length) : count}
            onChange={e => setCount(e.target.value)} disabled={typed.length > 0} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.shelf")}><Input value={shelf} onChange={e => setShelf(e.target.value)} className="h-9 text-sm" /></Field>
        <Field label={t("field.price", { currency })}>
          <Input type="number" min={0} step="any" value={price} onChange={e => setPrice(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.acquiredOn")}>
          <Input type="date" value={acquiredOn} onChange={e => setAcquiredOn(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.barcodes")} hint={t("field.barcodesHint")} className="sm:col-span-2">
          <textarea value={barcodes} onChange={e => setBarcodes(e.target.value)} rows={3}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-mono" />
        </Field>
      </div>
    </Modal>
  );
}

export function CopyForm({ copy, onClose }: { copy: CopyDto; onClose: () => void }) {
  const { t } = useTranslation("library");
  const currency = useCurrency();
  const update = useUpdateCopy();

  const [barcode, setBarcode] = React.useState(copy.barcode);
  const [shelf, setShelf] = React.useState(copy.shelfLocation ?? "");
  const [condition, setCondition] = React.useState(copy.condition);
  const [status, setStatus] = React.useState(copy.status);
  const [price, setPrice] = React.useState(copy.price ? String(copy.price) : "");
  const [acquiredOn, setAcquiredOn] = React.useState(copy.acquiredOn ?? "");
  const [notes, setNotes] = React.useState(copy.notes ?? "");

  // On loan, held and in transit belong to circulation; only the rest can be set by hand.
  const statusEditable = (MANUAL_COPY_STATUSES as string[]).includes(copy.status);

  const save = () => barcode.trim() && update.mutate({
    id: copy.id,
    body: {
      barcode: barcode.trim(), shelfLocation: shelf || null, condition, status: statusEditable ? status : null,
      price: num(price), acquiredOn: acquiredOn || null, notes: notes || null,
    },
  }, { onSuccess: onClose });

  return (
    <Modal title={t("catalogue.copy.edit")} subtitle={copy.title} onClose={onClose}
      footer={<SaveButtons saving={update.isPending} disabled={!barcode.trim()} onClose={onClose} onSave={save} />}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("field.barcode")}><Input value={barcode} onChange={e => setBarcode(e.target.value)} className="h-9 text-sm font-mono" /></Field>
        <Field label={t("field.shelf")}><Input value={shelf} onChange={e => setShelf(e.target.value)} className="h-9 text-sm" /></Field>
        <Field label={t("field.status")} hint={statusEditable ? undefined : t("catalogue.copy.statusLocked")}>
          <select value={status} onChange={e => setStatus(e.target.value)} className={SELECT} disabled={!statusEditable}>
            {(statusEditable ? MANUAL_COPY_STATUSES : [copy.status]).map(s => <option key={s} value={s}>{t(`copyStatus.${s}`)}</option>)}
          </select>
        </Field>
        <Field label={t("field.condition")}>
          <select value={condition} onChange={e => setCondition(e.target.value)} className={SELECT}>
            {CONDITIONS.map(c => <option key={c} value={c}>{t(`condition.${c}`)}</option>)}
          </select>
        </Field>
        <Field label={t("field.price", { currency })}>
          <Input type="number" min={0} step="any" value={price} onChange={e => setPrice(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.acquiredOn")}>
          <Input type="date" value={acquiredOn} onChange={e => setAcquiredOn(e.target.value)} className="h-9 text-sm" />
        </Field>
        <Field label={t("field.notes")} className="sm:col-span-2">
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
        </Field>
      </div>
    </Modal>
  );
}

/** Send a copy to another branch. It shows as in transit until that branch receives it. */
export function TransferForm({ copy, onClose }: { copy: CopyDto; onClose: () => void }) {
  const { t } = useTranslation("library");
  const transfer = useTransferCopy();
  const { data: branches = [] } = useBranches(true);
  const others = branches.filter(b => b.id !== copy.branchId);
  const [toBranchId, setToBranchId] = React.useState("");
  const target = toBranchId || others[0]?.id || "";

  return (
    <Modal title={t("catalogue.transfer.title")} subtitle={`${copy.title} · ${copy.barcode}`} onClose={onClose} size="sm"
      footer={<SaveButtons saving={transfer.isPending} disabled={!target} onClose={onClose} label={t("catalogue.transfer.send")}
        onSave={() => transfer.mutate({ id: copy.id, toBranchId: target }, { onSuccess: onClose })} />}>
      {others.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("catalogue.transfer.noBranches")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("catalogue.transfer.from", { branch: copy.branchName })}</p>
          <Field label={t("catalogue.transfer.to")}>
            <select value={target} onChange={e => setToBranchId(e.target.value)} className={SELECT}>
              {others.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </>
      )}
    </Modal>
  );
}
