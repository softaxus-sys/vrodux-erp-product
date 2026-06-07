/**
 * Converts POS receipt data to ESC/POS byte stream for thermal printing.
 * Produces a formatted 80mm (48-column) receipt with header, items, totals,
 * payment info, and auto-cut.
 */

import { EscPos } from "./escpos";
import type { ReceiptLineItem } from "@/modules/pos/retail/components/pos-receipt";

export interface EscPosReceiptParams {
  companyName:    string;
  addressLine?:   string;
  regNumber?:     string;
  txnNumber:      string;
  cashierName?:   string;
  currency:       string;
  taxLabel:       string;   // "GST" | "VAT"
  cart:           ReceiptLineItem[];
  subtotal:       number;
  discountAmount: number;
  taxAmount:      number;
  total:          number;
  paymentMethod:  string;
  payments?:      { method: string; amount: number }[]; // split-tender breakdown
  tendered:       number;
}

function fmt(n: number): string {
  return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function money(n: number, currency: string): string {
  return `${currency} ${fmt(n)}`;
}

function nowStr(): string {
  return new Date().toLocaleString("en", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildEscPosReceipt(p: EscPosReceiptParams): Uint8Array {
  const COLS = 48;
  const esc  = new EscPos(COLS);
  const m    = (n: number) => money(n, p.currency);

  // ── Header ────────────────────────────────────────────────────────────────────
  esc
    .init()
    .center()
    .bigOn().boldOn().println(p.companyName.toUpperCase()).bigOff().boldOff();

  if (p.addressLine) esc.println(p.addressLine);
  if (p.regNumber)   esc.println(p.regNumber);

  esc
    .println()
    .boldOn().println("TAX INVOICE").boldOff()
    .println(`Ref: ${p.txnNumber}`)
    .println(nowStr());

  if (p.cashierName) esc.println(`Cashier: ${p.cashierName}`);

  esc.left().rule();

  // ── Items ─────────────────────────────────────────────────────────────────────
  // Header row
  const itemCols = COLS - 8 - 10; // 30 chars for name
  esc.boldOn().text("Item".padEnd(itemCols)).text("Qty".padStart(6)).text("Total".padStart(10) + "\n").boldOff();
  esc.rule("-");

  for (const item of p.cart) {
    const name   = item.name.substring(0, itemCols).padEnd(itemCols);
    const qty    = String(item.quantity).padStart(6);
    const amount = fmt(item.total).padStart(10);
    esc.text(name + qty + amount + "\n");

    // Unit price on second line
    const unitPriceLine = `  @ ${m(item.price)} ea`.padEnd(COLS);
    esc.println(unitPriceLine.substring(0, COLS));
  }

  esc.rule();

  // ── Totals ────────────────────────────────────────────────────────────────────
  const taxBase = p.subtotal - p.discountAmount;

  esc.row("Subtotal:", m(taxBase));

  if (p.discountAmount > 0) {
    esc.row("Discount:", `-${m(p.discountAmount)}`);
  }

  esc.row(`${p.taxLabel}:`, m(p.taxAmount));

  esc.rule("-");
  esc
    .bigOn().boldOn()
    .center().println(`TOTAL: ${m(p.total)}`)
    .bigOff().boldOff()
    .left()
    .rule();

  // ── Payment ───────────────────────────────────────────────────────────────────
  esc.println(`Payment: ${p.paymentMethod}`);

  // Split-tender breakdown
  if (p.payments && p.payments.length > 1) {
    for (const pay of p.payments) {
      esc.row(`  ${pay.method}:`, money(pay.amount, p.currency));
    }
  }

  if (p.paymentMethod.toLowerCase() === "cash" && p.tendered > 0) {
    const change = Math.max(0, p.tendered - p.total);
    esc
      .row("Tendered:", m(p.tendered))
      .boldOn().row("Change:", m(change)).boldOff();
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  esc
    .rule()
    .center()
    .println("Thank you for your purchase!")
    .println("Please retain this receipt.")
    .feed(4)
    .cut();

  return esc.build();
}
