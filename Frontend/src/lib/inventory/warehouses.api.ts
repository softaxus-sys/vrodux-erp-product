import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/inventory/warehouses`;

export type WarehouseType   = "main" | "transit" | "cold_storage" | "bonded";
export type WarehouseStatus = "active" | "inactive";

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  locationCity: string;
  locationAddress: string;
  manager: string;
  managerPhone: string;
  managerEmail: string;
  capacity: number;
  utilized: number;
  utilizationPct: number;
  status: WarehouseStatus;
  zones: string[];
  totalSKUs: number;
  totalValue: number;
  lastAudit: string;
  nextAudit: string;
}

export interface WarehouseSummaryDto {
  total: number;
  active: number;
  totalCapacity: number;
  totalUtilized: number;
  avgUtilization: number;
  totalSKUs: number;
  totalValue: number;
}

export interface CreateWarehouseRequest {
  code: string;
  name: string;
  type: WarehouseType;
  locationCity: string;
  locationAddress: string;
  manager: string;
  managerPhone: string;
  managerEmail: string;
  capacity: number;
  zones?: string[];
}

export const warehousesApi = {
  getAll: (): Promise<WarehouseDto[]> =>
    rawApiClient.get<WarehouseDto[]>(BASE),

  getById: (id: string): Promise<WarehouseDto> =>
    rawApiClient.get<WarehouseDto>(`${BASE}/${id}`),

  create: (data: CreateWarehouseRequest): Promise<WarehouseDto> =>
    rawApiClient.post<WarehouseDto>(BASE, data),

  getSummary: (): Promise<WarehouseSummaryDto> =>
    rawApiClient.get<WarehouseSummaryDto>(`${BASE}/summary`),
};
