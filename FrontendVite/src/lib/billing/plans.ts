/**
 * Public plan catalogue — mirrors vrodux.com/pricing and the backend `PlanDefinitions`.
 *
 * Keep all three in step. The backend is authoritative for entitlement (it computes the JWT
 * `plan` + `modules` claims); this file exists purely so the UI can render prices, seat counts
 * and feature lists without a round-trip.
 */

/**
 * Length of the free trial, in days. The backend decides it (`TrialPolicy.DurationDays`) and every
 * trial it grants is exactly this long; this copy exists only so the labels can say so without a
 * round-trip. Change both together — never write a literal number of trial days in a label.
 */
export const TRIAL_DAYS = 14;

export type PlanId = "micro" | "starter" | "professional" | "enterprise";
export type BillingPeriod = "monthly" | "annual";

export interface PlanDefinition {
  id: PlanId;
  /** Matches the backend `PlanType` member name — this is what the API sends and expects. */
  name: string;
  label: string;
  tagline: string;
  /** Month-to-month list price in USD. Null = quoted by sales. */
  monthlyUsd: number | null;
  /** Discounted per-month rate when billed annually. Null = quoted by sales. */
  annualUsdPerMonth: number | null;
  /** Seats included. -1 = unlimited. */
  maxUsers: number;
  /** Can a tenant buy this without talking to sales? */
  selfServe: boolean;
  highlight?: boolean;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "micro",
    name: "Micro",
    label: "Micro",
    tagline: "The full ERP for a small team",
    monthlyUsd: 159,
    annualUsdPerMonth: 129,
    maxUsers: 3,
    selfServe: true,
    features: [
      "Up to 3 users",
      "Every module included — pick what you need, or all of it",
      "Cloud hosting & automatic updates",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    label: "Starter",
    tagline: "The full ERP for a growing team",
    monthlyUsd: 299,
    annualUsdPerMonth: 249,
    maxUsers: 10,
    selfServe: true,
    features: [
      "Up to 10 users",
      "Every module included",
      "Standard support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    label: "Professional",
    tagline: "For larger teams, up to 50 users",
    monthlyUsd: 849,
    annualUsdPerMonth: 699,
    maxUsers: 50,
    selfServe: true,
    highlight: true,
    features: [
      "Up to 50 users",
      "Every module included",
      "Multi-company (up to 3) & multi-currency",
      "Advanced analytics & BI",
      "API access & custom workflows",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    label: "Enterprise",
    tagline: "Unlimited scale, with an SLA",
    monthlyUsd: null,
    annualUsdPerMonth: null,
    maxUsers: -1,
    selfServe: false,
    features: [
      "Unlimited users & companies",
      "Every module included",
      "Advanced permissions & enterprise security",
      "Custom integrations & development",
      "Dedicated support with SLA",
      "On-premise deployment option",
    ],
  },
];

const BY_ID = new Map(PLANS.map(p => [p.id, p]));

/** Look up a plan by its slug or by the backend's `PlanType` name (case-insensitive). */
export function getPlan(id: string | null | undefined): PlanDefinition | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.trim().toLowerCase() as PlanId);
}

/** Amount actually charged per cycle: the full year up-front on annual, otherwise one month. */
export function amountFor(plan: PlanDefinition, period: BillingPeriod): number | null {
  if (period === "annual") {
    return plan.annualUsdPerMonth === null ? null : plan.annualUsdPerMonth * 12;
  }
  return plan.monthlyUsd;
}

/** Percentage saved by paying annually, rounded — matches the badges on the pricing page. */
export function annualSavingPct(plan: PlanDefinition): number | null {
  if (plan.monthlyUsd === null || plan.annualUsdPerMonth === null) return null;
  return Math.round((1 - plan.annualUsdPerMonth / plan.monthlyUsd) * 100);
}

export function formatUsd(amount: number | null): string {
  if (amount === null) return "Custom";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(amount);
}

export function normaliseBillingPeriod(v: string | null | undefined): BillingPeriod {
  // Every pricing-page CTA defaults to annual, so annual is the fallback.
  return v?.trim().toLowerCase() === "monthly" ? "monthly" : "annual";
}
