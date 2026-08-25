import { exportPdf } from "@/lib/pdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EmployeePayslipDto } from "@/lib/hr/hr.api";
import type { MyProfileDto } from "@/lib/hr/self.api";

/**
 * The employee's own payslip as a printable document.
 *
 * <p>Built from the figures already on the payslip rather than fetched again: the self-service
 * endpoints return only the signed-in person's records, so there is nothing further to ask for and
 * no id to pass that could be tampered with.</p>
 *
 * <p>Uses the shared <c>exportPdf</c> helper — the browser's own print-to-PDF, so no dependency is
 * added and the output matches every other document the product produces.</p>
 */
export function exportPayslipPdf(
  slip: EmployeePayslipDto,
  profile: MyProfileDto | undefined,
  currency: string,
  labels: {
    title: string; employee: string; employeeNumber: string; designation: string;
    department: string; period: string; payDate: string; status: string;
    earnings: string; basic: string; allowances: string; deductions: string;
    netPay: string; bank: string; iban: string; note: string;
  },
) {
  const money = (v: number) => formatCurrency(v, currency);
  const gross = slip.basicSalary + slip.allowances;

  // Two columns rather than a wide table: a payslip is read as label/value pairs, and this keeps
  // it legible on A4 without horizontal scrolling in the print preview.
  const rows: (string | number)[][] = [
    [labels.employee,       profile?.fullName ?? "—"],
    [labels.employeeNumber, profile?.employeeNumber ?? "—"],
    [labels.designation,    profile?.jobTitle ?? "—"],
    [labels.department,     profile?.departmentName ?? "—"],
    [labels.period,         slip.period],
    [labels.payDate,        formatDate(slip.paidAt ?? slip.processedAt, "medium")],
    [labels.status,         slip.runStatus],
    ["", ""],
    [labels.basic,          money(slip.basicSalary)],
    [labels.allowances,     money(slip.allowances)],
    [labels.earnings,       money(gross)],
    [labels.deductions,     `- ${money(slip.deductions)}`],
    [labels.netPay,         money(slip.netSalary)],
  ];

  // Bank details only when they exist — an empty "IBAN: —" on a payslip invites a support ticket.
  if (profile?.bankAccount) rows.push(["", ""], [labels.bank, profile.bankAccount]);
  if (profile?.iban)        rows.push([labels.iban, profile.iban]);

  rows.push(["", ""], [labels.note, ""]);

  exportPdf({
    title: `${labels.title} — ${slip.period}`,
    subtitle: `${profile?.fullName ?? ""} · ${slip.runNumber}`,
    columns: ["", ""],
    rows,
  });
}
