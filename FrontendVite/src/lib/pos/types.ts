/**
 * TypeScript mirrors of the POS microservice DTOs.
 */

// ── Products ─────────────────────────────────────────────────────────────────

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  categoryName: string;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  trackInventory: boolean;
  isActive: boolean;
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
  categoryName: string;
  salePrice: number;
  taxRate: number;
  stockQuantity: number;
  unit: string;
  isActive: boolean;
  isLowStock: boolean;
  reorderLevel: number;
  costPrice: number;
}

export interface ProductCategoryDto {
  id: string;
  name: string;
  description: string | null;
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  adjustmentType: string;
  quantity: number;
  balanceAfter: number;
  reference: string | null;
  createdAt: string;
  notes: string | null;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface POSSessionDto {
  id: string;
  cashierId: string;
  registerId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashVariance: number;
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  netSales: number;
  notes: string | null;
}

export interface POSSessionSummaryDto {
  id: string;
  registerId: string;
  status: string;
  openedAt: string;
  totalTransactions: number;
  netSales: number;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface POSLineItemDto {
  id: string;
  productId: string;
  productName: string;
  productSKU: string | null;
  productBarcode: string | null;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  unit: string;
}

export interface POSPaymentDto {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
}

export interface POSTransactionDto {
  id: string;
  transactionNumber: string;
  sessionId: string;
  cashierId: string;
  customerId: string | null;
  customerName: string | null;
  type: string;
  status: string;
  originalTxnId: string | null;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  notes: string | null;
  completedAt: string;
  lineItems: POSLineItemDto[];
  payments: POSPaymentDto[];
}

export interface POSTransactionSummaryDto {
  id: string;
  transactionNumber: string;
  customerName: string | null;
  type: string;
  status: string;
  totalAmount: number;
  primaryPaymentMethod: string;
  completedAt: string;
}

export interface HeldTransactionDto {
  id: string;
  sessionId: string;
  label: string;
  itemsJson: string;
  customerId: string | null;
  heldAt: string;
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface CustomerDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  loyaltyPoints: number;
  totalPurchases: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface CustomerSummaryDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  loyaltyPoints: number;
  isActive: boolean;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface PaymentMethodSummaryDto {
  method: string;
  count: number;
  amount: number;
}

export interface TopProductDto {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface HourlySalesDto {
  hour: number;
  transactionCount: number;
  salesAmount: number;
}

export interface DailySummaryDto {
  date: string;
  totalTransactions: number;
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  grossSales: number;
  refundAmount: number;
  netSales: number;
  taxCollected: number;
  totalDiscount: number;
  paymentBreakdown: PaymentMethodSummaryDto[];
  topProducts: TopProductDto[];
  hourlySales: HourlySalesDto[];
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export interface VendorDto {
  id: string;
  name: string;
  code: string | null;
  category: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  paymentTerms: string;
  currency: string;
  notes: string | null;
  status: string;
  rating: number;
  purchaseOrderCount: number;
  createdAt: string;
  updatedAt: string | null;
}

// ── Purchase Orders ────────────────────────────────────────────────────────────

export interface PurchaseOrderItemDto {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
}

export interface PurchaseOrderDto {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  notes: string | null;
  expectedDate: string | null;
  receivedDate: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  items: PurchaseOrderItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface PurchaseOrderSummaryDto {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  expectedDate: string | null;
  receivedDate: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string | null;
}

// ── Sales Orders ───────────────────────────────────────────────────────────────

export interface SalesOrderItemDto {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
}

export interface SalesOrderDto {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  notes: string | null;
  expectedDate: string | null;
  deliveredDate: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  items: SalesOrderItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface SalesOrderSummaryDto {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  expectedDate: string | null;
  deliveredDate: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string | null;
}

// ── Sales Quotations ───────────────────────────────────────────────────────────

export interface SalesQuotationItemDto {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
}

export interface SalesQuotationDto {
  id: string;
  quotationNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  notes: string | null;
  discountPercent: number;
  validUntil: string | null;
  convertedOrderId: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  items: SalesQuotationItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface SalesQuotationSummaryDto {
  id: string;
  quotationNumber: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  discountPercent: number;
  validUntil: string | null;
  convertedOrderId: string | null;
  subTotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string | null;
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface LineItemRequest {
  productId: string;
  quantity: number;
  unitPriceOverride?: number | null;
  discountPercent: number;
  discountAmount: number;
}

export interface PaymentRequest {
  method: string;
  amount: number;
  reference?: string | null;
}

export type OrderDiscountType = "none" | "percentage" | "fixed" | "voucher" | "loyalty";

export interface OrderDiscountRequest {
  type: OrderDiscountType;
  value?: number | null;          // percentage (0-100) or fixed currency amount
  voucherCode?: string | null;    // for type=voucher
  loyaltyPoints?: number | null;  // for type=loyalty
}

export interface CreateSaleRequest {
  sessionId: string;
  customerId?: string | null;
  lineItems: LineItemRequest[];
  payments: PaymentRequest[];
  notes?: string | null;
  orderDiscount?: OrderDiscountRequest | null;
}

// ── Vouchers ────────────────────────────────────────────────────────────────

export interface VoucherDto {
  id: string;
  code: string;
  description: string | null;
  valueType: number;               // 1 = Percentage, 2 = FixedAmount
  value: number;
  minSpend: number;
  maxDiscountAmount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface VoucherValidationDto {
  valid: boolean;
  discountAmount: number;
  message: string | null;
  voucher: VoucherDto | null;
}

export interface RefundRequest {
  sessionId: string;
  lineItems: LineItemRequest[];
  payments: PaymentRequest[];
  reason?: string | null;
}

export interface CashMovementDto {
  id: string;
  sessionId: string;
  cashierId: string;
  type: "PayIn" | "PayOut";
  amount: number;
  reason: string;
  createdAt: string;
}

