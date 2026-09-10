import type { LeadDto, PurchaseUrgency } from "@/types/crm";

/** Lead temperature derived from the intent score -- mirrors web's leadHeat (i18n stripped for v1). */
export function leadHeat(score: number): { label: string; emoji: string } {
  if (score >= 70) return { label: "Hot", emoji: "\u{1F525}" };
  if (score >= 40) return { label: "Warm", emoji: "\u{1F324}️" };
  return { label: "Cold", emoji: "❄️" };
}

const URGENCY_LABELS: Record<Exclude<PurchaseUrgency, "unknown">, string> = {
  immediate: "Immediate",
  "1_month": "Within 1 month",
  "1_3_months": "1–3 months",
  "3_6_months": "3–6 months",
  "6_plus": "6+ months",
};

export function urgencyLabel(urgency?: PurchaseUrgency | null): string | null {
  if (!urgency || urgency === "unknown") return null;
  return URGENCY_LABELS[urgency];
}

/** A short summary of what the lead wants -- mirrors web's buildLeadSummary. */
export function buildLeadSummary(
  lead: Pick<LeadDto, "interestedIn" | "budget" | "purchaseTimeframe" | "purchaseUrgency" | "message" | "company">
): string {
  const parts: string[] = [];
  if (lead.interestedIn) parts.push(lead.interestedIn.trim());
  if (lead.budget) parts.push(`Budget ${lead.budget.trim()}`);
  const urg = urgencyLabel(lead.purchaseUrgency);
  if (urg) parts.push(urg);
  if (parts.length) return parts.join(" · ");
  if (lead.message) return lead.message.trim().replace(/\s+/g, " ").slice(0, 140);
  if (lead.company) return lead.company.trim();
  return "—";
}

/** "PKR 6M" / "AED 750K" -- mirrors web's formatCompactValue. Returns "—" for missing/zero. */
export function formatCompactValue(amount: number | null | undefined, currency: string): string {
  if (!amount || amount <= 0) return "—";
  const abs = Math.abs(amount);
  const trim = (n: number) => (Math.round(n * 10) / 10).toString();
  let num: string;
  if (abs >= 1e9) num = trim(amount / 1e9) + "B";
  else if (abs >= 1e6) num = trim(amount / 1e6) + "M";
  else if (abs >= 1e3) num = trim(amount / 1e3) + "K";
  else num = String(Math.round(amount));
  return `${currency} ${num}`;
}

/** Digits-only phone, safe to hand to tel:/wa.me links. Empty string if nothing usable. */
export function cleanPhone(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^\d+]/g, "");
}
