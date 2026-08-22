import * as React from "react";
import { toCsv, downloadFile } from "@/lib/csv";
import { exportPdf } from "@/lib/pdf";

/**
 * What a report panel hands up so the hub's single Export button can serve any report.
 * Panels register this whenever their data changes; the hub renders one ExportMenu.
 */
export interface ReportExportPayload {
  title:     string;
  subtitle?: string;
  columns:   string[];
  rows:      (string | number | null | undefined)[][];
  landscape?: boolean;
}

export type RegisterExport = (payload: ReportExportPayload | null) => void;

/**
 * Registers the panel's export payload with the hub and clears it on unmount, so switching reports
 * can never leave the Export button pointing at the previous report's data.
 *
 * `payload` is rebuilt on every render, so it is compared by content rather than identity — passing
 * it straight into a dependency array would re-register (and re-render the hub) on every tick.
 */
export function useRegisterExport(register: RegisterExport, payload: ReportExportPayload | null) {
  // Includes the subtitle: changing the filter can leave the numbers identical while the range
  // description changes, and an export must never be stamped with the previous filter's scope.
  const signature = payload
    ? [payload.title, payload.subtitle ?? "", payload.columns.join(","), payload.rows.length,
       JSON.stringify(payload.rows[0] ?? []), JSON.stringify(payload.rows.at(-1) ?? [])].join("|")
    : "none";

  const latest = React.useRef(payload);
  latest.current = payload;

  React.useEffect(() => {
    register(latest.current);
    return () => register(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, register]);
}

function stamp(): string {
  return new Date().toISOString().split("T")[0];
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function exportPayloadCsv(payload: ReportExportPayload) {
  const objects = payload.rows.map(row =>
    Object.fromEntries(payload.columns.map((c, i) => [c, row[i] ?? ""])),
  );
  downloadFile(`${slug(payload.title)}_${stamp()}.csv`, toCsv(objects, payload.columns));
}

export function exportPayloadPdf(payload: ReportExportPayload) {
  exportPdf({
    title:    payload.title,
    subtitle: payload.subtitle,
    columns:  payload.columns,
    rows:     payload.rows,
    landscape: payload.landscape ?? payload.columns.length > 6,
  });
}
