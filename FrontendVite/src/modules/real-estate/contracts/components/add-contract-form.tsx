import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { PaymentFrequency } from "@/lib/real-estate/re.api";
import { useCreateContract, useProperties, useTenants, useUnits } from "@/hooks/real-estate/use-re";

interface AddContractFormProps {
  open: boolean;
  onClose: () => void;
}

const TODAY = () => new Date().toISOString().split("T")[0];

/** A year from today, matching the standard UAE lease term — never a hardcoded date. */
function oneYearOut() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

const FREQUENCIES: { value: PaymentFrequency; label: string; per: number }[] = [
  { value: "monthly",     label: "Monthly",     per: 12 },
  { value: "quarterly",   label: "Quarterly",   per: 4 },
  { value: "semi_annual", label: "Half-yearly", per: 2 },
  { value: "annual",      label: "Annual",      per: 1 },
];

export function AddContractForm({ open, onClose }: AddContractFormProps) {
  const currency = useCurrency();
  const create   = useCreateContract();

  const { data: properties = [] } = useProperties();
  const { data: units = [] }      = useUnits();
  const { data: tenants = [] }    = useTenants();

  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId]         = React.useState("");
  const [tenantId, setTenantId]     = React.useState("");
  const [startDate, setStartDate]   = React.useState(TODAY());
  const [endDate, setEndDate]       = React.useState(oneYearOut());
  const [annualRent, setAnnualRent] = React.useState("");
  const [deposit, setDeposit]       = React.useState("");
  const [frequency, setFrequency]   = React.useState<PaymentFrequency>("quarterly");
  const [ejari, setEjari]           = React.useState("");
  const [notes, setNotes]           = React.useState("");

  const [advance, setAdvance]           = React.useState("");
  const [advanceDate, setAdvanceDate]   = React.useState(TODAY());
  const [advanceMethod, setAdvanceMethod]       = React.useState("cheque");
  const [advanceReference, setAdvanceReference] = React.useState("");

  // Only vacant units of the chosen property can be let. Offering an occupied one just produces a
  // 409 from the server's active-lease guard after the user has filled the whole form in.
  const availableUnits = React.useMemo(
    () => units.filter(u => u.propertyId === propertyId && (u.status === "vacant" || u.status === "reserved")),
    [units, propertyId]);

  React.useEffect(() => { setUnitId(""); }, [propertyId]);

  // Prefill the rent from the unit's asking price — it is right most of the time and still editable.
  React.useEffect(() => {
    const unit = units.find(u => u.id === unitId);
    if (unit && !annualRent) setAnnualRent(String(unit.rentPerYear ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const rent  = parseFloat(annualRent) || 0;
  const per   = FREQUENCIES.find(f => f.value === frequency)?.per ?? 1;
  const each  = per > 0 ? rent / per : rent;

  const advanceValue = parseFloat(advance) || 0;
  const advanceTooBig = advanceValue > rent + 0.01;

  // Whether the tenant will be chased on day one. The first installment falls due on the lease
  // start date, so with no advance the reminder ladder fires immediately — worth stating in the
  // form rather than letting it surprise someone after they save.
  const coversFirst = advanceValue >= each - 0.01;

  const valid = !!propertyId && !!unitId && !!tenantId && !!startDate && !!endDate
             && endDate > startDate && rent > 0 && !advanceTooBig;

  const submit = async () => {
    try {
      await create.mutateAsync({
        propertyId, unitId, tenantId, startDate, endDate,
        annualRent: rent,
        securityDeposit: parseFloat(deposit) || 0,
        paymentFrequency: frequency,
        ejariNumber: ejari.trim() || null,
        notes: notes.trim() || null,
        advanceRentAmount: advanceValue || undefined,
        advancePaidDate: advanceValue ? advanceDate : undefined,
        advanceMethod: advanceValue ? advanceMethod : undefined,
        advanceReference: advanceValue ? advanceReference.trim() || undefined : undefined,
      });
      onClose();
    } catch {
      // The hook surfaced the error; keep the drawer open so nothing typed is lost.
    }
  };

  if (!open) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed top-0 end-0 h-full w-full max-w-[520px] bg-background border-s border-border shadow-2xl z-50 flex flex-col">

        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="font-bold text-base">New lease</p>
            <p className="text-xs text-muted-foreground">The rent schedule is generated automatically.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Property">
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-card px-3">
              <option value="">Select a property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="Unit" hint={propertyId && availableUnits.length === 0 ? "No vacant units in this property." : undefined}>
            <select value={unitId} onChange={e => setUnitId(e.target.value)} disabled={!propertyId}
              className="w-full h-9 text-sm rounded-md border border-input bg-card px-3 disabled:opacity-50">
              <option value="">{propertyId ? "Select a unit…" : "Choose a property first"}</option>
              {availableUnits.map(u => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber} — {u.unitType}{u.rentPerYear ? ` · ${formatCurrency(u.rentPerYear, currency)}/yr` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tenant">
            <select value={tenantId} onChange={e => setTenantId(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-input bg-card px-3">
              <option value="">Select a tenant…</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}{t.email ? ` — ${t.email}` : ""}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Reminders are emailed to this tenant, so their email address must be on file.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
            </Field>
            <Field label="End date" hint={endDate && startDate && endDate <= startDate ? "Must be after the start date." : undefined}>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className={cn("h-9 text-sm", endDate && startDate && endDate <= startDate && "border-destructive")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual rent">
              <Input type="number" min={0} step={1000} value={annualRent}
                onChange={e => setAnnualRent(e.target.value)} placeholder="0" className="h-9 text-sm text-end" />
            </Field>
            <Field label="Security deposit">
              <Input type="number" min={0} step={500} value={deposit}
                onChange={e => setDeposit(e.target.value)} placeholder="0" className="h-9 text-sm text-end" />
            </Field>
          </div>

          <Field label="Payment frequency">
            <div className="grid grid-cols-4 gap-1.5">
              {FREQUENCIES.map(f => (
                <button key={f.value} type="button" onClick={() => setFrequency(f.value)}
                  className={cn("px-2 py-2 text-xs rounded-lg font-medium border",
                    frequency === f.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40")}>
                  {f.label}
                </button>
              ))}
            </div>
            {rent > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                {per} payment{per === 1 ? "" : "s"} of about {formatCurrency(each, currency)}.
                The exact split is calculated from the lease term.
              </p>
            )}
          </Field>

          {/* ── Advance rent ─────────────────────────────────────────── */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div>
              <p className="text-sm font-medium">Advance rent received</p>
              <p className="text-[11px] text-muted-foreground">
                Rent handed over at signing. It settles the schedule from the first payment onward,
                so the tenant is not chased for money they have already paid.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" min={0} step={500} value={advance}
                  onChange={e => setAdvance(e.target.value)} placeholder="0"
                  className={cn("h-9 text-sm text-end", advanceTooBig && "border-destructive")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Received on</label>
                <Input type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)}
                  disabled={!advanceValue} className="h-9 text-sm disabled:opacity-50" />
              </div>
            </div>

            {rent > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setAdvance(String(Math.round(each)))}
                  className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-muted/40">
                  First payment ({formatCurrency(each, currency)})
                </button>
                {per > 1 && (
                  <button type="button" onClick={() => setAdvance(String(Math.round(each * 2)))}
                    className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-muted/40">
                    First two
                  </button>
                )}
                <button type="button" onClick={() => setAdvance(String(Math.round(rent)))}
                  className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-muted/40">
                  Full year
                </button>
                {advanceValue > 0 && (
                  <button type="button" onClick={() => setAdvance("")}
                    className="px-2 py-1 text-[11px] rounded-md text-muted-foreground hover:bg-muted/40">
                    Clear
                  </button>
                )}
              </div>
            )}

            {advanceValue > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Method</label>
                  <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}
                    className="w-full h-9 text-sm rounded-md border border-input bg-card px-3">
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reference</label>
                  <Input value={advanceReference} onChange={e => setAdvanceReference(e.target.value)}
                    placeholder="Cheque no. / txn id" className="h-9 text-sm" />
                </div>
              </div>
            )}

            {advanceTooBig ? (
              <p className="text-[11px] text-destructive">
                That is more than the whole lease is worth ({formatCurrency(rent, currency)}).
              </p>
            ) : rent > 0 && !coversFirst ? (
              <p className="text-[11px] text-warning">
                The first payment is due on {startDate || "the start date"}, so reminders begin straight away.
              </p>
            ) : advanceValue > 0 ? (
              <p className="text-[11px] text-success">
                Covers the first payment — reminders start from the one after it.
              </p>
            ) : null}
          </div>

          <Field label="Ejari number (optional)">
            <Input value={ejari} onChange={e => setEjari(e.target.value)} className="h-9 text-sm" />
          </Field>

          <Field label="Notes (optional)">
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-9 text-sm" />
          </Field>
        </div>

        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            Create lease
          </Button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[11px] text-warning mt-1">{hint}</p>}
    </div>
  );
}
