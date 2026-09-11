/**
 * Trimmed mirror of the Inventory service's DTOs (Softaxis.Inventory.Application.DTOs.InventoryDtos
 * and ProductStock/Dtos/ProductStockDtos.cs). Read-only "stock lookup" for v1 -- see
 * Mobile/README.md for what's explicitly out of scope.
 */
export interface ProductSummaryDto {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId: string;
  categoryName: string;
  brandId?: string | null;
  brandName?: string | null;
  unitOfMeasureId?: string | null;
  unitOfMeasureSymbol?: string | null;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  trackInventory: boolean;
  isLowStock: boolean;
  imageUrl?: string | null;
  createdAt: string;
}

export interface ProductDto extends ProductSummaryDto {
  description?: string | null;
  updatedAt?: string | null;
}

export interface WarehouseStockDto {
  warehouseId: string;
  warehouseName: string;
  warehouseCode?: string | null;
  quantity: number;
  reorderLevel: number;
  isLowStock: boolean;
  isDefault: boolean;
}

export interface ProductStockSummaryDto {
  productId: string;
  totalOnHand: number;
  warehouses: WarehouseStockDto[];
}

export interface WarehouseDto {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  isActive: boolean;
  isDefault: boolean;
  movementCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProductsPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isLowStock?: boolean;
}
