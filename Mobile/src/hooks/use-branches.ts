import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { branchesApi, type BranchDto } from "@/lib/branches.api";
import { useAuthStore } from "@/store/auth.store";
import { useBranchStore } from "@/store/branch.store";

export interface CurrentBranch {
  branchId: string | null;
  branchName: string;
  /** Branches this user may work at: every branch when unrestricted, only assigned ones otherwise. */
  options: BranchDto[];
  restricted: boolean;
  /** True while the branch list is still loading -- screens should wait rather than flash a chooser. */
  loading: boolean;
  setBranchId: (id: string | null) => void;
}

/** Same rules as the web's useCurrentBranch: a user with branch assignments is held to them and
 *  starts on their first one; an unrestricted user picks. */
export function useCurrentBranch(): CurrentBranch {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const all = useQuery({ queryKey: ["branches", "all"], queryFn: branchesApi.getAll, enabled: signedIn, staleTime: 5 * 60_000 });
  const mine = useQuery({ queryKey: ["branches", "mine"], queryFn: branchesApi.mine, enabled: signedIn, staleTime: 5 * 60_000 });
  const { branchId, setBranchId } = useBranchStore();

  const assigned = mine.data ?? [];
  const restricted = assigned.length > 0;
  const options = restricted ? (all.data ?? []).filter((b) => assigned.some((m) => m.branchId === b.id)) : (all.data ?? []);

  useEffect(() => {
    if (all.isLoading || mine.isLoading) return;
    // A stored branch that no longer exists (or this user may not use) is dropped.
    if (branchId && !options.some((o) => o.id === branchId)) setBranchId(restricted ? (options[0]?.id ?? null) : null);
    else if (!branchId && restricted && options[0]) setBranchId(options[0].id);
    // A workspace with exactly one branch never needs asking.
    else if (!branchId && options.length === 1) setBranchId(options[0].id);
  }, [all.isLoading, mine.isLoading, branchId, options, restricted, setBranchId]);

  return {
    branchId,
    branchName: options.find((o) => o.id === branchId)?.name ?? "",
    options,
    restricted,
    loading: all.isLoading || mine.isLoading,
    setBranchId,
  };
}
