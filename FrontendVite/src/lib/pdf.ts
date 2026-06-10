/**
 * pdf.ts — Zero-dependency, browser-native PDF export.
 *
 * Opens a styled print window and calls window.print().
 * The user saves as PDF from the browser's print dialog
 * (Chrome/Edge: "Save as PDF" destination is selected by default).
 */

export interface PdfExportOptions {
  /** Report title shown in the header (e.g. "Employee Directory") */
  title: string;
  /** Optional subtitle / filter description (e.g. "Active employees · June 2026") */
  subtitle?: string;
  /** Column header labels — order matches `rows` */
  columns: string[];
  /** Data rows — each row is an array of cell values in column order */
  rows: (string | number | null | undefined)[][];
  /** Landscape orientation? Default false (portrait) */
  landscape?: boolean;
}

// ── Brand tokens ──────────────────────────────────────────────────────────────

const BRAND = {
  primary:     "#3b82f6",   // blue-500
  primaryDark: "#1d4ed8",   // blue-700
  headerBg:    "#0f172a",   // slate-900
  rowAlt:      "#f0f9ff",   // blue-50
  border:      "#e2e8f0",   // slate-200
  textMuted:   "#64748b",   // slate-500
  textBody:    "#1e293b",   // slate-800
};

// ── HTML template ─────────────────────────────────────────────────────────────

function buildHtml(opts: PdfExportOptions): string {
  const { title, subtitle, columns, rows, landscape = false } = opts;
  const now = new Date().toLocaleString("en-AE", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const pageSize = landscape ? "A4 landscape" : "A4 portrait";

  const headerCells = columns
    .map(c => `<th>${escHtml(c)}</th>`)
    .join("");

  const bodyRows = rows
    .map((row, i) => {
      const cells = columns.map((_, ci) => {
        const val = row[ci];
        return `<td>${escHtml(val === null || val === undefined ? "—" : String(val))}</td>`;
      }).join("");
      return `<tr class="${i % 2 === 0 ? "even" : "odd"}">${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(title)} — VroduxERP</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Base ── */
    html { font-size: 11px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Helvetica, Arial, sans-serif;
      color: ${BRAND.textBody};
      background: #ffffff;
      padding: 0;
    }

    /* ── Page header ── */
    .page-header {
      background: ${BRAND.headerBg};
      color: #fff;
      padding: 18px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: ${BRAND.primary};
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 17px; color: #fff;
      flex-shrink: 0;
    }
    .brand-name { font-weight: 700; font-size: 15px; line-height: 1.2; }
    .brand-sub  { font-size: 10px; color: #94a3b8; margin-top: 1px; }
    .report-meta { text-align: right; }
    .report-title { font-weight: 700; font-size: 15px; }
    .report-date  { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    /* ── Info bar ── */
    .info-bar {
      background: #f1f5f9;
      border-bottom: 1.5px solid ${BRAND.border};
      padding: 9px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: ${BRAND.textMuted};
    }
    .info-bar .tag {
      display: inline-flex; align-items: center; gap: 4px;
      background: #dbeafe; color: ${BRAND.primaryDark};
      border-radius: 99px; padding: 2px 8px;
      font-weight: 600; font-size: 9.5px;
    }

    /* ── Table wrapper ── */
    .table-wrap { padding: 20px 28px 0; }

    /* ── Subtitle (filter label above table) ── */
    .subtitle {
      font-size: 10.5px;
      color: ${BRAND.textMuted};
      margin-bottom: 10px;
      padding-left: 2px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr {
      background: ${BRAND.headerBg};
      color: #ffffff;
    }
    thead th {
      padding: 9px 11px;
      text-align: left;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    tbody tr.even { background: #ffffff; }
    tbody tr.odd  { background: ${BRAND.rowAlt}; }
    tbody td {
      padding: 8px 11px;
      border-bottom: 1px solid ${BRAND.border};
      vertical-align: top;
      max-width: 180px;
      word-break: break-word;
    }
    tbody tr:last-child td { border-bottom: none; }

    /* First column slightly bolder */
    tbody td:first-child { font-weight: 500; }

    /* ── Footer ── */
    .page-footer {
      margin: 0 28px;
      padding: 10px 0;
      border-top: 1.5px solid ${BRAND.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 9px;
      color: ${BRAND.textMuted};
      margin-top: 20px;
    }
    .footer-brand { font-weight: 600; color: ${BRAND.primary}; }

    /* ── Print ── */
    @media print {
      @page {
        size: ${pageSize};
        margin: 0;
      }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      .page-header, thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      /* Keep header on every page */
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }

      /* Avoid row breaks mid-content */
      tbody tr { page-break-inside: avoid; }

      /* Page numbers */
      .page-footer::after {
        content: "Page " counter(page) " of " counter(pages);
      }
    }

    /* ── Screen preview ── */
    @media screen {
      body { max-width: ${landscape ? "1100px" : "820px"}; margin: 0 auto; padding: 20px; box-shadow: 0 0 40px rgba(0,0,0,0.12); min-height: 100vh; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="page-header">
    <div class="brand">
      <div class="brand-icon">V</div>
      <div>
        <div class="brand-name">VroduxERP</div>
        <div class="brand-sub">by Softaxis</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">${escHtml(title)}</div>
      <div class="report-date">Generated ${escHtml(now)}</div>
    </div>
  </div>

  <!-- Info bar -->
  <div class="info-bar">
    <span>${subtitle ? escHtml(subtitle) : "&nbsp;"}</span>
    <span class="tag">${rows.length} record${rows.length !== 1 ? "s" : ""}</span>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="page-footer">
    <span><span class="footer-brand">VroduxERP</span> &nbsp;·&nbsp; Confidential — do not distribute</span>
    <span>${escHtml(now)}</span>
  </div>

  <script>
    // Auto-print once fonts and layout settle
    window.addEventListener("load", function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Opens a styled print window for the given data.
 * Chrome/Edge will default to "Save as PDF" in the print dialog.
 */
export function exportPdf(opts: PdfExportOptions): void {
  const html = buildHtml(opts);
  const win  = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!win) {
    // Popup blocked — fall back to a Blob URL in the current tab
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
