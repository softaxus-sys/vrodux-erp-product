import type { ProfitLossDto, BalanceSheetDto, CashFlowDto, StatementLine } from "@/lib/finance/finance.api";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

function esc(s: string): string {
  return s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
  .company { font-size: 22px; font-weight: 800; color: #2563eb; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
  .muted { color: #666; font-size: 12px; }
  section { margin-top: 20px; }
  section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #555; background: #f3f4f6; margin: 0; padding: 8px 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { font-weight: 700; border-top: 2px solid #1a1a1a; border-bottom: none; }
  .good { color: #16a34a; }
  .bad { color: #dc2626; }
  .banner { margin-top: 16px; padding: 10px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; }
  .banner.good { background: #f0fdf4; color: #16a34a; }
  .banner.bad { background: #fef2f2; color: #dc2626; }
  .toolbar { text-align: center; margin-bottom: 20px; }
  @media print { .toolbar { display: none; } body { padding: 0; } @page { margin: 16mm; } }
`;

function shell(title: string, subtitle: string, body: string): string {
  return `<!doctype html><html><head><title>${esc(title)}</title><style>${STYLES}</style></head><body>
    <div class="toolbar">
      <button onclick="window.print()" style="padding:9px 22px;font-size:14px;cursor:pointer;border-radius:6px;border:none;background:#2563eb;color:#fff;font-weight:600">Print / Save as PDF</button>
    </div>
    <div class="head">
      <div><div class="company">Vrodux</div><div class="muted">Financial Statements</div></div>
      <div class="title"><h1>${esc(title)}</h1><div class="muted">${esc(subtitle)}</div></div>
    </div>
    ${body}
  </body></html>`;
}

function sectionRows(lines: StatementLine[], currency: string): string {
  if (lines.length === 0) return `<tr><td colspan="2" class="muted">No entries</td></tr>`;
  return lines.map(l => `
    <tr>
      <td><span class="muted" style="font-family:monospace;margin-right:8px">${esc(l.accountCode)}</span>${esc(l.accountName)}</td>
      <td class="num">${esc(formatCurrency(l.amount, currency))}</td>
    </tr>`).join("");
}

function openPrintWindow(html: string): void {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) { toast.error("Pop-up blocked — allow pop-ups to print."); return; }
  win.document.write(html);
  win.document.close();
}

export function printProfitLoss(data: ProfitLossDto, currency: string): void {
  const margin = data.totalRevenue > 0 ? Math.round((data.netProfit / data.totalRevenue) * 100) : 0;
  const profitClass = data.netProfit >= 0 ? "good" : "bad";
  const body = `
    <section>
      <h2>Revenue</h2>
      <table><tbody>${sectionRows(data.revenue, currency)}
        <tr class="total"><td>Total Revenue</td><td class="num good">${esc(formatCurrency(data.totalRevenue, currency))}</td></tr>
      </tbody></table>
    </section>
    <section>
      <h2>Expenses</h2>
      <table><tbody>${sectionRows(data.expenses, currency)}
        <tr class="total"><td>Total Expenses</td><td class="num bad">${esc(formatCurrency(data.totalExpenses, currency))}</td></tr>
      </tbody></table>
    </section>
    <div class="banner ${profitClass}">Net Profit: ${esc(formatCurrency(data.netProfit, currency))} (Margin ${margin}%)</div>`;
  openPrintWindow(shell("Profit & Loss", `${data.from} → ${data.to}`, body));
}

export function printBalanceSheet(data: BalanceSheetDto, currency: string): void {
  const equityLines: StatementLine[] = [...data.equity, { accountCode: "—", accountName: "Retained Earnings", amount: data.retainedEarnings }];
  const balanceClass = data.isBalanced ? "good" : "bad";
  const balanceMsg = data.isBalanced ? "Balanced — Assets = Liabilities + Equity" : "Out of balance — check posted entries";
  const body = `
    <div class="banner ${balanceClass}">${esc(balanceMsg)}</div>
    <section>
      <h2>Assets</h2>
      <table><tbody>${sectionRows(data.assets, currency)}
        <tr class="total"><td>Total Assets</td><td class="num">${esc(formatCurrency(data.totalAssets, currency))}</td></tr>
      </tbody></table>
    </section>
    <section>
      <h2>Liabilities</h2>
      <table><tbody>${sectionRows(data.liabilities, currency)}
        <tr class="total"><td>Total Liabilities</td><td class="num">${esc(formatCurrency(data.totalLiabilities, currency))}</td></tr>
      </tbody></table>
    </section>
    <section>
      <h2>Equity</h2>
      <table><tbody>${sectionRows(equityLines, currency)}
        <tr class="total"><td>Total Equity</td><td class="num">${esc(formatCurrency(data.totalEquity, currency))}</td></tr>
      </tbody></table>
    </section>
    <section>
      <table><tbody>
        <tr class="total"><td>Total Liabilities + Equity</td><td class="num">${esc(formatCurrency(data.totalLiabilitiesAndEquity, currency))}</td></tr>
      </tbody></table>
    </section>`;
  openPrintWindow(shell("Balance Sheet", `As of ${data.asOf}`, body));
}

export function printCashFlow(data: CashFlowDto, currency: string): void {
  const netClass = data.netCashFlow >= 0 ? "good" : "bad";
  const body = `
    <section>
      <table><tbody>
        <tr><td>Opening Cash Balance</td><td class="num">${esc(formatCurrency(data.openingCash, currency))}</td></tr>
        <tr><td>Cash Inflows</td><td class="num good">${esc(formatCurrency(data.inflows, currency))}</td></tr>
        <tr><td>Cash Outflows</td><td class="num bad">${esc(formatCurrency(-data.outflows, currency))}</td></tr>
        <tr class="total"><td>Net Cash Flow</td><td class="num ${netClass}">${esc(formatCurrency(data.netCashFlow, currency))}</td></tr>
        <tr class="total"><td>Closing Cash Balance</td><td class="num">${esc(formatCurrency(data.closingCash, currency))}</td></tr>
      </tbody></table>
    </section>
    <p class="muted" style="margin-top:12px">Direct method over cash &amp; bank accounts</p>`;
  openPrintWindow(shell("Cash Flow Statement", `${data.from} → ${data.to}`, body));
}
