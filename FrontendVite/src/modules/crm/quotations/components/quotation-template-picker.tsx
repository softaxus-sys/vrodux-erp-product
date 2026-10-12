import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Loader2, Star, Layers, CalendarClock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuotationTemplates } from "@/hooks/sales/use-sales-quotations";

interface Props {
  open: boolean;
  /** Who the quotation is for — shown so the rep sees what they are about to generate. */
  customerName: string;
  busy?: boolean;
  onClose: () => void;
  onPick: (templateId: string) => void;
}

/**
 * Choose which Sales quotation template to build the new quotation from. The quotation is then
 * generated for this customer with the template's lines, terms and look, and opened for review —
 * nothing is sent until the user says so.
 *
 * Portalled to <body>: it is opened from inside a transformed drawer, and a `fixed` element inside
 * a transformed ancestor is positioned against that ancestor, not the viewport, so it would be
 * clipped to the drawer.
 */
export function QuotationTemplatePicker({ open, customerName, busy, onClose, onPick }: Props) {
  const { t } = useTranslation("crm");
  const { data: templates = [], isLoading, isError, error } = useQuotationTemplates();
  const [selected, setSelected] = React.useState<string | null>(null);

  // Pre-select the default template each time the dialog opens, so the common case is one click.
  React.useEffect(() => {
    if (!open) return;
    setSelected(templates.find(x => x.isDefault)?.id ?? templates[0]?.id ?? null);
  }, [open, templates]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="min-w-0">
                <h3 className="font-semibold">
                  {t("quotations.pickTitle", { defaultValue: "Choose a quotation template" })}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {t("quotations.pickSubtitle", {
                    defaultValue: "A new quotation for {{name}} will be built from it. You can review and edit it before sending.",
                    name: customerName,
                  })}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} disabled={busy}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {isError && (
                <p className="text-sm text-destructive text-center py-8 px-4">
                  {(error as Error)?.message ??
                    t("quotations.pickError", { defaultValue: "Could not load the quotation templates." })}
                </p>
              )}

              {!isLoading && !isError && templates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">
                  {t("quotations.pickEmpty", {
                    defaultValue: "No quotation templates yet. Create one in Sales → Quotations → Templates, then come back." })}
                </p>
              )}

              {templates.map(tpl => {
                const on = selected === tpl.id;
                const sections = new Set(tpl.items.map(i => i.sectionTitle).filter(Boolean)).size;
                return (
                  <button
                    key={tpl.id} type="button" onClick={() => setSelected(tpl.id)}
                    className={cn(
                      "w-full text-start rounded-xl border p-3.5 transition-colors flex items-start gap-3",
                      on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <div className={cn("mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {on ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{tpl.name}</span>
                        {tpl.isDefault && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                            <Star className="h-2.5 w-2.5" />{t("quotations.default", { defaultValue: "Default" })}
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {t("quotations.validDays", { defaultValue: "Valid {{n}} days", n: tpl.validityDays })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {t("quotations.lineCount", { defaultValue: "{{n}} lines", n: tpl.items.length })}
                          {sections > 0 && ` · ${t("quotations.sectionCount", { defaultValue: "{{n}} sections", n: sections })}`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl">
              <Button variant="outline" size="sm" className="h-9" onClick={onClose} disabled={busy}>
                {t("drawer.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button size="sm" className="h-9 gap-1.5" disabled={!selected || busy}
                      onClick={() => selected && onPick(selected)}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("quotations.generate", { defaultValue: "Create quotation" })}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
