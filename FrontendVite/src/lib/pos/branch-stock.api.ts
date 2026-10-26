import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/pos-dashboard`;

export interface BranchStockRowDto {
  productId: string;
  productName: string;
  sku: string | null;
  unit: string;
  reorderLevel: number;
  branchId: string;
  branchName: string;
  stockQuantity: number;
  asOf: string | null;
}

export const branchStockApi = {
  get: (search?: string, branchId?: string): Promise<BranchStockRowDto[]> => {
    const q = new URLSearchParams();
    if (search?.trim()) q.set("search", search.trim());
    if (branchId) q.set("branchId", branchId);
    const qs = q.toString();
    return apiClient.get<BranchStockRowDto[]>(`${BASE}/branch-stock${qs ? `?${qs}` : ""}`);
  },
};
