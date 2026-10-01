import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/** Past this many options a list is searched, not scanned — a workspace can hold hundreds of towers. */
const SEARCH_THRESHOLD = 8;

/**
 * A filter that takes several values at once: a button that opens a checklist.
 *
 * <p>The button carries the count of what is ticked, so a filter left on is visible without
 * opening it.</p>
 */
export function MultiSelectFilter({
  label, options, selected, onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [term, setTerm] = React.useState("");

  const visible = term.trim()
    ? options.filter(o => o.label.toLowerCase().includes(term.trim().toLowerCase()))
    : options;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  return (
    <Popover onOpenChange={open => { if (!open) setTerm(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            selected.length > 0
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-card text-foreground hover:bg-muted/50",
          )}
        >
          {label}
          {selected.length > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        {options.length > SEARCH_THRESHOLD && (
          <div className="relative border-b border-border">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full h-9 ps-8 pe-3 bg-transparent text-sm focus:outline-none"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {options.length === 0 ? "Nothing to filter by yet." : "No matches."}
            </p>
          ) : (
            visible.map(o => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-start hover:bg-muted"
                >
                  <span className={cn(
                    "h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center",
                    on ? "bg-primary border-primary text-primary-foreground" : "border-border",
                  )}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground text-start hover:bg-muted"
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
