import { rawApiClient } from "@/lib/api-client";
import type { ReportResult } from "@/lib/pos/reports.api";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/inventory/reports`;

export interface InvReportRunParams {
  from?: string;
  to?: string;
  warehouseId?: string;
  categoryId?: string;
  valuationMethod?: string;
  movementType?: string;
  fiscalYear?: string;
  itcStatus?: string;
  writeOffReason?: string;
  fromProvince?: string;
  idleDays?: number;
  expiryWindowDays?: number;
}

export const inventoryReportsApi = {
  /** Run any inventory report by its registry ID. Returns raw JSON result. */
  run: (reportId: string, params: InvReportRunParams = {}): Promise<ReportResult> => {
    const qs = new URLSearchParams();
    if (params.from)              qs.set("from",             params.from);
    if (params.to)                qs.set("to",               params.to);
    if (params.warehouseId)       qs.set("warehouseId",      params.warehouseId);
    if (params.categoryId)        qs.set("categoryId",       params.categoryId);
    if (params.valuationMethod)   qs.set("valuationMethod",  params.valuationMethod);
    if (params.movementType)      qs.set("movementType",     params.movementType);
    if (params.fiscalYear)        qs.set("fiscalYear",       params.fiscalYear);
    if (params.itcStatus)         qs.set("itcStatus",        params.itcStatus);
    if (params.writeOffReason)    qs.set("writeOffReason",   params.writeOffReason);
    if (params.fromProvince)      qs.set("fromProvince",     params.fromProvince);
    if (params.idleDays != null)  qs.set("idleDays",         String(params.idleDays));
    if (params.expiryWindowDays != null) qs.set("expiryWindowDays", String(params.expiryWindowDays));
    return rawApiClient.get<ReportResult>(`${BASE}/${encodeURIComponent(reportId)}?${qs}`);
  },
};
