import { apiClient, type PagedResult } from "@/lib/api-client";

export interface BranchDto {
  id: string;
  code: string;
  name: string;
  type: string;
  city: string;
  status: string;
  currency: string;
}

/** Appends ?branchId= (or &branchId=) when a branch is chosen; nothing otherwise. */
export function withBranch(url: string, branchId: string | null | undefined): string {
  if (!branchId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}branchId=${encodeURIComponent(branchId)}`;
}

export const branchesApi = {
  getAll: async (): Promise<BranchDto[]> => {
    const page = await apiClient.get<PagedResult<BranchDto>>("/api/branches?page=1&pageSize=100");
    return (page.items ?? []).filter((b) => b.status !== "inactive");
  },
  /** The caller's own branch assignments -- empty means unrestricted (every branch). */
  mine: (): Promise<{ branchId: string }[]> => apiClient.get("/api/restaurant/user-branches/mine"),
};
