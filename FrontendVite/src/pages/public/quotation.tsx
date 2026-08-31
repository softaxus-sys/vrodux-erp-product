import * as React from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check, X, Loader2, Download, FileWarning, CheckCircle2, XCircle, Clock, Building2,
} from "lucide-react";
import { publicQuotationsApi, type PublicQuotationDto } from "@/lib/sales/quotations.api";
import { printQuotation } from "@/modules/sales/quotations/components/quotation-print";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

/**
 * The page a customer opens from the link in their email. No authentication, no app chrome, no
 * dependency on the tenant's theme — a customer who has never heard of this product should be
 * able to read a proposal and answer it.
 *
 * Deliberately self-contained: it does not use the app's layout, sidebar, auth store or i18n
 * (the recipient's language is not the tenant's UI language), and it renders whatever currency
 * the quotation was priced in rather than any tenant setting.
 */
export default function PublicQuotationPage() {
  const { token = "" } = useParams<{ token: string }>();

  const [data, setData]       = React.useState<PublicQuotationDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState<string | null>(null);

  const [decision, setDecision] = React.useState<"accept" | "decline" | null>(null);
  const [name, setName]         = React.useState("");
  const [comment, setComment]   = React.useState("");
  const [saving, setSaving]     = React.useState(false);

  // Guarded so React StrictMode's double-invoke does not record two views.
  const fetched = React.useRef(false);
  React.useEffect(() => {
    if (fetched.current || !token) return;
    fetched.current = true;
    publicQuotationsApi.get(token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!decision || saving) return;
    setSaving(true);
    try {
      const updated = await publicQuotationsApi.respond(token, {
        accepted: decision === "accept",
        byName:   name.trim() || null,
        comment:  comment.trim() || null,
      });
      setData(updated);
      setDecision(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading quotation…</p>
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
          <FileWarning className="h-9 w-9 text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-900">This quotation is not available</h1>
          <p className="text-sm text-slate-500 max-w-md">
            {error ?? "The link may have expired or been withdrawn."} Please contact the sender for
            an up-to-date link.
          </p>
        </div>
      </Shell>
    );
  }

  const cur    = data.currencyCode;
  const brand  = data.branding;
  const accent = brand.accentColor?.trim() || "#0f172a";
  const answered = data.status === "approved" || data.status === "rejected";

  const billable = data.items.filter(i => !i.isOptional);
  const optional = data.items.filter(i => i.isOptional);
  const ungrouped = billable.filter(i => !i.sectionId);

  return (
    <Shell>
      {/* Letterhead */}
      <div className="px-6 sm:px-10 pt-8 pb-6 border-b-4" style={{ borderColor: accent }}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt="" className="max-h-14 max-w-[200px] object-contain mb-2" />
              : <Building2 className="h-7 w-7 mb-2" style={{ color: accent }} />}
            <p className="text-lg font-bold" style={{ color: accent }}>{brand.companyName}</p>
            <div className="text-xs text-slate-500 leading-relaxed mt-1">
              {brand.address && <p className="whitespace-pre-line">{brand.address}</p>}
              <p>
                {[brand.phone, brand.email].filter(Boolean).join(" · ")}
              </p>
              {brand.taxNumber && <p>TRN: {brand.taxNumber}</p>}
            </div>
          </div>
          <div className="text-end">
            <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: accent }}>Quotation</h1>
            <p className="text-sm text-slate-500 mt-1">{data.quotationNumber}</p>
            <StatusPill status={data.status} isExpired={data.isExpired} />
          </div>
        </div>
      </div>

      {/* Outcome banner */}
      {answered && (
        <div className={cn(
          "px-6 sm:px-10 py-4 flex items-start gap-3 border-b",
          data.status === "approved"
            ? "bg-emerald-50 border-emerald-200"
            : "bg-rose-50 border-rose-200",
        )}>
          {data.status === "approved"
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            : <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
          <div>
            <p className={cn("text-sm font-semibold",
              data.status === "approved" ? "text-emerald-900" : "text-rose-900")}>
              {data.status === "approved"
                ? "You accepted this quotation."
                : "You declined this quotation."}
              {data.respondedAt && (
                <span className="font-normal opacity-75"> · {formatDate(data.respondedAt, "medium")}</span>
              )}
            </p>
            {data.responseComment && (
              <p className="text-xs mt-1 text-slate-600 whitespace-pre-line">{data.responseComment}</p>
            )}
          </div>
        </div>
      )}

      {!answered && data.isExpired && (
        <div className="px-6 sm:px-10 py-4 flex items-center gap-3 bg-amber-50 border-b border-amber-200">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            This quotation expired on <strong>{data.validUntil}</strong>. Please contact us for an
            updated quote.
          </p>
        </div>
      )}

      <div className="px-6 sm:px-10 py-7 space-y-7">
        {/* Parties + meta */}
        <div className="grid sm:grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Prepared for</p>
            <p className="font-semibold text-slate-900">{data.customerName ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Details</p>
            <MetaRow label="Issue date"  value={data.issueDate} />
            <MetaRow label="Valid until" value={data.validUntil} />
            {data.reference      && <MetaRow label="Your reference" value={data.reference} />}
            {data.preparedByName && <MetaRow label="Prepared by"    value={data.preparedByName} />}
            {Object.entries(data.customFields ?? {}).map(([k, v]) => (
              <MetaRow key={k} label={k} value={v} />
            ))}
          </div>
        </div>

        {data.title && <h2 className="text-lg font-semibold text-slate-900">{data.title}</h2>}
        {data.coverNote && (
          <div className="rounded-lg bg-slate-50 border-s-4 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line"
               style={{ borderColor: accent }}>
            {data.coverNote}
          </div>
        )}

        {/* Items */}
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b-2 border-slate-200">
                <th className="text-start px-2 py-2 font-bold">Description</th>
                <th className="text-end px-2 py-2 font-bold w-20">Qty</th>
                <th className="text-end px-2 py-2 font-bold w-28">Unit price</th>
                <th className="text-end px-2 py-2 font-bold w-16">Disc.</th>
                <th className="text-end px-2 py-2 font-bold w-32">Amount</th>
              </tr>
            </thead>
            {ungrouped.length > 0 && <tbody><ItemRows items={ungrouped} cur={cur} /></tbody>}
            {data.sections.map(s => {
              const rows = billable.filter(i => i.sectionId === s.id);
              if (!rows.length) return null;
              return (
                <tbody key={s.id}>
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-2 py-2 border-y border-slate-200">
                      <span className="font-bold text-[13px]" style={{ color: accent }}>{s.title}</span>
                      {s.description && <span className="text-xs text-slate-500 ms-2">{s.description}</span>}
                    </td>
                  </tr>
                  <ItemRows items={rows} cur={cur} />
                </tbody>
              );
            })}
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatCurrency(data.subTotal, cur)} />
            {data.discountAmount > 0 && (
              <Row label={`Discount (${data.discountPercent}%)`}
                   value={`−${formatCurrency(data.discountAmount, cur)}`} negative />
            )}
            <Row label="Tax" value={formatCurrency(data.taxAmount, cur)} />
            <div className="flex justify-between pt-2.5 mt-1.5 border-t-2 text-lg font-bold"
                 style={{ borderColor: accent, color: accent }}>
              <span>Total</span><span>{formatCurrency(data.total, cur)}</span>
            </div>
          </div>
        </div>

        {/* Optional extras */}
        {optional.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Optional extras</p>
            <p className="text-xs text-slate-500 mb-2">
              Quoted for your consideration — not included in the total above.
            </p>
            <table className="w-full text-sm">
              <tbody><ItemRows items={optional} cur={cur} /></tbody>
            </table>
            <p className="text-end text-sm font-semibold text-violet-800 mt-2">
              + {formatCurrency(data.optionalTotal, cur)} if all selected
            </p>
          </div>
        )}

        {(data.paymentTerms || data.termsAndConditions) && (
          <div className="pt-5 border-t border-slate-200 space-y-4">
            {data.paymentTerms && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment terms</p>
                <p className="text-[13px] text-slate-700 whitespace-pre-line leading-relaxed">{data.paymentTerms}</p>
              </div>
            )}
            {data.termsAndConditions && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Terms &amp; conditions</p>
                <p className="text-[13px] text-slate-700 whitespace-pre-line leading-relaxed">{data.termsAndConditions}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 sm:px-10 py-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
        {data.canRespond && !decision && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Ready to proceed?</p>
            <div className="flex gap-2">
              <button onClick={() => printQuotation(data)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Download className="h-4 w-4" />Download PDF
              </button>
              <button onClick={() => setDecision("decline")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-300 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50">
                <X className="h-4 w-4" />Decline
              </button>
              <button onClick={() => setDecision("accept")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
                      style={{ background: accent }}>
                <Check className="h-4 w-4" />Accept quotation
              </button>
            </div>
          </div>
        )}

        {decision && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              {decision === "accept" ? "Accept this quotation" : "Decline this quotation"}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <input
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder={decision === "accept" ? "Anything to add? (optional)" : "Reason (optional)"}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <p className="text-xs text-slate-500">
              {decision === "accept"
                ? "This confirms your acceptance to the sender. It cannot be undone here."
                : "The sender will be notified. This cannot be undone here."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDecision(null)} disabled={saving}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100">
                Back
              </button>
              <button onClick={submit} disabled={saving}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60",
                        decision === "accept" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700",
                      )}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {decision === "accept" ? "Confirm acceptance" : "Confirm decline"}
              </button>
            </div>
          </motion.div>
        )}

        {!data.canRespond && !decision && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {answered ? "You have already responded to this quotation." : "This quotation is no longer open for a response."}
            </p>
            <button onClick={() => printQuotation(data)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100">
              <Download className="h-4 w-4" />Download PDF
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Presentational bits ───────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  // Forced light: this is a document for an outside reader, not an app screen, and it must look
  // the same as the PDF they download.
  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-3 sm:px-4" style={{ colorScheme: "light" }}>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200">
        {children}
      </div>
      <p className="max-w-3xl mx-auto text-center text-[11px] text-slate-400 mt-4">
        Secure quotation link — please do not forward.
      </p>
    </div>
  );
}

function ItemRows({ items, cur }: { items: PublicQuotationDto["items"]; cur: string }) {
  return (
    <>
      {items.map(i => (
        <tr key={i.id} className="border-b border-slate-100">
          <td className="px-2 py-2.5 align-top">
            <p className="font-medium text-slate-800">{i.description}</p>
            {i.notes && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{i.notes}</p>}
          </td>
          <td className="px-2 py-2.5 text-end align-top text-slate-700 tabular-nums">
            {i.quantity}{i.unit && <span className="text-slate-400 text-xs ms-1">{i.unit}</span>}
          </td>
          <td className="px-2 py-2.5 text-end align-top text-slate-700 tabular-nums">{formatCurrency(i.unitPrice, cur)}</td>
          <td className="px-2 py-2.5 text-end align-top text-slate-500 tabular-nums">
            {i.discountPercent > 0 ? `${i.discountPercent}%` : "—"}
          </td>
          <td className="px-2 py-2.5 text-end align-top font-semibold text-slate-900 tabular-nums">
            {formatCurrency(i.lineTotal, cur)}
          </td>
        </tr>
      ))}
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-[13px] border-b border-dotted border-slate-200 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-end">{value}</span>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn("tabular-nums", negative ? "text-rose-600" : "text-slate-800")}>{value}</span>
    </div>
  );
}

function StatusPill({ status, isExpired }: { status: string; isExpired: boolean }) {
  const meta = isExpired && status !== "approved" && status !== "rejected"
    ? { label: "Expired",  cls: "bg-amber-100 text-amber-800" }
    : status === "approved" ? { label: "Accepted", cls: "bg-emerald-100 text-emerald-800" }
    : status === "rejected" ? { label: "Declined", cls: "bg-rose-100 text-rose-800" }
    : { label: "Awaiting your response", cls: "bg-slate-100 text-slate-600" };

  return (
    <span className={cn("inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", meta.cls)}>
      {meta.label}
    </span>
  );
}
