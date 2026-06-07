import type { InvoiceDetailDto } from "@/lib/finance/finance.api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const CUR = "AED";

function esc(s: string): string {
  return s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}

/**
 * Opens a print-ready window with a professional A4 invoice. The browser's
 * print dialog doubles as "Save as PDF", so this powers both Print and PDF.
 */
export function printInvoice(inv: InvoiceDetailDto, company = "Your Company") {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) { toast.error("Pop-up blocked — allow pop-ups to print the invoice."); return; }

  const statusLabel = inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
  const rows = inv.items.map(i => `
    <tr>
      <td>${esc(i.description)}</td>
      <td class="num">${i.quantity}</td>
      <td class="num">${esc(formatCurrency(i.unitPrice, CUR))}</td>
      <td class="num">${esc(formatCurrency(i.lineTotal ?? i.quantity * i.unitPrice, CUR))}</td>
    </tr>`).join("");

  win.document.write(`<!doctype html><html><head><title>${esc(inv.invoiceNumber)}</title><style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
    .company { font-size: 22px; font-weight: 800; color: #2563eb; }
    .title { text-align: right; }
    .title h1 { margin: 0; font-size: 28px; letter-spacing: 1px; }
    .muted { color: #666; font-size: 12px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
             background: #eff6ff; color: #2563eb; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin: 24px 0; gap: 24px; }
    .meta h3 { font-size: 11px; text-transform: uppercase; color: #888; margin: 0 0 6px; letter-spacing: .5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #555; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    .num { text-align: right; }
    .totals { width: 280px; margin-left: auto; margin-top: 16px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals .grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 10px; font-size: 17px; font-weight: 800; }
    .notes { margin-top: 28px; font-size: 12px; color: #555; border-top: 1px solid #eee; padding-top: 12px; }
    .toolbar { text-align: center; margin-bottom: 20px; }
    @media print { .toolbar { display: none; } body { padding: 0; } @page { margin: 16mm; } }
  </style></head><body>
    <div class="toolbar">
      <button onclick="window.print()" style="padding:9px 22px;font-size:14px;cursor:pointer;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600">Print / Save as PDF</button>
    </div>
    <div class="head">
      <div><div class="company">${esc(company)}</div><div class="muted">Tax Invoice</div></div>
      <div class="title">
        <h1>INVOICE</h1>
        <div class="muted">${esc(inv.invoiceNumber)}</div>
        <span class="badge">${esc(statusLabel)}</span>
      </div>
    </div>
    <div class="meta">
      <div>
        <h3>Bill To</h3>
        <div style="font-weight:700">${esc(inv.customerName)}</div>
        ${inv.customerEmail ? `<div class="muted">${esc(inv.customerEmail)}</div>` : ""}
      </div>
      <div style="text-align:right">
        <h3>Details</h3>
        <div class="muted">Invoice Date: <strong>${esc(inv.invoiceDate)}</strong></div>
        <div class="muted">Due Date: <strong>${esc(inv.dueDate)}</strong></div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${esc(formatCurrency(inv.subTotal, CUR))}</span></div>
      <div class="row"><span>Tax (${inv.taxRate}%)</span><span>${esc(formatCurrency(inv.taxAmount, CUR))}</span></div>
      <div class="row grand"><span>Total</span><span>${esc(formatCurrency(inv.total, CUR))}</span></div>
    </div>
    ${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ""}
  </body></html>`);
  win.document.close();
}
