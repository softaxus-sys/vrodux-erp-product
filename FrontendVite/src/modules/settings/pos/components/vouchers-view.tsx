import { parseApiDate } from "@/lib/utils";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Pencil, Trash2, Ticket, Loader2, Percent, Banknote, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useVouchers, useUpsertVoucher, useDeleteVoucher } from "@/hooks/pos/use-vouchers";
import { printApi } from "@/lib/pos/print.api";
import { buildEscPosVoucher } from "@/lib/pos/voucher-escpos";
import { useAuthStore } from "@/store/auth.store";
import type { VoucherDto } from "@/lib/pos/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10); // YYYY-MM-DD
}
function fromDateInput(d: string): string | null {
  return d ? `${d}T00:00:00Z` : null;
}

// ── Dialog ──────────────────────────────────────────────────────────────────

interface VoucherDialogProps {
  open:     boolean;
  onClose:  () => void;
  editing?: VoucherDto | null;
}

function VoucherDialog({ open, onClose, editing }: VoucherDialogProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [code, setCode]               = React.useState("");
  const [description, setDesc]        = React.useState("");
  const [valueType, setValueType]     = React.useState<1 | 2>(1); // 1=%, 2=fixed
  const [value, setValue]             = React.useState("");
  const [minSpend, setMinSpend]       = React.useState("");
  const [maxDiscount, setMaxDiscount] = React.useState("");
  const [validFrom, setValidFrom]     = React.useState("");
  const [validUntil, setValidUntil]   = React.useState("");
  const [usageLimit, setUsageLimit]   = React.useState("");
  const [isActive, setIsActive]       = React.useState(true);

  const upsert = useUpsertVoucher();

  React.useEffect(() => {
    if (editing) {
      setCode(editing.code);
      setDesc(editing.description ?? "");
      setValueType(editing.valueType === 2 ? 2 : 1);
      setValue(String(editing.value));
      setMinSpend(editing.minSpend ? String(editing.minSpend) : "");
      setMaxDiscount(editing.maxDiscountAmount != null ? String(editing.maxDiscountAmount) : "");
      setValidFrom(toDateInput(editing.validFrom));
      setValidUntil(toDateInput(editing.validUntil));
      setUsageLimit(editing.usageLimit != null ? String(editing.usageLimit) : "");
      setIsActive(editing.isActive);
    } else {
      setCode(""); setDesc(""); setValueType(1); setValue(""); setMinSpend("");
      setMaxDiscount(""); setValidFrom(""); setValidUntil(""); setUsageLimit(""); setIsActive(true);
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !value) return;
    await upsert.mutateAsync({
      id:                editing?.id ?? null,
      code:              code.trim().toUpperCase(),
      description:       description.trim() || null,
      valueType,
      value:             parseFloat(value) || 0,
      minSpend:          parseFloat(minSpend) || 0,
      maxDiscountAmount: maxDiscount ? parseFloat(maxDiscount) : null,
      validFrom:         fromDateInput(validFrom),
      validUntil:        fromDateInput(validUntil),
      usageLimit:        usageLimit ? parseInt(usageLimit, 10) : null,
      isActive,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Ticket className="w-4 h-4 text-primary" />
          {editing ? t("vouchers.edit") : t("vouchers.new")}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.code")} *</label>
              <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SAVE10" required className="h-9 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.type")} *</label>
              <div className="flex rounded-lg border border-border overflow-hidden h-9">
                <button type="button" onClick={() => setValueType(1)}
                  className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold transition-colors ${valueType === 1 ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}>
                  <Percent className="w-3 h-3" /> %
                </button>
                <button type="button" onClick={() => setValueType(2)}
                  className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold transition-colors ${valueType === 2 ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}>
                  <Banknote className="w-3 h-3" /> {t("vouchers.fixed")}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.descriptionLabel")}</label>
            <Input value={description} onChange={e => setDesc(e.target.value)} placeholder={t("vouchers.descriptionPlaceholder")} className="h-9 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{valueType === 1 ? t("vouchers.percentRequired") : t("vouchers.amountRequired")}</label>
              <Input type="number" min={0} max={valueType === 1 ? 100 : undefined} value={value} onChange={e => setValue(e.target.value)} placeholder={valueType === 1 ? "10" : "50.00"} required className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.minSpend")}</label>
              <Input type="number" min={0} value={minSpend} onChange={e => setMinSpend(e.target.value)} placeholder="0" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.maxDiscount")}</label>
              <Input type="number" min={0} value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} placeholder="—" className="h-9 text-sm"
                disabled={valueType === 2} title={valueType === 2 ? t("vouchers.maxDiscountHint") : ""} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.validFrom")}</label>
              <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.validUntil")}</label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("vouchers.usageLimit")}</label>
              <Input type="number" min={1} value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder="∞" className="h-9 text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-sm">{t("vouchers.active")}</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={upsert.isPending}>{tc("action.cancel")}</Button>
            <Button type="submit" disabled={!code.trim() || !value || upsert.isPending}>
              {upsert.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{tc("action.saving")}</> : (editing ? t("vouchers.saveChanges") : tc("action.create"))}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Preview Dialog (shown before printing) ───────────────────────────────────

function fmtMoney(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDateNice(iso: string | null): string | null {
  if (!iso) return null;
  return parseApiDate(iso).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

/** Faux barcode rendered with CSS stripes — visual preview of the printed CODE128. */
function FauxBarcode({ value }: { value: string }) {
  // deterministic stripe widths derived from the code characters
  const bars = React.useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < value.length * 3; i++) {
      const c = value.charCodeAt(i % value.length);
      out.push(((c + i) % 3) + 1); // width 1-3
    }
    return out;
  }, [value]);
  return (
    <div className="flex items-end justify-center gap-[1px] h-10" aria-hidden>
      {bars.map((w, i) => (
        <span key={i} className={i % 2 === 0 ? "bg-black" : "bg-transparent"} style={{ width: w, height: "100%" }} />
      ))}
    </div>
  );
}

interface VoucherPreviewDialogProps {
  voucher:    VoucherDto | null;
  companyName: string;
  currency:   string;
  printing:   boolean;
  onPrint:    () => void;
  onClose:    () => void;
}

function VoucherPreviewDialog({ voucher, companyName, currency, printing, onPrint, onClose }: VoucherPreviewDialogProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  if (!voucher) return null;
  const v = voucher;
  const isPercent = v.valueType === 1;
  const valueText = isPercent ? `${v.value}% ${t("vouchers.off")}` : `${fmtMoney(v.value, currency)} ${t("vouchers.off")}`;
  const from  = fmtDateNice(v.validFrom);
  const until = fmtDateNice(v.validUntil);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2"><Printer className="w-4 h-4 text-primary" />{t("vouchers.previewTitle")}</h2>
          <span className="text-[10px] text-muted-foreground">{t("vouchers.receiptSize")}</span>
        </div>

        {/* Paper preview */}
        <div className="p-5 bg-muted/30 max-h-[60vh] overflow-y-auto">
          <div className="mx-auto bg-white text-black rounded-sm shadow-md px-4 py-5 font-mono text-center"
               style={{ width: 280, border: "1px dashed #999" }}>
            <p className="text-[10px] tracking-widest">{"*".repeat(32)}</p>
            <p className="text-base font-black tracking-wide mt-2 uppercase">{companyName}</p>
            <p className="text-[11px] font-bold mt-2">{t("vouchers.voucherHeading")}</p>
            <p className="text-2xl font-black my-3">{valueText}</p>

            {/* boxed code */}
            <div className="inline-block border-2 border-black rounded px-4 py-1.5 my-1">
              <span className="text-xl font-black tracking-widest">{v.code}</span>
            </div>

            {/* faux barcode */}
            <div className="my-3"><FauxBarcode value={v.code} /></div>

            {v.description && <p className="text-[11px] mb-2">{v.description}</p>}

            <div className="border-t border-dashed border-gray-400 my-2" />
            <p className="text-[11px] font-bold">{t("vouchers.terms")}</p>
            <div className="text-[10px] text-left leading-relaxed mt-1 space-y-0.5">
              {v.minSpend > 0 && <p>{t("vouchers.termMinSpend", { amount: fmtMoney(v.minSpend, currency) })}</p>}
              {isPercent && v.maxDiscountAmount != null && <p>{t("vouchers.termMaxDiscount", { amount: fmtMoney(v.maxDiscountAmount, currency) })}</p>}
              <p>{t("vouchers.termValid", { from: from ?? t("vouchers.now"), until: until ?? t("vouchers.noExpiry") })}</p>
              {v.usageLimit != null && <p>{t("vouchers.termLimit", { n: v.usageLimit })}</p>}
              <p>{t("vouchers.termOnePer")}</p>
              <p>{t("vouchers.termNoCash")}</p>
            </div>
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* QR placeholder */}
            <p className="text-[10px]">{t("vouchers.scanToRedeem")}</p>
            <div className="mx-auto my-2 grid place-items-center bg-white" style={{ width: 88, height: 88, border: "1px solid #000" }}>
              <div className="grid grid-cols-5 gap-[2px]">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span key={i} className={(v.code.charCodeAt(i % v.code.length) + i) % 2 === 0 ? "bg-black" : "bg-white"} style={{ width: 10, height: 10 }} />
                ))}
              </div>
            </div>
            <p className="text-[11px] mt-1">{t("vouchers.thankYou")}</p>
            <p className="text-[10px] tracking-widest mt-1">{"*".repeat(32)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={printing}>{tc("action.cancel")}</Button>
          <Button onClick={onPrint} disabled={printing} className="gap-1.5">
            {printing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t("vouchers.printing")}</> : <><Printer className="w-3.5 h-3.5" />{t("vouchers.printToPrinter")}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation ──────────────────────────────────────────────────────

function ConfirmDeleteVoucherDialog({
  voucher, onConfirm, onCancel,
}: { voucher: VoucherDto; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="font-bold">{t("vouchers.confirmDeleteTitle")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          {t("vouchers.confirmDeleteBody", { code: voucher.code })}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>{tc("action.cancel")}</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>
            <Trash2 className="h-4 w-4 mr-1.5" />{tc("action.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function VouchersView() {
  const { t } = useTranslation("settings");
  const [search, setSearch]     = React.useState("");
  const [dialogOpen, setDialog] = React.useState(false);
  const [editing, setEditing]   = React.useState<VoucherDto | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<VoucherDto | null>(null);

  const { data: vouchers = [], isLoading } = useVouchers();
  const deleteVoucher = useDeleteVoucher();
  const { tenant }  = useAuthStore();
  const companyName = tenant?.branding?.companyName ?? "Vrodux";
  const currency    = tenant?.currency ?? "AED";

  const [preview, setPreview]   = React.useState<VoucherDto | null>(null);
  const [printing, setPrinting] = React.useState(false);

  const handlePrint = async () => {
    if (!preview) return;
    setPrinting(true);
    try {
      const data = buildEscPosVoucher({ companyName, currency, voucher: preview });
      const res = await printApi.printRaw(data);
      if (res.success) {
        toast.success(t("vouchers.printSent", { code: preview.code }));
        setPreview(null);
      } else {
        toast.error(res.message || t("vouchers.printFailed"));
      }
    } catch (e: any) {
      toast.error(e?.message ?? t("vouchers.printerUnreachable"));
    } finally {
      setPrinting(false);
    }
  };

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return vouchers.filter(v =>
      !q || v.code.toLowerCase().includes(q) || (v.description ?? "").toLowerCase().includes(q));
  }, [vouchers, search]);

  const handleEdit   = (v: VoucherDto) => { setEditing(v); setDialog(true); };
  const handleCreate = () => { setEditing(null); setDialog(true); };

  const valueLabel = (v: VoucherDto) =>
    v.valueType === 1 ? `${v.value}%` : v.value.toLocaleString("en", { minimumFractionDigits: 2 });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{t("vouchers.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("vouchers.description")}</p>
          </div>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> {t("vouchers.new")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("vouchers.searchPlaceholder")} className="pl-8 h-9 text-sm" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">{t("vouchers.empty")}</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.code")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.colValue")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.minSpend")}</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.colValidity")}</th>
                <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.colUsage")}</th>
                <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">{t("vouchers.colStatus")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        {v.valueType === 1 ? <Percent className="w-3.5 h-3.5 text-primary" /> : <Banknote className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div>
                        <p className="font-mono font-bold">{v.code}</p>
                        {v.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{v.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {valueLabel(v)}
                    {v.valueType === 1 && v.maxDiscountAmount != null && (
                      <span className="text-[10px] text-muted-foreground font-normal"> ({t("vouchers.max")} {v.maxDiscountAmount})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.minSpend > 0 ? v.minSpend.toLocaleString("en") : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {v.validFrom || v.validUntil
                      ? `${toDateInput(v.validFrom) || "…"} → ${toDateInput(v.validUntil) || "…"}`
                      : t("vouchers.always")}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {v.usageCount}{v.usageLimit != null ? ` / ${v.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${v.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {v.isActive ? t("vouchers.active") : t("vouchers.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setPreview(v)} title={t("vouchers.previewPrint")}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPendingDelete(v)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VoucherDialog open={dialogOpen} onClose={() => { setDialog(false); setEditing(null); }} editing={editing} />

      <VoucherPreviewDialog
        voucher={preview}
        companyName={companyName}
        currency={currency}
        printing={printing}
        onPrint={handlePrint}
        onClose={() => { if (!printing) setPreview(null); }}
      />

      {pendingDelete && (
        <ConfirmDeleteVoucherDialog
          voucher={pendingDelete}
          onConfirm={() => { deleteVoucher.mutate(pendingDelete.id); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
