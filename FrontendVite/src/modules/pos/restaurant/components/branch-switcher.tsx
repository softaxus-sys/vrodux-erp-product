import * as React from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentBranch } from "@/hooks/restaurant/use-current-branch";

/** Small dropdown for picking the "acting branch" — hidden entirely for single-location tenants
 * (no branches configured at all) since there's nothing to switch between. */
export function BranchSwitcher() {
  const { t } = useTranslation("restaurant");
  const { branchId, branchName, options, restricted, setBranchId } = useCurrentBranch();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (options.length === 0) return null; // single-location tenant — nothing to switch between

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted/30 hover:bg-muted/50 text-foreground">
        <Building2 className="w-3.5 h-3.5 text-primary" />
        {branchName}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-auto">
          {!restricted && (
            <button onClick={() => { setBranchId(null); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-muted/30",
                branchId === null && "text-primary font-medium")}>
              {t("branch.allBranches")}
            </button>
          )}
          {options.map(b => (
            <button key={b.id} onClick={() => { setBranchId(b.id); setOpen(false); }}
              className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-muted/30",
                branchId === b.id && "text-primary font-medium")}>
              {b.name} <span className="text-muted-foreground">({b.code})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
