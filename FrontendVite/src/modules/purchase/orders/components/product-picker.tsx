import * as React from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useInventoryProducts } from "@/hooks/inventory/use-inventory-products";

interface ProductPickerProps {
  value: string;
  onSelect: (product: { id: string; name: string; costPrice: number; taxRate: number }) => void;
  onTextChange: (text: string) => void;
}

export function ProductPicker({ value, onSelect, onTextChange }: ProductPickerProps) {
  const currency = useCurrency();
  const [open, setOpen]     = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = useInventoryProducts({ search: search || undefined, isActive: true, pageSize: 20 });
  const products = data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-8 w-full items-center justify-between rounded border border-transparent bg-transparent px-2 text-xs hover:border-border focus-visible:border-primary/40 focus-visible:outline-none"
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value || "Search product or type description…"}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search products…"
            value={search}
            onValueChange={(v) => { setSearch(v); onTextChange(v); }}
          />
          <CommandList>
            {isLoading && <div className="py-4 text-center text-xs text-muted-foreground">Searching…</div>}
            {!isLoading && <CommandEmpty>No products found. Free text will be used.</CommandEmpty>}
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect({ id: p.id, name: p.name, costPrice: p.costPrice, taxRate: p.taxRate });
                    setSearch("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{p.name}</p>
                    {p.sku && <p className="truncate text-[10px] text-muted-foreground">SKU: {p.sku}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatCurrency(p.costPrice, currency)}</span>
                  {value === p.name && <Check className="h-3.5 w-3.5 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
