import * as React from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";
import type { ListingVariant, ProductOption, VariantInput } from "@/lib/inventory/listings.api";

export const MAX_OPTIONS = 3;
export const MAX_VARIANTS = 250;

const field = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40";

// ── Option choices ────────────────────────────────────────────────────────────

/** The same key the server uses: order-independent and case-insensitive. */
export const comboKey = (choices: Record<string, string>) =>
  Object.entries(choices)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k.trim().toLowerCase()}=${v.trim().toLowerCase()}`)
    .join("|");

/** Every combination of the options' values — Size × Colour. No options = one empty combination. */
export function generateCombos(options: ProductOption[]): Record<string, string>[] {
  const usable = options.filter(o => o.name.trim() && o.values.length > 0);
  return usable.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap(c => o.values.map(v => ({ ...c, [o.name.trim()]: v }))),
    [{}],
  );
}

export function OptionsEditor({ options, onChange, disabled }: {
  options: ProductOption[]; onChange: (o: ProductOption[]) => void; disabled?: boolean;
}) {
  const { t } = useTranslation("inventory");
  const [drafts, setDrafts] = React.useState<Record<number, string>>({});

  const set = (i: number, patch: Partial<ProductOption>) =>
    onChange(options.map((o, x) => x === i ? { ...o, ...patch } : o));

  const commit = (i: number) => {
    const raw = (drafts[i] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (raw.length === 0) return;
    const have = new Set(options[i].values.map(v => v.toLowerCase()));
    const next = [...options[i].values];
    for (const v of raw) if (!have.has(v.toLowerCase())) { have.add(v.toLowerCase()); next.push(v); }
    set(i, { values: next });
    setDrafts(d => ({ ...d, [i]: "" }));
  };

  return (
    <div className="space-y-3">
      {options.map((o, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Input value={o.name} disabled={disabled} maxLength={50}
              onChange={e => set(i, { name: e.target.value })}
              placeholder={t("listings.options.namePlaceholder")} className="h-8 text-sm max-w-[220px]" />
            {!disabled && (
              <button type="button" title={t("listings.options.removeOption")}
                onClick={() => onChange(options.filter((_, x) => x !== i))}
                className="ms-auto h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {o.values.map(v => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold ps-2.5 pe-1 py-0.5">
                {v}
                {!disabled && (
                  <button type="button" aria-label={t("listings.options.removeValue", { value: v })}
                    onClick={() => set(i, { values: o.values.filter(x => x !== v) })}
                    className="h-4 w-4 rounded-full hover:bg-primary/20 flex items-center justify-center"><X className="h-3 w-3" /></button>
                )}
              </span>
            ))}
            {!disabled && (
              <input value={drafts[i] ?? ""} onChange={e => setDrafts(d => ({ ...d, [i]: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(i); } }}
                onBlur={() => commit(i)}
                placeholder={t("listings.options.valuePlaceholder")}
                className="h-7 min-w-[140px] flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground" />
            )}
          </div>
        </div>
      ))}
      {!disabled && options.length < MAX_OPTIONS && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8"
          onClick={() => onChange([...options, { name: "", values: [] }])}>
          <Plus className="h-3.5 w-3.5" />{t("listings.options.add")}
        </Button>
      )}
    </div>
  );
}

// ── New variants (rows not saved yet) ─────────────────────────────────────────

export interface NewVariantRow {
  key: string;
  existingProductId: string | null;
  /** Shown for an existing product (read-only: its price and stock are left as they are). */
  existingName: string | null;
  existingPrice: number | null;
  existingStock: number | null;
  options: Record<string, string>;
  sku: string;
  salePrice: string;
  costPrice: string;
  openingStock: string;
  weightGrams: string;
  sellOnline: boolean;
}

export const blankRow = (options: Record<string, string>): NewVariantRow => ({
  key: crypto.randomUUID(), existingProductId: null, existingName: null, existingPrice: null, existingStock: null,
  options, sku: "", salePrice: "", costPrice: "", openingStock: "", weightGrams: "", sellOnline: true,
});

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));

export function toVariantInput(r: NewVariantRow, taxRate: number): VariantInput {
  const base = { options: r.options, sellOnline: r.sellOnline, weightGrams: num(r.weightGrams) ?? null };
  if (r.existingProductId) return { ...base, existingProductId: r.existingProductId };
  return {
    ...base, existingProductId: null,
    sku: r.sku.trim() || null,
    salePrice: num(r.salePrice) ?? 0, costPrice: num(r.costPrice) ?? 0, taxRate,
    openingStock: num(r.openingStock) ?? 0, trackInventory: true,
  };
}

/** Rows for the combinations that do not exist yet — keeps what was already typed against each. */
export function missingCombos(options: ProductOption[], taken: Set<string>, rows: NewVariantRow[]): NewVariantRow[] {
  const have = new Set([...taken, ...rows.map(r => comboKey(r.options))]);
  return generateCombos(options).filter(c => !have.has(comboKey(c))).map(blankRow);
}

export function NewVariantsTable({ rows, options, onChange, minimal }: {
  rows: NewVariantRow[]; options: ProductOption[]; onChange: (rows: NewVariantRow[]) => void;
  /** A listing with no options has a single variant: hide the choice columns. */
  minimal?: boolean;
}) {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const [bulkPrice, setBulkPrice] = React.useState("");
  const [bulkCost, setBulkCost] = React.useState("");
  const [bulkStock, setBulkStock] = React.useState("");

  const patch = (key: string, p: Partial<NewVariantRow>) => onChange(rows.map(r => r.key === key ? { ...r, ...p } : r));
  const applyAll = (k: "salePrice" | "costPrice" | "openingStock", v: string) =>
    onChange(rows.map(r => r.existingProductId ? r : { ...r, [k]: v }));
  const optionNames = options.filter(o => o.name.trim()).map(o => o.name.trim());

  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.filter(r => !r.existingProductId).length > 1 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs font-semibold text-muted-foreground w-full sm:w-auto">{t("listings.variants.setForAll")}</span>
          {([
            ["salePrice", t("listings.variants.price"), bulkPrice, setBulkPrice],
            ["costPrice", t("listings.variants.cost"), bulkCost, setBulkCost],
            ["openingStock", t("listings.variants.stock"), bulkStock, setBulkStock],
          ] as const).map(([k, label, val, setVal]) => (
            <div key={k} className="flex items-end gap-1">
              <label className="text-[11px] text-muted-foreground">
                {label}
                <input type="number" min={0} value={val} onChange={e => setVal(e.target.value)} className={cn(field, "w-24 mt-0.5")} />
              </label>
              <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={val.trim() === ""}
                onClick={() => applyAll(k, val)}>{t("listings.variants.apply")}</Button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-start">
              {!minimal && optionNames.map(n => <th key={n} className="px-2 py-2 text-start font-semibold">{n}</th>)}
              <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.sku")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.price")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.cost")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.stock")}</th>
              <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.weight")}</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => (
              <tr key={r.key} className="align-middle">
                {!minimal && optionNames.map(n => {
                  const o = options.find(x => x.name.trim() === n)!;
                  return (
                    <td key={n} className="px-2 py-1.5">
                      <select value={r.options[n] ?? ""} onChange={e => patch(r.key, { options: { ...r.options, [n]: e.target.value } })}
                        className={cn(field, "bg-card min-w-[96px]")}>
                        {o.values.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                  );
                })}
                {r.existingProductId ? (
                  <td colSpan={4} className="px-2 py-1.5">
                    <div className="font-semibold truncate">{r.existingName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t("listings.variants.existingNote", { price: formatCurrency(r.existingPrice ?? 0, currency), stock: r.existingStock ?? 0 })}
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-1.5"><input value={r.sku} onChange={e => patch(r.key, { sku: e.target.value.toUpperCase() })} placeholder="SKU" className={cn(field, "font-mono")} /></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} value={r.salePrice} onChange={e => patch(r.key, { salePrice: e.target.value })} className={field} /></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} value={r.costPrice} onChange={e => patch(r.key, { costPrice: e.target.value })} className={field} /></td>
                    <td className="px-2 py-1.5"><input type="number" min={0} value={r.openingStock} onChange={e => patch(r.key, { openingStock: e.target.value })} className={field} /></td>
                  </>
                )}
                <td className="px-2 py-1.5"><input type="number" min={0} value={r.weightGrams} onChange={e => patch(r.key, { weightGrams: e.target.value })} placeholder="g" className={field} /></td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <button type="button" title={r.sellOnline ? t("listings.variants.hide") : t("listings.variants.show")}
                      onClick={() => patch(r.key, { sellOnline: !r.sellOnline })}
                      className={cn("h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted", !r.sellOnline && "text-muted-foreground")}>
                      {r.sellOnline ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" title={t("listings.variants.removeRow")} onClick={() => onChange(rows.filter(x => x.key !== r.key))}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Variants already in the listing ───────────────────────────────────────────

export function ExistingVariantsTable({ variants, options, choices, onChoice, busy, canEdit, onSave, onRemove }: {
  variants: ListingVariant[]; options: ProductOption[]; busy: boolean; canEdit: boolean;
  /**
   * The choices as they stand in the form. They are applied with the options when the listing is saved,
   * because a variant's choices must always fit the options — changing one without the other would be
   * refused. Anything not in here keeps the choices the variant has.
   */
  choices: Record<string, Record<string, string>>;
  onChoice: (productId: string, option: string, value: string) => void;
  /** Immediate changes that do not depend on the options: offered online, weight. */
  onSave: (v: ListingVariant, patch: { sellOnline: boolean; weightGrams: number | null }) => void;
  onRemove: (v: ListingVariant) => void;
}) {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const optionNames = options.map(o => o.name);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs min-w-[640px]">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {optionNames.map(n => <th key={n} className="px-2 py-2 text-start font-semibold">{n}</th>)}
            <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.sku")}</th>
            <th className="px-2 py-2 text-end font-semibold">{t("listings.variants.price")}</th>
            <th className="px-2 py-2 text-end font-semibold">{t("listings.variants.stock")}</th>
            <th className="px-2 py-2 text-start font-semibold">{t("listings.variants.weight")}</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {variants.map(v => (
            <tr key={v.productId} className={cn("align-middle", !v.sellOnline && "opacity-60")}>
              {options.map(o => (
                <td key={o.name} className="px-2 py-1.5">
                  {canEdit ? (
                    <select value={choices[v.productId]?.[o.name] ?? v.options[o.name] ?? ""} disabled={busy}
                      onChange={e => onChoice(v.productId, o.name, e.target.value)}
                      className={cn(field, "bg-card min-w-[96px]", !(choices[v.productId]?.[o.name] ?? v.options[o.name]) && "border-warning")}>
                      <option value="">—</option>
                      {o.values.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  ) : v.options[o.name]}
                </td>
              ))}
              <td className="px-2 py-1.5 font-mono">{v.sku ?? "—"}</td>
              <td className="px-2 py-1.5 text-end tabular-nums">{formatCurrency(v.salePrice, currency)}</td>
              <td className={cn("px-2 py-1.5 text-end tabular-nums", v.stockQuantity <= 0 && "text-destructive font-semibold")}>{v.stockQuantity}</td>
              <td className="px-2 py-1.5">
                {canEdit ? (
                  <input type="number" min={0} defaultValue={v.weightGrams ?? ""} placeholder="g" disabled={busy}
                    onBlur={e => {
                      const n = e.target.value.trim() === "" ? null : Number(e.target.value);
                      if (n !== v.weightGrams) onSave(v, { sellOnline: v.sellOnline, weightGrams: n });
                    }} className={field} />
                ) : (v.weightGrams ?? "—")}
              </td>
              <td className="px-2 py-1.5">
                {canEdit && (
                  <div className="flex items-center justify-end gap-0.5">
                    <button type="button" disabled={busy} title={v.sellOnline ? t("listings.variants.hide") : t("listings.variants.show")}
                      onClick={() => onSave(v, { sellOnline: !v.sellOnline, weightGrams: v.weightGrams })}
                      className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted">
                      {v.sellOnline ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <button type="button" disabled={busy} title={t("listings.variants.removeFromListing")} onClick={() => onRemove(v)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/20">{t("listings.variants.editElsewhere")}</p>
    </div>
  );
}

// ── Pick a product you already have ───────────────────────────────────────────

export function ExistingProductPicker({ onPick, onClose, excludeIds }: {
  onPick: (p: { id: string; name: string; salePrice: number; stockQuantity: number }) => void;
  onClose: () => void; excludeIds: Set<string>;
}) {
  const { t } = useTranslation("inventory");
  const currency = useCurrency();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => { const h = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(h); }, [q]);
  const { data, isFetching } = useInventoryProducts({ page: 1, pageSize: 8, search: debounced || undefined, isActive: true });
  const items = (data?.items ?? []).filter(p => !excludeIds.has(p.id));

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t("listings.variants.searchExisting")} className="h-8 ps-8 text-xs" />
        </div>
        <button type="button" onClick={onClose} aria-label={t("listings.close")} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-border">
        {isFetching && items.length === 0 && <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {!isFetching && items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">{t("listings.variants.noProducts")}</p>}
        {items.map(p => (
          <button key={p.id} type="button" onClick={() => onPick({ id: p.id, name: p.name, salePrice: p.salePrice, stockQuantity: p.stockQuantity })}
            className="w-full text-start px-2 py-2 hover:bg-muted/60 flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs font-semibold truncate">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground font-mono">{p.sku ?? "—"}</span>
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0 text-end">
              {formatCurrency(p.salePrice, currency)}<br />{t("listings.variants.inStock", { count: p.stockQuantity })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function GenerateButton({ count, onClick, disabled }: { count: number; onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation("inventory");
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={onClick} disabled={disabled || count === 0}>
      <Sparkles className="h-3.5 w-3.5" />{t("listings.variants.generate", { count })}
    </Button>
  );
}
