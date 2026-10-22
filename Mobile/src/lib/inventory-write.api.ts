import { apiClient } from "@/lib/api-client";

const BASE = "/api/inventory";

export const INVENTORY_PRODUCTS_CREATE = ["inventory.stock.create"];
export const INVENTORY_MOVEMENTS_CREATE = ["inventory.movements.create"];
export const INVENTORY_TRANSFERS_CREATE = ["inventory.transfers.create"];
export const INVENTORY_TRANSFERS_APPROVE = ["inventory.transfers.approve"];

export interface CategoryLite {
  id: string;
  name: string;
  code: string | null;
}

export type MovementType = "Receipt" | "WriteOff" | "Adjustment";

export interface TransferLite {
  id: string;
  transferNumber: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  status: string;
  requestedBy: string;
  expectedDate: string;
  totalValue: number;
  items: { itemName: string; quantity: number }[];
}

export const inventoryWriteApi = {
  getCategories: (): Promise<CategoryLite[]> => apiClient.get(`${BASE}/categories?isActive=true`),

  createProduct: (p: {
    name: string; sku: string | null; barcode: string | null; categoryId: string; salePrice: number; costPrice: number;
    taxRate: number; unit: string; openingStock: number; reorderLevel: number; trackInventory: boolean;
  }) => apiClient.post<{ id: string; name: string }>(`${BASE}/products`, p),

  /** Quantity is positive for Receipt / WriteOff (the type decides direction) and signed for Adjustment. */
  createMovement: (m: {
    productId: string; movementType: MovementType; quantity: number; unitCost: number; warehouseId: string | null;
    reference: string | null; notes: string | null;
  }) => apiClient.post<{ id: string }>(`${BASE}/stock-movements`, m),

  getTransfers: (status?: string): Promise<{ items: TransferLite[] }> =>
    apiClient.get(`${BASE}/transfers?page=1&pageSize=30${status ? `&status=${status}` : ""}`),

  createTransfer: (t: {
    fromWarehouseId: string; fromWarehouseName: string; toWarehouseId: string; toWarehouseName: string;
    requestedBy: string; expectedDate: string; notes: string | null;
    items: { stockItemId: string; itemName: string; sku: string; quantity: number; unitCost: number }[];
  }) => apiClient.post<{ id: string }>(`${BASE}/transfers`, t),

  submitTransfer: (id: string): Promise<void> => apiClient.post(`${BASE}/transfers/${id}/submit`),
  approveTransfer: (id: string, by: string): Promise<void> => apiClient.post(`${BASE}/transfers/${id}/approve`, { by }),
  receiveTransfer: (id: string): Promise<void> => apiClient.post(`${BASE}/transfers/${id}/receive`),
};
