import { apiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/admin/storage-usage`;

/**
 * Super-admin: per-tenant breakdown of the shared object-storage bucket against its provisioned
 * budget. Visibility only — nothing here enforces a cap. Only counts bytes actually living in the
 * bucket (a document stored the legacy, pre-object-storage way isn't using the bucket budget at
 * all, so it's excluded). Best-effort, not an audit: a bucket delete that failed silently would
 * leave an orphaned object neither this screen nor the database knows about.
 */

export interface TenantStorageUsageDto {
  tenantId: string;
  tenantName: string;
  plan: string;
  hrBytes: number;
  crmBytes: number;
  supportBytes: number;
  realEstateBytes: number;
  totalBytes: number;
}

export interface StorageUsageDto {
  budgetBytes: number;
  totalBytes: number;
  tenants: TenantStorageUsageDto[];
}

export const storageUsageApi = {
  get: (): Promise<StorageUsageDto> => apiClient.get(BASE),
};
