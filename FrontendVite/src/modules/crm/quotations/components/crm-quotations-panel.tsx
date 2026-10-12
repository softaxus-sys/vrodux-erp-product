import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Loader2, Mail, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useModuleLink } from "@/hooks/manufacturing/use-manufacturing-links";
import { useCrmQuotations, useCreateQuotationFromTemplate } from "@/hooks/sales/use-sales-quotations";
import { crmApi } from "@/lib/crm/crm.api";
import {
  QUOTATION_STATUS_META,
  type QuotationDto, type QuotationSummaryDto, type QuotationStatus,
} from "@/lib/sales/quotations.api";
import { QuotationDrawer } from "@/modules/sales/quotations/components/quotation-drawer";
import { QuotationBuilder } from "@/modules/sales/quotations/components/quotation-builder";
import { QuotationTemplatePicker } from "./quotation-template-picker";

/** True when this workspace has Sales and the user may see quotations — decides whether CRM offers the tab at all. */
export function useCanViewQuotations() {
  return useModuleLink("sales", "sales.quotations.view");
}
export function useCanCreateQuotations() {
  return useModuleLink("sales", "sales.quotations.create");
}

/** Who a quotation is being raised for, and where to file it. */
export interface QuotationParty {
  customerName: string;
  /** The person to address the cover note to; falls back to the customer name. */
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  leadId?: string;
  crmCustomerId?: string;
  dealId?: string;
  /** Told when the customer answers. */
  ownerUserId?: string | null;
  /** Where the "quotation sent" entry is logged on the CRM timeline. */
  timeline: { type: "lead" | "customer"; id: string; name: string };
}

interface Props {
  party: QuotationParty;
  /** Increment to open the template picker from outside (the lead drawer's footer button). */
  openPickerSignal?: number;
}

/** A just-created DTO as the list-row shape the drawer is keyed on. */
function toSummary(q: QuotationDto): QuotationSummaryDto {
  return {
    id: q.id, quotationNumber: q.quotationNumber, title: q.title,
    customerId: q.customerId, customerName: q.customerName, status: q.status,
    currencyCode: q.currencyCode, discountPercent: q.discountPercent, subTotal: q.subTotal,
    discountAmount: q.discountAmount, taxAmount: q.taxAmount, total: q.total,
    itemCount: q.items.length, issueDate: q.issueDate, validUntil: q.validUntil,
    isExpired: q.isExpired, convertedOrderId: q.convertedOrderId, invoiceId: q.invoiceId,
    invoiceNumber: q.invoiceNumber, hasShareLink: !!q.shareToken, sentAt: q.sentAt,
    viewedAt: q.viewedAt, respondedAt: q.respondedAt, createdAt: q.createdAt, updatedAt: q.updatedAt,
    leadId: q.leadId, crmCustomerId: q.crmCustomerId,
  };
}

/**
 * Quotations raised for one CRM lead or account.
 *
 * "New quotation" → pick a Sales template → the server builds a complete draft for this customer
 * (lines, terms, validity, company letterhead) → it opens on a preview of exactly what the
 * customer will receive → send by email, copy the link, or download the PDF. Everything is a
 * normal Sales quotation, so it also appears under Sales → Quotations.
 */
export function CrmQuotationsPanel({ party, openPickerSignal = 0 }: Props) {
  const { t } = useTranslation("crm");
  const qc = useQueryClient();
  const me = useAuthStore(s => s.user);
  const canCreate = useCanCreateQuotations();

  const scope = { leadId: party.leadId, crmCustomerId: party.leadId ? undefined : party.crmCustomerId };
  const { data, isLoading, isError, error } = useCrmQuotations(scope);
  const rows = data?.items ?? [];

  const createFromTemplate = useCreateQuotationFromTemplate();
  const [pickerOpen, setPickerOpen]   = React.useState(false);
  const [selected, setSelected]       = React.useState<QuotationSummaryDto | null>(null);
  const [drawerOpen, setDrawerOpen]   = React.useState(false);
  const [editing, setEditing]         = React.useState<QuotationDto | null>(null);
  // What to show again once the builder closes — editing is a detour, not a destination.
  const reopenRef = React.useRef<QuotationSummaryDto | null>(null);

  React.useEffect(() => {
    if (openPickerSignal > 0 && canCreate) setPickerOpen(true);
  }, [openPickerSignal, canCreate]);

  const open = (s: QuotationSummaryDto) => { setSelected(s); setDrawerOpen(true); };

  const handlePick = async (templateId: string) => {
    try {
      const created = await createFromTemplate.mutateAsync({
        templateId,
        customerName:    party.customerName,
        contactName:     party.contactName ?? null,
        customerEmail:   party.email ?? null,
        customerPhone:   party.phone ?? null,
        customerAddress: party.address ?? null,
        preparedByName:  me?.name ?? null,
        leadId:          party.leadId ?? null,
        crmCustomerId:   party.crmCustomerId ?? null,
        dealId:          party.dealId ?? null,
        leadOwnerUserId: party.ownerUserId ?? null,
      });
      setPickerOpen(false);

      // A template with no lines yields a draft with nothing to price — open the builder so the
      // rep fills it in, then show the preview. Otherwise go straight to the preview.
      if (created.items.length === 0) {
        reopenRef.current = toSummary(created);
        setEditing(created);
        toast.info(t("quotations.addLines", {
          defaultValue: "This template has no line items yet — add what you are quoting." }));
      } else {
        open(toSummary(created));
      }
    } catch {
      // The mutation hook already surfaced the reason; keep the picker open to retry.
    }
  };

  /** Log "quotation sent" on the CRM timeline, as the sender (so nobody gets an assignment alert for it). */
  const logSent = async (q: QuotationDto, r: { emailSent: boolean; sentTo: string | null }) => {
    try {
      const how = r.emailSent && r.sentTo ? `emailed to ${r.sentTo}` : "shared with the customer";
      const a = await crmApi.createActivity({
        type: "email",
        subject: `Quotation ${q.quotationNumber} ${how}`,
        description: `${q.title ?? "Quotation"} — ${formatCurrency(q.total, q.currencyCode)}`,
        relatedToType: party.timeline.type,
        relatedToId:   party.timeline.id,
        relatedToName: party.timeline.name,
        assignedTo:       me?.name ?? "",
        assignedToUserId: me?.id ?? null,
      });
      await crmApi.completeActivity(a.id);
      qc.invalidateQueries({ queryKey: ["crm", "activities"] });
    } catch {
      // The timeline entry is a convenience; the quotation itself was already sent.
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("quotations.title", { defaultValue: "Quotations" })}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("quotations.hint", {
              defaultValue: "Built from your Sales templates and sent from here." })}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3.5 w-3.5" />{t("quotations.new", { defaultValue: "New quotation" })}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive text-center py-6">
          {(error as Error)?.message ?? t("quotations.loadError", { defaultValue: "Could not load quotations." })}
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 px-6 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">{t("quotations.empty", { defaultValue: "No quotations yet" })}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canCreate
              ? t("quotations.emptyHint", { defaultValue: "Pick a template and a ready-to-send quotation is generated for this customer." })
              : t("quotations.emptyNoCreate", { defaultValue: "You can view quotations here, but creating them needs the Sales quotation permission." })}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map(q => {
          const meta = QUOTATION_STATUS_META[q.status as QuotationStatus] ?? QUOTATION_STATUS_META.draft;
          return (
            <button
              key={q.id} type="button" onClick={() => open(q)}
              className="w-full text-start rounded-xl border border-border p-3.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold">{q.quotationNumber}</span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold", meta.color, meta.bg)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />{meta.label}
                    </span>
                  </div>
                  {q.title && <p className="text-sm mt-1 truncate">{q.title}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    {q.sentAt && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{formatDate(q.sentAt, "short")}</span>}
                    {q.viewedAt && <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{t("quotations.opened", { defaultValue: "Opened" })}</span>}
                    {q.respondedAt && (q.status === "approved"
                      ? <span className="inline-flex items-center gap-1 text-success"><ThumbsUp className="h-3 w-3" />{t("quotations.accepted", { defaultValue: "Accepted" })}</span>
                      : <span className="inline-flex items-center gap-1 text-destructive"><ThumbsDown className="h-3 w-3" />{t("quotations.declined", { defaultValue: "Declined" })}</span>)}
                    {!q.sentAt && <span>{t("quotations.notSent", { defaultValue: "Not sent yet" })}</span>}
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-semibold">{formatCurrency(q.total, q.currencyCode)}</p>
                  {q.validUntil && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t("quotations.validUntil", { defaultValue: "Valid until {{date}}", date: q.validUntil })}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Portalled to <body>: this panel lives inside a transformed drawer, which would otherwise
          clip these `fixed` overlays to its own box. */}
      <QuotationTemplatePicker
        open={pickerOpen}
        customerName={party.customerName}
        busy={createFromTemplate.isPending}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />

      {createPortal(
        <>
          <QuotationDrawer
            quotation={selected}
            open={drawerOpen}
            initialTab="preview"
            onClose={() => setDrawerOpen(false)}
            onEdit={q => { reopenRef.current = toSummary(q); setEditing(q); }}
            onSent={logSent}
          />
          <QuotationBuilder
            open={!!editing}
            editing={editing}
            onClose={() => {
              setEditing(null);
              // Back to the preview, so the edit's effect is what the rep sees next.
              if (reopenRef.current) { open(reopenRef.current); reopenRef.current = null; }
            }}
          />
        </>,
        document.body,
      )}
    </div>
  );
}
