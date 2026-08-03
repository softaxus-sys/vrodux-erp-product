import * as React from "react";
import { useBranches } from "@/hooks/identity/use-branches";
import { useMyBranches } from "@/hooks/restaurant/use-user-branches";
import { useBranchStore } from "@/store/branch.store";
import type { BranchDto } from "@/lib/identity/branches.api";

export interface CurrentBranch {
  /** null = "All Branches" — only ever null for an unrestricted user (no UserBranch assignments). */
  branchId: string | null;
  branchName: string;
  /** Selectable branches — every tenant branch for an unrestricted user, only the assigned ones otherwise. */
  options: BranchDto[];
  /** True once the user has at least one UserBranch assignment — they can't pick "All Branches". */
  restricted: boolean;
  setBranchId: (id: string | null) => void;
}

/** The restaurant "acting branch" — drives which branch new tables/orders get tagged with, and
 * (for a branch-scoped user) which branch's data they're currently focused on. See BranchScope /
 * IBranchAccessGuard on the backend for the read-side enforcement this mirrors. */
export function useCurrentBranch(): CurrentBranch {
  const { data: mine = [] } = useMyBranches();
  const { data: allBranches = [] } = useBranches();
  const { currentBranchId, setCurrentBranchId } = useBranchStore();

  const restricted = mine.length > 0;
  const options = restricted
    ? allBranches.filter(b => mine.some(m => m.branchId === b.id))
    : allBranches;

  React.useEffect(() => {
    if (restricted && (!currentBranchId || !options.some(o => o.id === currentBranchId))) {
      setCurrentBranchId(options[0]?.id ?? null);
    }
  }, [restricted, currentBranchId, options, setCurrentBranchId]);

  const branchId = currentBranchId;
  const branchName = branchId
    ? (options.find(o => o.id === branchId)?.name ?? "—")
    : "All Branches";

  return { branchId, branchName, options, restricted, setBranchId: setCurrentBranchId };
}
