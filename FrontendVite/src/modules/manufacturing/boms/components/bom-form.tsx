import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useBom, useCreateBom, useUpdateBom, useWorkCentres } from "@/hooks/manufacturing/use-manufacturing";
import type { StockItemDto } from "@/lib/manufacturing/manufacturing.api";
import { ProductPicker } from "../../shared/components/product-picker";

interface Props { open: boolean; onClose: () => void; editingId?: string | null; }

interface LineRow { item: StockItemDto; quantity: string; scrap: string; }
interface OpRow { key: number; name: string; workCentreId: string; setup: string; run: string; }

const SELECT = "w-full h-8 px-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };
const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export function BomForm({ open, onClose, editingId }: Props) {
  const { t } = useTranslation("manufacturing");
  const currency = useCurrency();
  const isEdit = !!editingId;
  const { data: editing, isLoading: loadingEdit } = useBom(open && editingId ? editingId : null);
  const create = useCreateBom();
  const update = useUpdateBom();
  const saving = create.isPending || update.isPending;

  const [name, setName] = React.useState("");
  const [product, setProduct] = React.useState<StockItemDto | null>(null);
  const [outputQty, setOutputQty] = React.useState("1");
  const [unit, setUnit] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<LineRow[]>([]);
  const [ops, setOps] = React.useState<OpRow[]>([]);
  const [byProducts, setByProducts] = React.useState<{ item: StockItemDto; quantity: string }[]>([]);
  const nextKey = React.useRef(1);
  const { data: workCentres = [] } = useWorkCentres(false, open);

  // Blank form for a new BOM.
  React.useEffect(() => {
    if (open && !editingId) {
      setName(""); setProduct(null); setOutputQty("1"); setUnit(""); setNotes(""); setLines([]); setOps([]); setByProducts([]);
    }
  }, [open, editingId]);

  // Prefill once the BOM being edited has loaded. Every field the save sends is restored here —
  // the update replaces the whole record, so anything missed would be wiped.
  React.useEffect(() => {
    if (!open || !editing || editing.id !== editingId) return;
    setName(editing.name);
    setProduct({ id: editing.productId, name: editing.productName, sku: editing.productSku, unit: editing.unit, costPrice: 0, stockQuantity: NaN });
    setOutputQty(String(editing.outputQuantity));
    setUnit(editing.unit);
    setNotes(editing.notes ?? "");
    setLines(editing.lines.map(l => ({
      item: { id: l.componentProductId, name: l.componentName, sku: l.componentSku, unit: l.unit, costPrice: l.unitCost, stockQuantity: NaN },
      quantity: String(l.quantity), scrap: String(l.scrapPercent),
    })));
    setOps(editing.operations.map(o => ({
      key: nextKey.current++, name: o.name, workCentreId: o.workCentreId,
      setup: String(o.setupMinutes), run: String(o.runMinutesPerBatch),
    })));
    setByProducts(editing.byProducts.map(b => ({
      item: { id: b.productId, name: b.productName, sku: b.productSku, unit: b.unit, costPrice: 0, stockQuantity: NaN },
      quantity: String(b.quantity),
    })));
  }, [open, editing, editingId]);

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const lineCost = (l: LineRow) => num(l.quantity) * (1 + num(l.scrap) / 100) * l.item.costPrice;
  const materialCost = lines.reduce((sum, l) => sum + lineCost(l), 0);

  const setOp = (key: number, patch: Partial<OpRow>) =>
    setOps(prev => prev.map(o => (o.key === key ? { ...o, ...patch } : o)));
  // Costed at the work centre's current rates, which is what the server stores on save.
  const opCost = (o: OpRow) => {
    const centre = workCentres.find(w => w.id === o.workCentreId);
    return centre ? (num(o.setup) + num(o.run)) / 60 * (centre.labourRatePerHour + centre.overheadRatePerHour) : 0;
  };
  const operationCost = ops.reduce((sum, o) => sum + opCost(o), 0);
  const perUnit = num(outputQty) > 0 ? (materialCost + operationCost) / num(outputQty) : 0;
  const opsValid = ops.every(o => o.name.trim().length > 0 && !!o.workCentreId && num(o.setup) >= 0 && num(o.run) >= 0);

  const valid = name.trim().length > 0 && !!product && num(outputQty) > 0
    && lines.length > 0 && lines.every(l => num(l.quantity) > 0 && num(l.scrap) >= 0 && num(l.scrap) <= 100) && opsValid;

  const save = () => {
    if (!valid || !product) return;
    const body = {
      name: name.trim(), productId: product.id, outputQuantity: num(outputQty),
      unit: unit.trim() || null, notes: notes.trim() || null,
      lines: lines.map(l => ({ componentProductId: l.item.id, quantity: num(l.quantity), unit: l.item.unit, scrapPercent: num(l.scrap) })),
      operations: ops.map(o => ({ name: o.name.trim(), workCentreId: o.workCentreId, setupMinutes: num(o.setup), runMinutesPerBatch: num(o.run) })),
      byProducts: byProducts.filter(b => num(b.quantity) > 0).map(b => ({ productId: b.item.id, quantity: num(b.quantity) })),
    };
    if (isEdit && editingId) update.mutate({ id: editingId, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  const usedIds = [...lines.map(l => l.item.id), ...byProducts.map(b => b.item.id), ...(product ? [product.id] : [])];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="fixed end-0 top-0 h-full w-full max-w-2xl bg-card border-s border-border z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-bold">{isEdit ? t("bomForm.titleEdit") : t("bomForm.titleNew")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("bomForm.subtitle")}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground" aria-label={t("action.close")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEdit && loadingEdit ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" />{t("loading")}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className={LABEL}>{t("bomForm.name")}</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("bomForm.namePlaceholder")} className="h-9 text-sm" />
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL}>{t("bomForm.product")}</label>
                  <ProductPicker value={product} placeholder={t("bomForm.productPlaceholder")}
                    excludeIds={lines.map(l => l.item.id)}
                    onChange={p => { setProduct(p); if (p && !unit) setUnit(p.unit); }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={LABEL}>{t("bomForm.outputQuantity")}</label>
                    <Input type="number" min={0} step="any" value={outputQty} onChange={e => setOutputQty(e.target.value)} className="h-9 text-sm" />
                    <p className="text-[11px] text-muted-foreground">{t("bomForm.outputHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className={LABEL}>{t("bomForm.unit")}</label>
                    <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs" className="h-9 text-sm" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={LABEL}>{t("bomForm.components")}</label>
                  <ProductPicker value={null} placeholder={t("bomForm.addComponent")} excludeIds={usedIds}
                    onChange={item => { if (item) setLines(prev => [...prev, { item, quantity: "1", scrap: "0" }]); }} />

                  {lines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("bomForm.noComponents")}</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="text-start font-semibold px-3 py-2">{t("bomForm.col.component")}</th>
                            <th className="text-start font-semibold px-2 py-2 w-28">{t("bomForm.col.quantity")}</th>
                            <th className="text-start font-semibold px-2 py-2 w-20">{t("bomForm.col.scrap")}</th>
                            <th className="text-end font-semibold px-3 py-2 w-28">{t("bomForm.col.cost")}</th>
                            <th className="w-9" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l, i) => (
                            <tr key={l.item.id} className="border-t border-border">
                              <td className="px-3 py-2">
                                <p className="truncate">{l.item.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatCurrency(l.item.costPrice, currency)} / {l.item.unit}
                                </p>
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1">
                                  <Input type="number" min={0} step="any" value={l.quantity}
                                    onChange={e => setLine(i, { quantity: e.target.value })} className="h-8 text-sm" />
                                  <span className="text-[11px] text-muted-foreground shrink-0">{l.item.unit}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <Input type="number" min={0} max={100} step="any" value={l.scrap}
                                  onChange={e => setLine(i, { scrap: e.target.value })} className="h-8 text-sm" />
                              </td>
                              <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(lineCost(l), currency)}</td>
                              <td className="pe-2">
                                <button type="button" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  aria-label={t("action.remove")}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/30 text-sm">
                          <tr className="border-t border-border">
                            <td colSpan={3} className="px-3 py-2 text-muted-foreground">{t("bomForm.materialCost")}</td>
                            <td className="px-3 py-2 text-end font-semibold tabular-nums">{formatCurrency(materialCost, currency)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={LABEL}>{t("bomForm.operations")}</label>
                    <button type="button" disabled={workCentres.length === 0}
                      onClick={() => setOps(prev => [...prev, { key: nextKey.current++, name: "", workCentreId: workCentres.find(w => w.isActive)?.id ?? "", setup: "0", run: "0" }])}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline">
                      <Plus className="h-3 w-3" />{t("bomForm.addOperation")}
                    </button>
                  </div>
                  {workCentres.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("bomForm.noWorkCentres")}</p>
                  ) : ops.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("bomForm.noOperations")}</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="text-start font-semibold px-3 py-2">{t("bomForm.col.operation")}</th>
                            <th className="text-start font-semibold px-2 py-2 w-40">{t("bomForm.col.workCentre")}</th>
                            <th className="text-start font-semibold px-2 py-2 w-20">{t("bomForm.col.setup")}</th>
                            <th className="text-start font-semibold px-2 py-2 w-20">{t("bomForm.col.run")}</th>
                            <th className="text-end font-semibold px-3 py-2 w-24">{t("bomForm.col.cost")}</th>
                            <th className="w-9" />
                          </tr>
                        </thead>
                        <tbody>
                          {ops.map(o => (
                            <tr key={o.key} className="border-t border-border">
                              <td className="px-3 py-2">
                                <Input value={o.name} onChange={e => setOp(o.key, { name: e.target.value })}
                                  placeholder={t("bomForm.operationPlaceholder")} className="h-8 text-sm" />
                              </td>
                              <td className="px-2 py-2">
                                <select value={o.workCentreId} onChange={e => setOp(o.key, { workCentreId: e.target.value })} className={SELECT}>
                                  <option value="">—</option>
                                  {workCentres.filter(w => w.isActive || w.id === o.workCentreId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <Input type="number" min={0} step="any" value={o.setup} onChange={e => setOp(o.key, { setup: e.target.value })} className="h-8 text-sm" />
                              </td>
                              <td className="px-2 py-2">
                                <Input type="number" min={0} step="any" value={o.run} onChange={e => setOp(o.key, { run: e.target.value })} className="h-8 text-sm" />
                              </td>
                              <td className="px-3 py-2 text-end tabular-nums">{formatCurrency(opCost(o), currency)}</td>
                              <td className="pe-2">
                                <button type="button" onClick={() => setOps(prev => prev.filter(x => x.key !== o.key))}
                                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={t("action.remove")}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t("bomForm.operationsHint")}</p>
                </div>

                <div className="space-y-2">
                  <label className={LABEL}>{t("bomForm.byProducts")}</label>
                  <ProductPicker value={null} placeholder={t("bomForm.addByProduct")} excludeIds={usedIds}
                    onChange={item => { if (item) setByProducts(prev => [...prev, { item, quantity: "1" }]); }} />
                  {byProducts.length > 0 && (
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {byProducts.map((b, i) => (
                        <div key={b.item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                          <span className="flex-1 truncate">{b.item.name}</span>
                          <Input type="number" min={0} step="any" value={b.quantity} className="h-8 text-sm w-24"
                            onChange={e => setByProducts(prev => prev.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))} />
                          <span className="text-[11px] text-muted-foreground w-8">{b.item.unit}</span>
                          <button type="button" onClick={() => setByProducts(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label={t("action.remove")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t("bomForm.byProductsHint")}</p>
                </div>

                <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("bomForm.materialCost")}</span><span className="tabular-nums">{formatCurrency(materialCost, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("bomForm.operationCost")}</span><span className="tabular-nums">{formatCurrency(operationCost, currency)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-border pt-1"><span>{t("bomForm.costPerUnit")}</span><span className="tabular-nums">{formatCurrency(perUnit, currency)}</span></div>
                </div>

                <div className="space-y-1.5">
                  <label className={LABEL}>{t("bomForm.notes")}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-border flex justify-between shrink-0">
              <Button variant="outline" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
              <Button onClick={save} disabled={!valid || saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? t("action.save") : t("bomForm.create")}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
