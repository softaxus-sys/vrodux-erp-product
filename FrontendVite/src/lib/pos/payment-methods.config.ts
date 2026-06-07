/**
 * payment-methods.config.ts
 *
 * Master registry of all known payment methods.
 * Each method belongs to one or more country codes; "*" = universal.
 *
 * IDs stored in app-settings (category "pos", key "paymentMethods").
 * Only IDs are persisted — runtime shapes are resolved here.
 *
 * Add a new country/method: append to PAYMENT_METHOD_REGISTRY and
 * optionally add a seed entry to COUNTRY_PAYMENT_SEEDS.
 */

import {
  Banknote,
  CreditCard,
  Smartphone,
  Landmark,
  FileText,
  Tag,
  Wallet,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentMethodDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind text-color class for the icon / label */
  color: string;
  /** Tailwind bg + border classes used for the active/selected state */
  bg: string;
  /** Country codes this method applies to; ["*"] = every country */
  countries: string[];
  description?: string;
}

export interface CustomPaymentMethod {
  id: string;
  label: string;
}

export interface PaymentMethodsConfig {
  /** Ordered list of enabled method IDs (registry + custom) */
  enabled: string[];
  /** User-defined custom methods not in the registry */
  custom: CustomPaymentMethod[];
}

// ─── Master Registry ──────────────────────────────────────────────────────────

export const PAYMENT_METHOD_REGISTRY: PaymentMethodDef[] = [

  // ── Universal ──────────────────────────────────────────────────────────────
  {
    id: "Cash",
    label: "Cash",
    icon: Banknote,
    color: "text-success",
    bg: "bg-success/10 border-success/30",
    countries: ["*"],
    description: "Physical cash payment",
  },
  {
    id: "Card",
    label: "Card",
    icon: CreditCard,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    countries: ["*"],
    description: "Visa / Mastercard / Amex / Debit",
  },
  {
    id: "BankTransfer",
    label: "Bank Transfer",
    icon: Landmark,
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
    countries: ["*"],
    description: "Wire / SWIFT / IBAN / SEPA",
  },
  {
    id: "Cheque",
    label: "Cheque",
    icon: FileText,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
    countries: ["ae", "gb", "us", "pk", "sa"],
    description: "Post-dated or bearer cheque",
  },

  // ── Pakistan (PK) ──────────────────────────────────────────────────────────
  {
    id: "EasyPaisa",
    label: "EasyPaisa",
    icon: Smartphone,
    color: "text-purple-500",
    bg: "bg-purple-500/10 border-purple-500/30",
    countries: ["pk"],
    description: "Telenor mobile wallet",
  },
  {
    id: "JazzCash",
    label: "JazzCash",
    icon: Smartphone,
    color: "text-rose-500",
    bg: "bg-rose-500/10 border-rose-500/30",
    countries: ["pk"],
    description: "Jazz mobile wallet",
  },
  {
    id: "SadaPay",
    label: "SadaPay",
    icon: Wallet,
    color: "text-sky-500",
    bg: "bg-sky-500/10 border-sky-500/30",
    countries: ["pk"],
    description: "SadaPay digital wallet",
  },
  {
    id: "NayaPay",
    label: "NayaPay",
    icon: Wallet,
    color: "text-violet-500",
    bg: "bg-violet-500/10 border-violet-500/30",
    countries: ["pk"],
    description: "NayaPay e-money wallet",
  },

  // ── UAE (AE) ───────────────────────────────────────────────────────────────
  {
    id: "ApplePay",
    label: "Apple Pay",
    icon: Smartphone,
    color: "text-foreground",
    bg: "bg-muted border-border",
    countries: ["ae", "sa", "gb", "us", "in"],
    description: "Apple NFC contactless",
  },
  {
    id: "GooglePay",
    label: "Google Pay",
    icon: Wallet,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    countries: ["ae", "sa", "gb", "us", "in"],
    description: "Google Pay / GPay",
  },
  {
    id: "SamsungPay",
    label: "Samsung Pay",
    icon: Smartphone,
    color: "text-teal-600",
    bg: "bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800",
    countries: ["ae", "sa"],
    description: "Samsung NFC wallet",
  },
  {
    id: "Tabby",
    label: "Tabby (BNPL)",
    icon: Tag,
    color: "text-lime-600",
    bg: "bg-lime-50 border-lime-200 dark:bg-lime-950/30 dark:border-lime-800",
    countries: ["ae", "sa"],
    description: "Buy Now, Pay Later — Tabby",
  },
  {
    id: "Tamara",
    label: "Tamara (BNPL)",
    icon: Tag,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    countries: ["ae", "sa"],
    description: "Buy Now, Pay Later — Tamara",
  },

  // ── Saudi Arabia (SA) ──────────────────────────────────────────────────────
  {
    id: "STCPay",
    label: "STC Pay",
    icon: Smartphone,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
    countries: ["sa"],
    description: "STC mobile wallet (KSA)",
  },
  {
    id: "Mada",
    label: "Mada",
    icon: CreditCard,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
    countries: ["sa"],
    description: "Saudi national debit network",
  },

  // ── India (IN) ─────────────────────────────────────────────────────────────
  {
    id: "UPI",
    label: "UPI",
    icon: Smartphone,
    color: "text-indigo-500",
    bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
    countries: ["in"],
    description: "Unified Payments Interface",
  },
  {
    id: "PhonePe",
    label: "PhonePe",
    icon: Smartphone,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
    countries: ["in"],
    description: "PhonePe UPI wallet",
  },
  {
    id: "Paytm",
    label: "Paytm",
    icon: Wallet,
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    countries: ["in"],
    description: "Paytm wallet & UPI",
  },

  // ── United Kingdom (GB) ────────────────────────────────────────────────────
  {
    id: "ContactlessGBP",
    label: "Contactless",
    icon: CreditCard,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    countries: ["gb"],
    description: "Contactless card / device",
  },

  // ── United States (US) ─────────────────────────────────────────────────────
  {
    id: "Zelle",
    label: "Zelle",
    icon: Landmark,
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
    countries: ["us"],
    description: "Zelle bank-to-bank transfer",
  },
  {
    id: "Venmo",
    label: "Venmo",
    icon: Wallet,
    color: "text-sky-600",
    bg: "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800",
    countries: ["us"],
    description: "Venmo social payments",
  },
];

// ─── Country seed defaults ────────────────────────────────────────────────────
// First time a tenant uses POS (before they visit Payment Methods settings),
// these IDs will be shown on the POS screen automatically.

export const COUNTRY_PAYMENT_SEEDS: Record<string, string[]> = {
  pk:      ["Cash", "Card", "EasyPaisa", "JazzCash"],
  ae:      ["Cash", "Card", "ApplePay",  "GooglePay"],
  sa:      ["Cash", "Card", "STCPay",    "Mada"],
  in:      ["Cash", "Card", "UPI",       "GooglePay"],
  gb:      ["Cash", "Card", "ApplePay",  "ContactlessGBP"],
  us:      ["Cash", "Card", "ApplePay",  "GooglePay"],
  om:      ["Cash", "Card", "GooglePay", "ApplePay"],
  qa:      ["Cash", "Card", "GooglePay", "ApplePay"],
  kw:      ["Cash", "Card", "GooglePay", "ApplePay"],
  bh:      ["Cash", "Card", "GooglePay", "ApplePay"],
  default: ["Cash", "Card", "BankTransfer"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All registry methods available for a country (universal + country-specific) */
export function getMethodsForCountry(countryCode: string): PaymentMethodDef[] {
  return PAYMENT_METHOD_REGISTRY.filter(
    m => m.countries.includes("*") || m.countries.includes(countryCode)
  );
}

/** Default enabled IDs for a country */
export function getSeedIds(countryCode: string): string[] {
  return COUNTRY_PAYMENT_SEEDS[countryCode] ?? COUNTRY_PAYMENT_SEEDS["default"];
}

/** Build a PaymentMethodDef from a user-defined custom entry */
export function buildCustomDef(cm: CustomPaymentMethod): PaymentMethodDef {
  return {
    id:          cm.id,
    label:       cm.label,
    icon:        CircleDollarSign,
    color:       "text-muted-foreground",
    bg:          "bg-muted/30 border-border",
    countries:   ["*"],
    description: "Custom payment method",
  };
}
