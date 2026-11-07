import { apiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/admin/catalogue-move`;

/**
 * Moving a workspace's product catalogue from the POS schema into Inventory (the single source of truth
 * for products and stock). Platform operators only — see docs/product-catalogue-unification.md.
 */

export interface MoveRecord {
  movedAt: string; movedBy: string; productsMoved: number; alreadyThere: number;
  categoriesCreated: number; warehousesCreated: number; stockBuckets: number;
}

export interface MoveStatus {
  tenantId: string; tenantName: string;
  /** on_pos | on_inventory | empty */
  state: "on_pos" | "on_inventory" | "empty";
  posProducts: number; inventoryProducts: number; lastMove: MoveRecord | null;
}

export interface Clash { posProductId: string; posName: string; value: string; inventoryProductId: string; inventoryName: string }
export interface MoveBranch { branchId: string; name: string; hasWarehouse: boolean; products: number; units: number }

export interface MovePreview {
  tenantId: string; tenantName: string; state: MoveStatus["state"];
  canMove: boolean; blockers: string[]; warnings: string[];
  counts: { posProducts: number; alreadyInInventory: number; categoriesUsed: number; categoriesToCreate: number; productsWithBranchStock: number; negativeStock: number };
  headOfficeUnits: number; branchUnits: number; mainWarehouseWillBeCreated: boolean;
  branches: MoveBranch[]; skuClashes: Clash[]; barcodeClashes: Clash[];
}

export const catalogueMoveApi = {
  status:  (tenantId: string): Promise<MoveStatus>  => apiClient.get<MoveStatus>(`${BASE}/${tenantId}`),
  preview: (tenantId: string): Promise<MovePreview> => apiClient.get<MovePreview>(`${BASE}/${tenantId}/preview`),
  run:     (tenantId: string): Promise<MoveRecord>  => apiClient.post<MoveRecord>(`${BASE}/${tenantId}/run`),
};
