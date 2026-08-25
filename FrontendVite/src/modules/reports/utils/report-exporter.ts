import { parseApiDate } from "@/lib/utils";
/**
 * Branded report export utilities — PDF, Excel (HTML), CSV, XML.
 *
 * Every format includes a company header with:
 *   - Company name + legal name + contact details
 *   - TRN / VAT registration number
 *   - Report title, period, country, compliance reference
 *   - Brand primary colour applied to table headers / accents
 */

import type { ReportResult }                    from "@/lib/pos/reports.api";
import type { ReportDefinition, CountryConfig } from "../config/report-registry";

// ── Public types ──────────────────────────────────────────────────────────────

export interface TenantInfo {
  companyName:     string;
  legalName?:      string;
  address?:        string;
  phone?:          string;
  email?:          string;
  website?:        string;
  registrationNo?: string;
  vatTrn?:         string;
  primaryColor:    string;   // hex, e.g. "#2563eb"
  currency?:       string;
  country?:        string;
}

export interface ExportOptions {
  result:     ReportResult;
  report:     ReportDefinition;
  country:    CountryConfig;
  tenant:     TenantInfo;
  dateRange?: { from: string; to: string };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function ini(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join("").slice(0, 2);
}

function slug(s: string): string { return s.replace(/[^a-z0-9]/gi, "_"); }

function todayIso(): string { return new Date().toISOString().split("T")[0]; }

function nowStr(): string {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  try {
    return parseApiDate(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

/** Lighten hex by blending with white (factor 0–1). */
function lighten(hex: string, f: number): string {
  const c = hex.replace(/^#/, "");
  const mix = (n: number) => Math.round(parseInt(c.slice(n, n + 2), 16) + (255 - parseInt(c.slice(n, n + 2), 16)) * f)
    .toString(16).padStart(2, "0");
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

function dl(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

/** Escape for HTML output. */
function eh(v: unknown): string {
  return String(v ?? "—")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Escape for XML PCDATA. */
function ex(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Make a valid XML element name from a column string. */
function xt(s: string): string {
  const c = s.replace(/[^a-z0-9_]/gi, "_");
  return /^[0-9]/.test(c) ? `_${c}` : c;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF  (browser window.print)
// ─────────────────────────────────────────────────────────────────────────────

export function exportPdf({ result, report, country, tenant, dateRange }: ExportOptions): void {
  const pc     = tenant.primaryColor || "#2563eb";
  const pcL    = lighten(pc, 0.91);   // very light tint for alt rows
  const pcL2   = lighten(pc, 0.82);   // slightly stronger for compliance chip

  const colsHtml = result.columns.map(c => `<th>${eh(c)}</th>`).join("");
  const rowsHtml = result.rows.map((row, i) =>
    `<tr class="${i % 2 === 0 ? "odd" : "even"}">${
      result.columns.map(col => `<td>${eh(row[col])}</td>`).join("")
    }</tr>`
  ).join("");

  const periodHtml = dateRange
    ? `<span class="chip">${fmtDate(dateRange.from)}&nbsp;&ndash;&nbsp;${fmtDate(dateRange.to)}</span>`
    : "";

  const contactRows = [
    tenant.address        && `<div class="ci"><span class="cl">Address:</span> ${eh(tenant.address)}</div>`,
    tenant.phone          && `<div class="ci"><span class="cl">Phone:</span> ${eh(tenant.phone)}</div>`,
    tenant.email          && `<div class="ci"><span class="cl">Email:</span> ${eh(tenant.email)}</div>`,
    tenant.website        && `<div class="ci"><span class="cl">Web:</span> ${eh(tenant.website)}</div>`,
    tenant.registrationNo && `<div class="ci"><span class="cl">Reg.No.:</span> ${eh(tenant.registrationNo)}</div>`,
  ].filter(Boolean).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${eh(report.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:9.5pt;color:#1e293b;background:#fff}
.page{padding:24px 30px}

/* ── Company header ── */
.hdr{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
.logo{width:50px;height:50px;border-radius:10px;background:${pc};color:#fff;
  font-size:18pt;font-weight:900;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;letter-spacing:-1px;user-select:none}
.hdr-body{flex:1}
.co-name{font-size:15pt;font-weight:800;color:${pc};letter-spacing:-.4px;line-height:1.15}
.co-legal{font-size:8.5pt;color:#64748b;margin-top:2px}
.contacts{display:flex;flex-wrap:wrap;gap:2px 18px;margin-top:6px}
.ci{font-size:8pt;color:#475569}
.cl{font-weight:600;color:#334155}
.trn{display:inline-flex;align-items:center;gap:5px;margin-top:7px;
  background:${pcL};color:${pc};font-size:8pt;font-weight:700;
  padding:3px 10px;border-radius:20px;border:1px solid ${pc}40}

/* ── Divider ── */
.div{border:none;border-top:2.5px solid ${pc};margin:15px 0 11px}

/* ── Report title block ── */
.rttl{display:flex;align-items:center;gap:9px;margin-bottom:7px}
.accent{width:4px;height:21px;background:${pc};border-radius:2px;flex-shrink:0}
.title{font-size:12.5pt;font-weight:700;color:#0f172a}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-left:13px;margin-bottom:13px}
.chip{font-size:7.5pt;color:#64748b;background:#f1f5f9;
  padding:2px 8px;border-radius:10px;border:1px solid #e2e8f0}
.chip.comp{background:${pcL2};color:${pc};border-color:${pc}30;font-weight:700}

/* ── Table ── */
table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:2px}
thead th{background:${pc};color:#fff;padding:7px 9px;text-align:left;
  font-weight:600;font-size:8pt;letter-spacing:.25px;white-space:nowrap}
thead th:first-child{border-radius:4px 0 0 4px}
thead th:last-child{border-radius:0 4px 4px 0}
tr.odd td{background:#fff}
tr.even td{background:${pcL}}
td{padding:5px 9px;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap}
tbody tr:last-child td{border-bottom:none}

/* ── Footer ── */
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;
  display:flex;justify-content:space-between;align-items:flex-end}
.fl{font-size:7.5pt;color:#94a3b8}
.fr{font-size:7.5pt;color:#94a3b8;text-align:right;line-height:1.5}
.fr b{color:${pc}}

@media print{
  @page{margin:12mm}
  body{font-size:9pt}
  .page{padding:0}
}
</style>
</head>
<body>
<div class="page">

  <!-- Company Header -->
  <div class="hdr">
    <div class="logo">${ini(tenant.companyName)}</div>
    <div class="hdr-body">
      <div class="co-name">${eh(tenant.companyName)}</div>
      ${tenant.legalName ? `<div class="co-legal">${eh(tenant.legalName)}</div>` : ""}
      <div class="contacts">${contactRows}</div>
      ${tenant.vatTrn ? `<div class="trn">&#9679;&nbsp;TRN&nbsp;/&nbsp;VAT:&nbsp;<strong>${eh(tenant.vatTrn)}</strong></div>` : ""}
    </div>
  </div>

  <hr class="div" />

  <!-- Report Title -->
  <div class="rttl">
    <div class="accent"></div>
    <div class="title">${eh(report.title)}</div>
  </div>
  <div class="chips">
    ${periodHtml}
    <span class="chip">${eh(country.flag)}&nbsp;${eh(country.name)}</span>
    <span class="chip">Currency:&nbsp;${eh(country.currency)}</span>
    <span class="chip">Generated:&nbsp;${nowStr()}</span>
    ${report.complianceRef ? `<span class="chip comp">${eh(report.complianceRef)}</span>` : ""}
  </div>

  <!-- Data Table -->
  <table>
    <thead><tr>${colsHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <!-- Footer -->
  <div class="footer">
    <div class="fl">
      Total:&nbsp;<strong>${result.totalCount}</strong>&nbsp;records
      &nbsp;&middot;&nbsp;${eh(report.description)}
    </div>
    <div class="fr">
      Generated by&nbsp;<b>${eh(tenant.companyName)}</b><br>
      ${nowStr()}&nbsp;&middot;&nbsp;Confidential
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel  (HTML-in-XLS with Microsoft Office namespace — styled)
// ─────────────────────────────────────────────────────────────────────────────

export function exportExcel({ result, report, country, tenant, dateRange }: ExportOptions): void {
  const pc   = tenant.primaryColor || "#2563eb";
  const pcL  = lighten(pc, 0.91);
  const n    = result.columns.length;

  const half  = Math.ceil(n / 2);
  const other = Math.max(n - half, 1);

  const periodText = dateRange
    ? `${fmtDate(dateRange.from)} to ${fmtDate(dateRange.to)}`
    : "All dates";

  // Inline-styled header rows (Excel CSS class support is unreliable)
  const S = {
    coName:   `font-family:Calibri,Arial,sans-serif;font-size:16pt;font-weight:bold;color:${pc};padding:8px 10px`,
    legal:    `font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#64748b;padding:2px 10px`,
    contact:  `font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#475569;padding:2px 10px`,
    trn:      `font-family:Calibri,Arial,sans-serif;font-size:9pt;font-weight:bold;color:${pc};padding:3px 10px`,
    rTitle:   `font-family:Calibri,Arial,sans-serif;font-size:13pt;font-weight:bold;color:#0f172a;padding:5px 10px`,
    rMeta:    `font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#64748b;padding:2px 10px`,
    rRight:   `font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#64748b;padding:2px 10px;text-align:right`,
    compRef:  `font-family:Calibri,Arial,sans-serif;font-size:9pt;font-weight:bold;color:${pc};padding:2px 10px`,
    thCell:   `font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;background:${pc};color:#ffffff;padding:6px 10px;white-space:nowrap`,
    tdOdd:    `font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#334155;background:#ffffff;padding:4px 10px;border-bottom:1px solid #e2e8f0`,
    tdEven:   `font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#334155;background:${pcL};padding:4px 10px;border-bottom:1px solid #e2e8f0`,
    footer:   `font-family:Calibri,Arial,sans-serif;font-size:8.5pt;color:#94a3b8;padding:5px 10px`,
    sep:      `height:10pt`,
    rule:     `border-top:2px solid ${pc}`,
  };

  const colHeaders = result.columns.map(c => `<td style="${S.thCell}">${eh(c)}</td>`).join("");
  const dataRows = result.rows.map((row, i) =>
    `<tr>${result.columns.map(col =>
      `<td style="${i % 2 === 0 ? S.tdOdd : S.tdEven}">${eh(row[col])}</td>`
    ).join("")}</tr>`
  ).join("");

  const headerBlock = [
    // Company name
    `<tr><td colspan="${n}" style="${S.coName}">${eh(tenant.companyName)}</td></tr>`,
    // Legal name
    tenant.legalName
      ? `<tr><td colspan="${n}" style="${S.legal}">${eh(tenant.legalName)}</td></tr>`
      : "",
    // Address + Phone
    (tenant.address || tenant.phone)
      ? `<tr>
          <td colspan="${half}" style="${S.contact}"><b>Address:</b> ${eh(tenant.address ?? "")}</td>
          <td colspan="${other}" style="${S.contact}"><b>Phone:</b> ${eh(tenant.phone ?? "")}</td>
         </tr>`
      : "",
    // Email + Website
    (tenant.email || tenant.website)
      ? `<tr>
          <td colspan="${half}" style="${S.contact}"><b>Email:</b> ${eh(tenant.email ?? "")}</td>
          <td colspan="${other}" style="${S.contact}"><b>Web:</b> ${eh(tenant.website ?? "")}</td>
         </tr>`
      : "",
    // Reg No + VAT TRN
    (tenant.registrationNo || tenant.vatTrn)
      ? `<tr>
          ${tenant.registrationNo ? `<td colspan="${half}" style="${S.contact}"><b>Reg.No.:</b> ${eh(tenant.registrationNo)}</td>` : `<td colspan="${half}"></td>`}
          ${tenant.vatTrn ? `<td colspan="${other}" style="${S.trn}">TRN / VAT: ${eh(tenant.vatTrn)}</td>` : `<td colspan="${other}"></td>`}
         </tr>`
      : "",
    // Rule separator
    `<tr><td colspan="${n}" style="${S.rule}"></td></tr>`,
    `<tr><td colspan="${n}" style="${S.sep}"></td></tr>`,
    // Report title + period
    `<tr>
      <td colspan="${half}" style="${S.rTitle}">${eh(report.title)}</td>
      <td colspan="${other}" style="${S.rRight}">Period: ${eh(periodText)}</td>
     </tr>`,
    // Description + country
    `<tr>
      <td colspan="${half}" style="${S.rMeta}">${eh(report.description)}</td>
      <td colspan="${other}" style="${S.rRight}">${eh(country.flag)} ${eh(country.name)} · ${eh(country.currency)}</td>
     </tr>`,
    // Compliance ref
    report.complianceRef
      ? `<tr><td colspan="${n}" style="${S.compRef}">${eh(report.complianceRef)}</td></tr>`
      : "",
    `<tr><td colspan="${n}" style="${S.sep}"></td></tr>`,
  ].filter(Boolean).join("\n");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
</head>
<body>
<table>
${headerBlock}
<tr>${colHeaders}</tr>
${dataRows}
<tr><td colspan="${n}" style="${S.sep}"></td></tr>
<tr><td colspan="${n}" style="${S.footer}">
  Total: ${result.totalCount} records &nbsp;&middot;&nbsp;
  Generated: ${nowStr()} &nbsp;&middot;&nbsp;
  ${eh(tenant.companyName)} &nbsp;&middot;&nbsp; Confidential
</td></tr>
</table>
</body>
</html>`;

  const blob = new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  dl(blob, `${slug(report.title)}_${todayIso()}.xls`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV  (RFC 4180 + comment header block)
// ─────────────────────────────────────────────────────────────────────────────

export function exportCsv({ result, report, country, tenant, dateRange }: ExportOptions): void {
  const lines: string[] = [];

  // ── Company header (# comment lines — compatible with Excel, Numbers, etc.) ─
  lines.push(`# ${tenant.companyName}`);
  if (tenant.legalName && tenant.legalName !== tenant.companyName)
    lines.push(`# Legal Name: ${tenant.legalName}`);
  if (tenant.address)        lines.push(`# Address: ${tenant.address}`);
  if (tenant.phone)          lines.push(`# Phone: ${tenant.phone}`);
  if (tenant.email)          lines.push(`# Email: ${tenant.email}`);
  if (tenant.website)        lines.push(`# Website: ${tenant.website}`);
  if (tenant.registrationNo) lines.push(`# Registration No.: ${tenant.registrationNo}`);
  if (tenant.vatTrn)         lines.push(`# TRN / VAT No.: ${tenant.vatTrn}`);
  lines.push("#");

  // ── Report metadata ──────────────────────────────────────────────────────────
  lines.push(`# Report: ${report.title}`);
  lines.push(`# Description: ${report.description}`);
  if (dateRange)
    lines.push(`# Period: ${fmtDate(dateRange.from)} to ${fmtDate(dateRange.to)}`);
  lines.push(`# Country: ${country.flag} ${country.name}`);
  lines.push(`# Currency: ${country.currency}`);
  if (report.complianceRef) lines.push(`# Compliance: ${report.complianceRef}`);
  if (report.regulator)     lines.push(`# Regulator: ${report.regulator}`);
  lines.push(`# Generated: ${nowStr()}`);
  lines.push(`# Total Records: ${result.totalCount}`);
  lines.push("#");

  // ── Column headers ───────────────────────────────────────────────────────────
  lines.push(result.columns.map(c => `"${c}"`).join(","));

  // ── Data rows ────────────────────────────────────────────────────────────────
  for (const row of result.rows) {
    lines.push(
      result.columns.map(col => {
        const v = row[col];
        if (v == null) return "";
        if (typeof v === "string") return `"${v.replace(/"/g, '""')}"`;
        return String(v);
      }).join(",")
    );
  }

  // UTF-8 BOM so Excel opens correctly
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  dl(blob, `${slug(report.title)}_${todayIso()}.csv`);
}

// ─────────────────────────────────────────────────────────────────────────────
// XML  (structured envelope with <tenant> + <metadata> + <data> sections)
// ─────────────────────────────────────────────────────────────────────────────

export function exportXml({ result, report, country, tenant, dateRange }: ExportOptions): void {
  const iso = new Date().toISOString();

  const tenantBlock = `  <tenant>
    <companyName>${ex(tenant.companyName)}</companyName>
    ${tenant.legalName      ? `<legalName>${ex(tenant.legalName)}</legalName>\n    ` : ""}${tenant.address       ? `<address>${ex(tenant.address)}</address>\n    ` : ""}${tenant.phone         ? `<phone>${ex(tenant.phone)}</phone>\n    ` : ""}${tenant.email         ? `<email>${ex(tenant.email)}</email>\n    ` : ""}${tenant.website       ? `<website>${ex(tenant.website)}</website>\n    ` : ""}${tenant.registrationNo? `<registrationNo>${ex(tenant.registrationNo)}</registrationNo>\n    ` : ""}${tenant.vatTrn        ? `<vatTrn>${ex(tenant.vatTrn)}</vatTrn>\n    ` : ""}${tenant.country       ? `<country>${ex(tenant.country)}</country>\n    ` : ""}${tenant.currency      ? `<currency>${ex(tenant.currency)}</currency>` : ""}
  </tenant>`;

  const metaBlock = `  <metadata>
    <reportTitle>${ex(report.title)}</reportTitle>
    <description>${ex(report.description)}</description>
    ${dateRange ? `<period from="${ex(dateRange.from)}" to="${ex(dateRange.to)}" />` : ""}
    <country name="${ex(country.name)}" flag="${ex(country.flag)}" currency="${ex(country.currency)}" />
    ${report.complianceRef ? `<complianceRef>${ex(report.complianceRef)}</complianceRef>` : ""}
    ${report.regulator     ? `<regulator>${ex(report.regulator)}</regulator>` : ""}
    <generated>${iso}</generated>
    <generatedBy>${ex(tenant.companyName)}</generatedBy>
  </metadata>`;

  const dataBlock = `  <data totalCount="${result.totalCount}" columns="${result.columns.map(ex).join(",")}">
${result.rows.map(row =>
    `    <row>\n${result.columns.map(col =>
      `      <${xt(col)}>${ex(row[col])}</${xt(col)}>`
    ).join("\n")}\n    </row>`
  ).join("\n")}
  </data>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<report title="${ex(report.title)}" generated="${iso}" totalCount="${result.totalCount}">
${tenantBlock}
${metaBlock}
${dataBlock}
</report>`;

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  dl(blob, `${slug(report.title)}_${todayIso()}.xml`);
}
