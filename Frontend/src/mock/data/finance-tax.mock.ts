export interface TaxPeriod {
  id: string;
  period: string;
  from: string;
  to: string;
  status: "open" | "filed" | "paid" | "overdue";
  outputVat: number; // collected from sales
  inputVat: number; // paid on purchases
  netVat: number; // output - input
  dueDate: string;
  filedDate?: string;
  paidDate?: string;
  penalty?: number;
}

export interface TaxTransaction {
  id: string;
  date: string;
  type: "sale" | "purchase";
  reference: string;
  amount: number;
  vatAmount: number;
  vatRate: number;
  description: string;
  period: string;
}

export const mockTaxPeriods: TaxPeriod[] = [
  {
    id: "tp1",
    period: "Q2 2024",
    from: "2024-04-01",
    to: "2024-06-30",
    status: "paid",
    outputVat: 285000,
    inputVat: 128500,
    netVat: 156500,
    dueDate: "2024-07-28",
    filedDate: "2024-07-20",
    paidDate: "2024-07-20",
  },
  {
    id: "tp2",
    period: "Q3 2024",
    from: "2024-07-01",
    to: "2024-09-30",
    status: "paid",
    outputVat: 312000,
    inputVat: 145000,
    netVat: 167000,
    dueDate: "2024-10-28",
    filedDate: "2024-10-25",
    paidDate: "2024-10-25",
  },
  {
    id: "tp3",
    period: "Q4 2024",
    from: "2024-10-01",
    to: "2024-12-31",
    status: "paid",
    outputVat: 425000,
    inputVat: 198000,
    netVat: 227000,
    dueDate: "2025-01-28",
    filedDate: "2025-01-22",
    paidDate: "2025-01-22",
  },
  {
    id: "tp4",
    period: "Q1 2025",
    from: "2025-01-01",
    to: "2025-03-31",
    status: "paid",
    outputVat: 368000,
    inputVat: 172000,
    netVat: 196000,
    dueDate: "2025-04-28",
    filedDate: "2025-04-24",
    paidDate: "2025-04-24",
  },
  {
    id: "tp5",
    period: "Q1 2026",
    from: "2026-01-01",
    to: "2026-03-31",
    status: "filed",
    outputVat: 342500,
    inputVat: 154000,
    netVat: 188500,
    dueDate: "2026-04-28",
    filedDate: "2026-04-21",
    paidDate: "2026-04-21",
  },
  {
    id: "tp6",
    period: "Q2 2026",
    from: "2026-04-01",
    to: "2026-06-30",
    status: "open",
    outputVat: 187500,
    inputVat: 84200,
    netVat: 103300,
    dueDate: "2026-07-28",
  },
];

export const mockTaxTransactions: TaxTransaction[] = [
  // Q2 2026 Sales (output VAT)
  { id: "tt1", date: "2026-04-05", type: "sale", reference: "INV-2026-0215", amount: 850000, vatAmount: 42500, vatRate: 5, description: "Enterprise Software License - Emirates Group", period: "Q2 2026" },
  { id: "tt2", date: "2026-04-12", type: "sale", reference: "INV-2026-0218", amount: 320000, vatAmount: 16000, vatRate: 5, description: "Managed IT Services - Aldar Properties", period: "Q2 2026" },
  { id: "tt3", date: "2026-04-18", type: "sale", reference: "INV-2026-0221", amount: 580000, vatAmount: 29000, vatRate: 5, description: "System Integration Project - Dubai Holding", period: "Q2 2026" },
  { id: "tt4", date: "2026-04-25", type: "sale", reference: "INV-2026-0224", amount: 245000, vatAmount: 12250, vatRate: 5, description: "Consulting Services - ADNOC", period: "Q2 2026" },
  { id: "tt5", date: "2026-05-03", type: "sale", reference: "INV-2026-0228", amount: 1250000, vatAmount: 62500, vatRate: 5, description: "Annual Maintenance Contract - Majid Al Futtaim", period: "Q2 2026" },
  { id: "tt6", date: "2026-05-10", type: "sale", reference: "INV-2026-0231", amount: 425000, vatAmount: 21250, vatRate: 5, description: "Cloud Migration Services - Abu Dhabi Commercial Bank", period: "Q2 2026" },
  { id: "tt7", date: "2026-05-15", type: "sale", reference: "INV-2026-0234", amount: 175000, vatAmount: 8750, vatRate: 5, description: "Training & Enablement - RAK Properties", period: "Q2 2026" },
  { id: "tt8", date: "2026-05-19", type: "sale", reference: "INV-2026-0237", amount: 305000, vatAmount: 15250, vatRate: 5, description: "Cybersecurity Assessment - DP World", period: "Q2 2026" },

  // Q2 2026 Purchases (input VAT)
  { id: "tt9", date: "2026-04-03", type: "purchase", reference: "PO-2026-0875", amount: 320000, vatAmount: 16000, vatRate: 5, description: "AWS Cloud Services - Amazon Web Services", period: "Q2 2026" },
  { id: "tt10", date: "2026-04-10", type: "purchase", reference: "PO-2026-0878", amount: 85000, vatAmount: 4250, vatRate: 5, description: "SAP License Renewal - SAP Middle East", period: "Q2 2026" },
  { id: "tt11", date: "2026-04-15", type: "purchase", reference: "PO-2026-0881", amount: 165000, vatAmount: 8250, vatRate: 5, description: "DIFC Office Rent - DIFC Authority", period: "Q2 2026" },
  { id: "tt12", date: "2026-04-20", type: "purchase", reference: "PO-2026-0885", amount: 42000, vatAmount: 2100, vatRate: 5, description: "Office Supplies - Office One LLC", period: "Q2 2026" },
  { id: "tt13", date: "2026-05-02", type: "purchase", reference: "PO-2026-0891", amount: 285000, vatAmount: 14250, vatRate: 5, description: "IT Hardware - Dell Technologies MEA", period: "Q2 2026" },
  { id: "tt14", date: "2026-05-05", type: "purchase", reference: "PO-2026-0894", amount: 125000, vatAmount: 6250, vatRate: 5, description: "Professional Services - Deloitte UAE", period: "Q2 2026" },
  { id: "tt15", date: "2026-05-12", type: "purchase", reference: "PO-2026-0897", amount: 38000, vatAmount: 1900, vatRate: 5, description: "Marketing Materials - Print Hub Dubai", period: "Q2 2026" },
  { id: "tt16", date: "2026-05-18", type: "purchase", reference: "PO-2026-0901", amount: 62000, vatAmount: 3100, vatRate: 5, description: "Security Software - Palo Alto Networks", period: "Q2 2026" },

  // Q1 2026 Sales
  { id: "tt17", date: "2026-01-15", type: "sale", reference: "INV-2026-0180", amount: 1100000, vatAmount: 55000, vatRate: 5, description: "Annual Enterprise License - Dubai Airports", period: "Q1 2026" },
  { id: "tt18", date: "2026-02-20", type: "sale", reference: "INV-2026-0195", amount: 780000, vatAmount: 39000, vatRate: 5, description: "Digital Transformation Project - Dubai Police", period: "Q1 2026" },
  { id: "tt19", date: "2026-03-10", type: "sale", reference: "INV-2026-0207", amount: 970000, vatAmount: 48500, vatRate: 5, description: "Cloud Infrastructure - Abu Dhabi Gov", period: "Q1 2026" },

  // Q1 2026 Purchases
  { id: "tt20", date: "2026-01-10", type: "purchase", reference: "PO-2026-0830", amount: 450000, vatAmount: 22500, vatRate: 5, description: "Microsoft Enterprise Agreement - Microsoft Gulf", period: "Q1 2026" },
  { id: "tt21", date: "2026-02-15", type: "purchase", reference: "PO-2026-0845", amount: 280000, vatAmount: 14000, vatRate: 5, description: "Network Equipment - Cisco Systems UAE", period: "Q1 2026" },
  { id: "tt22", date: "2026-03-20", type: "purchase", reference: "PO-2026-0861", amount: 350000, vatAmount: 17500, vatRate: 5, description: "Subcontractor Services - Al Ghurair Engineering", period: "Q1 2026" },
];

export const taxSummary = {
  currentPeriodOutput: 187500,
  currentPeriodInput: 84200,
  currentNetVat: 103300,
  ytdVatPaid: 188500,
  nextDueDate: "2026-07-28",
  currentPeriod: "Q2 2026",
  registrationNumber: "TRN100345678900003",
};
