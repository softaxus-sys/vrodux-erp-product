export type GLPeriod = "2026-01" | "2026-02" | "2026-03" | "2026-04" | "2026-05";

export interface GLEntry {
  id: string;
  period: GLPeriod;
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  debit: number;
  credit: number;
  balance: number;
  journalRef: string;
  description: string;
  date: string;
  postedBy: string;
}

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export const mockGLEntries: GLEntry[] = [
  // January 2026
  { id: "gl1", period: "2026-01", accountCode: "1001", accountName: "Cash in Hand", accountType: "asset", debit: 50000, credit: 5000, balance: 45000, journalRef: "JE-2026-001", description: "Opening balances", date: "2026-01-01", postedBy: "Mariam Al Dhaheri" },
  { id: "gl2", period: "2026-01", accountCode: "1002", accountName: "Emirates NBD - Current", accountType: "asset", debit: 2200000, credit: 350000, balance: 1850000, journalRef: "JE-2026-001", description: "Opening balances & Jan transactions", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl3", period: "2026-01", accountCode: "1100", accountName: "Accounts Receivable", accountType: "asset", debit: 3500000, credit: 800000, balance: 2700000, journalRef: "JE-2026-002", description: "Customer invoices & receipts", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl4", period: "2026-01", accountCode: "2001", accountName: "Accounts Payable", accountType: "liability", debit: 650000, credit: 1200000, balance: 550000, journalRef: "JE-2026-003", description: "Vendor invoices & payments", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl5", period: "2026-01", accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", debit: 0, credit: 2100000, balance: 2100000, journalRef: "JE-2026-004", description: "Sales invoices January", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl6", period: "2026-01", accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", debit: 600000, credit: 0, balance: 600000, journalRef: "JE-2026-005", description: "January payroll posting", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl7", period: "2026-01", accountCode: "5001", accountName: "Cost of Goods Sold", accountType: "expense", debit: 1200000, credit: 0, balance: 1200000, journalRef: "JE-2026-006", description: "COGS January", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl8", period: "2026-01", accountCode: "2003", accountName: "VAT Payable", accountType: "liability", debit: 0, credit: 105000, balance: 105000, journalRef: "JE-2026-007", description: "VAT on sales January", date: "2026-01-31", postedBy: "Mariam Al Dhaheri" },

  // February 2026
  { id: "gl9", period: "2026-02", accountCode: "1002", accountName: "Emirates NBD - Current", accountType: "asset", debit: 1850000, credit: 420000, balance: 1430000, journalRef: "JE-2026-020", description: "February bank transactions", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },
  { id: "gl10", period: "2026-02", accountCode: "1100", accountName: "Accounts Receivable", accountType: "asset", debit: 2800000, credit: 950000, balance: 1850000, journalRef: "JE-2026-021", description: "Feb customer invoices & receipts", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },
  { id: "gl11", period: "2026-02", accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", debit: 0, credit: 2350000, balance: 2350000, journalRef: "JE-2026-022", description: "Sales invoices February", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },
  { id: "gl12", period: "2026-02", accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", debit: 600000, credit: 0, balance: 600000, journalRef: "JE-2026-023", description: "February payroll", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },
  { id: "gl13", period: "2026-02", accountCode: "5003", accountName: "Rent Expense", accountType: "expense", debit: 140000, credit: 0, balance: 140000, journalRef: "JE-2026-024", description: "February rent", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },
  { id: "gl14", period: "2026-02", accountCode: "2001", accountName: "Accounts Payable", accountType: "liability", debit: 780000, credit: 980000, balance: 200000, journalRef: "JE-2026-025", description: "Vendor payments Feb", date: "2026-02-28", postedBy: "Mariam Al Dhaheri" },

  // March 2026
  { id: "gl15", period: "2026-03", accountCode: "1002", accountName: "Emirates NBD - Current", accountType: "asset", debit: 2100000, credit: 580000, balance: 1520000, journalRef: "JE-2026-040", description: "March bank transactions", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl16", period: "2026-03", accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", debit: 0, credit: 2600000, balance: 2600000, journalRef: "JE-2026-041", description: "Sales invoices March", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl17", period: "2026-03", accountCode: "4002", accountName: "Service Revenue", accountType: "revenue", debit: 0, credit: 680000, balance: 680000, journalRef: "JE-2026-042", description: "Service revenue March", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl18", period: "2026-03", accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", debit: 600000, credit: 0, balance: 600000, journalRef: "JE-2026-043", description: "March payroll", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl19", period: "2026-03", accountCode: "2003", accountName: "VAT Payable", accountType: "liability", debit: 105000, credit: 116500, balance: 11500, journalRef: "JE-2026-044", description: "VAT settlement Q1 2026", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },
  { id: "gl20", period: "2026-03", accountCode: "5005", accountName: "Depreciation Expense", accountType: "expense", debit: 35000, credit: 0, balance: 35000, journalRef: "JE-2026-045", description: "Q1 depreciation charge", date: "2026-03-31", postedBy: "Mariam Al Dhaheri" },

  // April 2026
  { id: "gl21", period: "2026-04", accountCode: "1002", accountName: "Emirates NBD - Current", accountType: "asset", debit: 2300000, credit: 510000, balance: 1790000, journalRef: "JE-2026-060", description: "April bank transactions", date: "2026-04-30", postedBy: "Mariam Al Dhaheri" },
  { id: "gl22", period: "2026-04", accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", debit: 0, credit: 2750000, balance: 2750000, journalRef: "JE-2026-061", description: "Sales invoices April", date: "2026-04-30", postedBy: "Mariam Al Dhaheri" },
  { id: "gl23", period: "2026-04", accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", debit: 600000, credit: 0, balance: 600000, journalRef: "JE-2026-062", description: "April payroll", date: "2026-04-30", postedBy: "Mariam Al Dhaheri" },
  { id: "gl24", period: "2026-04", accountCode: "1100", accountName: "Accounts Receivable", accountType: "asset", debit: 3100000, credit: 1200000, balance: 1900000, journalRef: "JE-2026-063", description: "April customer transactions", date: "2026-04-30", postedBy: "Mariam Al Dhaheri" },
  { id: "gl25", period: "2026-04", accountCode: "5006", accountName: "Marketing & Advertising", accountType: "expense", debit: 95000, credit: 0, balance: 95000, journalRef: "JE-2026-064", description: "GITEX marketing spend", date: "2026-04-30", postedBy: "Mariam Al Dhaheri" },

  // May 2026
  { id: "gl26", period: "2026-05", accountCode: "1002", accountName: "Emirates NBD - Current", accountType: "asset", debit: 2450000, credit: 450000, balance: 2000000, journalRef: "JE-2026-080", description: "May bank transactions", date: "2026-05-20", postedBy: "Mariam Al Dhaheri" },
  { id: "gl27", period: "2026-05", accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", debit: 0, credit: 2700000, balance: 2700000, journalRef: "JE-2026-081", description: "Sales invoices May YTD", date: "2026-05-20", postedBy: "Mariam Al Dhaheri" },
  { id: "gl28", period: "2026-05", accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", debit: 600000, credit: 0, balance: 600000, journalRef: "JE-2026-082", description: "May payroll", date: "2026-05-20", postedBy: "Mariam Al Dhaheri" },
  { id: "gl29", period: "2026-05", accountCode: "2001", accountName: "Accounts Payable", accountType: "liability", debit: 850000, credit: 1200000, balance: 350000, journalRef: "JE-2026-083", description: "May vendor transactions", date: "2026-05-20", postedBy: "Mariam Al Dhaheri" },
  { id: "gl30", period: "2026-05", accountCode: "3005", accountName: "Current Year Profit", accountType: "equity", debit: 0, credit: 1245000, balance: 1245000, journalRef: "JE-2026-084", description: "YTD profit recognition", date: "2026-05-20", postedBy: "Mariam Al Dhaheri" },
];

export const trialBalance: TrialBalanceLine[] = [
  { accountCode: "1001", accountName: "Cash in Hand", accountType: "asset", openingBalance: 0, totalDebits: 50000, totalCredits: 5000, closingBalance: 45000 },
  { accountCode: "1002", accountName: "Emirates NBD - Current Account", accountType: "asset", openingBalance: 0, totalDebits: 10900000, totalCredits: 2310000, closingBalance: 2400000 },
  { accountCode: "1003", accountName: "ADCB - USD Account", accountType: "asset", openingBalance: 1395400, totalDebits: 0, totalCredits: 0, closingBalance: 1395400 },
  { accountCode: "1100", accountName: "Accounts Receivable", accountType: "asset", openingBalance: 0, totalDebits: 12500000, totalCredits: 3250000, closingBalance: 3250000 },
  { accountCode: "1200", accountName: "Inventory - Raw Materials", accountType: "asset", openingBalance: 780000, totalDebits: 0, totalCredits: 0, closingBalance: 780000 },
  { accountCode: "1500", accountName: "Property & Equipment", accountType: "asset", openingBalance: 8500000, totalDebits: 0, totalCredits: 0, closingBalance: 8500000 },
  { accountCode: "2001", accountName: "Accounts Payable", accountType: "liability", openingBalance: 0, totalDebits: 3080000, totalCredits: 4930000, closingBalance: 1850000 },
  { accountCode: "2003", accountName: "VAT Payable", accountType: "liability", openingBalance: 0, totalDebits: 105000, totalCredits: 292500, closingBalance: 187500 },
  { accountCode: "2200", accountName: "Long-term Loan - Emirates NBD", accountType: "liability", openingBalance: 3500000, totalDebits: 0, totalCredits: 0, closingBalance: 3500000 },
  { accountCode: "3001", accountName: "Share Capital", accountType: "equity", openingBalance: 5000000, totalDebits: 0, totalCredits: 0, closingBalance: 5000000 },
  { accountCode: "3003", accountName: "Retained Earnings", accountType: "equity", openingBalance: 2850000, totalDebits: 0, totalCredits: 0, closingBalance: 2850000 },
  { accountCode: "3005", accountName: "Current Year Profit", accountType: "equity", openingBalance: 0, totalDebits: 0, totalCredits: 1245000, closingBalance: 1245000 },
  { accountCode: "4001", accountName: "Product Sales Revenue", accountType: "revenue", openingBalance: 0, totalDebits: 0, totalCredits: 12500000, closingBalance: 12500000 },
  { accountCode: "4002", accountName: "Service Revenue", accountType: "revenue", openingBalance: 0, totalDebits: 0, totalCredits: 3800000, closingBalance: 3800000 },
  { accountCode: "4003", accountName: "Consulting Revenue", accountType: "revenue", openingBalance: 0, totalDebits: 0, totalCredits: 1250000, closingBalance: 1250000 },
  { accountCode: "5001", accountName: "Cost of Goods Sold", accountType: "expense", openingBalance: 0, totalDebits: 7250000, totalCredits: 0, closingBalance: 7250000 },
  { accountCode: "5002", accountName: "Salaries & Wages", accountType: "expense", openingBalance: 0, totalDebits: 3600000, totalCredits: 0, closingBalance: 3600000 },
  { accountCode: "5003", accountName: "Rent Expense", accountType: "expense", openingBalance: 0, totalDebits: 840000, totalCredits: 0, closingBalance: 840000 },
  { accountCode: "5005", accountName: "Depreciation Expense", accountType: "expense", openingBalance: 0, totalDebits: 420000, totalCredits: 0, closingBalance: 420000 },
  { accountCode: "5006", accountName: "Marketing & Advertising", accountType: "expense", openingBalance: 0, totalDebits: 560000, totalCredits: 0, closingBalance: 560000 },
];

export const glSummary = {
  totalDebits: 41710000,
  totalCredits: 41710000,
  isBalanced: true,
  periods: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"] as GLPeriod[],
  accounts: 20,
  currentPeriod: "2026-05" as GLPeriod,
};
