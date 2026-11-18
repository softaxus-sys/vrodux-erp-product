import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/hooks/finance/use-finance";

export interface PaymentDetailsValue { account: string; link: string; instructions: string }
export const EMPTY_PAYMENT: PaymentDetailsValue = { account: "", link: "", instructions: "" };

/** Kind of payment, worked out from the chosen account's name (used for the label shown on the invoice). */
export function methodFor(account: string, name?: string): string | null {
  if (!account) return null;
  const n = (name ?? "").toLowerCase();
  if (n.includes("stripe")) return "stripe";
  if (n.includes("paypal")) return "paypal";
  if (n.includes("payoneer")) return "payoneer";
  if (n.includes("bank")) return "bank";
  return "other";
}

/** Payload fields for create/update/template requests. */
export function paymentPayload(v: PaymentDetailsValue, accounts: { accountNumber: string; name: string }[] | undefined) {
  const acc = accounts?.find(a => a.accountNumber === v.account);
  return {
    paymentAccountNumber: v.account || null,
    paymentMethod: methodFor(v.account, acc?.name),
    paymentLink: v.account ? (v.link.trim() || null) : null,
    paymentInstructions: v.account ? (v.instructions.trim() || null) : null,
  };
}

/** Where the customer pays this invoice. Lists the workspace's own cash/bank/processor accounts; paid
 *  invoices post to the one chosen. Blank = company bank details from Settings. */
export function PaymentDetailsFields({ value, onChange }: { value: PaymentDetailsValue; onChange: (v: PaymentDetailsValue) => void }) {
  const { data: accounts } = useAccounts({ isActive: true });
  const options = (accounts ?? []).filter(a => /^10\d\d/.test(a.accountNumber)).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  const set = (p: Partial<PaymentDetailsValue>) => onChange({ ...value, ...p });
  const kind = methodFor(value.account, options.find(a => a.accountNumber === value.account)?.name);
  return (
    <div className="col-span-2 space-y-2 rounded-lg border border-border p-3">
      <Label>Receiving account (payment goes here when the invoice is paid)</Label>
      <select value={value.account} onChange={e => set({ account: e.target.value })}
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
        <option value="">Company bank details (Settings)</option>
        {options.map(a => <option key={a.id} value={a.accountNumber}>{a.accountNumber} {a.name}</option>)}
      </select>
      {value.account && (
        <>
          {kind !== "bank" && (
            <Input value={value.link} onChange={e => set({ link: e.target.value })} placeholder="Payment link (optional), e.g. https://buy.stripe.com/..." />
          )}
          <textarea rows={3} value={value.instructions} onChange={e => set({ instructions: e.target.value })}
            placeholder={kind === "bank" ? "Bank, account name, IBAN, SWIFT… one per line" : "Optional note shown on the invoice, e.g. Pay by card via Stripe"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring" />
        </>
      )}
    </div>
  );
}
