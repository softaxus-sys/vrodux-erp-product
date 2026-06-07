export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";
export type ExpenseCategory = "travel" | "accommodation" | "meals" | "entertainment" | "software" | "office" | "training" | "medical" | "fuel" | "other";

export interface ExpenseItem {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  receiptUrl?: string;
  date: string;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  submittedBy: string;
  department: string;
  submittedDate: string;
  status: ExpenseStatus;
  totalAmount: number;
  currency: "AED";
  items: ExpenseItem[];
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
  rejectionReason?: string;
  paymentMethod?: string;
  notes?: string;
}

export const mockExpenses: Expense[] = [
  {
    id: "e1",
    expenseNumber: "EXP-2026-0042",
    submittedBy: "Khalid Al Rashidi",
    department: "Sales",
    submittedDate: "2026-05-19",
    status: "submitted",
    totalAmount: 18500,
    currency: "AED",
    notes: "Dubai-Riyadh sales trip for Al Rajhi Bank pitch",
    items: [
      { id: "ei1", description: "Emirates Business Class - DXB to RUH return", category: "travel", amount: 8200, date: "2026-05-12" },
      { id: "ei2", description: "Riyadh Marriott - 3 nights", category: "accommodation", amount: 6300, date: "2026-05-13" },
      { id: "ei3", description: "Client Dinner - Najd Palace Restaurant", category: "entertainment", amount: 2800, date: "2026-05-14" },
      { id: "ei4", description: "Taxi & Transportation", category: "travel", amount: 1200, date: "2026-05-13" },
    ],
  },
  {
    id: "e2",
    expenseNumber: "EXP-2026-0041",
    submittedBy: "Sara Al Hashimi",
    department: "Engineering",
    submittedDate: "2026-05-18",
    status: "approved",
    totalAmount: 4750,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-19",
    notes: "AWS re:Invent Dubai conference",
    items: [
      { id: "ei5", description: "AWS Summit Dubai - Conference Pass", category: "training", amount: 3500, date: "2026-05-18" },
      { id: "ei6", description: "Conference Meals", category: "meals", amount: 850, date: "2026-05-18" },
      { id: "ei7", description: "Parking - DWTC", category: "travel", amount: 400, date: "2026-05-18" },
    ],
  },
  {
    id: "e3",
    expenseNumber: "EXP-2026-0040",
    submittedBy: "Layla Al Farsi",
    department: "Marketing",
    submittedDate: "2026-05-17",
    status: "paid",
    totalAmount: 12200,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-18",
    paidDate: "2026-05-20",
    paymentMethod: "Bank Transfer",
    notes: "GITEX Global 2026 participation",
    items: [
      { id: "ei8", description: "GITEX Exhibitor Stand Setup", category: "office", amount: 8500, date: "2026-05-10" },
      { id: "ei9", description: "Promotional Materials Printing", category: "office", amount: 2400, date: "2026-05-09" },
      { id: "ei10", description: "Team Lunch during GITEX", category: "meals", amount: 1300, date: "2026-05-11" },
    ],
  },
  {
    id: "e4",
    expenseNumber: "EXP-2026-0039",
    submittedBy: "Omar Al Tamimi",
    department: "IT",
    submittedDate: "2026-05-16",
    status: "submitted",
    totalAmount: 6800,
    currency: "AED",
    notes: "Emergency server hardware replacement",
    items: [
      { id: "ei11", description: "Dell Server RAM Modules x4", category: "office", amount: 4200, date: "2026-05-15" },
      { id: "ei12", description: "Network Cables & Components", category: "office", amount: 1850, date: "2026-05-15" },
      { id: "ei13", description: "Delivery & Installation", category: "other", amount: 750, date: "2026-05-16" },
    ],
  },
  {
    id: "e5",
    expenseNumber: "EXP-2026-0038",
    submittedBy: "Hassan Al Nuaimi",
    department: "Operations",
    submittedDate: "2026-05-15",
    status: "rejected",
    totalAmount: 9500,
    currency: "AED",
    rejectionReason: "Requires three quotes for purchases above AED 5,000. Please resubmit with proper procurement documentation.",
    notes: "Warehouse equipment",
    items: [
      { id: "ei14", description: "Industrial Shelving Units x6", category: "office", amount: 9500, date: "2026-05-14" },
    ],
  },
  {
    id: "e6",
    expenseNumber: "EXP-2026-0037",
    submittedBy: "Fatima Al Zaabi",
    department: "HR",
    submittedDate: "2026-05-14",
    status: "paid",
    totalAmount: 3200,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-15",
    paidDate: "2026-05-17",
    paymentMethod: "Bank Transfer",
    notes: "HR Team offsite planning day",
    items: [
      { id: "ei15", description: "Team Building Venue - Marriott Resort", category: "entertainment", amount: 2400, date: "2026-05-10" },
      { id: "ei16", description: "Team Lunch & Refreshments", category: "meals", amount: 800, date: "2026-05-10" },
    ],
  },
  {
    id: "e7",
    expenseNumber: "EXP-2026-0036",
    submittedBy: "Yousef Al Mansouri",
    department: "Sales",
    submittedDate: "2026-05-13",
    status: "approved",
    totalAmount: 8900,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-14",
    notes: "Abu Dhabi client visits",
    items: [
      { id: "ei17", description: "Etihad Business - DXB to AUH return", category: "travel", amount: 1800, date: "2026-05-08" },
      { id: "ei18", description: "ADNOC Client Dinner", category: "entertainment", amount: 4200, date: "2026-05-09" },
      { id: "ei19", description: "Hotel - Le Royal Méridien Abu Dhabi", category: "accommodation", amount: 2450, date: "2026-05-09" },
      { id: "ei20", description: "Ground Transportation", category: "travel", amount: 450, date: "2026-05-08" },
    ],
  },
  {
    id: "e8",
    expenseNumber: "EXP-2026-0035",
    submittedBy: "Mariam Al Dhaheri",
    department: "Finance",
    submittedDate: "2026-05-12",
    status: "paid",
    totalAmount: 2850,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-13",
    paidDate: "2026-05-15",
    paymentMethod: "Bank Transfer",
    notes: "ACCA training materials",
    items: [
      { id: "ei21", description: "ACCA Study Materials - Strategic Business Leader", category: "training", amount: 1950, date: "2026-05-12" },
      { id: "ei22", description: "ACCA Exam Registration Fee", category: "training", amount: 900, date: "2026-05-12" },
    ],
  },
  {
    id: "e9",
    expenseNumber: "EXP-2026-0034",
    submittedBy: "Rashed Al Ketbi",
    department: "Operations",
    submittedDate: "2026-05-11",
    status: "submitted",
    totalAmount: 5400,
    currency: "AED",
    notes: "Fleet vehicle servicing",
    items: [
      { id: "ei23", description: "Toyota Land Cruiser - Full Service", category: "fuel", amount: 2800, date: "2026-05-10" },
      { id: "ei24", description: "Nissan Patrol - Oil Change & Tires", category: "fuel", amount: 2600, date: "2026-05-10" },
    ],
  },
  {
    id: "e10",
    expenseNumber: "EXP-2026-0033",
    submittedBy: "Noura Al Suwaidi",
    department: "Marketing",
    submittedDate: "2026-05-10",
    status: "draft",
    totalAmount: 7200,
    currency: "AED",
    notes: "LinkedIn & Google Ads top-up",
    items: [
      { id: "ei25", description: "LinkedIn Campaign Manager Credit", category: "software", amount: 5000, date: "2026-05-09" },
      { id: "ei26", description: "Google Ads - Search Campaign", category: "software", amount: 2200, date: "2026-05-09" },
    ],
  },
  {
    id: "e11",
    expenseNumber: "EXP-2026-0032",
    submittedBy: "Ali Al Shamsi",
    department: "Engineering",
    submittedDate: "2026-05-09",
    status: "approved",
    totalAmount: 3600,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-10",
    notes: "GitHub Enterprise & Jira subscription",
    items: [
      { id: "ei27", description: "GitHub Enterprise - Monthly", category: "software", amount: 2200, date: "2026-05-01" },
      { id: "ei28", description: "Atlassian Jira Cloud - Monthly", category: "software", amount: 1400, date: "2026-05-01" },
    ],
  },
  {
    id: "e12",
    expenseNumber: "EXP-2026-0031",
    submittedBy: "Khalid Al Rashidi",
    department: "Sales",
    submittedDate: "2026-05-08",
    status: "paid",
    totalAmount: 22500,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-09",
    paidDate: "2026-05-12",
    paymentMethod: "Bank Transfer",
    notes: "Singapore fintech conference",
    items: [
      { id: "ei29", description: "Singapore Airlines Business Class", category: "travel", amount: 12800, date: "2026-04-28" },
      { id: "ei30", description: "Marina Bay Sands Hotel - 4 nights", category: "accommodation", amount: 7200, date: "2026-04-29" },
      { id: "ei31", description: "Conference Registration - Singapore Fintech Festival", category: "training", amount: 1800, date: "2026-04-28" },
      { id: "ei32", description: "Meals & Transportation", category: "meals", amount: 700, date: "2026-04-29" },
    ],
  },
  {
    id: "e13",
    expenseNumber: "EXP-2026-0030",
    submittedBy: "Sara Al Hashimi",
    department: "Engineering",
    submittedDate: "2026-05-07",
    status: "paid",
    totalAmount: 1450,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-08",
    paidDate: "2026-05-10",
    paymentMethod: "Bank Transfer",
    notes: "Team working lunch - sprint retrospective",
    items: [
      { id: "ei33", description: "Team Lunch - Zuma Dubai DIFC", category: "meals", amount: 1450, date: "2026-05-07" },
    ],
  },
  {
    id: "e14",
    expenseNumber: "EXP-2026-0029",
    submittedBy: "Omar Al Tamimi",
    department: "IT",
    submittedDate: "2026-05-06",
    status: "rejected",
    totalAmount: 3200,
    currency: "AED",
    rejectionReason: "Personal laptop policy does not cover MacBook Pro upgrades. Please submit IT procurement request through the standard channel.",
    notes: "MacBook Pro upgrade",
    items: [
      { id: "ei34", description: "MacBook Pro M4 - Personal Use Upgrade", category: "office", amount: 3200, date: "2026-05-05" },
    ],
  },
  {
    id: "e15",
    expenseNumber: "EXP-2026-0028",
    submittedBy: "Fatima Al Zaabi",
    department: "HR",
    submittedDate: "2026-05-05",
    status: "paid",
    totalAmount: 4800,
    currency: "AED",
    approvedBy: "Ahmed Al Mansoori",
    approvedDate: "2026-05-06",
    paidDate: "2026-05-08",
    paymentMethod: "Bank Transfer",
    notes: "Employee medical checkup - annual health screening",
    items: [
      { id: "ei35", description: "Corporate Health Screening - NMC Royal", category: "medical", amount: 3600, date: "2026-05-04" },
      { id: "ei36", description: "Transport for employees", category: "travel", amount: 1200, date: "2026-05-04" },
    ],
  },
];

export const expensesSummary = {
  total: 15,
  draft: 1,
  submitted: 4,
  approved: 4,
  rejected: 2,
  paid: 6,
  totalAmount: 114650,
  totalPaid: 46000,
  pendingApproval: 38700,
};
