import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileText, Link2, Loader2, Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import {
  useQuotationsForInvoice, useSalesQuotations, useLinkQuotationInvoice,
} from "@/hooks/sales/use-sales-quotations";
import { QUOTATION_STATUS_META, type QuotationSummaryDto } from "@/lib/sales/quotations.api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Quotations attached to an invoice, shown inside the invoice drawer.
 *
 * The link is stored on the quotation (Sales owns it), so this reads and writes through the
 * Sales API rather than adding an invoice-side column — Finance and Sales are separate services
 * and neither writes into the other's schema.
 *
 * Renders nothing at all for a tenant without the Sales module or a user without quotation
 * access: an empty "no quotations" box on every invoice would be noise for the many tenants that
 * bill without quoting first.
 */
export function InvoiceQuotationsPanel({ invoiceId, invoiceNumber }: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();

  const hasSales = useAuthStore(s => s.tenant?.enabledModules?.includes("sales")) ?? false;
  const canView  = useCan("sales.quotations.view");
  const canLink  = useCan("sales.quotations.edit");

  const [picking, setPicking] = React.useState(false);
  const [search, setSearch]   = React.useState("");

  const enabled = hasSales && canView;
  const { data, isLoading } = useQuotationsForInvoice(invoiceId, enabled);
  const attached = data?.items ?? [];

  if (!enabled) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold">
          {t("invoicing.drawer.quotations.title", { defaultValue: "Quotations" })}
        </h3>
        {canLink && !picking && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setPicking(true)}>
            <Plus className="h-3 w-3" />
            {t("invoicing.drawer.quotations.attach", { defaultValue: "Attach" })}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attached.length === 0 && !picking ? (
        <p className="text-xs text-muted-foreground">
          {t("invoicing.drawer.quotations.none", {
            defaultValue: "No quotation attached. Attach the one this invoice was raised from to keep the trail." })}
        </p>
      ) : (
        <div className="space-y-2">
          {attached.map(q => <AttachedRow key={q.id} q={q} currency={currency} canLink={canLink} />)}
        </div>
      )}

      {picking && (
        <QuotationPicker
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          search={search}
          setSearch={setSearch}
          onDone={() => { setPicking(false); setSearch(""); }}
          attachedIds={new Set(attached.map(a => a.id))}
        />
      )}
    </div>
  );
}

function AttachedRow({ q, currency, canLink }: {
  q: QuotationSummaryDto; currency: string; canLink: boolean;
}) {
  const { t } = useTranslation("finance");
  const unlink = useLinkQuotationInvoice();
  const meta = QUOTATION_STATUS_META[q.status] ?? QUOTATION_STATUS_META.draft;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold">{q.quotationNumber}</span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", meta.color, meta.bg)}>
            {meta.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {q.title || q.customerName || "—"}
          {q.issueDate && ` · ${formatDate(q.issueDate, "short")}`}
        </p>
      </div>
      <span className="text-xs font-semibold whitespace-nowrap">
        {formatCurrency(q.total, q.currencyCode || currency)}
      </span>
      {canLink && (
        <Button
          variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          title={t("invoicing.drawer.quotations.detach", { defaultValue: "Detach" })}
          onClick={() => unlink.mutate({ id: q.id, invoiceId: null, invoiceNumber: null })}
          disabled={unlink.isPending}
        >
          {unlink.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}

function QuotationPicker({ invoiceId, invoiceNumber, search, setSearch, onDone, attachedIds }: {
  invoiceId: string;
  invoiceNumber: string;
  search: string;
  setSearch: (v: string) => void;
  onDone: () => void;
  attachedIds: Set<string>;
}) {
  const { t } = useTranslation("finance");
  const currency = useCurrency();
  const link = useLinkQuotationInvoice();

  // Accepted quotations first: attaching one to an invoice almost always means billing work the
  // customer already agreed to.
  const { data, isLoading } = useSalesQuotations({ pageSize: 25, search: search || undefined });
  const options = (data?.items ?? [])
    .filter(q => !attachedIds.has(q.id) && !q.invoiceId)
    .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));

  const attach = async (q: QuotationSummaryDto) => {
    try {
      await link.mutateAsync({ id: q.id, invoiceId, invoiceNumber });
      onDone();
    } catch { /* hook toasts */ }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)} autoFocus
            placeholder={t("invoicing.drawer.quotations.searchPh", {
              defaultValue: "Search by number, title or customer" })}
            className="h-8 text-xs ps-8"
          />
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onDone}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-2 text-center">
          {t("invoicing.drawer.quotations.noneToAttach", {
            defaultValue: "No unattached quotations found. A quotation already linked to another invoice will not appear here." })}
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto space-y-1">
          {options.map(q => {
            const meta = QUOTATION_STATUS_META[q.status] ?? QUOTATION_STATUS_META.draft;
            return (
              <button
                key={q.id} type="button" onClick={() => attach(q)} disabled={link.isPending}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted text-start transition-colors disabled:opacity-60"
              >
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold">{q.quotationNumber}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", meta.color, meta.bg)}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{q.title || q.customerName || "—"}</p>
                </div>
                <span className="text-[11px] font-semibold whitespace-nowrap">
                  {formatCurrency(q.total, q.currencyCode || currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
