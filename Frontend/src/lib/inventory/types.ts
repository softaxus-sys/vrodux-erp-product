/**
 * TypeScript mirrors of the Inventory microservice DTOs.
 */

export interface ProductCategoryDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface BrandDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface UnitOfMeasureDto {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  unitOfMeasureId: string | null;
  unitOfMeasureSymbol: string | null;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  trackInventory: boolean;
  isLowStock: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductSummaryDto {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  unitOfMeasureId: string | null;
  unitOfMeasureSymbol: string | null;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  trackInventory: boolean;
  isLowStock: boolean;
  imageUrl: string | null;
  createdAt: string;
}

export interface WarehouseDto {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
  isDefault: boolean;
  movementCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  productSKU: string | null;
  movementType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reference: string | null;
  notes: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  movedAt: string;
  createdAt: string;
}

/** Fixed movement type constants — mirrors backend MovementTypes class. */
export const MovementType = {
  Receipt:    "Receipt",
  Sale:       "Sale",
  Adjustment: "Adjustment",
  Transfer:   "Transfer",
  WriteOff:   "WriteOff",
  Return:     "Return",
} as const;

export type MovementType = (typeof MovementType)[keyof typeof MovementType];
