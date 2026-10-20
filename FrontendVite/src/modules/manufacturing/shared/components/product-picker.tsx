import * as React from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStockItems } from "@/hooks/manufacturing/use-manufacturing";
import { fmtQty, type StockItemDto } from "@/lib/manufacturing/manufacturing.api";

interface Props {
  value: StockItemDto | null;
  onChange: (item: StockItemDto | null) => void;
  placeholder?: string;
  /** Products that may not be picked here (already on the BOM, or the finished product itself). */
  excludeIds?: string[];
  disabled?: boolean;
}

/** Searchable Inventory product picker, fed by Manufacturing's own lookup endpoint. */
export function ProductPicker({ value, onChange, placeholder, excludeIds = [], disabled }: Props) {
  const { t } = useTranslation("manufacturing");
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [search, setSearch] = React.useState("");
  const boxRef = React.useRef<HTMLDivElement>(null);

  // Debounce so each keystroke is not its own request.
  React.useEffect(() => {
    const id = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const { data: items = [], isFetching } = useStockItems(search, open);
  const options = items.filter(i => !excludeIds.includes(i.id));

  if (value) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm">
        <span className="truncate flex-1">
          {value.name}
          {value.sku && <span className="text-muted-foreground ms-1.5 text-xs">{value.sku}</span>}
        </span>
        {!disabled && (
          <button type="button" onClick={() => { onChange(null); setText(""); }}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground" aria-label={t("picker.clear")}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input value={text} disabled={disabled} onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        placeholder={placeholder ?? t("picker.placeholder")} className="ps-8 h-9 text-sm" />
      {isFetching && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {isFetching ? t("picker.searching") : t("picker.empty")}
            </p>
          ) : options.map(item => (
            <button key={item.id} type="button"
              onClick={() => { onChange(item); setOpen(false); setText(""); }}
              className={cn("w-full flex items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-muted/60")}>
              <span className="min-w-0">
                <span className="block truncate">{item.name}</span>
                {item.sku && <span className="block text-[11px] text-muted-foreground truncate">{item.sku}</span>}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {t("picker.onHand", { quantity: fmtQty(item.stockQuantity), unit: item.unit })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
