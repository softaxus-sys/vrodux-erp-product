export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string;
  balance: number;
  currency: "AED";
  isActive: boolean;
  description: string;
}

export const mockAccounts: Account[] = [
  // ASSETS
  { id: "a1", code: "1001", name: "Cash in Hand", type: "asset", parentCode: "1000", balance: 45000, currency: "AED", isActive: true, description: "Petty cash and cash on hand" },
  { id: "a2", code: "1002", name: "Emirates NBD - Current Account", type: "asset", parentCode: "1000", balance: 2400000, currency: "AED", isActive: true, description: "Main operating bank account at Emirates NBD" },
  { id: "a3", code: "1003", name: "ADCB - USD Account", type: "asset", parentCode: "1000", balance: 1395400, currency: "AED", isActive: true, description: "USD current account at ADCB (USD 380K)" },
  { id: "a4", code: "1004", name: "Mashreq - Savings Account", type: "asset", parentCode: "1000", balance: 850000, currency: "AED", isActive: true, description: "AED savings account at Mashreq Bank" },
  { id: "a5", code: "1100", name: "Accounts Receivable", type: "asset", balance: 3250000, currency: "AED", isActive: true, description: "Amounts owed by customers for goods and services" },
  { id: "a6", code: "1101", name: "Allowance for Doubtful Accounts", type: "asset", balance: -125000, currency: "AED", isActive: true, description: "Provision for uncollectable receivables" },
  { id: "a7", code: "1200", name: "Inventory - Raw Materials", type: "asset", balance: 780000, currency: "AED", isActive: true, description: "Stock of raw materials for production" },
  { id: "a8", code: "1201", name: "Inventory - Finished Goods", type: "asset", balance: 1120000, currency: "AED", isActive: true, description: "Completed products ready for sale" },
  { id: "a9", code: "1300", name: "Prepaid Expenses", type: "asset", balance: 245000, currency: "AED", isActive: true, description: "Expenses paid in advance (insurance, rent)" },
  { id: "a10", code: "1301", name: "Prepaid Insurance", type: "asset", parentCode: "1300", balance: 85000, currency: "AED", isActive: true, description: "Insurance premiums paid in advance" },
  { id: "a11", code: "1500", name: "Property & Equipment", type: "asset", balance: 8500000, currency: "AED", isActive: true, description: "Land, buildings, and equipment at cost" },
  { id: "a12", code: "1501", name: "Accumulated Depreciation", type: "asset", balance: -2300000, currency: "AED", isActive: true, description: "Total accumulated depreciation on fixed assets" },
  { id: "a13", code: "1600", name: "Intangible Assets", type: "asset", balance: 450000, currency: "AED", isActive: true, description: "Licenses, patents, and goodwill" },

  // LIABILITIES
  { id: "l1", code: "2001", name: "Accounts Payable", type: "liability", balance: 1850000, currency: "AED", isActive: true, description: "Amounts owed to vendors and suppliers" },
  { id: "l2", code: "2002", name: "Accrued Expenses", type: "liability", balance: 320000, currency: "AED", isActive: true, description: "Expenses incurred but not yet paid" },
  { id: "l3", code: "2003", name: "VAT Payable", type: "liability", balance: 187500, currency: "AED", isActive: true, description: "VAT collected on sales minus VAT paid on purchases" },
  { id: "l4", code: "2004", name: "Salaries Payable", type: "liability", balance: 450000, currency: "AED", isActive: true, description: "Salaries earned by employees but not yet paid" },
  { id: "l5", code: "2005", name: "Income Tax Payable", type: "liability", balance: 215000, currency: "AED", isActive: true, description: "Corporate tax liability" },
  { id: "l6", code: "2100", name: "Short-term Bank Loan - ADCB", type: "liability", balance: 1200000, currency: "AED", isActive: true, description: "Short-term credit facility at ADCB" },
  { id: "l7", code: "2200", name: "Long-term Loan - Emirates NBD", type: "liability", balance: 3500000, currency: "AED", isActive: true, description: "Term loan for equipment financing" },
  { id: "l8", code: "2201", name: "Finance Lease Obligations", type: "liability", balance: 680000, currency: "AED", isActive: true, description: "Lease liabilities under IFRS 16" },

  // EQUITY
  { id: "e1", code: "3001", name: "Share Capital", type: "equity", balance: 5000000, currency: "AED", isActive: true, description: "Paid-up share capital of the company" },
  { id: "e2", code: "3002", name: "Share Premium", type: "equity", balance: 1500000, currency: "AED", isActive: true, description: "Amount received above par value for shares" },
  { id: "e3", code: "3003", name: "Retained Earnings", type: "equity", balance: 2850000, currency: "AED", isActive: true, description: "Cumulative net earnings retained in the business" },
  { id: "e4", code: "3004", name: "General Reserve", type: "equity", balance: 750000, currency: "AED", isActive: true, description: "Appropriation from retained earnings as reserve" },
  { id: "e5", code: "3005", name: "Current Year Profit", type: "equity", balance: 1245000, currency: "AED", isActive: true, description: "Net profit for the current financial year" },

  // REVENUE
  { id: "r1", code: "4001", name: "Product Sales Revenue", type: "revenue", balance: 12500000, currency: "AED", isActive: true, description: "Revenue from sale of products" },
  { id: "r2", code: "4002", name: "Service Revenue", type: "revenue", balance: 3800000, currency: "AED", isActive: true, description: "Revenue from professional and managed services" },
  { id: "r3", code: "4003", name: "Consulting Revenue", type: "revenue", balance: 1250000, currency: "AED", isActive: true, description: "Revenue from consulting engagements" },
  { id: "r4", code: "4004", name: "Maintenance Contracts", type: "revenue", balance: 680000, currency: "AED", isActive: true, description: "Annual maintenance and support contracts" },
  { id: "r5", code: "4005", name: "Other Income", type: "revenue", balance: 145000, currency: "AED", isActive: true, description: "Miscellaneous income" },
  { id: "r6", code: "4006", name: "Interest Income", type: "revenue", balance: 38000, currency: "AED", isActive: true, description: "Interest earned on bank deposits and investments" },

  // EXPENSES
  { id: "x1", code: "5001", name: "Cost of Goods Sold", type: "expense", balance: 7250000, currency: "AED", isActive: true, description: "Direct cost of products sold" },
  { id: "x2", code: "5002", name: "Salaries & Wages", type: "expense", balance: 3600000, currency: "AED", isActive: true, description: "Employee compensation and wages" },
  { id: "x3", code: "5003", name: "Rent Expense", type: "expense", balance: 840000, currency: "AED", isActive: true, description: "Office and warehouse rental expense" },
  { id: "x4", code: "5004", name: "Utilities Expense", type: "expense", balance: 185000, currency: "AED", isActive: true, description: "Electricity, water, and internet expenses" },
  { id: "x5", code: "5005", name: "Depreciation Expense", type: "expense", balance: 420000, currency: "AED", isActive: true, description: "Annual depreciation on fixed assets" },
  { id: "x6", code: "5006", name: "Marketing & Advertising", type: "expense", balance: 560000, currency: "AED", isActive: true, description: "Digital marketing, events, and advertising" },
  { id: "x7", code: "5007", name: "Travel & Entertainment", type: "expense", balance: 225000, currency: "AED", isActive: true, description: "Business travel, client entertainment" },
  { id: "x8", code: "5008", name: "Software & Subscriptions", type: "expense", balance: 180000, currency: "AED", isActive: true, description: "SaaS tools, licenses, and cloud services" },
  { id: "x9", code: "5009", name: "Insurance Expense", type: "expense", balance: 95000, currency: "AED", isActive: true, description: "Business and asset insurance premiums" },
  { id: "x10", code: "5010", name: "Professional Fees", type: "expense", balance: 145000, currency: "AED", isActive: true, description: "Legal, audit, and consulting fees" },
  { id: "x11", code: "5011", name: "Finance Charges", type: "expense", balance: 210000, currency: "AED", isActive: true, description: "Interest on loans and bank charges" },
  { id: "x12", code: "5012", name: "Office Supplies", type: "expense", balance: 42000, currency: "AED", isActive: true, description: "Stationery, office consumables" },
];

export const accountingSummary = {
  totalAssets: 18295400,
  totalLiabilities: 8402500,
  totalEquity: 11345000,
  totalRevenue: 18413000,
  totalExpenses: 13752000,
  netProfit: 4661000,
};
