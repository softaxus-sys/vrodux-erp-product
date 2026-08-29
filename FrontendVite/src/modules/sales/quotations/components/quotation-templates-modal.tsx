import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Loader2, Star, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import {
  useQuotationTemplates, useCreateQuotationTemplate,
  useUpdateQuotationTemplate, useDeleteQuotationTemplate,
} from "@/hooks/sales/use-sales-quotations";
import type { QuotationTemplateDto, SaveQuotationTemplateRequest } from "@/lib/sales/quotations.api";

const uid = () => `t${Math.random().toString(36).slice(2, 10)}`;

interface Row {
  key: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  sectionTitle: string;
  isOptional: boolean;
}

const emptyRow = (): Row => ({
  key: uid(), description: "", unit: "", quantity: 1, unitPrice: 0,
  discountPercent: 0, taxRate: 0, sectionTitle: "", isOptional: false,
});

/**
 * Manages the reusable boilerplate a tenant puts on every proposal.
 *
 * This is the "fully dynamic" half of the feature that is actually worth having: rather than a
 * layout designer, the tenant curates the wording and standard lines they reuse, so a new
 * quotation opens already sounding like their business.
 */
export function QuotationTemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("sales");
  const { data: templates = [], isLoading } = useQuotationTemplates(true);

  const [editing, setEditing] = React.useState<QuotationTemplateDto | "new" | null>(null);
  React.useEffect(() => { if (!open) setEditing(null); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 w-full max-w-3xl bg-background shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {editing && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {editing === "new"
                      ? t("quotations.templates.newTitle", { defaultValue: "New template" })
                      : editing
                        ? editing.name
                        : t("quotations.templates.title", { defaultValue: "Quotation templates" })}
                  </h2>
                  {!editing && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("quotations.templates.subtitle", {
                        defaultValue: "Reusable wording, terms and standard lines for your proposals." })}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {editing ? (
              <TemplateForm
                template={editing === "new" ? null : editing}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <Can permission="sales.quotations.create">
                  <Button variant="outline" className="w-full gap-2 mb-4 border-dashed"
                          onClick={() => setEditing("new")}>
                    <Plus className="h-4 w-4" />
                    {t("quotations.templates.create", { defaultValue: "New template" })}
                  </Button>
                </Can>

                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12">
                    <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {t("quotations.templates.empty", {
                        defaultValue: "No templates yet. Create one with your standard cover note, payment terms and conditions, and every new quotation will start from it." })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(tpl => (
                      <button
                        key={tpl.id} type="button" onClick={() => setEditing(tpl)}
                        className={cn(
                          "w-full text-start rounded-xl border p-3.5 transition-colors hover:border-primary hover:bg-primary/5",
                          tpl.isActive ? "border-border bg-card" : "border-dashed border-border bg-muted/30",
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{tpl.name}</span>
                          {tpl.isDefault && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              {t("quotations.templates.default", { defaultValue: "Default" })}
                            </span>
                          )}
                          {!tpl.isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-muted-foreground bg-muted">
                              {t("quotations.templates.inactive", { defaultValue: "Inactive" })}
                            </span>
                          )}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {t("quotations.templates.meta", {
                            defaultValue: "{{days}} day validity · {{count}} standard line(s)",
                            days: tpl.validityDays, count: tpl.items.length })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TemplateForm({ template, onDone }: { template: QuotationTemplateDto | null; onDone: () => void }) {
  const { t } = useTranslation("sales");
  const create = useCreateQuotationTemplate();
  const update = useUpdateQuotationTemplate();
  const remove = useDeleteQuotationTemplate();
  const pending = create.isPending || update.isPending;

  const [name, setName]           = React.useState(template?.name ?? "");
  const [description, setDesc]    = React.useState(template?.description ?? "");
  const [titleTpl, setTitleTpl]   = React.useState(template?.titleTemplate ?? "");
  const [coverNote, setCoverNote] = React.useState(template?.coverNote ?? "");
  const [terms, setTerms]         = React.useState(template?.termsAndConditions ?? "");
  const [payTerms, setPayTerms]   = React.useState(template?.paymentTerms ?? "");
  const [footer, setFooter]       = React.useState(template?.footerNote ?? "");
  const [validity, setValidity]   = React.useState(template?.validityDays ?? 30);
  const [taxRate, setTaxRate]     = React.useState(template?.defaultTaxRate ?? 0);
  const [discount, setDiscount]   = React.useState(template?.defaultDiscount ?? 0);
  const [accent, setAccent]       = React.useState(template?.accentColor ?? "");
  const [isDefault, setIsDefault] = React.useState(template?.isDefault ?? false);
  const [isActive, setIsActive]   = React.useState(template?.isActive ?? true);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const [rows, setRows] = React.useState<Row[]>(
    template?.items.map(i => ({
      key: i.id ?? uid(), description: i.description, unit: i.unit ?? "",
      quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discountPercent,
      taxRate: i.taxRate, sectionTitle: i.sectionTitle ?? "", isOptional: i.isOptional,
    })) ?? []);

  const setRow = <K extends keyof Row>(key: string, field: K, value: Row[K]) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)));

  const save = async () => {
    if (!name.trim() || pending) return;
    const payload: SaveQuotationTemplateRequest = {
      name: name.trim(),
      description: description.trim() || null,
      titleTemplate: titleTpl.trim() || null,
      coverNote: coverNote.trim() || null,
      termsAndConditions: terms.trim() || null,
      paymentTerms: payTerms.trim() || null,
      footerNote: footer.trim() || null,
      validityDays: validity || 30,
      defaultTaxRate: taxRate || 0,
      defaultDiscount: discount || 0,
      accentColor: accent.trim() || null,
      showLogo: true,
      customFields: null,
      isDefault,
      isActive,
      items: rows.filter(r => r.description.trim()).map((r, i) => ({
        description: r.description.trim(),
        unit: r.unit.trim() || null,
        quantity: r.quantity || 1,
        unitPrice: r.unitPrice || 0,
        discountPercent: r.discountPercent || 0,
        taxRate: r.taxRate || 0,
        sectionTitle: r.sectionTitle.trim() || null,
        isOptional: r.isOptional,
        sortOrder: i,
      })),
    };
    try {
      if (template) await update.mutateAsync({ id: template.id, ...payload });
      else          await create.mutateAsync(payload);
      onDone();
    } catch { /* hook toasts */ }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <F label={t("quotations.templates.name", { defaultValue: "Template name" })} required className="col-span-2">
            <Input value={name} onChange={e => setName(e.target.value)}
                   placeholder={t("quotations.templates.namePh", { defaultValue: "e.g. Standard services proposal" })} />
          </F>
          <F label={t("quotations.templates.description", { defaultValue: "When to use it" })} className="col-span-2">
            <Input value={description} onChange={e => setDesc(e.target.value)} />
          </F>
          <F label={t("quotations.templates.titleTpl", { defaultValue: "Default quotation title" })} className="col-span-2">
            <Input value={titleTpl} onChange={e => setTitleTpl(e.target.value)} />
          </F>
          <F label={t("quotations.templates.validity", { defaultValue: "Validity (days)" })}>
            <Input type="number" min={1} max={3650} value={validity}
                   onChange={e => setValidity(Number(e.target.value))} />
          </F>
          <F label={t("quotations.templates.accent", { defaultValue: "Accent colour" })}>
            <div className="flex gap-2">
              <Input value={accent} onChange={e => setAccent(e.target.value)} placeholder="#0f172a" className="flex-1" />
              <input type="color" value={accent || "#0f172a"} onChange={e => setAccent(e.target.value)}
                     className="h-9 w-12 rounded-lg border border-border bg-card cursor-pointer" />
            </div>
          </F>
          <F label={t("quotations.templates.taxRate", { defaultValue: "Default tax %" })}>
            <Input type="number" min={0} max={100} step={0.01} value={taxRate}
                   onChange={e => setTaxRate(Number(e.target.value))} />
          </F>
          <F label={t("quotations.templates.discount", { defaultValue: "Default discount %" })}>
            <Input type="number" min={0} max={100} step={0.01} value={discount}
                   onChange={e => setDiscount(Number(e.target.value))} />
          </F>
        </div>

        <F label={t("quotations.templates.coverNote", { defaultValue: "Cover note" })}>
          <textarea value={coverNote} onChange={e => setCoverNote(e.target.value)} rows={4}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </F>
        <F label={t("quotations.templates.payTerms", { defaultValue: "Payment terms" })}>
          <Input value={payTerms} onChange={e => setPayTerms(e.target.value)} />
        </F>
        <F label={t("quotations.templates.terms", { defaultValue: "Terms & conditions" })}>
          <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={6}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </F>
        <F label={t("quotations.templates.footer", { defaultValue: "Footer note" })}>
          <Input value={footer} onChange={e => setFooter(e.target.value)} />
        </F>

        {/* Standard lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("quotations.templates.lines", { defaultValue: "Standard lines" })}
            </label>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                    onClick={() => setRows(prev => [...prev, emptyRow()])}>
              <Plus className="h-3 w-3" />{t("quotations.templates.addLine", { defaultValue: "Add line" })}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t("quotations.templates.linesHint", {
              defaultValue: "Prefilled onto every quotation started from this template. Give lines the same section name to group them." })}
          </p>
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.key} className="rounded-lg border border-border p-2.5 space-y-2">
                <div className="flex gap-2">
                  <Input value={r.description} onChange={e => setRow(r.key, "description", e.target.value)}
                         placeholder={t("quotations.templates.linePh", { defaultValue: "Description" })}
                         className="h-8 text-xs flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                          onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  <Input value={r.sectionTitle} onChange={e => setRow(r.key, "sectionTitle", e.target.value)}
                         placeholder={t("quotations.templates.section", { defaultValue: "Section" })}
                         className="h-8 text-xs col-span-2" />
                  <Input type="number" min={0} step={0.01} value={r.quantity}
                         onChange={e => setRow(r.key, "quantity", Number(e.target.value))}
                         placeholder="Qty" className="h-8 text-xs" />
                  <Input value={r.unit} onChange={e => setRow(r.key, "unit", e.target.value)}
                         placeholder="Unit" className="h-8 text-xs" />
                  <Input type="number" min={0} step={0.01} value={r.unitPrice}
                         onChange={e => setRow(r.key, "unitPrice", Number(e.target.value))}
                         placeholder="Price" className="h-8 text-xs" />
                  <Input type="number" min={0} max={100} step={0.01} value={r.taxRate}
                         onChange={e => setRow(r.key, "taxRate", Number(e.target.value))}
                         placeholder="Tax %" className="h-8 text-xs" />
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={r.isOptional}
                         onChange={e => setRow(r.key, "isOptional", e.target.checked)}
                         className="h-3.5 w-3.5 rounded border-border accent-violet-600" />
                  {t("quotations.templates.optional", { defaultValue: "Optional extra" })}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
                   className="h-4 w-4 rounded border-border accent-primary" />
            {t("quotations.templates.makeDefault", { defaultValue: "Use as the default template" })}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                   className="h-4 w-4 rounded border-border accent-primary" />
            {t("quotations.templates.active", { defaultValue: "Available when creating quotations" })}
          </label>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 shrink-0 bg-muted/20 flex items-center justify-between gap-3">
        {template ? (
          <Can permission="sales.quotations.delete">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">
                  {t("quotations.templates.deleteConfirm", { defaultValue: "Delete this template?" })}
                </span>
                <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={remove.isPending}
                        onClick={async () => { await remove.mutateAsync(template.id); onDone(); }}>
                  {remove.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.confirm", { defaultValue: "Confirm" })}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(false)}>
                  {t("common.cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm"
                      className="h-9 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />{t("common.delete", { defaultValue: "Delete" })}
              </Button>
            )}
          </Can>
        ) : <span />}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone} disabled={pending}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button onClick={save} disabled={!name.trim() || pending} className="gap-2 min-w-28">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>
    </>
  );
}

function F({ label, required, className, children }: {
  label: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ms-1">*</span>}
      </label>
      {children}
    </div>
  );
}
