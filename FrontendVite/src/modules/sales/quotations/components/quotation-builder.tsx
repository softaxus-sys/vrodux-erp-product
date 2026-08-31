import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Trash2, Loader2, FileText, LayoutList, Settings2, Copy,
  ChevronUp, ChevronDown, Sparkles, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import {
  useCreateSalesQuotation, useUpdateSalesQuotation, useQuotationTemplates,
} from "@/hooks/sales/use-sales-quotations";
import { useSalesCustomers } from "@/hooks/sales/use-customers";
import type {
  QuotationDto, QuotationTemplateDto, QuotationItemRequest, QuotationSectionRequest,
} from "@/lib/sales/quotations.api";

// Never hardcode a date — a fixed "today" silently rots.
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/** Client-side ids. Sections are submitted with these so their lines can reference them. */
const uid = () => `c${Math.random().toString(36).slice(2, 10)}`;

interface Line {
  key: string;
  sectionKey: string | null;
  description: string;
  unit: string;
  notes: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  isOptional: boolean;
}

interface Section { key: string; title: string; description: string }

const newLine = (sectionKey: string | null, taxRate: number): Line => ({
  key: uid(), sectionKey, description: "", unit: "", notes: "",
  qty: 1, unitPrice: 0, discount: 0, taxRate, isOptional: false,
});

type Tab = "details" | "items" | "document";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present = edit an existing quotation; absent = create a new one. */
  editing?: QuotationDto | null;
}

export function QuotationBuilder({ open, onClose, editing }: Props) {
  const { t } = useTranslation("sales");
  const currency = useCurrency();

  const { data: templates = [] } = useQuotationTemplates();
  const { data: customers = [] } = useSalesCustomers({ isActive: true });

  const create = useCreateSalesQuotation();
  const update = useUpdateSalesQuotation();
  const isPending = create.isPending || update.isPending;

  const [tab, setTab] = React.useState<Tab>("details");

  // ── Customer + header ──
  const [customerId, setCustomerId]   = React.useState<string | null>(null);
  const [customerName, setCustomerName] = React.useState("");
  const [email, setEmail]             = React.useState("");
  const [phone, setPhone]             = React.useState("");
  const [address, setAddress]         = React.useState("");
  const [title, setTitle]             = React.useState("");
  const [reference, setReference]     = React.useState("");
  const [issueDate, setIssueDate]     = React.useState(today());
  const [validUntil, setValidUntil]   = React.useState(plusDays(30));
  const [preparedBy, setPreparedBy]   = React.useState("");
  const [discountPct, setDiscountPct] = React.useState(0);
  const [defaultTax, setDefaultTax]   = React.useState(0);

  // ── Body ──
  const [sections, setSections] = React.useState<Section[]>([]);
  const [lines, setLines]       = React.useState<Line[]>([]);

  // ── Document ──
  const [coverNote, setCoverNote] = React.useState("");
  const [terms, setTerms]         = React.useState("");
  const [payTerms, setPayTerms]   = React.useState("");
  const [notes, setNotes]         = React.useState("");
  const [custom, setCustom]       = React.useState<{ key: string; label: string; value: string }[]>([]);

  const resetTo = React.useCallback((q: QuotationDto | null | undefined, tax: number) => {
    if (!q) {
      setCustomerId(null); setCustomerName(""); setEmail(""); setPhone(""); setAddress("");
      setTitle(""); setReference(""); setIssueDate(today()); setValidUntil(plusDays(30));
      setPreparedBy(""); setDiscountPct(0);
      setSections([]); setLines([newLine(null, tax), newLine(null, tax)]);
      setCoverNote(""); setTerms(""); setPayTerms(""); setNotes(""); setCustom([]);
      return;
    }
    setCustomerId(q.customerId); setCustomerName(q.customerName ?? "");
    setEmail(q.customerEmail ?? ""); setPhone(q.customerPhone ?? ""); setAddress(q.customerAddress ?? "");
    setTitle(q.title ?? ""); setReference(q.reference ?? "");
    setIssueDate(q.issueDate ?? today()); setValidUntil(q.validUntil ?? plusDays(30));
    setPreparedBy(q.preparedByName ?? ""); setDiscountPct(q.discountPercent);

    // Server ids double as client keys here: they are unique and stable, and the composer only
    // needs the two sides to agree, not for the key to be freshly generated.
    setSections(q.sections.map(s => ({ key: s.id, title: s.title, description: s.description ?? "" })));
    setLines(q.items.map(i => ({
      key: i.id, sectionKey: i.sectionId, description: i.description,
      unit: i.unit ?? "", notes: i.notes ?? "", qty: i.quantity, unitPrice: i.unitPrice,
      discount: i.discountPercent, taxRate: i.taxRate, isOptional: i.isOptional,
    })));
    setCoverNote(q.coverNote ?? ""); setTerms(q.termsAndConditions ?? "");
    setPayTerms(q.paymentTerms ?? ""); setNotes(q.notes ?? "");
    setCustom(Object.entries(q.customFields ?? {}).map(([label, value]) => ({ key: uid(), label, value })));
  }, []);

  // Re-seed whenever the drawer opens, so a previous edit never bleeds into the next one.
  React.useEffect(() => {
    if (!open) return;
    setTab("details");
    resetTo(editing, defaultTax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  /** Applying a template only fills what is still empty — it never overwrites typed content. */
  const applyTemplate = (tpl: QuotationTemplateDto) => {
    setDefaultTax(tpl.defaultTaxRate);
    if (!title.trim() && tpl.titleTemplate) setTitle(tpl.titleTemplate);
    if (!coverNote.trim() && tpl.coverNote) setCoverNote(tpl.coverNote);
    if (!terms.trim() && tpl.termsAndConditions) setTerms(tpl.termsAndConditions);
    if (!payTerms.trim() && tpl.paymentTerms) setPayTerms(tpl.paymentTerms);
    if (discountPct === 0) setDiscountPct(tpl.defaultDiscount);
    setValidUntil(plusDays(tpl.validityDays));

    if (tpl.customFields && custom.length === 0) {
      setCustom(Object.entries(tpl.customFields).map(([label, value]) => ({ key: uid(), label, value })));
    }

    if (tpl.items.length) {
      // Template lines carry a section *title*; group them so one template can seed several
      // sections on the new quotation.
      const titles = [...new Set(tpl.items.map(i => i.sectionTitle).filter(Boolean))] as string[];
      const map = new Map(titles.map(name => [name, uid()]));
      const newSections = titles.map(name => ({ key: map.get(name)!, title: name, description: "" }));
      const newLines = tpl.items.map<Line>(i => ({
        key: uid(),
        sectionKey: i.sectionTitle ? map.get(i.sectionTitle)! : null,
        description: i.description, unit: i.unit ?? "", notes: "",
        qty: i.quantity, unitPrice: i.unitPrice, discount: i.discountPercent,
        taxRate: i.taxRate, isOptional: i.isOptional,
      }));
      setSections(newSections);
      // Replace the untouched starter rows; keep anything the user has already typed.
      setLines(prev => [...prev.filter(l => l.description.trim() || l.unitPrice > 0), ...newLines]);
    }
    setTab("items");
  };

  // ── Totals — mirrors the server exactly (optional lines excluded, tax on the discounted base)
  const billable   = lines.filter(l => !l.isOptional);
  const lineTotal  = (l: Line) => l.qty * l.unitPrice * (1 - l.discount / 100);
  const subTotal   = billable.reduce((s, l) => s + lineTotal(l), 0);
  const discAmount = Math.round(subTotal * (discountPct / 100) * 100) / 100;
  const netSub     = subTotal - discAmount;
  const factor     = subTotal > 0 ? netSub / subTotal : 0;
  const taxAmount  = Math.round(billable.reduce((s, l) => s + lineTotal(l) * factor * (l.taxRate / 100), 0) * 100) / 100;
  const total      = netSub + taxAmount;
  const optionalTotal = lines.filter(l => l.isOptional)
    .reduce((s, l) => s + lineTotal(l) + lineTotal(l) * (l.taxRate / 100), 0);

  const validLines = lines.filter(l => l.description.trim());
  const isValid = customerName.trim().length > 0 && validLines.length > 0;

  // ── Line/section editing ──
  const setLine = <K extends keyof Line>(key: string, field: K, value: Line[K]) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));

  const removeLine  = (key: string) => setLines(prev => prev.filter(l => l.key !== key));
  const addLine     = (sectionKey: string | null) => setLines(prev => [...prev, newLine(sectionKey, defaultTax)]);
  const duplicateLine = (key: string) => setLines(prev => {
    const i = prev.findIndex(l => l.key === key);
    if (i < 0) return prev;
    const copy = { ...prev[i], key: uid() };
    return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
  });

  const moveLine = (key: string, dir: -1 | 1) => setLines(prev => {
    const i = prev.findIndex(l => l.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    // Only reorder within the same section — swapping across a boundary would silently re-home
    // the line, which reads as the row vanishing.
    if (prev[i].sectionKey !== prev[j].sectionKey) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const addSection = () => {
    const key = uid();
    setSections(prev => [...prev, { key, title: `Section ${prev.length + 1}`, description: "" }]);
    setLines(prev => [...prev, newLine(key, defaultTax)]);
  };

  const removeSection = (key: string) => {
    setSections(prev => prev.filter(s => s.key !== key));
    // Its lines are kept and re-homed to the ungrouped block: deleting a heading should not
    // silently delete the pricing underneath it.
    setLines(prev => prev.map(l => (l.sectionKey === key ? { ...l, sectionKey: null } : l)));
  };

  // ── Submit ──
  const buildPayload = () => {
    const usedSections = sections.filter(s => s.title.trim());
    const sectionReq: QuotationSectionRequest[] = usedSections.map((s, i) => ({
      clientId: s.key, title: s.title.trim(), description: s.description.trim() || null, sortOrder: i,
    }));

    const orderIn = (sectionKey: string | null) =>
      lines.filter(l => l.sectionKey === sectionKey && l.description.trim());

    const itemReq: QuotationItemRequest[] = [];
    const push = (l: Line, sectionKey: string | null, sortOrder: number) => itemReq.push({
      productId: null,
      description: l.description.trim(),
      unit: l.unit.trim() || null,
      notes: l.notes.trim() || null,
      quantity: l.qty || 1,
      unitPrice: l.unitPrice || 0,
      discountPercent: l.discount || 0,
      taxRate: l.taxRate || 0,
      sectionClientId: sectionKey,
      isOptional: l.isOptional,
      sortOrder,
    });

    orderIn(null).forEach((l, i) => push(l, null, i));
    usedSections.forEach(s => orderIn(s.key).forEach((l, i) => push(l, s.key, i)));

    const customFields = custom.reduce<Record<string, string>>((acc, c) => {
      if (c.label.trim()) acc[c.label.trim()] = c.value.trim();
      return acc;
    }, {});

    return {
      customerId,
      customerName: customerName.trim(),
      notes: notes.trim() || null,
      validUntil: validUntil || null,
      discountPercent: discountPct,
      items: itemReq,
      sections: sectionReq.length ? sectionReq : null,
      document: {
        title: title.trim() || null,
        reference: reference.trim() || null,
        issueDate: issueDate || null,
        coverNote: coverNote.trim() || null,
        termsAndConditions: terms.trim() || null,
        paymentTerms: payTerms.trim() || null,
        preparedByName: preparedBy.trim() || null,
        customerEmail: email.trim() || null,
        customerPhone: phone.trim() || null,
        customerAddress: address.trim() || null,
        customFields: Object.keys(customFields).length ? customFields : null,
      },
    };
  };

  const handleSubmit = async () => {
    if (!isValid || isPending) return;
    const payload = buildPayload();
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, status: editing.status, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      // The hook already surfaced the error; keep the drawer open so nothing typed is lost.
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "details",  label: t("quotations.builder.tabs.details",  { defaultValue: "Details" }),  icon: FileText },
    { id: "items",    label: t("quotations.builder.tabs.items",    { defaultValue: "Items" }),    icon: LayoutList },
    { id: "document", label: t("quotations.builder.tabs.document", { defaultValue: "Document" }), icon: Settings2 },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 end-0 w-full max-w-4xl bg-background shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold">
                  {editing
                    ? t("quotations.builder.editTitle", { defaultValue: "Edit quotation" })
                    : t("quotations.builder.newTitle",  { defaultValue: "New quotation" })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editing?.quotationNumber ??
                    t("quotations.builder.subtitle", { defaultValue: "Build the proposal your customer will see." })}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 border-b border-border shrink-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id} type="button" onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {tab === "details" && (
                <DetailsTab
                  {...{ templates, applyTemplate, customers, customerId, setCustomerId, customerName,
                        setCustomerName, email, setEmail, phone, setPhone, address, setAddress,
                        title, setTitle, reference, setReference, issueDate, setIssueDate,
                        validUntil, setValidUntil, preparedBy, setPreparedBy, editing }}
                />
              )}

              {tab === "items" && (
                <ItemsTab
                  {...{ sections, setSections, lines, currency, defaultTax, setDefaultTax,
                        setLine, removeLine, addLine, duplicateLine, moveLine, addSection,
                        removeSection, lineTotal }}
                />
              )}

              {tab === "document" && (
                <DocumentTab
                  {...{ coverNote, setCoverNote, payTerms, setPayTerms, terms, setTerms,
                        notes, setNotes, custom, setCustom, discountPct, setDiscountPct }}
                />
              )}
            </div>

            {/* Totals + actions */}
            <div className="border-t border-border px-6 py-4 shrink-0 bg-muted/20">
              <div className="flex items-end justify-between gap-4 mb-3">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex gap-6">
                    <span>{t("quotations.builder.subtotal", { defaultValue: "Subtotal" })}: <span className="font-medium text-foreground">{formatCurrency(subTotal, currency)}</span></span>
                    {discAmount > 0 && (
                      <span>{t("quotations.builder.discount", { defaultValue: "Discount" })}: <span className="font-medium text-destructive">−{formatCurrency(discAmount, currency)}</span></span>
                    )}
                    <span>{t("quotations.builder.tax", { defaultValue: "Tax" })}: <span className="font-medium text-foreground">{formatCurrency(taxAmount, currency)}</span></span>
                  </div>
                  {optionalTotal > 0 && (
                    <p className="text-[11px] text-violet-600 dark:text-violet-400">
                      {t("quotations.builder.optionalHint", {
                        defaultValue: "+ {{amount}} if the optional items are selected",
                        amount: formatCurrency(optionalTotal, currency),
                      })}
                    </p>
                  )}
                </div>
                <div className="text-end">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("quotations.builder.total", { defaultValue: "Total" })}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(total, currency)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {!customerName.trim()
                    ? t("quotations.builder.needCustomer", { defaultValue: "Add a customer to continue." })
                    : validLines.length === 0
                      ? t("quotations.builder.needItems", { defaultValue: "Add at least one line item." })
                      : t("quotations.builder.lineCount", {
                          defaultValue: "{{count}} line item(s)", count: validLines.length })}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} disabled={isPending}>
                    {t("common.cancel", { defaultValue: "Cancel" })}
                  </Button>
                  <Button onClick={handleSubmit} disabled={!isValid || isPending} className="gap-2 min-w-36">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editing
                      ? t("quotations.builder.save",   { defaultValue: "Save changes" })
                      : t("quotations.builder.create", { defaultValue: "Create quotation" })}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Details tab ───────────────────────────────────────────────────────────────
function DetailsTab(p: any) {
  const { t } = useTranslation("sales");
  return (
    <>
      {!p.editing && p.templates.length > 0 && (
        <Field label={t("quotations.builder.template", { defaultValue: "Start from a template" })}>
          <div className="flex flex-wrap gap-2">
            {p.templates.map((tpl: QuotationTemplateDto) => (
              <button
                key={tpl.id} type="button" onClick={() => p.applyTemplate(tpl)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 text-xs font-medium transition-colors"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {tpl.name}
                {tpl.isDefault && (
                  <span className="text-[10px] text-muted-foreground">
                    {t("quotations.builder.defaultTag", { defaultValue: "default" })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("quotations.builder.customer", { defaultValue: "Customer" })} required className="col-span-2">
          <Input
            value={p.customerName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { p.setCustomerName(e.target.value); p.setCustomerId(null); }}
            list="quotation-customers"
            placeholder={t("quotations.builder.customerPh", { defaultValue: "Search or type a customer name" })}
          />
          {/* A datalist keeps this a plain text field: quoting a prospect who is not yet a saved
              customer is the normal case, and a hard <select> would block it. */}
          <datalist id="quotation-customers">
            {p.customers.map((c: any) => <option key={c.id} value={c.name} />)}
          </datalist>
        </Field>

        <Field label={t("quotations.builder.email", { defaultValue: "Email" })}>
          <Input type="email" value={p.email} onChange={(e: any) => p.setEmail(e.target.value)}
                 placeholder="customer@company.com" />
          <p className="text-[11px] text-muted-foreground mt-1">
            {t("quotations.builder.emailHint", { defaultValue: "Where the quotation link is sent." })}
          </p>
        </Field>

        <Field label={t("quotations.builder.phone", { defaultValue: "Phone" })}>
          <Input value={p.phone} onChange={(e: any) => p.setPhone(e.target.value)} />
        </Field>

        <Field label={t("quotations.builder.address", { defaultValue: "Billing address" })} className="col-span-2">
          <textarea
            value={p.address} onChange={(e: any) => p.setAddress(e.target.value)} rows={2}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>

        <Field label={t("quotations.builder.docTitle", { defaultValue: "Quotation title" })} className="col-span-2">
          <Input value={p.title} onChange={(e: any) => p.setTitle(e.target.value)}
                 placeholder={t("quotations.builder.docTitlePh", { defaultValue: "e.g. Proposal for warehouse fit-out" })} />
        </Field>

        <Field label={t("quotations.builder.reference", { defaultValue: "Your reference" })}>
          <Input value={p.reference} onChange={(e: any) => p.setReference(e.target.value)}
                 placeholder={t("quotations.builder.referencePh", { defaultValue: "Customer PO / RFQ number" })} />
        </Field>

        <Field label={t("quotations.builder.preparedBy", { defaultValue: "Prepared by" })}>
          <Input value={p.preparedBy} onChange={(e: any) => p.setPreparedBy(e.target.value)} />
        </Field>

        <Field label={t("quotations.builder.issueDate", { defaultValue: "Issue date" })}>
          <Input type="date" value={p.issueDate} onChange={(e: any) => p.setIssueDate(e.target.value)} />
        </Field>

        <Field label={t("quotations.builder.validUntil", { defaultValue: "Valid until" })}>
          <Input type="date" value={p.validUntil} onChange={(e: any) => p.setValidUntil(e.target.value)} />
        </Field>
      </div>
    </>
  );
}

// ── Items tab ─────────────────────────────────────────────────────────────────
function ItemsTab(p: any) {
  const { t } = useTranslation("sales");
  const ungrouped = p.lines.filter((l: Line) => l.sectionKey === null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">
            {t("quotations.builder.defaultTax", { defaultValue: "Default tax %" })}
          </label>
          <Input
            type="number" min={0} max={100} step={0.01} value={p.defaultTax}
            onChange={(e: any) => p.setDefaultTax(Number(e.target.value))}
            className="h-8 w-20 text-sm"
          />
          <span className="text-[11px] text-muted-foreground">
            {t("quotations.builder.defaultTaxHint", { defaultValue: "applied to new lines" })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={p.addSection}>
            <Plus className="h-3 w-3" />{t("quotations.builder.addSection", { defaultValue: "Add section" })}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => p.addLine(null)}>
            <Plus className="h-3 w-3" />{t("quotations.builder.addLine", { defaultValue: "Add line" })}
          </Button>
        </div>
      </div>

      {ungrouped.length > 0 && (
        <LineTable {...p} rows={ungrouped} sectionKey={null} />
      )}

      {p.sections.map((s: Section) => (
        <div key={s.key} className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              value={s.title}
              onChange={(e: any) => p.setSections((prev: Section[]) =>
                prev.map(x => (x.key === s.key ? { ...x, title: e.target.value } : x)))}
              className="h-7 text-sm font-semibold border-0 bg-transparent px-1 focus-visible:ring-1"
              placeholder={t("quotations.builder.sectionTitlePh", { defaultValue: "Section title" })}
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => p.removeSection(s.key)}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
          <LineTable {...p} rows={p.lines.filter((l: Line) => l.sectionKey === s.key)} sectionKey={s.key} nested />
        </div>
      ))}

      {p.lines.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          {t("quotations.builder.noLines", { defaultValue: "No line items yet." })}
        </p>
      )}
    </>
  );
}

function LineTable(p: any) {
  const { t } = useTranslation("sales");
  const { rows, sectionKey, nested, currency } = p;

  return (
    <div className={cn(!nested && "rounded-xl border border-border overflow-hidden")}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="text-start px-3 py-2 font-semibold">{t("quotations.builder.col.desc", { defaultValue: "Description" })}</th>
            <th className="text-end px-2 py-2 font-semibold w-16">{t("quotations.builder.col.qty", { defaultValue: "Qty" })}</th>
            <th className="text-start px-2 py-2 font-semibold w-20">{t("quotations.builder.col.unit", { defaultValue: "Unit" })}</th>
            <th className="text-end px-2 py-2 font-semibold w-28">{t("quotations.builder.col.price", { defaultValue: "Price" })}</th>
            <th className="text-end px-2 py-2 font-semibold w-16">{t("quotations.builder.col.disc", { defaultValue: "Disc %" })}</th>
            <th className="text-end px-2 py-2 font-semibold w-16">{t("quotations.builder.col.tax", { defaultValue: "Tax %" })}</th>
            <th className="text-end px-3 py-2 font-semibold w-28">{t("quotations.builder.col.total", { defaultValue: "Total" })}</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((l: Line) => (
            <React.Fragment key={l.key}>
              <tr className={cn(l.isOptional && "bg-violet-50/50 dark:bg-violet-900/10")}>
                <td className="px-2 py-1.5">
                  <Input value={l.description}
                         onChange={(e: any) => p.setLine(l.key, "description", e.target.value)}
                         placeholder={t("quotations.builder.col.descPh", { defaultValue: "What are you quoting?" })}
                         className="h-8 text-xs border-0 bg-transparent px-2 focus-visible:ring-1" />
                </td>
                <td className="px-1 py-1.5">
                  <Input type="number" min={0} step={0.01} value={l.qty}
                         onChange={(e: any) => p.setLine(l.key, "qty", Number(e.target.value))}
                         className="h-8 text-xs text-end border-0 bg-transparent px-1 focus-visible:ring-1" />
                </td>
                <td className="px-1 py-1.5">
                  <Input value={l.unit} onChange={(e: any) => p.setLine(l.key, "unit", e.target.value)}
                         placeholder="pcs" className="h-8 text-xs border-0 bg-transparent px-1 focus-visible:ring-1" />
                </td>
                <td className="px-1 py-1.5">
                  <Input type="number" min={0} step={0.01} value={l.unitPrice}
                         onChange={(e: any) => p.setLine(l.key, "unitPrice", Number(e.target.value))}
                         className="h-8 text-xs text-end border-0 bg-transparent px-1 focus-visible:ring-1" />
                </td>
                <td className="px-1 py-1.5">
                  <Input type="number" min={0} max={100} step={0.01} value={l.discount}
                         onChange={(e: any) => p.setLine(l.key, "discount", Number(e.target.value))}
                         className="h-8 text-xs text-end border-0 bg-transparent px-1 focus-visible:ring-1" />
                </td>
                <td className="px-1 py-1.5">
                  <Input type="number" min={0} max={100} step={0.01} value={l.taxRate}
                         onChange={(e: any) => p.setLine(l.key, "taxRate", Number(e.target.value))}
                         className="h-8 text-xs text-end border-0 bg-transparent px-1 focus-visible:ring-1" />
                </td>
                <td className="px-3 py-1.5 text-end text-xs font-semibold tabular-nums">
                  {formatCurrency(p.lineTotal(l), currency)}
                </td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <button type="button" title={t("quotations.builder.moveUp", { defaultValue: "Move up" })}
                            onClick={() => p.moveLine(l.key, -1)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button type="button" title={t("quotations.builder.moveDown", { defaultValue: "Move down" })}
                            onClick={() => p.moveLine(l.key, 1)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button type="button" title={t("quotations.builder.duplicate", { defaultValue: "Duplicate" })}
                            onClick={() => p.duplicateLine(l.key)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted">
                      <Copy className="h-3 w-3" />
                    </button>
                    <button type="button" title={t("quotations.builder.removeLine", { defaultValue: "Remove" })}
                            onClick={() => p.removeLine(l.key)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr className={cn(l.isOptional && "bg-violet-50/50 dark:bg-violet-900/10")}>
                <td colSpan={8} className="px-3 pb-2 pt-0">
                  <div className="flex items-center gap-3">
                    <Input value={l.notes} onChange={(e: any) => p.setLine(l.key, "notes", e.target.value)}
                           placeholder={t("quotations.builder.col.notesPh", { defaultValue: "Optional note shown under this line" })}
                           className="h-7 text-[11px] border-0 bg-transparent px-2 focus-visible:ring-1 flex-1" />
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer shrink-0 pe-2">
                      <input type="checkbox" checked={l.isOptional}
                             onChange={e => p.setLine(l.key, "isOptional", e.target.checked)}
                             className="h-3.5 w-3.5 rounded border-border accent-violet-600" />
                      {t("quotations.builder.optional", { defaultValue: "Optional extra" })}
                    </label>
                  </div>
                </td>
              </tr>
            </React.Fragment>
          ))}
          <tr>
            <td colSpan={8} className="px-3 py-2">
              <button type="button" onClick={() => p.addLine(sectionKey)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Plus className="h-3 w-3" />{t("quotations.builder.addLine", { defaultValue: "Add line" })}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Document tab ──────────────────────────────────────────────────────────────
function DocumentTab(p: any) {
  const { t } = useTranslation("sales");
  return (
    <>
      <Field label={t("quotations.builder.coverNote", { defaultValue: "Cover note" })}>
        <textarea
          value={p.coverNote} onChange={(e: any) => p.setCoverNote(e.target.value)} rows={4}
          placeholder={t("quotations.builder.coverNotePh", {
            defaultValue: "The opening paragraph your customer reads above the pricing." })}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("quotations.builder.headerDiscount", { defaultValue: "Overall discount %" })}>
          <Input type="number" min={0} max={100} step={0.01} value={p.discountPct}
                 onChange={(e: any) => p.setDiscountPct(Number(e.target.value))} />
        </Field>
        <Field label={t("quotations.builder.payTerms", { defaultValue: "Payment terms" })}>
          <Input value={p.payTerms} onChange={(e: any) => p.setPayTerms(e.target.value)}
                 placeholder={t("quotations.builder.payTermsPh", { defaultValue: "e.g. 50% advance, balance on delivery" })} />
        </Field>
      </div>

      <Field label={t("quotations.builder.terms", { defaultValue: "Terms & conditions" })}>
        <textarea
          value={p.terms} onChange={(e: any) => p.setTerms(e.target.value)} rows={6}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>

      <Field label={t("quotations.builder.customFields", { defaultValue: "Additional details" })}>
        <p className="text-[11px] text-muted-foreground mb-2">
          {t("quotations.builder.customFieldsHint", {
            defaultValue: "Extra rows shown on the document — delivery lead time, warranty, project code." })}
        </p>
        <div className="space-y-2">
          {p.custom.map((c: any) => (
            <div key={c.key} className="flex gap-2">
              <Input value={c.label} placeholder={t("quotations.builder.fieldLabel", { defaultValue: "Label" })}
                     onChange={(e: any) => p.setCustom((prev: any[]) =>
                       prev.map(x => (x.key === c.key ? { ...x, label: e.target.value } : x)))}
                     className="h-9 text-sm flex-1" />
              <Input value={c.value} placeholder={t("quotations.builder.fieldValue", { defaultValue: "Value" })}
                     onChange={(e: any) => p.setCustom((prev: any[]) =>
                       prev.map(x => (x.key === c.key ? { ...x, value: e.target.value } : x)))}
                     className="h-9 text-sm flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => p.setCustom((prev: any[]) => prev.filter(x => x.key !== c.key))}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
          {p.custom.length < 25 && (
            <button type="button"
                    onClick={() => p.setCustom((prev: any[]) => [...prev, { key: uid(), label: "", value: "" }])}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" />{t("quotations.builder.addField", { defaultValue: "Add field" })}
            </button>
          )}
        </div>
      </Field>

      <Field label={t("quotations.builder.internalNotes", { defaultValue: "Internal notes" })}>
        <textarea
          value={p.notes} onChange={(e: any) => p.setNotes(e.target.value)} rows={3}
          placeholder={t("quotations.builder.internalNotesPh", {
            defaultValue: "Only your team sees this — it never appears on the customer's copy." })}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>
    </>
  );
}

function Field({ label, required, className, children }: {
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
