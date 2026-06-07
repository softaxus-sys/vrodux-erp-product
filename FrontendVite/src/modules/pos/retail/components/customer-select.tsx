import * as React from "react";
import { User2, Search, X, Star, ChevronDown, UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCustomers, useCreateCustomer } from "@/hooks/pos/use-customers";
import type { CustomerSummaryDto } from "@/lib/pos/types";

export interface SelectedCustomer {
  id:            string;
  name:          string;
  loyaltyPoints: number;
}

interface CustomerSelectProps {
  selected:   SelectedCustomer | null;
  onSelect:   (customer: SelectedCustomer | null) => void;
}

/**
 * Compact customer picker for the POS cart header.
 * Walk-in (no customer) is the default. Selecting a customer enables
 * loyalty-points redemption in the discount panel.
 */
export function CustomerSelect({ selected, onSelect }: CustomerSelectProps) {
  const [open, setOpen]       = React.useState(false);
  const [search, setSearch]   = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName]   = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const boxRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading } = useCustomers({ search: search || undefined, pageSize: 20 });
  const customers = data?.items ?? [];
  const createCustomer = useCreateCustomer();

  const submitNew = async () => {
    if (!newName.trim()) return;
    try {
      const c = await createCustomer.mutateAsync({ name: newName.trim(), phone: newPhone.trim() || null });
      onSelect({ id: c.id, name: c.name, loyaltyPoints: c.loyaltyPoints });
      setCreating(false); setNewName(""); setNewPhone(""); setOpen(false); setSearch("");
    } catch { /* toast in hook */ }
  };

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (c: CustomerSummaryDto) => {
    onSelect({ id: c.id, name: c.name, loyaltyPoints: c.loyaltyPoints });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors w-full",
          selected
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30"
        )}
      >
        <User2 className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? selected.name : "Walk-in Customer"}
        </span>
        {selected && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning shrink-0">
            <Star className="h-3 w-3 fill-warning" />
            {selected.loyaltyPoints}
          </span>
        )}
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 right-0 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {creating ? (
            /* Inline create form */
            <div className="p-3 space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-primary" />New Customer</p>
              <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNew(); }}
                placeholder="Name *" className="h-8 text-xs" />
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNew(); }}
                placeholder="Phone (optional)" className="h-8 text-xs" />
              <div className="flex gap-2 pt-0.5">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setCreating(false)} disabled={createCustomer.isPending}>Back</Button>
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={submitNew} disabled={!newName.trim() || createCustomer.isPending}>
                  {createCustomer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : (
          <>
          <div className="p-2 border-b border-border flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 px-2 shrink-0" title="Add new customer"
              onClick={() => { setNewName(search); setCreating(true); }}>
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 text-muted-foreground"
            >
              <User2 className="h-3.5 w-3.5" /> Walk-in Customer (no loyalty)
            </button>
            {isLoading ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
            ) : customers.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">No customers found.</p>
            ) : (
              customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => pick(c)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-muted/40 border-t border-border/40"
                >
                  <div className="min-w-0 text-left">
                    <p className="font-semibold text-foreground truncate">{c.name}</p>
                    {c.phone && <p className="text-[10px] text-muted-foreground truncate">{c.phone}</p>}
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning shrink-0">
                    <Star className="h-3 w-3 fill-warning" />{c.loyaltyPoints}
                  </span>
                </button>
              ))
            )}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
