import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { getTenantCurrency } from "@/hooks/use-currency";
import type {
  QuotationDto, PublicQuotationDto, QuotationBrandingDto, QuotationItemDto,
} from "@/lib/sales/quotations.api";

/**
 * Renders a branded, print-ready quotation and opens the browser's print dialog — which doubles
 * as "Save as PDF". Same zero-dependency approach as the invoice printer (`invoice-print.ts`):
 * the browser already has a competent PDF engine, so shipping one would be dead weight.
 *
 * Takes either the internal DTO or the public one, since the customer's own page offers the same
 * download and must render the identical document.
 */
type Printable = QuotationDto | PublicQuotationDto;

export function printQuotation(q: Printable, branding?: QuotationBrandingDto | null) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast.error("Pop-up blocked — allow pop-ups to download the quotation.");
    return;
  }
  win.document.write(buildHtml(q, branding));
  win.document.close();
  // Give the document a beat to lay out before the dialog steals focus, or the first page
  // occasionally prints half-styled.
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Preserves author line breaks without letting raw HTML through. */
function multiline(s: string | null | undefined): string {
  return esc(s).replace(/\n/g, "<br/>");
}

export function buildHtml(q: Printable, branding?: QuotationBrandingDto | null): string {
  const cur    = q.currencyCode || getTenantCurrency();
  const money  = (n: number) => esc(formatCurrency(n, cur));
  const brand  = branding ?? ("branding" in q ? q.branding : undefined);
  const accent = brand?.accentColor?.trim() || "#0f172a";

  const billable = q.items.filter(i => !i.isOptional);
  const optional = q.items.filter(i => i.isOptional);

  const itemRows = (items: QuotationItemDto[]) => items.map(i => `
    <tr>
      <td>
        <div class="desc">${esc(i.description)}</div>
        ${i.notes ? `<div class="note">${multiline(i.notes)}</div>` : ""}
      </td>
      <td class="num">${esc(String(i.quantity))}${i.unit ? ` <span class="unit">${esc(i.unit)}</span>` : ""}</td>
      <td class="num">${money(i.unitPrice)}</td>
      <td class="num">${i.discountPercent > 0 ? `${esc(String(i.discountPercent))}%` : "—"}</td>
      <td class="num strong">${money(i.lineTotal)}</td>
    </tr>`).join("");

  // Ungrouped lines first, then each section under its own heading — the same order the
  // document builder shows and the server returns.
  const ungrouped = billable.filter(i => !i.sectionId);
  const body = [
    ungrouped.length ? `<tbody>${itemRows(ungrouped)}</tbody>` : "",
    ...q.sections.map(s => {
      const rows = billable.filter(i => i.sectionId === s.id);
      if (!rows.length) return "";
      return `<tbody>
        <tr class="section"><td colspan="5">
          <span class="section-title">${esc(s.title)}</span>
          ${s.description ? `<span class="section-desc">${esc(s.description)}</span>` : ""}
        </td></tr>
        ${itemRows(rows)}
      </tbody>`;
    }),
  ].join("");

  const customRows = Object.entries(q.customFields ?? {})
    .map(([k, v]) => `<div class="meta-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`)
    .join("");

  const statusLabel = q.status === "approved" ? "Accepted"
    : q.status === "rejected" ? "Declined"
    : q.status.charAt(0).toUpperCase() + q.status.slice(1);

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>${esc(q.quotationNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1a1a1a; margin: 0; padding: 36px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; padding-bottom: 20px; border-bottom: 3px solid ${esc(accent)}; }
  .logo { max-height: 56px; max-width: 200px; object-fit: contain; margin-bottom: 8px; }
  .company { font-size: 17px; font-weight: 700; color: ${esc(accent)}; }
  .muted { color: #64748b; font-size: 11.5px; line-height: 1.55; }
  .doc-type { text-align: right; }
  .doc-type h1 { margin: 0; font-size: 26px; letter-spacing: .04em; text-transform: uppercase; color: ${esc(accent)}; }
  .badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .grid { display: flex; gap: 40px; margin: 22px 0 18px; }
  .grid > div { flex: 1; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; font-weight: 700; margin-bottom: 5px; }
  .meta-row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; font-size: 12px; border-bottom: 1px dotted #e2e8f0; }
  .meta-row span { color: #64748b; }
  .cover { margin: 18px 0; padding: 14px 16px; background: #f8fafc; border-left: 3px solid ${esc(accent)}; border-radius: 4px; line-height: 1.65; }
  h2.title { font-size: 16px; margin: 18px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
  thead th.num, td.num { text-align: right; }
  td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .desc { font-weight: 500; }
  .note { color: #64748b; font-size: 11px; margin-top: 2px; }
  .unit { color: #94a3b8; font-size: 11px; }
  .strong { font-weight: 700; }
  tr.section td { background: #f8fafc; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  .section-title { font-weight: 700; font-size: 12.5px; color: ${esc(accent)}; }
  .section-desc { color: #64748b; font-size: 11px; margin-left: 8px; }
  .totals { margin-top: 16px; margin-left: auto; width: 300px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12.5px; }
  .totals .row.grand { border-top: 2px solid ${esc(accent)}; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 700; color: ${esc(accent)}; }
  .optional { margin-top: 24px; }
  .optional h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #7c3aed; margin: 0 0 2px; }
  .optional .hint { color: #64748b; font-size: 11px; margin: 0 0 6px; }
  .terms { margin-top: 26px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .terms h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin: 0 0 6px; }
  .terms p { margin: 0 0 12px; line-height: 1.65; color: #334155; font-size: 11.5px; white-space: pre-line; }
  .foot { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 10.5px; }
  @media print {
    body { padding: 18px; }
    tr, tbody { page-break-inside: avoid; }
    .terms { page-break-inside: avoid; }
  }
</style></head><body>

  <div class="head">
    <div>
      ${brand?.logoUrl ? `<img class="logo" src="${esc(brand.logoUrl)}" alt=""/>` : ""}
      <div class="company">${esc(brand?.companyName ?? "")}</div>
      <div class="muted">
        ${brand?.legalName ? `${esc(brand.legalName)}<br/>` : ""}
        ${brand?.address ? `${multiline(brand.address)}<br/>` : ""}
        ${brand?.phone ? `${esc(brand.phone)} · ` : ""}${brand?.email ? esc(brand.email) : ""}
        ${brand?.website ? `<br/>${esc(brand.website)}` : ""}
        ${brand?.taxNumber ? `<br/>TRN: ${esc(brand.taxNumber)}` : ""}
      </div>
    </div>
    <div class="doc-type">
      <h1>Quotation</h1>
      <div class="muted" style="margin-top:4px">${esc(q.quotationNumber)}</div>
      <div class="badge">${esc(statusLabel)}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Prepared for</div>
      <div style="font-weight:600;font-size:14px">${esc(q.customerName ?? "—")}</div>
      <div class="muted">
        ${"customerAddress" in q && q.customerAddress ? `${multiline(q.customerAddress)}<br/>` : ""}
        ${"customerEmail" in q && q.customerEmail ? `${esc(q.customerEmail)}<br/>` : ""}
        ${"customerPhone" in q && q.customerPhone ? esc(q.customerPhone) : ""}
      </div>
    </div>
    <div>
      <div class="label">Details</div>
      <div class="meta-row"><span>Issue date</span><strong>${esc(q.issueDate ?? "—")}</strong></div>
      <div class="meta-row"><span>Valid until</span><strong>${esc(q.validUntil ?? "—")}</strong></div>
      ${q.reference ? `<div class="meta-row"><span>Your reference</span><strong>${esc(q.reference)}</strong></div>` : ""}
      ${q.preparedByName ? `<div class="meta-row"><span>Prepared by</span><strong>${esc(q.preparedByName)}</strong></div>` : ""}
      ${customRows}
    </div>
  </div>

  ${q.title ? `<h2 class="title">${esc(q.title)}</h2>` : ""}
  ${q.coverNote ? `<div class="cover">${multiline(q.coverNote)}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit price</th>
        <th class="num">Disc.</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    ${body}
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(q.subTotal)}</span></div>
    ${q.discountAmount > 0
      ? `<div class="row"><span>Discount (${esc(String(q.discountPercent))}%)</span><span>−${money(q.discountAmount)}</span></div>` : ""}
    <div class="row"><span>Tax</span><span>${money(q.taxAmount)}</span></div>
    <div class="row grand"><span>Total</span><span>${money(q.total)}</span></div>
  </div>

  ${optional.length ? `
    <div class="optional">
      <h3>Optional extras</h3>
      <p class="hint">Quoted for your consideration — not included in the total above.</p>
      <table>
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Disc.</th><th class="num">Amount</th></tr></thead>
        <tbody>${itemRows(optional)}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>If all selected</span><span class="strong">+ ${money(q.optionalTotal)}</span></div>
      </div>
    </div>` : ""}

  ${(q.paymentTerms || q.termsAndConditions) ? `
    <div class="terms">
      ${q.paymentTerms ? `<h3>Payment terms</h3><p>${multiline(q.paymentTerms)}</p>` : ""}
      ${q.termsAndConditions ? `<h3>Terms &amp; conditions</h3><p>${multiline(q.termsAndConditions)}</p>` : ""}
    </div>` : ""}

  <div class="foot">
    <span>${esc(q.quotationNumber)}${q.title ? ` · ${esc(q.title)}` : ""}</span>
    <span>${esc(brand?.companyName ?? "")}</span>
  </div>

</body></html>`;
}
