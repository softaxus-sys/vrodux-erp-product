export type PayrollStatus = "draft" | "processing" | "approved" | "paid" | "failed";
export type PayslipStatus = "generated" | "sent" | "viewed";

export interface PayrollDeduction {
  label: string;
  amount: number;
}

export interface PayrollAllowance {
  label: string;
  amount: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  payPeriod: string;
  basicSalary: number;
  allowances: PayrollAllowance[];
  deductions: PayrollDeduction[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  bank: string;
  iban: string;
  status: PayslipStatus;
  paidOn?: string;
}

export interface PayrollRun {
  id: string;
  month: string;
  year: number;
  payPeriod: string;
  status: PayrollStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  currency: string;
  processedBy?: string;
  processedOn?: string;
  approvedBy?: string;
  approvedOn?: string;
  paidOn?: string;
  wpsFile?: string;
  payslips: Payslip[];
}

const empData = [
  { id: "emp-001", name: "Ahmed Al Mansouri",  no: "EMP-0412",  dept: "Technology",      desig: "Chief Technology Officer",    basic: 45000, bank: "Emirates NBD",   iban: "AE070331234567890123456" },
  { id: "emp-002", name: "Sara Al Hashimi",    no: "EMP-0389",  dept: "Finance",          desig: "Senior Financial Analyst",    basic: 22000, bank: "ADCB",           iban: "AE070331234567890123457" },
  { id: "emp-003", name: "Khalid Al Marri",    no: "EMP-0401",  dept: "Technology",       desig: "Senior Software Engineer",    basic: 18000, bank: "FAB",            iban: "AE070331234567890123458" },
  { id: "emp-004", name: "Fatima Al Zaabi",    no: "EMP-0356",  dept: "Sales & Marketing",desig: "Sales Manager",               basic: 28000, bank: "Mashreq",        iban: "AE070331234567890123459" },
  { id: "emp-005", name: "Omar Al Farsi",      no: "EMP-0378",  dept: "Real Estate",      desig: "Senior Sales Executive",      basic: 20000, bank: "Emirates NBD",   iban: "AE070331234567890123460" },
  { id: "emp-006", name: "Mohammed Al Rashid", no: "EMP-0334",  dept: "Operations",       desig: "Operations Director",         basic: 38000, bank: "ADCB",           iban: "AE070331234567890123461" },
  { id: "emp-007", name: "Layla Hassan",       no: "EMP-0412b", dept: "Sales & Marketing",desig: "Account Executive",           basic: 15000, bank: "RAK Bank",       iban: "AE070331234567890123462" },
  { id: "emp-008", name: "Tariq Al Ameri",     no: "EMP-0290",  dept: "Finance",          desig: "Finance Manager",             basic: 25000, bank: "Emirates NBD",   iban: "AE070331234567890123463" },
  { id: "emp-009", name: "Nour Al Shamsi",     no: "EMP-0455",  dept: "Human Resources",  desig: "HR Business Partner",         basic: 16000, bank: "ENBD",           iban: "AE070331234567890123464" },
  { id: "emp-010", name: "James Mitchell",     no: "EMP-0178",  dept: "Construction",     desig: "Project Director",            basic: 42000, bank: "Barclays UAE",   iban: "AE070331234567890123465" },
];

function buildPayslip(emp: typeof empData[0], month: string, year: number, paid: boolean): Payslip {
  const housing = Math.round(emp.basic * 0.25);
  const transport = Math.round(emp.basic * 0.1);
  const medical = 1000;
  const gross = emp.basic + housing + transport + medical;
  const insurance = Math.round(gross * 0.015);
  const net = gross - insurance;
  return {
    id: `ps-${emp.id}-${year}-${month}`,
    employeeId: emp.id,
    employeeName: emp.name,
    employeeNumber: emp.no,
    department: emp.dept,
    designation: emp.desig,
    payPeriod: `${month} ${year}`,
    basicSalary: emp.basic,
    allowances: [
      { label: "Housing Allowance", amount: housing },
      { label: "Transport Allowance", amount: transport },
      { label: "Medical Allowance", amount: medical },
    ],
    deductions: [
      { label: "Medical Insurance Premium", amount: insurance },
    ],
    grossSalary: gross,
    totalDeductions: insurance,
    netSalary: net,
    currency: "AED",
    bank: emp.bank,
    iban: emp.iban,
    status: paid ? "sent" : "generated",
    paidOn: paid ? `${year}-${String(["January","February","March","April","May"].indexOf(month) + 1).padStart(2,"0")}-25` : undefined,
  };
}

const months = ["January", "February", "March", "April", "May"];

export const mockPayrollRuns: PayrollRun[] = months.map((month, idx) => {
  const isPaid = idx < 4;
  const payslips = empData.map(e => buildPayslip(e, month, 2026, isPaid));
  const totalGross = payslips.reduce((s, p) => s + p.grossSalary, 0);
  const totalDed = payslips.reduce((s, p) => s + p.totalDeductions, 0);
  const totalNet = payslips.reduce((s, p) => s + p.netSalary, 0);
  const monthNum = String(idx + 1).padStart(2, "0");
  return {
    id: `pr-2026-${monthNum}`,
    month,
    year: 2026,
    payPeriod: `${month} 2026`,
    status: isPaid ? "paid" : idx === 4 ? "approved" : "paid",
    totalEmployees: empData.length,
    totalGross,
    totalDeductions: totalDed,
    totalNet,
    currency: "AED",
    processedBy: "Tariq Al Ameri",
    processedOn: `2026-${monthNum}-20`,
    approvedBy: isPaid || idx === 4 ? "Ahmed Al Mansouri" : undefined,
    approvedOn: isPaid || idx === 4 ? `2026-${monthNum}-22` : undefined,
    paidOn: isPaid ? `2026-${monthNum}-25` : undefined,
    wpsFile: isPaid ? `WPS_${month}_2026.txt` : undefined,
    payslips,
  };
});

// Latest run is May (index 4)
export const currentPayroll = mockPayrollRuns[4];

export const payrollSummary = {
  currentMonth: "May 2026",
  totalEmployees: empData.length,
  totalNetPayroll: currentPayroll.totalNet,
  totalGrossPayroll: currentPayroll.totalGross,
  totalDeductions: currentPayroll.totalDeductions,
  status: currentPayroll.status,
  paidRuns: mockPayrollRuns.filter(r => r.status === "paid").length,
  pendingRuns: mockPayrollRuns.filter(r => r.status !== "paid").length,
  ytdTotal: mockPayrollRuns.filter(r => r.status === "paid").reduce((s, r) => s + r.totalNet, 0),
};
