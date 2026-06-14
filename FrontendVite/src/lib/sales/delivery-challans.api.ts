import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/sales/delivery-challans`;

export interface DeliveryChallanItemDto {
  id: string;
  salesOrderItemId: string | null;
  productId: string | null;
  description: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DeliveryChallanDto {
  id: string;
  challanNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerId: string | null;
  customerName: string;
  challanDate: string;
  driverName: string | null;
  notes: string | null;
  status: string;
  items: DeliveryChallanItemDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface DeliveryChallanSummaryDto {
  id: string;
  challanNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerId: string | null;
  customerName: string;
  challanDate: string;
  driverName: string | null;
  status: string;
  itemCount: number;
  createdAt: string;
}

export interface DeliveryChallanItemRequest {
  salesOrderItemId?: string | null;
  productId?: string | null;
  description: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  unitPrice: number;
}

export interface CreateDeliveryChallanRequest {
  salesOrderId: string;
  challanDate: string;
  driverName?: string | null;
  notes?: string | null;
  items: DeliveryChallanItemRequest[];
}

export interface GetDeliveryChallansParams {
  salesOrderId?: string;
  customerId?: string;
}

export const deliveryChallansApi = {
  getAll: (params: GetDeliveryChallansParams = {}): Promise<DeliveryChallanSummaryDto[]> => {
    const qs = new URLSearchParams();
    if (params.salesOrderId) qs.set("salesOrderId", params.salesOrderId);
    if (params.customerId)   qs.set("customerId", params.customerId);
    const query = qs.toString();
    return rawApiClient.get<DeliveryChallanSummaryDto[]>(`${BASE}${query ? `?${query}` : ""}`);
  },

  getById: (id: string): Promise<DeliveryChallanDto> =>
    rawApiClient.get<DeliveryChallanDto>(`${BASE}/${id}`),

  create: (payload: CreateDeliveryChallanRequest): Promise<DeliveryChallanDto> =>
    rawApiClient.post<DeliveryChallanDto>(BASE, payload),
};
