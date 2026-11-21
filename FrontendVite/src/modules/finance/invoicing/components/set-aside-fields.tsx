import { Plus, Trash2, HandHeart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { useCan } from "@/components/auth/can";
import { useSetAsideRules } from "@/hooks/finance/use-set-asides";
import type { SetAsideDef } from "@/lib/finance/finance.api";

/** What one share comes to for an invoice: a percentage is of the amount BEFORE VAT. */
export function setAsideAmount(d: SetAsideDef, subTotal: number): number {
  const v = Number.isFinite(d.value) ? d.value : 0;
  return Math.round((d.kind === "percent" ? subTotal * v / 100 : v) * 100) / 100;
}

interface Props {
  rows: SetAsideDef[];
  onChange: (rows: SetAsideDef[]) => void;
  /** Invoice amount before VAT — what a percentage is worked out on. */
  subTotal: number;
  currency: string;
}

/**
 * Optional "put part of this income aside" box (e.g. Charity 5%). Nothing is paid out by this: when
 * the invoice is paid the system records what is owed, and the Set-asides page reminds you to pay it.
 * Rows start from the workspace's default rules; the user may change, remove or add any of them.
 */
export function SetAsideFields({ rows, onChange, subTotal, currency }: Props) {
  const { data: rules } = useSetAsideRules();
  // Owners only: set-asides are the business's own commitment, not something other staff see.
  const isOwner = useCan("finance.accounting.view");
  const total = rows.reduce((s, r) => s + setAsideAmount(r, subTotal), 0);

  const update = (i: number, patch: Partial<SetAsideDef>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  if (!isOwner) return null;

  return (
    <div className="col-span-2 space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <HandHeart className="h-3.5 w-3.5 text-rose-500" />
          Set aside from this income <span className="font-normal text-muted-foreground">(optional, e.g. Charity)</span>
        </Label>
        <button type="button" onClick={() => onChange([...rows, { name: rules?.[0]?.name ?? "", kind: "percent", value: 5 }])}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing is set aside from this invoice.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_6rem_auto_auto] items-center gap-2">
              <Input list="set-aside-names" value={r.name} onChange={e => update(i, { name: e.target.value })} placeholder="Name, e.g. Charity" />
              <select value={r.kind} onChange={e => update(i, { kind: e.target.value as SetAsideDef["kind"] })}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm">
                <option value="percent">% of amount</option>
                <option value="fixed">Fixed amount</option>
              </select>
              <Input type="number" min={0} step="0.01" value={Number.isFinite(r.value) ? r.value : ""}
                onChange={e => update(i, { value: e.target.value === "" ? 0 : +e.target.value })} />
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap min-w-[5.5rem] text-right">
                {formatCurrency(setAsideAmount(r, subTotal), currency)}
              </span>
              <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/40" aria-label="Remove">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <datalist id="set-aside-names">{(rules ?? []).map(r => <option key={r.id} value={r.name} />)}</datalist>
          <p className="text-xs text-muted-foreground">
            Percentages are taken on the amount before VAT. Set aside in total: <b>{formatCurrency(total, currency)}</b>
            {" "}— worked out when the invoice is paid; you pay it out later from Finance → Set-asides.
          </p>
        </div>
      )}
    </div>
  );
}
