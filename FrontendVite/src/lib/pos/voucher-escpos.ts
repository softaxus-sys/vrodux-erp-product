import { parseApiDate } from "@/lib/utils";
/**
 * Renders a discount voucher / coupon as an ESC/POS byte stream for thermal
 * printing on an 80mm receipt printer. Produces a decorative, gift-card-style
 * layout with a large value, a boxed code, a scannable CODE128 barcode, a QR
 * code, and the terms (min spend, validity, usage).
 */

import { EscPos } from "./escpos";
import type { VoucherDto } from "./types";

export interface EscPosVoucherParams {
  companyName: string;
  currency:    string;
  voucher:     VoucherDto;
}

function fmtMoney(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return parseApiDate(iso).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}

/** Centre a short string within the paper width using spaces. */
function centerPad(s: string, cols: number): string {
  if (s.length >= cols) return s.substring(0, cols);
  const left = Math.floor((cols - s.length) / 2);
  return " ".repeat(left) + s;
}

export function buildEscPosVoucher(p: EscPosVoucherParams): Uint8Array {
  const COLS = 48;
  const esc  = new EscPos(COLS);
  const v    = p.voucher;
  const isPercent = v.valueType === 1;

  const valueText = isPercent
    ? `${v.value}% OFF`
    : `${fmtMoney(v.value, p.currency)} OFF`;

  esc.init();

  // ── Decorative top border ───────────────────────────────────────────────
  esc.center();
  esc.boldOn().println("*".repeat(COLS)).boldOff();
  esc.println();

  // ── Store name ──────────────────────────────────────────────────────────
  esc.boldOn().bigOn().println(p.companyName.toUpperCase()).bigOff().boldOff();
  esc.println();

  // ── Banner ──────────────────────────────────────────────────────────────
  esc.boldOn().println("=== DISCOUNT VOUCHER ===").boldOff();
  esc.println();

  // ── Big value ───────────────────────────────────────────────────────────
  esc.boldOn().setSize(2, 3).println(valueText).setSize(1, 1).boldOff();
  esc.println();

  // ── Boxed code ──────────────────────────────────────────────────────────
  const codeLine = `   ${v.code}   `;
  const boxWidth = Math.min(COLS, codeLine.length + 4);
  esc.println(centerPad("+" + "-".repeat(boxWidth - 2) + "+", COLS));
  esc.boldOn().bigOn().println(v.code).bigOff().boldOff();
  esc.println(centerPad("+" + "-".repeat(boxWidth - 2) + "+", COLS));
  esc.println();

  // ── Scannable barcode of the code ───────────────────────────────────────
  esc.barcode(v.code, 70, 3, "none");
  esc.println();

  if (v.description) {
    esc.println(v.description);
    esc.println();
  }

  // ── Terms ───────────────────────────────────────────────────────────────
  esc.left().rule("-");
  esc.boldOn().println("TERMS & CONDITIONS").boldOff();

  if (v.minSpend > 0)
    esc.println(`- Minimum spend: ${fmtMoney(v.minSpend, p.currency)}`);

  if (isPercent && v.maxDiscountAmount != null)
    esc.println(`- Max discount: ${fmtMoney(v.maxDiscountAmount, p.currency)}`);

  const from  = fmtDate(v.validFrom);
  const until = fmtDate(v.validUntil);
  if (from || until)
    esc.println(`- Valid: ${from ?? "now"} to ${until ?? "no expiry"}`);
  else
    esc.println("- No expiry date");

  if (v.usageLimit != null)
    esc.println(`- Limited to ${v.usageLimit} redemption(s)`);

  esc.println("- One voucher per transaction");
  esc.println("- Cannot be exchanged for cash");
  esc.rule("-");

  // ── QR + footer ─────────────────────────────────────────────────────────
  esc.center();
  esc.println("Scan to redeem at checkout");
  esc.qr(v.code, 6, "M");
  esc.println();
  esc.println("Thank you!");
  esc.boldOn().println("*".repeat(COLS)).boldOff();

  esc.feed(4).cut();

  return esc.build();
}
