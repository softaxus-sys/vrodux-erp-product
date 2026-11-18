import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PaymentDetailsValue { method: string; link: string; instructions: string }
export const EMPTY_PAYMENT: PaymentDetailsValue = { method: "", link: "", instructions: "" };

/** How the customer should pay this invoice. Blank = the company bank details from Settings. */
export function PaymentDetailsFields({ value, onChange }: { value: PaymentDetailsValue; onChange: (v: PaymentDetailsValue) => void }) {
  const set = (p: Partial<PaymentDetailsValue>) => onChange({ ...value, ...p });
  return (
    <div className="col-span-2 space-y-2 rounded-lg border border-border p-3">
      <Label>Payment details shown on the invoice</Label>
      <select value={value.method} onChange={e => set({ method: e.target.value })}
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
        <option value="">Company bank details (Settings)</option>
        <option value="bank">Different bank account</option>
        <option value="stripe">Stripe / online payment link</option>
        <option value="other">Other</option>
      </select>
      {value.method && (
        <>
          {value.method === "stripe" && (
            <Input value={value.link} onChange={e => set({ link: e.target.value })} placeholder="Payment link, e.g. https://buy.stripe.com/..." />
          )}
          <textarea rows={3} value={value.instructions} onChange={e => set({ instructions: e.target.value })}
            placeholder={value.method === "stripe" ? "Optional note, e.g. Pay by card via Stripe" : "Bank, account name, IBAN, SWIFT… one per line"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring" />
        </>
      )}
    </div>
  );
}
