/**
 * TypeScript mirrors of the Sales microservice DTOs.
 * Orders/Quotations reuse the shapes from lib/pos/types — they are identical.
 */

export interface SalesCustomerDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  notes: string | null;
  isActive: boolean;
  orderCount: number;
  quotationCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertCustomerRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

// Re-export POS types that share the same shape as Sales service responses
export type {
  SalesOrderDto,
  SalesOrderSummaryDto,
  SalesOrderItemDto,
  SalesQuotationDto,
  SalesQuotationSummaryDto,
  SalesQuotationItemDto,
} from "@/lib/pos/types";
