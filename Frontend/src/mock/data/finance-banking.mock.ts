export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string; // last 4 digits
  iban: string;
  currency: "AED" | "USD" | "EUR";
  balance: number;
  availableBalance: number;
  status: "active" | "inactive";
  accountType: "current" | "savings" | "loan";
  lastSynced: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  reference: string;
  amount: number; // positive = credit, negative = debit
  type: "credit" | "debit";
  category: string;
  reconciled: boolean;
  balance: number;
}

export const mockBankAccounts: BankAccount[] = [
  {
    id: "ba1",
    accountName: "Emirates NBD - Main Operating",
    bankName: "Emirates NBD",
    accountNumber: "7842",
    iban: "AE070331234567890127842",
    currency: "AED",
    balance: 2400000,
    availableBalance: 2350000,
    status: "active",
    accountType: "current",
    lastSynced: "2026-05-20T08:30:00Z",
  },
  {
    id: "ba2",
    accountName: "ADCB - USD Operations",
    bankName: "Abu Dhabi Commercial Bank",
    accountNumber: "5521",
    iban: "AE070030122019876545521",
    currency: "USD",
    balance: 380000,
    availableBalance: 380000,
    status: "active",
    accountType: "current",
    lastSynced: "2026-05-20T08:30:00Z",
  },
  {
    id: "ba3",
    accountName: "Mashreq - Savings Reserve",
    bankName: "Mashreq Bank",
    accountNumber: "3310",
    iban: "AE060330000019283473310",
    currency: "AED",
    balance: 850000,
    availableBalance: 850000,
    status: "active",
    accountType: "savings",
    lastSynced: "2026-05-20T07:45:00Z",
  },
  {
    id: "ba4",
    accountName: "Dubai Islamic Bank - Petty",
    bankName: "Dubai Islamic Bank",
    accountNumber: "9901",
    iban: "AE460240039201234569901",
    currency: "AED",
    balance: 125000,
    availableBalance: 125000,
    status: "active",
    accountType: "current",
    lastSynced: "2026-05-19T18:00:00Z",
  },
  {
    id: "ba5",
    accountName: "Emirates NBD - EUR Account",
    bankName: "Emirates NBD",
    accountNumber: "6634",
    iban: "AE070331234567891236634",
    currency: "EUR",
    balance: 65000,
    availableBalance: 65000,
    status: "active",
    accountType: "current",
    lastSynced: "2026-05-20T08:30:00Z",
  },
];

export const mockBankTransactions: BankTransaction[] = [
  // Emirates NBD transactions
  { id: "bt1", accountId: "ba1", date: "2026-05-20", description: "Payroll - May 2026", reference: "PAY-2026-05", amount: -450000, type: "debit", category: "Payroll", reconciled: true, balance: 2400000 },
  { id: "bt2", accountId: "ba1", date: "2026-05-19", description: "Customer Receipt - Majid Al Futtaim", reference: "REC-INV-0234", amount: 875000, type: "credit", category: "Customer Receipt", reconciled: true, balance: 2850000 },
  { id: "bt3", accountId: "ba1", date: "2026-05-18", description: "Vendor Payment - Al Ghurair Industries", reference: "PO-2026-0891", amount: -325000, type: "debit", category: "Supplier Payment", reconciled: true, balance: 1975000 },
  { id: "bt4", accountId: "ba1", date: "2026-05-17", description: "Office Rent - DIFC Tower A", reference: "RENT-MAY26", amount: -165000, type: "debit", category: "Rent", reconciled: true, balance: 2300000 },
  { id: "bt5", accountId: "ba1", date: "2026-05-16", description: "Customer Receipt - Emirates Group", reference: "REC-INV-0228", amount: 1250000, type: "credit", category: "Customer Receipt", reconciled: false, balance: 2465000 },
  { id: "bt6", accountId: "ba1", date: "2026-05-15", description: "DEWA Electricity Bill", reference: "DEWA-052026", amount: -28500, type: "debit", category: "Utilities", reconciled: true, balance: 1215000 },
  { id: "bt7", accountId: "ba1", date: "2026-05-14", description: "Vendor Payment - Etisalat (e&)", reference: "TEL-052026", amount: -12000, type: "debit", category: "Utilities", reconciled: true, balance: 1243500 },
  { id: "bt8", accountId: "ba1", date: "2026-05-13", description: "Customer Receipt - Dubai Holding", reference: "REC-INV-0221", amount: 580000, type: "credit", category: "Customer Receipt", reconciled: false, balance: 1255500 },
  { id: "bt9", accountId: "ba1", date: "2026-05-12", description: "Loan Repayment - ENBD Term Loan", reference: "LOAN-ENBD-052026", amount: -125000, type: "debit", category: "Loan Repayment", reconciled: true, balance: 675500 },
  { id: "bt10", accountId: "ba1", date: "2026-05-10", description: "Vendor Payment - Raqamiyat Solutions", reference: "PO-2026-0875", amount: -89000, type: "debit", category: "Supplier Payment", reconciled: true, balance: 800500 },
  { id: "bt11", accountId: "ba1", date: "2026-05-08", description: "Customer Receipt - Aldar Properties", reference: "REC-INV-0215", amount: 425000, type: "credit", category: "Customer Receipt", reconciled: true, balance: 889500 },
  { id: "bt12", accountId: "ba1", date: "2026-05-05", description: "Corporate Tax Payment - FTA", reference: "TAX-FTA-Q1-26", amount: -215000, type: "debit", category: "Tax Payment", reconciled: true, balance: 464500 },
  { id: "bt13", accountId: "ba1", date: "2026-05-03", description: "Customer Receipt - ADNOC Distribution", reference: "REC-INV-0208", amount: 320000, type: "credit", category: "Customer Receipt", reconciled: false, balance: 679500 },
  { id: "bt14", accountId: "ba1", date: "2026-05-01", description: "Opening Balance Transfer", reference: "OB-MAY26", amount: 359500, type: "credit", category: "Transfer", reconciled: true, balance: 359500 },

  // ADCB USD transactions
  { id: "bt15", accountId: "ba2", date: "2026-05-19", description: "International Wire - Customer USA", reference: "WIRE-US-2605", amount: 120000, type: "credit", category: "Customer Receipt", reconciled: true, balance: 380000 },
  { id: "bt16", accountId: "ba2", date: "2026-05-17", description: "Vendor Payment - SAP License", reference: "SAP-LIC-2026", amount: -85000, type: "debit", category: "Software", reconciled: true, balance: 260000 },
  { id: "bt17", accountId: "ba2", date: "2026-05-15", description: "Wire Receipt - European Client", reference: "WIRE-EU-1905", amount: 95000, type: "credit", category: "Customer Receipt", reconciled: false, balance: 345000 },
  { id: "bt18", accountId: "ba2", date: "2026-05-10", description: "Bank Charges - SWIFT", reference: "CHG-SWIFT-052026", amount: -250, type: "debit", category: "Bank Charges", reconciled: true, balance: 250000 },

  // Mashreq savings transactions
  { id: "bt19", accountId: "ba3", date: "2026-05-15", description: "Interest Credit - May 2026", reference: "INT-MAY26", amount: 2833, type: "credit", category: "Interest Income", reconciled: true, balance: 850000 },
  { id: "bt20", accountId: "ba3", date: "2026-05-01", description: "Transfer from ENBD Main", reference: "TRF-ENBD-050126", amount: 100000, type: "credit", category: "Transfer", reconciled: true, balance: 847167 },
  { id: "bt21", accountId: "ba3", date: "2026-04-30", description: "Transfer to ENBD for Payroll", reference: "TRF-ENBD-043026", amount: -200000, type: "debit", category: "Transfer", reconciled: true, balance: 747167 },

  // DIB petty cash transactions
  { id: "bt22", accountId: "ba4", date: "2026-05-20", description: "Petty Cash Top-up", reference: "PC-TOP-052026", amount: 25000, type: "credit", category: "Transfer", reconciled: true, balance: 125000 },
  { id: "bt23", accountId: "ba4", date: "2026-05-18", description: "Office Supplies Purchase", reference: "PC-EXP-0845", amount: -3500, type: "debit", category: "Office Supplies", reconciled: true, balance: 100000 },
  { id: "bt24", accountId: "ba4", date: "2026-05-15", description: "Fuel Reimbursement", reference: "PC-EXP-0839", amount: -8200, type: "debit", category: "Fuel", reconciled: true, balance: 103500 },
  { id: "bt25", accountId: "ba4", date: "2026-05-12", description: "Staff Meal Allowance", reference: "PC-EXP-0831", amount: -5800, type: "debit", category: "Meals", reconciled: false, balance: 111700 },

  // ENBD EUR transactions
  { id: "bt26", accountId: "ba5", date: "2026-05-18", description: "EU Vendor Payment - TÜV Rheinland", reference: "EUR-PAY-0521", amount: -15000, type: "debit", category: "Supplier Payment", reconciled: true, balance: 65000 },
  { id: "bt27", accountId: "ba5", date: "2026-05-10", description: "EUR Customer Receipt - Berlin Tech AG", reference: "EUR-REC-0515", amount: 32000, type: "credit", category: "Customer Receipt", reconciled: false, balance: 80000 },
];

export const bankingSummary = {
  totalBalance: 4094650, // AED equivalent
  totalAccounts: 5,
  totalCreditThisMonth: 3699833,
  totalDebitThisMonth: 1506250,
  unreconciled: 6,
};
