/**
 * PosReceipt — country-aware legal receipt modal.
 *
 * Pakistan (FBR): Tier-1 POS Tax Invoice per SRO 1257(I)/2019 & Sales Tax Act 1990.
 * UAE     (FTA): Simplified Tax Invoice per Federal Decree-Law No. 8 of 2017.
 *
 * Add a new country: extend `RECEIPT_CONFIGS` and add a renderer below.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, RotateCcw, X, CheckCircle2, QrCode, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useHardware }  from "@/contexts/hardware-context";
import { buildEscPosReceipt } from "@/lib/pos/receipt-escpos";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptLineItem {
  productId: string;
  name:      string;
  quantity:  number;
  price:     number;       // unit price (incl. tax for PKR display; excl. VAT for UAE display)
  taxRate:   number;       // % e.g. 17 or 5
  total:     number;       // quantity × price (pre-tax)
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

export interface PosReceiptProps {
  cart:           ReceiptLineItem[];
  subtotal:       number;          // sum of totals before tax
  discountAmount: number;
  discountLabel?: string;          // e.g. "10%", "Voucher SAVE10", "120 points"
  taxAmount:      number;          // total tax collected
  total:          number;          // grand total
  paymentMethod:  string;
  payments?:      ReceiptPayment[]; // split-tender breakdown (when >1 method)
  tendered:       number;          // cash handed over (0 if card)
  txnNumber:      string;          // e.g. "TXN-000123"
  sessionId?:     string;
  cashierName?:   string;
  onNewSale:      () => void;
  onClose?:       () => void;
}

// ─── Country receipt configs ──────────────────────────────────────────────────

interface ReceiptConfig {
  currency:        string;
  taxLabel:        string;          // "GST" | "VAT"
  taxRate:         number;
  regNumber:       string;          // NTN/STRN or TRN
  regLabel:        string;          // label for reg number
  invoiceTitle:    (total: number) => string;
  locale:          string;
  legalFooter:     string[];
  poweredBy:       string;
  dateLocale:      string;
}

// Per-country defaults (overridden at runtime from tenant settings when available)
const RECEIPT_CONFIGS: Record<string, ReceiptConfig> = {
  pk: {
    currency:     "PKR",
    taxLabel:     "GST",
    taxRate:      17,
    regNumber:    "NTN: 0000000-0 | STRN: 0000000000000",
    regLabel:     "NTN / STRN",
    invoiceTitle: () => "TAX INVOICE",
    locale:       "en-PK",
    legalFooter:  [
      "Valid Tax Invoice under Sales Tax Act 1990.",
      "GST collected at 17% as per applicable law.",
      "Retain this receipt for your records.",
      "Complaints: complaints@fbr.gov.pk | 051-111-772-772",
    ],
    poweredBy:    "FBR Tier-1 POS Integrated System",
    dateLocale:   "en-PK",
  },
  ae: {
    currency:     "AED",
    taxLabel:     "VAT",
    taxRate:      5,
    regNumber:    "TRN: 100-000000-0-00003",
    regLabel:     "TRN",
    invoiceTitle: (total) => total >= 10000 ? "TAX INVOICE" : "SIMPLIFIED TAX INVOICE",
    locale:       "en-AE",
    legalFooter:  [
      "Tax Invoice issued per Federal Decree-Law No.8 of 2017.",
      "VAT collected at 5% on taxable supplies.",
      "Authorised by Federal Tax Authority (FTA).",
      "For queries: eservices.tax.gov.ae",
    ],
    poweredBy:    "FTA VAT Compliant POS System",
    dateLocale:   "en-AE",
  },
};

const CURRENCY_TO_COUNTRY_RECEIPT: Record<string, string> = {
  AED: "ae", PKR: "pk", SAR: "sa", OMR: "om",
  INR: "in", GBP: "gb", USD: "us", QAR: "qa",
};

/**
 * Resolve country code from tenant.country string (primary) with
 * tenant.currency as fallback — handles legacy string values and the
 * case where country was never explicitly saved.
 */
function getCountryCode(country?: string | null, currency?: string | null): string {
  const c = (country ?? "").toLowerCase().trim();
  if (c === "ae" || c.includes("uae") || c.includes("emirates") || c.includes("dubai")) return "ae";
  if (c === "pk" || c.includes("pakistan"))                                               return "pk";
  if (c === "sa" || c.includes("saudi"))                                                  return "sa";
  if (c === "om" || c.includes("oman"))                                                   return "om";
  if (c === "in" || c.includes("india"))                                                  return "in";
  if (c === "gb" || c.includes("kingdom"))                                                return "gb";
  if (c === "us" || c.includes("united states"))                                          return "us";
  // Fallback to currency
  if (currency) {
    const fromCurrency = CURRENCY_TO_COUNTRY_RECEIPT[currency.toUpperCase()];
    if (fromCurrency) return fromCurrency;
  }
  return "pk";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ISO 4217 default decimal precision for a currency (e.g. BHD/KWD/OMR = 3, JPY = 0, most = 2). */
function getCurrencyDecimals(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "AED" }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function fmtMoney(n: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  return `${currency} ${n.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`.trim();
}

function fmtDate(locale: string): string {
  return new Date().toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Dashed divider line
function Divider({ dashed = true }: { dashed?: boolean }) {
  return (
    <div className={cn("border-t my-2", dashed ? "border-dashed border-gray-300 dark:border-gray-600" : "border-gray-400 dark:border-gray-500")} />
  );
}

function Row({ label, value, bold, green, small }: {
  label: string; value: string;
  bold?: boolean; green?: boolean; small?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-2", small ? "text-[10px]" : "text-[11px]")}>
      <span className={cn(bold ? "font-bold" : "text-gray-500 dark:text-gray-400")}>{label}</span>
      <span className={cn(bold ? "font-extrabold" : "", green ? "text-green-600 dark:text-green-400" : "text-gray-800 dark:text-gray-200")}>{value}</span>
    </div>
  );
}

// ─── Pakistan Receipt ──────────────────────────────────────────────────────────

function PakistanReceipt({
  cart, subtotal, discountAmount, discountLabel, taxAmount, total,
  paymentMethod, payments, tendered, txnNumber, cashierName,
  cfg, companyName,
}: PosReceiptProps & { cfg: ReceiptConfig; companyName: string }) {
  const change = Math.max(0, tendered - total);
  // Per-item GST (each line item is taxed individually)
  const taxableBase = subtotal - discountAmount;

  return (
    <div className="font-mono text-[11px] text-gray-800 dark:text-gray-200 space-y-0">

      {/* ── Store header ── */}
      <div className="text-center space-y-0.5 pb-2">
        <p className="text-sm font-black uppercase tracking-widest">{companyName}</p>
        <p className="text-[10px] text-gray-500">Retail Store · Pakistan</p>
        <p className="text-[10px] text-gray-500">{cfg.regNumber}</p>
      </div>
      <Divider />

      {/* ── Invoice header ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold tracking-wider">{cfg.invoiceTitle(total)}</p>
        <p className="text-[10px] text-gray-500">{txnNumber || "—"}</p>
      </div>
      <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
        <p>Date: {fmtDate(cfg.dateLocale)}</p>
        {cashierName && <p>Cashier: {cashierName}</p>}
        <p>Payment: {paymentMethod}</p>
      </div>
      <Divider />

      {/* ── Item list ── */}
      {/* Header */}
      <div className="flex text-[9px] font-bold text-gray-500 uppercase">
        <span className="flex-1">Description</span>
        <span className="w-7 text-center">Qty</span>
        <span className="w-14 text-right">Price</span>
        <span className="w-16 text-right">Amount</span>
      </div>
      <div className="border-t border-gray-300 dark:border-gray-600 mt-0.5 mb-1" />

      {cart.map((item) => {
        const itemTax   = item.total * (item.taxRate / 100);
        const itemTotal = item.total; // excl tax (matches subtotal)
        return (
          <div key={item.productId} className="mb-1.5">
            <div className="flex items-start">
              <span className="flex-1 leading-tight">{item.name}</span>
              <span className="w-7 text-center shrink-0">{item.quantity}</span>
              <span className="w-14 text-right shrink-0">
                {item.price.toLocaleString("en", { minimumFractionDigits: getCurrencyDecimals(cfg.currency), maximumFractionDigits: getCurrencyDecimals(cfg.currency) })}
              </span>
              <span className="w-16 text-right shrink-0">
                {item.total.toLocaleString("en", { minimumFractionDigits: getCurrencyDecimals(cfg.currency), maximumFractionDigits: getCurrencyDecimals(cfg.currency) })}
              </span>
            </div>
            {item.taxRate > 0 && (
              <p className="text-[9px] text-gray-400 pl-1">
                GST @{item.taxRate}%: {fmtMoney(itemTax, "")}
              </p>
            )}
          </div>
        );
      })}

      <Divider />

      {/* ── Totals ── */}
      <div className="space-y-1">
        <Row label="Subtotal (excl. GST)" value={fmtMoney(taxableBase, cfg.currency)} />
        {discountAmount > 0 && (
          <Row label={discountLabel ? `Discount (${discountLabel})` : "Discount"} value={`– ${fmtMoney(discountAmount, cfg.currency)}`} green />
        )}
        <Row label={`GST @${cfg.taxRate}%`} value={fmtMoney(taxAmount, cfg.currency)} />
        <Divider dashed={false} />
        <Row label={`TOTAL DUE (${cfg.currency})`} value={fmtMoney(total, cfg.currency)} bold />
      </div>

      {/* ── Split payment breakdown ── */}
      {payments && payments.length > 1 && (
        <>
          <Divider />
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Payments</p>
          {payments.map((p, i) => (
            <Row key={i} label={p.method} value={fmtMoney(p.amount, cfg.currency)} />
          ))}
        </>
      )}

      {/* ── Cash change ── */}
      {paymentMethod === "Cash" && tendered > 0 && (
        <>
          <Divider />
          <Row label="CASH TENDERED" value={fmtMoney(tendered, cfg.currency)} />
          <Row label="CHANGE DUE" value={fmtMoney(change, cfg.currency)} bold green />
        </>
      )}

      <Divider />

      {/* ── FBR section ── */}
      <div className="text-center space-y-1">
        {/* Simulated QR / FBR verification area */}
        <div className="inline-flex flex-col items-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mx-auto">
          <QrCode className="h-10 w-10 text-gray-400" />
          <p className="text-[9px] text-gray-400">Scan to verify on FBR PRAL</p>
          <p className="text-[9px] font-mono text-gray-500 break-all max-w-[180px]">
            fbr.gov.pk/verify/{txnNumber}
          </p>
        </div>
      </div>

      <Divider />

      {/* ── Legal footer ── */}
      <div className="text-center space-y-0.5">
        {cfg.legalFooter.map((line, i) => (
          <p key={i} className="text-[9px] text-gray-400 leading-tight">{line}</p>
        ))}
        <p className="text-[9px] text-gray-400 mt-1 font-semibold">{cfg.poweredBy}</p>
      </div>

      <Divider />

      {/* ── Software promotion ── */}
      <div className="text-center space-y-0.5">
        <p className="text-[9px] text-gray-400 font-semibold">Powered by VroduxERP</p>
        <p className="text-[9px] text-gray-400">www.vrodux.com</p>
        <p className="text-[9px] text-gray-400">WhatsApp: +971 56 938 3079 / +92 314 9511674</p>
      </div>
    </div>
  );
}

// ─── UAE Receipt ──────────────────────────────────────────────────────────────

function UAEReceipt({
  cart, subtotal, discountAmount, discountLabel, taxAmount, total,
  paymentMethod, payments, tendered, txnNumber, cashierName,
  cfg, companyName,
}: PosReceiptProps & { cfg: ReceiptConfig; companyName: string }) {
  const change     = Math.max(0, tendered - total);
  const exclVAT    = total - taxAmount;
  const isFullTaxInvoice = total >= 10000; // AED

  return (
    <div className="font-mono text-[11px] text-gray-800 dark:text-gray-200 space-y-0">

      {/* ── Store header ── */}
      <div className="text-center space-y-0.5 pb-2">
        <p className="text-sm font-black uppercase tracking-widest">{companyName}</p>
        <p className="text-[10px] text-gray-500">Dubai · United Arab Emirates</p>
        <p className="text-[10px] font-bold">{cfg.regNumber}</p>
        {isFullTaxInvoice && (
          <p className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded px-2 py-0.5 inline-block">
            TAX INVOICE (Mandatory — Amount ≥ AED 10,000)
          </p>
        )}
      </div>
      <Divider />

      {/* ── Invoice header ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold tracking-wider">{cfg.invoiceTitle(total)}</p>
        <p className="text-[10px] text-gray-500">{txnNumber || "—"}</p>
      </div>
      <div className="mt-1 space-y-0.5 text-[10px] text-gray-500">
        <p>Supply Date: {fmtDate(cfg.dateLocale)}</p>
        {cashierName && <p>Served by: {cashierName}</p>}
        <p>Payment: {paymentMethod}</p>
      </div>
      <Divider />

      {/* ── Item list — UAE shows price EXCL VAT then VAT per line ── */}
      <div className="flex text-[9px] font-bold text-gray-500 uppercase">
        <span className="flex-1">Description</span>
        <span className="w-7 text-center">Qty</span>
        <span className="w-16 text-right">Excl VAT</span>
        <span className="w-14 text-right">VAT 5%</span>
      </div>
      <div className="border-t border-gray-300 dark:border-gray-600 mt-0.5 mb-1" />

      {cart.map((item) => {
        // Price stored as pre-tax; display excl VAT + VAT separately (UAE style)
        const lineExclVAT = item.total;
        const lineVAT     = item.total * (item.taxRate / 100);
        return (
          <div key={item.productId} className="flex items-start mb-1.5">
            <span className="flex-1 leading-tight">{item.name}</span>
            <span className="w-7 text-center shrink-0">{item.quantity}</span>
            <span className="w-16 text-right shrink-0">
              {lineExclVAT.toLocaleString("en", { minimumFractionDigits: getCurrencyDecimals(cfg.currency), maximumFractionDigits: getCurrencyDecimals(cfg.currency) })}
            </span>
            <span className="w-14 text-right shrink-0 text-gray-500">
              {lineVAT.toLocaleString("en", { minimumFractionDigits: getCurrencyDecimals(cfg.currency), maximumFractionDigits: getCurrencyDecimals(cfg.currency) })}
            </span>
          </div>
        );
      })}

      <Divider />

      {/* ── Totals — UAE mandatory split ── */}
      <div className="space-y-1">
        <Row label={`Taxable Amount (excl. VAT)`}    value={fmtMoney(exclVAT, cfg.currency)} />
        {discountAmount > 0 && (
          <Row label={discountLabel ? `Discount (${discountLabel})` : "Discount Applied"} value={`– ${fmtMoney(discountAmount, cfg.currency)}`} green />
        )}
        <Row label={`VAT @${cfg.taxRate}% (Output Tax)`} value={fmtMoney(taxAmount, cfg.currency)} />
        <Divider dashed={false} />
        <Row label={`TOTAL DUE (${cfg.currency})`} value={fmtMoney(total, cfg.currency)} bold />
      </div>

      {/* ── Split payment breakdown ── */}
      {payments && payments.length > 1 && (
        <>
          <Divider />
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Payments</p>
          {payments.map((p, i) => (
            <Row key={i} label={p.method} value={fmtMoney(p.amount, cfg.currency)} />
          ))}
        </>
      )}

      {/* ── Cash change ── */}
      {paymentMethod === "Cash" && tendered > 0 && (
        <>
          <Divider />
          <Row label="CASH TENDERED" value={fmtMoney(tendered, cfg.currency)} />
          <Row label="CHANGE DUE"    value={fmtMoney(change, cfg.currency)} bold green />
        </>
      )}

      <Divider />

      {/* ── FTA verification ── */}
      <div className="text-center space-y-1">
        <div className="inline-flex flex-col items-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
          <QrCode className="h-10 w-10 text-gray-400" />
          <p className="text-[9px] text-gray-400">Scan to verify (FTA e-Services)</p>
          <p className="text-[9px] font-mono text-gray-500 break-all max-w-[180px]">
            tax.gov.ae/verify/{txnNumber}
          </p>
        </div>
      </div>

      <Divider />

      {/* ── VAT note for B2B ── */}
      {isFullTaxInvoice && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 mb-2">
          <p className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">B2B Tax Invoice Note:</p>
          <p className="text-[9px] text-blue-500 dark:text-blue-400">
            If your business is VAT registered, please provide your TRN for input tax credit recovery.
          </p>
        </div>
      )}

      {/* ── Legal footer ── */}
      <div className="text-center space-y-0.5">
        {cfg.legalFooter.map((line, i) => (
          <p key={i} className="text-[9px] text-gray-400 leading-tight">{line}</p>
        ))}
        <p className="text-[9px] text-gray-400 mt-1 font-semibold">{cfg.poweredBy}</p>
      </div>

      <Divider />

      {/* ── Software promotion ── */}
      <div className="text-center space-y-0.5">
        <p className="text-[9px] text-gray-400 font-semibold">Powered by VroduxERP</p>
        <p className="text-[9px] text-gray-400">www.vrodux.com</p>
        <p className="text-[9px] text-gray-400">WhatsApp: +971 56 938 3079 / +92 314 9511674</p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PosReceipt(props: PosReceiptProps) {
  const { tenant, user }               = useAuthStore();
  const { printerStatus, printRaw } = useHardware();
  const [thermalPrinting, setThermalPrinting] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const countryCode = getCountryCode(tenant?.country, tenant?.currency);
  const baseCfg     = RECEIPT_CONFIGS[countryCode] ?? RECEIPT_CONFIGS["pk"];
  // Always use tenant's actual currency — never let the static config override it
  const cfg: ReceiptConfig = {
    ...baseCfg,
    currency: tenant?.currency || baseCfg.currency,
  };
  const companyName = tenant?.branding?.companyName ?? "Vrodux Retail";
  const cashierName = props.cashierName ?? user?.name;

  const buildEscData = () => buildEscPosReceipt({
    companyName:    companyName,
    regNumber:      cfg.regNumber,
    txnNumber:      props.txnNumber,
    cashierName:    cashierName,
    currency:       cfg.currency,
    taxLabel:       cfg.taxLabel,
    cart:           props.cart,
    subtotal:       props.subtotal,
    discountAmount: props.discountAmount,
    taxAmount:      props.taxAmount,
    total:          props.total,
    paymentMethod:  props.paymentMethod,
    tendered:       props.tendered,
    openDrawer:     props.paymentMethod.toLowerCase() === "cash"
      || !!props.payments?.some(p => p.method.toLowerCase() === "cash"),
  });

  /** Send ESC/POS bytes to the network printer — no browser dialog. */
  const handleThermalPrint = async () => {
    if (printerStatus !== "ready") return;
    setThermalPrinting(true);
    try {
      await printRaw(buildEscData());
    } finally {
      setThermalPrinting(false);
    }
  };

  const receiptProps = { ...props, cashierName, cfg, companyName };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={props.onClose}
    >
      <motion.div
        className="w-full max-w-sm bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
        initial={{ scale: 0.88, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Success strip */}
        <div className={cn(
          "px-5 py-4 text-white text-center shrink-0",
          countryCode === "ae" ? "bg-blue-600" : "bg-emerald-600"
        )}>
          <motion.div
            className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12, type: "spring", stiffness: 400 }}>
            <CheckCircle2 className="h-6 w-6" />
          </motion.div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Payment Successful</p>
          <p className="text-2xl font-black mt-1">
            {cfg.currency} {props.total.toLocaleString("en", { minimumFractionDigits: getCurrencyDecimals(cfg.currency), maximumFractionDigits: getCurrencyDecimals(cfg.currency) })}
          </p>
          <p className="text-[11px] opacity-70 mt-0.5">{props.paymentMethod}</p>
          {/* Country badge */}
          <span className={cn(
            "inline-block mt-2 text-[9px] font-bold px-2.5 py-0.5 rounded-full",
            countryCode === "ae"
              ? "bg-white/20 text-white"
              : "bg-white/20 text-white"
          )}>
            {countryCode === "ae" ? "🇦🇪 FTA VAT Compliant" : "🇵🇰 FBR POS Compliant"}
          </span>
        </div>

        {/* Receipt body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 bg-white dark:bg-zinc-950" ref={printRef}>
          {countryCode === "ae"
            ? <UAEReceipt {...receiptProps} />
            : <PakistanReceipt {...receiptProps} />
          }
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-zinc-800 shrink-0 space-y-2 bg-white dark:bg-zinc-950">
          <div className="flex gap-2">
            {/* ── Print button — sends ESC/POS to network printer, no dialog ── */}
            {printerStatus === "ready" ? (
              <Button
                variant="outline"
                className="flex-1 gap-1.5 h-10 text-sm border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400"
                onClick={handleThermalPrint}
                disabled={thermalPrinting}
              >
                <Zap className="h-3.5 w-3.5" />
                {thermalPrinting ? "Printing…" : "Print Receipt"}
              </Button>
            ) : printerStatus === "checking" || thermalPrinting ? (
              <Button variant="outline" className="flex-1 gap-1.5 h-10 text-sm" disabled>
                <Printer className="h-3.5 w-3.5 animate-pulse" />Connecting…
              </Button>
            ) : (
              // Printer unreachable — show disabled button with hint
              <Button variant="outline" className="flex-1 gap-1.5 h-10 text-sm opacity-60 cursor-not-allowed" disabled
                title="Network printer is offline. Check printer IP in appsettings.json.">
                <Printer className="h-3.5 w-3.5" />Printer Offline
              </Button>
            )}
            <Button
              className={cn("flex-1 gap-1.5 h-10 text-sm font-bold",
                countryCode === "ae"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
              onClick={props.onNewSale}
            >
              <RotateCcw className="h-3.5 w-3.5" />New Sale
            </Button>
          </div>
          {props.onClose && (
            <button onClick={props.onClose}
              className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors">
              Close without printing
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
