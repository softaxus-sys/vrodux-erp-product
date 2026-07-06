import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";

/**
 * Shown across the top whenever a super-admin is viewing the app AS a tenant (impersonation).
 * "Exit" restores the super-admin session and returns to the tenant list.
 */
export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const exitImpersonation = useAuthStore((s) => s.exitImpersonation);
  const navigate = useNavigate();

  if (!impersonation) return null;

  const handleExit = () => {
    exitImpersonation();
    navigate("/super-admin", { replace: true });
  };

  return (
    <div className="h-9 shrink-0 flex items-center justify-center gap-3 px-4 bg-amber-500 text-amber-950 text-xs font-medium">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        Viewing as <span className="font-bold">{impersonation.tenantName}</span> — you're seeing this tenant's data only.
      </span>
      <button
        onClick={handleExit}
        className="inline-flex items-center gap-1 rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-2 py-0.5 font-semibold transition-colors shrink-0"
      >
        <X className="h-3 w-3" /> Exit to super-admin
      </button>
    </div>
  );
}
