import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceType } from "@/lib/hospitality/tours.api";
import { Field, inputCls, selectCls } from "../../shared/hotel-ui";

// What an agent records for each kind of supplier booking. Stored as name/value pairs on the
// service (server: TourService.Details), so adding a field here needs no backend change.

type Kind = "text" | "date" | "datetime" | "time" | "number" | "select";
export interface DetailField { key: string; label: string; kind?: Kind; options?: string[]; placeholder?: string; wide?: boolean }

const MEALS = ["Room only", "Bed & breakfast", "Half board", "Full board", "All inclusive"];

export const SERVICE_FIELDS: Record<ServiceType, DetailField[]> = {
  hotel: [
    { key: "hotel", label: "Hotel name", wide: true, placeholder: "Hilton Istanbul Bosphorus" },
    { key: "city", label: "City" },
    { key: "checkIn", label: "Check-in", kind: "date" },
    { key: "checkOut", label: "Check-out", kind: "date" },
    { key: "roomType", label: "Room type", placeholder: "Deluxe double, sea view" },
    { key: "rooms", label: "Rooms", kind: "number" },
    { key: "mealPlan", label: "Meal plan", kind: "select", options: MEALS },
    { key: "guestsPerRoom", label: "Guests per room", placeholder: "2 adults + 1 child" },
  ],
  flight: [
    { key: "airline", label: "Airline", placeholder: "Emirates" },
    { key: "flightNo", label: "Flight no.", placeholder: "EK 121" },
    { key: "from", label: "From", placeholder: "DXB" },
    { key: "to", label: "To", placeholder: "IST" },
    { key: "departs", label: "Departs", kind: "datetime" },
    { key: "arrives", label: "Arrives", kind: "datetime" },
    { key: "class", label: "Class", kind: "select", options: ["Economy", "Premium economy", "Business", "First"] },
    { key: "baggage", label: "Baggage", placeholder: "30 kg + 7 kg cabin" },
    { key: "returnFlightNo", label: "Return flight no." },
    { key: "returnDeparts", label: "Return departs", kind: "datetime" },
    { key: "ticketNumbers", label: "Ticket numbers", wide: true, placeholder: "176-1234567890, 176-…" },
  ],
  car: [
    { key: "company", label: "Rental company", placeholder: "Hertz" },
    { key: "vehicle", label: "Vehicle / class", placeholder: "Toyota Camry or similar" },
    { key: "pickupPlace", label: "Pick-up place", placeholder: "Istanbul Airport" },
    { key: "pickupAt", label: "Pick-up", kind: "datetime" },
    { key: "dropoffPlace", label: "Drop-off place" },
    { key: "dropoffAt", label: "Drop-off", kind: "datetime" },
    { key: "withDriver", label: "Driver", kind: "select", options: ["Self-drive", "With driver"] },
    { key: "insurance", label: "Insurance", placeholder: "Full cover" },
  ],
  transfer: [
    { key: "from", label: "From", placeholder: "Airport" },
    { key: "to", label: "To", placeholder: "Hotel" },
    { key: "pickupAt", label: "Pick-up time", kind: "datetime" },
    { key: "vehicle", label: "Vehicle", placeholder: "Private van, 7 seats" },
    { key: "driver", label: "Driver name / phone", wide: true },
    { key: "meetingPoint", label: "Meeting point", wide: true, placeholder: "Arrivals hall, name board" },
  ],
  rail: [
    { key: "operator", label: "Operator" }, { key: "trainNo", label: "Train no." },
    { key: "from", label: "From" }, { key: "to", label: "To" },
    { key: "departs", label: "Departs", kind: "datetime" }, { key: "arrives", label: "Arrives", kind: "datetime" },
    { key: "class", label: "Class" }, { key: "seats", label: "Coach / seats" },
  ],
  cruise: [
    { key: "line", label: "Cruise line" }, { key: "ship", label: "Ship" },
    { key: "embark", label: "Embarks", kind: "date" }, { key: "disembark", label: "Disembarks", kind: "date" },
    { key: "port", label: "Departure port" }, { key: "cabin", label: "Cabin type / no." },
    { key: "mealPlan", label: "Dining", kind: "select", options: MEALS },
  ],
  bus: [
    { key: "operator", label: "Operator" }, { key: "from", label: "From" }, { key: "to", label: "To" },
    { key: "departs", label: "Departs", kind: "datetime" }, { key: "seats", label: "Seats" },
  ],
  visa: [
    { key: "country", label: "Country" },
    { key: "visaType", label: "Visa type", placeholder: "Tourist, 30 days" },
    { key: "applicants", label: "Applicants", kind: "number" },
    { key: "submittedOn", label: "Submitted", kind: "date" },
    { key: "expectedBy", label: "Expected by", kind: "date" },
    { key: "visaNumbers", label: "Visa numbers", wide: true },
  ],
  activity: [
    { key: "activity", label: "Activity", wide: true, placeholder: "Hot-air balloon flight" },
    { key: "date", label: "Date", kind: "date" }, { key: "time", label: "Time", kind: "time" },
    { key: "participants", label: "Participants", kind: "number" }, { key: "meetingPoint", label: "Meeting point" },
  ],
  guide: [
    { key: "guide", label: "Guide name" }, { key: "language", label: "Language" },
    { key: "phone", label: "Phone" }, { key: "days", label: "Days", kind: "number" },
  ],
  insurance: [
    { key: "insurer", label: "Insurer" }, { key: "policyNo", label: "Policy no." },
    { key: "cover", label: "Cover", placeholder: "Medical USD 50,000, cancellation" , wide: true },
    { key: "insured", label: "People insured", kind: "number" },
  ],
  other: [],
};

const toInputType = (k?: Kind) => k === "date" ? "date" : k === "datetime" ? "datetime-local" : k === "time" ? "time" : k === "number" ? "number" : "text";

/** Readable value for documents and lists (datetime-local values come as 2026-11-17T10:30). */
export function showDetail(v: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    return isNaN(+d) ? v : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00Z");
    return isNaN(+d) ? v : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return v;
}

/** Ordered label/value pairs for display: known fields first, then anything custom. */
export function detailRows(type: ServiceType, details: Record<string, string> | undefined): [string, string][] {
  const d = details ?? {};
  const known = SERVICE_FIELDS[type] ?? [];
  const rows: [string, string][] = known.filter(f => d[f.key]).map(f => [f.label, showDetail(d[f.key])]);
  for (const [k, v] of Object.entries(d)) if (!known.some(f => f.key === k) && v) rows.push([k, showDetail(v)]);
  return rows;
}

/** One line for list views: "EK 121 · DXB → IST · 17 Nov, 10:30". */
export function detailSummary(type: ServiceType, d: Record<string, string> | undefined): string {
  if (!d) return "";
  const j = (...p: (string | undefined)[]) => p.filter(Boolean).join(" · ");
  const route = d.from && d.to ? `${d.from} → ${d.to}` : undefined;
  switch (type) {
    case "flight": return j(d.airline, d.flightNo, route, d.departs && showDetail(d.departs));
    case "hotel":  return j(d.hotel, d.roomType, d.rooms && `${d.rooms} room${d.rooms === "1" ? "" : "s"}`, d.mealPlan);
    case "car":    return j(d.vehicle, d.pickupPlace && `pick-up ${d.pickupPlace}`, d.pickupAt && showDetail(d.pickupAt));
    case "transfer": case "bus": case "rail": return j(d.trainNo ?? d.operator, route, (d.pickupAt ?? d.departs) && showDetail(d.pickupAt ?? d.departs));
    case "cruise": return j(d.ship, d.cabin, d.embark && showDetail(d.embark));
    default: return "";
  }
}

/** The editor: the fields for the chosen type, plus any extra name/value lines the agent adds. */
export function ServiceDetailsEditor({ type, value, onChange }:
  { type: ServiceType; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const fields = SERVICE_FIELDS[type] ?? [];
  const known = new Set(fields.map(f => f.key));
  const extras = Object.entries(value).filter(([k]) => !known.has(k));
  const [newKey, setNewKey] = React.useState("");
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const remove = (k: string) => { const n = { ...value }; delete n[k]; onChange(n); };

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <Field key={f.key} label={f.label} className={f.wide ? "col-span-2" : undefined}>
              {f.kind === "select" ? (
                <select value={value[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} className={selectCls}>
                  <option value="">—</option>{f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={toInputType(f.kind)} value={value[f.key] ?? ""} placeholder={f.placeholder}
                  onChange={e => set(f.key, e.target.value)} className={inputCls} />
              )}
            </Field>
          ))}
        </div>
      )}
      {extras.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[10rem_1fr_auto] gap-2 items-center">
          <span className="text-xs text-muted-foreground truncate" title={k}>{k}</span>
          <input value={v} onChange={e => set(k, e.target.value)} className={inputCls} />
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive" onClick={() => remove(k)} aria-label={`Remove ${k}`}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={newKey} onChange={e => setNewKey(e.target.value)} className={inputCls} placeholder="Add another detail (e.g. Seat numbers)" />
        <Button size="sm" variant="outline" className="h-9 gap-1 shrink-0" disabled={!newKey.trim() || newKey.trim() in value}
          onClick={() => { set(newKey.trim(), " "); setNewKey(""); }}><Plus className="h-3.5 w-3.5" />Add</Button>
      </div>
    </div>
  );
}
