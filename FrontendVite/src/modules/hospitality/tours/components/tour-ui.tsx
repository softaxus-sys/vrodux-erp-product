import { cn } from "@/lib/utils";
import type { DepartureStatus, InstalmentStatus, ServiceStatus, ServiceType, TourBookingStatus } from "@/lib/hospitality/tours.api";

export const TOUR_STATUS: Record<TourBookingStatus, { label: string; chip: string }> = {
  enquiry:   { label: "Enquiry",   chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmed: { label: "Confirmed", chip: "bg-primary/15 text-primary" },
  completed: { label: "Completed", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground line-through" },
};

export const DEPARTURE_STATUS: Record<DepartureStatus, { label: string; chip: string }> = {
  open:      { label: "Open",      chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  closed:    { label: "Closed",    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground" },
  completed: { label: "Completed", chip: "bg-primary/15 text-primary" },
};

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; chip: string }> = {
  pending:   { label: "Not booked", chip: "bg-muted text-muted-foreground" },
  requested: { label: "Requested",  chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmed: { label: "Confirmed",  chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  cancelled: { label: "Cancelled",  chip: "bg-muted text-muted-foreground line-through" },
};

export const INSTALMENT_STATUS: Record<InstalmentStatus, { label: string; chip: string }> = {
  paid:     { label: "Paid",     chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  partial:  { label: "Part paid", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  overdue:  { label: "Overdue",  chip: "bg-destructive/15 text-destructive" },
  due:      { label: "Due today", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  upcoming: { label: "Upcoming", chip: "bg-muted text-muted-foreground" },
};

export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "hotel", label: "Hotel" }, { value: "flight", label: "Flight" }, { value: "transfer", label: "Transfer" },
  { value: "visa", label: "Visa" }, { value: "activity", label: "Activity / excursion" }, { value: "guide", label: "Guide" },
  { value: "insurance", label: "Travel insurance" }, { value: "other", label: "Other" },
];

export const PACKAGE_CATEGORIES = ["Tour", "Umrah", "Hajj", "Honeymoon", "Family holiday", "Adventure", "Cruise", "Business", "Safari", "City break"];
export const BOOKING_SOURCES = ["Walk-in", "Phone", "WhatsApp", "Website", "Email", "Referral", "Social media", "Corporate"];
export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "online"];

export function Chip({ map, value }: { map: Record<string, { label: string; chip: string }>; value: string }) {
  const s = map[value] ?? { label: value.replace(/_/g, " "), chip: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", s.chip)}>{s.label}</span>;
}

export function SeatsBar({ booked, capacity }: { booked: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">{booked}/{capacity}</span>
    </div>
  );
}
