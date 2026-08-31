import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, FileText, Send, ArrowRight, Copy, Building2, Calendar, CheckCircle2,
  Clock, Ban, Loader2, Trash2, Link2, Link2Off, Download, Pencil, Eye,
  Receipt, ThumbsUp, ThumbsDown, Mail, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Can, useCan } from "@/components/auth/can";
import { toast } from "sonner";
import {
  useSalesQuotation, useConvertQuotationToOrder, useDeleteSalesQuotation,
  useSendQuotation, useCreateQuotationShareLink, useRevokeQuotationShareLink,
  useRespondToQuotation, useDuplicateQuotation, useLinkQuotationInvoice,
} from "@/hooks/sales/use-sales-quotations";
import {
  QUOTATION_STATUS_META, isEditableQuotation,
  type QuotationSummaryDto, type QuotationDto, type QuotationItemDto,
} from "@/lib/sales/quotations.api";
import { printQuotation } from "./quotation-print";
import { financeApi } from "@/lib/finance/finance.api";

const STATUS_ICON: Record<string, React.ElementType> = {
  draft: FileText, sent: Send, viewed: Eye, approved: CheckCircle2,
  rejected: Ban, expired: Clock, converted: ArrowRight,
};

type Tab = "overview" | "items" | "document";

interface Props {
  quotation: QuotationSummaryDto | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (q: QuotationDto) => void;
}

export function QuotationDrawer({ quotation: quote, open, onClose, onEdit }: Props) {
  const { t } = useTranslation("sales");
  const currency = useCurrency();
  const canInvoice = useCan("finance.invoicing.create");

  const [tab, setTab] = React.useState<Tab>("overview");
  const [panel, setPanel] = React.useState<null | "send" | "respond" | "delete">(null);
  const [respondAs, setRespondAs] = React.useState<"accept" | "decline">("accept");
  const [sendTo, setSendTo]   = React.useState("");
  const [message, setMessage] = React.useState("");
  const [byName, setByName]   = React.useState("");
  const [comment, setComment] = React.useState("");

  const { data: detail, isLoading } = useSalesQuotation(open ? (quote?.id ?? null) : null);

  const convert   = useConvertQuotationToOrder();
  const remove    = useDeleteSalesQuotation();
  const send      = useSendQuotation();
  const makeLink  = useCreateQuotationShareLink();
  const dropLink  = useRevokeQuotationShareLink();
  const respond   = useRespondToQuotation();
  const duplicate = useDuplicateQuotation();
  const linkInv   = useLinkQuotationInvoice();
  const [invoicing, setInvoicing] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setPanel(null); return; }
    setTab("overview");
    setPanel(null);
    setMessage(""); setByName(""); setComment("");
  }, [open, quote?.id]);

  React.useEffect(() => { setSendTo(detail?.customerEmail ?? ""); }, [detail?.customerEmail]);

  if (!quote) return null;

  const q      = detail;
  const status = (detail?.status ?? quote.status);
  const meta   = QUOTATION_STATUS_META[status] ?? QUOTATION_STATUS_META.draft;
  const Icon   = STATUS_ICON[status] ?? FileText;
  const cur    = detail?.currencyCode || quote.currencyCode || currency;
  const editable = isEditableQuotation(status);

  const shareUrl = q?.shareToken
    ? `${window.location.origin}/q/${q.shareToken}`
    : null;

  // ── Actions ──
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("quotations.drawer.linkCopied", { defaultValue: "Share link copied." }));
    } catch {
      // Clipboard is blocked outside a secure context or without permission — show the URL so
      // it can still be copied by hand rather than failing silently.
      toast.info(url, { duration: 12000 });
    }
  };

  const handleShareLink = async () => {
    if (shareUrl) return copyLink(shareUrl);
    try {
      const r = await makeLink.mutateAsync(quote.id);
      await copyLink(r.url);
    } catch { /* hook toasts */ }
  };

  const handleSend = async () => {
    try {
      const r = await send.mutateAsync({ id: quote.id, toEmail: sendTo || null, message: message || null });
      setPanel(null);
      if (!r.emailSent) await copyLink(r.url);
    } catch { /* hook toasts */ }
  };

  const handleRespond = async () => {
    try {
      await respond.mutateAsync({
        id: quote.id, accepted: respondAs === "accept",
        byName: byName || null, comment: comment || null,
      });
      setPanel(null);
    } catch { /* hook toasts */ }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await duplicate.mutateAsync(quote.id);
      onClose();
      onEdit?.(copy);
    } catch { /* hook toasts */ }
  };

  /**
   * Raises a Finance invoice from the quotation, then links the two.
   *
   * Orchestrated here rather than server-side: Sales must never write into Finance's schema, so
   * the invoice is created against the Finance API and only its id and number are recorded back
   * on the quotation — the same shape the visa module uses to bill a case.
   */
  const handleCreateInvoice = async () => {
    if (!q || invoicing) return;
    setInvoicing(true);
    try {
      const due = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      // Optional lines are quoted, not agreed — billing them would charge for something the
      // customer never accepted. Line discounts are folded into the unit price because the
      // Finance invoice line has no discount field of its own.
      const items = q.items.filter(i => !i.isOptional).map(i => ({
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.quantity > 0 ? i.lineTotal / i.quantity : i.unitPrice,
      }));

      if (!items.length) {
        toast.error(t("quotations.drawer.nothingToBill", {
          defaultValue: "This quotation has no billable lines to invoice." }));
        return;
      }

      // A single blended rate: the invoice carries one tax rate, so derive it from what the
      // quotation actually charges rather than assuming a standard rate.
      const taxRate = q.netSubTotal > 0
        ? Math.round((q.taxAmount / q.netSubTotal) * 10000) / 100
        : 0;

      const invoice = await financeApi.createInvoice({
        customerName:  q.customerName ?? "—",
        customerEmail: q.customerEmail ?? null,
        invoiceDate:   new Date().toISOString().slice(0, 10),
        dueDate:       due,
        taxRate,
        notes: [q.title, `From quotation ${q.quotationNumber}`, q.paymentTerms]
          .filter(Boolean).join(" · "),
        items,
      });

      await linkInv.mutateAsync({
        id: quote.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
      toast.success(t("quotations.drawer.invoiceCreated", {
        defaultValue: "Draft invoice {{number}} created in Finance.",
        number: invoice.invoiceNumber,
      }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInvoicing(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: t("quotations.drawer.tab.overview", { defaultValue: "Overview" }) },
    { id: "items",    label: t("quotations.drawer.tab.items",    { defaultValue: "Items" }) },
    { id: "document", label: t("quotations.drawer.tab.document", { defaultValue: "Document" }) },
  ];

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
            className="fixed inset-y-0 end-0 w-full max-w-2xl bg-background shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{quote.quotationNumber}</span>
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                      meta.color, meta.bg)}>
                      <Icon className="h-3 w-3" />{meta.label}
                    </span>
                    {quote.isExpired && status !== "approved" && status !== "rejected" && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30">
                        {t("quotations.drawer.expired", { defaultValue: "Expired" })}
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-semibold mt-1 truncate">
                    {detail?.title || quote.customerName || "—"}
                  </p>
                  {detail?.title && (
                    <p className="text-xs text-muted-foreground truncate">{quote.customerName}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
              </div>

              {/* Delivery trail — a quotation's real state is "has the customer seen it", which
                  a status badge alone does not convey. */}
              {(q?.sentAt || q?.viewedAt || q?.respondedAt) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground">
                  {q?.sentAt && <Trail icon={Mail}  label={t("quotations.drawer.sent", { defaultValue: "Sent" })}     at={q.sentAt} extra={q.sentTo} />}
                  {q?.viewedAt && <Trail icon={Eye} label={t("quotations.drawer.viewed", { defaultValue: "Opened" })} at={q.viewedAt} />}
                  {q?.respondedAt && (
                    <Trail icon={q.status === "approved" ? ThumbsUp : ThumbsDown}
                           label={q.status === "approved"
                             ? t("quotations.drawer.accepted", { defaultValue: "Accepted" })
                             : t("quotations.drawer.declined", { defaultValue: "Declined" })}
                           at={q.respondedAt} extra={q.respondedByName} />
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 border-b border-border shrink-0">
              {TABS.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setTab(id)}
                  className={cn("px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === id ? "border-primary text-primary"
                               : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isLoading && !q ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {tab === "overview" && q && (
                    <OverviewTab q={q} cur={cur} shareUrl={shareUrl} onCopyLink={copyLink} />
                  )}
                  {tab === "items" && q && <ItemsTab q={q} cur={cur} />}
                  {tab === "document" && q && <DocumentTab q={q} />}
                </>
              )}
            </div>

            {/* Inline panels */}
            <AnimatePresence>
              {panel === "send" && (
                <Panel title={t("quotations.drawer.sendTitle", { defaultValue: "Send to customer" })}>
                  <Input value={sendTo} onChange={e => setSendTo(e.target.value)} type="email"
                         placeholder={t("quotations.drawer.sendToPh", { defaultValue: "customer@company.com" })}
                         className="h-9 text-sm" />
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                            placeholder={t("quotations.drawer.messagePh", { defaultValue: "Optional message to include in the email" })}
                            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <p className="text-[11px] text-muted-foreground">
                    {t("quotations.drawer.sendHint", {
                      defaultValue: "The customer gets a link to view, download and accept or decline online. If email is not configured, the link is copied for you instead." })}
                  </p>
                  <PanelActions onCancel={() => setPanel(null)} onConfirm={handleSend}
                                pending={send.isPending}
                                confirmLabel={t("quotations.drawer.button.send", { defaultValue: "Send" })} />
                </Panel>
              )}

              {panel === "respond" && (
                <Panel title={t("quotations.drawer.respondTitle", { defaultValue: "Record the customer's decision" })}>
                  <div className="flex gap-2">
                    {(["accept", "decline"] as const).map(v => (
                      <button key={v} type="button" onClick={() => setRespondAs(v)}
                        className={cn("flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                          respondAs === v
                            ? v === "accept"
                              ? "border-success bg-success/10 text-success"
                              : "border-destructive bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground hover:bg-muted")}>
                        {v === "accept"
                          ? t("quotations.drawer.accept",  { defaultValue: "Accepted" })
                          : t("quotations.drawer.decline", { defaultValue: "Declined" })}
                      </button>
                    ))}
                  </div>
                  <Input value={byName} onChange={e => setByName(e.target.value)}
                         placeholder={t("quotations.drawer.byNamePh", { defaultValue: "Who confirmed it?" })}
                         className="h-9 text-sm" />
                  <Input value={comment} onChange={e => setComment(e.target.value)}
                         placeholder={t("quotations.drawer.commentPh", { defaultValue: "Note (optional)" })}
                         className="h-9 text-sm" />
                  <PanelActions onCancel={() => setPanel(null)} onConfirm={handleRespond}
                                pending={respond.isPending}
                                confirmLabel={t("quotations.drawer.button.record", { defaultValue: "Record" })} />
                </Panel>
              )}

              {panel === "delete" && (
                <Panel title={t("quotations.drawer.deleteConfirm", { defaultValue: "Delete this quotation?" })} danger>
                  <p className="text-xs text-muted-foreground">
                    {t("quotations.drawer.deleteHint", {
                      defaultValue: "Its share link stops working immediately, so the customer's copy of the URL will no longer open." })}
                  </p>
                  <PanelActions
                    onCancel={() => setPanel(null)}
                    onConfirm={async () => { await remove.mutateAsync(quote.id); onClose(); }}
                    pending={remove.isPending} danger
                    confirmLabel={t("quotations.drawer.button.delete", { defaultValue: "Delete" })} />
                </Panel>
              )}
            </AnimatePresence>

            {/* Footer actions */}
            <div className="border-t border-border px-4 py-3 shrink-0 bg-muted/20 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-9"
                      onClick={() => q && printQuotation(q)} disabled={!q}>
                <Download className="h-3.5 w-3.5" />{t("quotations.drawer.button.pdf", { defaultValue: "PDF" })}
              </Button>

              <Can permission="sales.quotations.edit">
                <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleShareLink}
                        disabled={makeLink.isPending}>
                  {makeLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  {shareUrl
                    ? t("quotations.drawer.button.copyLink", { defaultValue: "Copy link" })
                    : t("quotations.drawer.button.getLink",  { defaultValue: "Get link" })}
                </Button>
              </Can>

              {editable && (
                <Can permission="sales.quotations.edit">
                  <Button variant="outline" size="sm" className="gap-1.5 h-9"
                          onClick={() => { if (q) { onClose(); onEdit?.(q); } }} disabled={!q}>
                    <Pencil className="h-3.5 w-3.5" />{t("quotations.drawer.button.edit", { defaultValue: "Edit" })}
                  </Button>
                </Can>
              )}

              {editable && (
                <Can permission="sales.quotations.edit">
                  <Button size="sm" className="gap-1.5 h-9" onClick={() => setPanel("send")}>
                    <Send className="h-3.5 w-3.5" />
                    {q?.sentAt
                      ? t("quotations.drawer.button.resend", { defaultValue: "Resend" })
                      : t("quotations.drawer.button.send",   { defaultValue: "Send" })}
                  </Button>
                </Can>
              )}

              {(status === "sent" || status === "viewed") && (
                <Can permission="sales.quotations.edit">
                  <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setPanel("respond")}>
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {t("quotations.drawer.button.record", { defaultValue: "Record decision" })}
                  </Button>
                </Can>
              )}

              {status === "approved" && (
                <>
                  <Can permission="sales.quotations.edit">
                    <Button size="sm" className="gap-1.5 h-9 bg-success hover:bg-success/90"
                            onClick={() => convert.mutate(quote.id)} disabled={convert.isPending}>
                      {convert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      {t("quotations.drawer.button.convert", { defaultValue: "Create order" })}
                    </Button>
                  </Can>
                  {canInvoice && !q?.invoiceId && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-9"
                            onClick={handleCreateInvoice} disabled={invoicing}>
                      {invoicing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                      {t("quotations.drawer.button.invoice", { defaultValue: "Create invoice" })}
                    </Button>
                  )}
                </>
              )}

              <Can permission="sales.quotations.create">
                <Button variant="ghost" size="sm" className="gap-1.5 h-9 ms-auto"
                        onClick={handleDuplicate} disabled={duplicate.isPending}>
                  {duplicate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  {t("quotations.drawer.button.duplicate", { defaultValue: "Duplicate" })}
                </Button>
              </Can>

              {status !== "converted" && (
                <Can permission="sales.quotations.delete">
                  <Button variant="ghost" size="sm"
                          className="gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setPanel("delete")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Can>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function OverviewTab({ q, cur, shareUrl, onCopyLink }: {
  q: QuotationDto; cur: string; shareUrl: string | null; onCopyLink: (u: string) => void;
}) {
  const { t } = useTranslation("sales");
  const revoke = useRevokeQuotationShareLink();
  const linkInv = useLinkQuotationInvoice();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Building2} label={t("quotations.drawer.customer", { defaultValue: "Customer" })} value={q.customerName ?? "—"} />
        <Stat icon={Calendar}  label={t("quotations.drawer.validUntil", { defaultValue: "Valid until" })} value={q.validUntil ?? "—"} />
      </div>

      <div className="rounded-xl border border-border p-4 space-y-2">
        <Row label={t("quotations.drawer.subtotal", { defaultValue: "Subtotal" })} value={formatCurrency(q.subTotal, cur)} />
        {q.discountAmount > 0 && (
          <Row label={t("quotations.drawer.discountPct", { defaultValue: "Discount ({{pct}}%)", pct: q.discountPercent })}
               value={`−${formatCurrency(q.discountAmount, cur)}`} negative />
        )}
        <Row label={t("quotations.drawer.tax", { defaultValue: "Tax" })} value={formatCurrency(q.taxAmount, cur)} />
        <div className="flex justify-between pt-2 border-t border-border text-base font-bold">
          <span>{t("quotations.drawer.total", { defaultValue: "Total" })}</span>
          <span>{formatCurrency(q.total, cur)}</span>
        </div>
        {q.optionalTotal > 0 && (
          <p className="text-[11px] text-violet-600 dark:text-violet-400 pt-1">
            {t("quotations.drawer.optionalHint", {
              defaultValue: "+ {{amount}} in optional extras, not included above",
              amount: formatCurrency(q.optionalTotal, cur),
            })}
          </p>
        )}
      </div>

      {/* Share link */}
      {shareUrl && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("quotations.drawer.shareLink", { defaultValue: "Customer link" })}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-[11px] bg-muted rounded px-2 py-1.5">{shareUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onCopyLink(shareUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <a href={shareUrl} target="_blank" rel="noreferrer"
               className="p-2 rounded-lg text-muted-foreground hover:bg-muted shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Can permission="sales.quotations.edit">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      title={t("quotations.drawer.revoke", { defaultValue: "Revoke link" })}
                      onClick={() => revoke.mutate(q.id)} disabled={revoke.isPending}>
                <Link2Off className="h-3.5 w-3.5" />
              </Button>
            </Can>
          </div>
        </div>
      )}

      {/* Downstream links */}
      {(q.invoiceId || q.convertedOrderId) && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("quotations.drawer.linked", { defaultValue: "Linked records" })}
          </p>
          {q.invoiceId && (
            <div className="flex items-center justify-between gap-2">
              <Link to="/finance/invoicing" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Receipt className="h-3.5 w-3.5" />
                {q.invoiceNumber ?? t("quotations.drawer.invoice", { defaultValue: "Invoice" })}
              </Link>
              <Can permission="sales.quotations.edit">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                        onClick={() => linkInv.mutate({ id: q.id, invoiceId: null, invoiceNumber: null })}
                        disabled={linkInv.isPending}>
                  {t("quotations.drawer.detach", { defaultValue: "Detach" })}
                </Button>
              </Can>
            </div>
          )}
          {q.convertedOrderId && (
            <Link to="/sales/orders" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ArrowRight className="h-3.5 w-3.5" />
              {t("quotations.drawer.viewOrder", { defaultValue: "View sales order" })}
            </Link>
          )}
        </div>
      )}

      {q.responseComment && (
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("quotations.drawer.customerNote", { defaultValue: "Customer's note" })}
          </p>
          <p className="text-sm whitespace-pre-line">{q.responseComment}</p>
        </div>
      )}

      {q.notes && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("quotations.drawer.internalNotes", { defaultValue: "Internal notes" })}
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{q.notes}</p>
        </div>
      )}
    </div>
  );
}

function ItemsTab({ q, cur }: { q: QuotationDto; cur: string }) {
  const { t } = useTranslation("sales");
  const billable  = q.items.filter(i => !i.isOptional);
  const optional  = q.items.filter(i => i.isOptional);
  const ungrouped = billable.filter(i => !i.sectionId);

  return (
    <div className="space-y-5">
      {ungrouped.length > 0 && <ItemGroup items={ungrouped} cur={cur} />}
      {q.sections.map(s => {
        const rows = billable.filter(i => i.sectionId === s.id);
        if (!rows.length) return null;
        return (
          <div key={s.id}>
            <p className="text-xs font-bold text-primary mb-1">{s.title}</p>
            {s.description && <p className="text-[11px] text-muted-foreground mb-1.5">{s.description}</p>}
            <ItemGroup items={rows} cur={cur} />
          </div>
        );
      })}
      {optional.length > 0 && (
        <div>
          <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">
            {t("quotations.drawer.optionalExtras", { defaultValue: "Optional extras" })}
          </p>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            {t("quotations.drawer.optionalNote", { defaultValue: "Not included in the total." })}
          </p>
          <ItemGroup items={optional} cur={cur} />
        </div>
      )}
    </div>
  );
}

function ItemGroup({ items, cur }: { items: QuotationItemDto[]; cur: string }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border/50">
          {items.map(i => (
            <tr key={i.id}>
              <td className="px-3 py-2.5">
                <p className="font-medium">{i.description}</p>
                {i.notes && <p className="text-[11px] text-muted-foreground mt-0.5">{i.notes}</p>}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {i.quantity}{i.unit ? ` ${i.unit}` : ""} × {formatCurrency(i.unitPrice, cur)}
                  {i.discountPercent > 0 && ` · −${i.discountPercent}%`}
                  {i.taxRate > 0 && ` · ${i.taxRate}% tax`}
                </p>
              </td>
              <td className="px-3 py-2.5 text-end font-semibold whitespace-nowrap align-top">
                {formatCurrency(i.lineTotal, cur)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTab({ q }: { q: QuotationDto }) {
  const { t } = useTranslation("sales");
  const blocks = [
    { label: t("quotations.drawer.coverNote", { defaultValue: "Cover note" }),  value: q.coverNote },
    { label: t("quotations.drawer.payTerms",  { defaultValue: "Payment terms" }), value: q.paymentTerms },
    { label: t("quotations.drawer.terms",     { defaultValue: "Terms & conditions" }), value: q.termsAndConditions },
  ].filter(b => b.value);

  const fields = Object.entries(q.customFields ?? {});
  const empty  = blocks.length === 0 && fields.length === 0 && !q.reference && !q.preparedByName;

  if (empty) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        {t("quotations.drawer.noDocument", {
          defaultValue: "No cover note or terms yet — add them from Edit to make this read like a proposal." })}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {(q.reference || q.preparedByName || fields.length > 0) && (
        <div className="rounded-xl border border-border p-3 space-y-1.5">
          {q.reference      && <Row label={t("quotations.drawer.reference",  { defaultValue: "Your reference" })} value={q.reference} />}
          {q.preparedByName && <Row label={t("quotations.drawer.preparedBy", { defaultValue: "Prepared by" })}    value={q.preparedByName} />}
          {fields.map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </div>
      )}
      {blocks.map(b => (
        <div key={b.label}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{b.label}</p>
          <p className="text-sm whitespace-pre-line leading-relaxed">{b.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────
function Trail({ icon: Icon, label, at, extra }: {
  icon: React.ElementType; label: string; at: string; extra?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3 w-3" />
      {label} {formatDate(at, "short")}{extra ? ` · ${extra}` : ""}
    </span>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />{label}
      </div>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-end", negative && "text-destructive")}>{value}</span>
    </div>
  );
}

function Panel({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className={cn("border-t px-6 py-4 space-y-2.5 shrink-0 overflow-hidden",
        danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30")}
    >
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </motion.div>
  );
}

function PanelActions({ onCancel, onConfirm, pending, confirmLabel, danger }: {
  onCancel: () => void; onConfirm: () => void; pending: boolean; confirmLabel: string; danger?: boolean;
}) {
  const { t } = useTranslation("sales");
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCancel} disabled={pending}>
        {t("common.cancel", { defaultValue: "Cancel" })}
      </Button>
      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onConfirm} disabled={pending}
              variant={danger ? "destructive" : "default"}>
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}{confirmLabel}
      </Button>
    </div>
  );
}
