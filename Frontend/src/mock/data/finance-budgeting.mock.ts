export type BudgetPeriod = "monthly" | "quarterly" | "annual";
export type BudgetStatus = "draft" | "approved" | "active" | "closed";

export interface BudgetLine {
  id: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number; // actual - budget (negative = under budget, positive = over)
  variancePct: number;
  isOverBudget: boolean;
}

export interface Budget {
  id: string;
  name: string;
  department: string;
  fiscalYear: "2026";
  period: BudgetPeriod;
  status: BudgetStatus;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePct: number;
  lines: BudgetLine[];
  approvedBy: string;
  createdBy: string;
}

export const mockBudgets: Budget[] = [
  {
    id: "b1",
    name: "Engineering FY2026",
    department: "Engineering",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 4800000,
    totalActual: 3950000,
    totalVariance: -850000,
    variancePct: -17.7,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Sara Al Hashimi",
    lines: [
      { id: "bl1", category: "Salaries & Benefits", budgetAmount: 3200000, actualAmount: 2780000, variance: -420000, variancePct: -13.1, isOverBudget: false },
      { id: "bl2", category: "Software Licenses", budgetAmount: 480000, actualAmount: 510000, variance: 30000, variancePct: 6.3, isOverBudget: true },
      { id: "bl3", category: "Cloud Infrastructure", budgetAmount: 360000, actualAmount: 298000, variance: -62000, variancePct: -17.2, isOverBudget: false },
      { id: "bl4", category: "Training & Certification", budgetAmount: 180000, actualAmount: 142000, variance: -38000, variancePct: -21.1, isOverBudget: false },
      { id: "bl5", category: "Equipment & Hardware", budgetAmount: 240000, actualAmount: 168000, variance: -72000, variancePct: -30.0, isOverBudget: false },
      { id: "bl6", category: "Recruitment", budgetAmount: 180000, actualAmount: 122000, variance: -58000, variancePct: -32.2, isOverBudget: false },
      { id: "bl7", category: "Travel", budgetAmount: 96000, actualAmount: 85000, variance: -11000, variancePct: -11.5, isOverBudget: false },
      { id: "bl8", category: "Miscellaneous", budgetAmount: 64000, actualAmount: 45000, variance: -19000, variancePct: -29.7, isOverBudget: false },
    ],
  },
  {
    id: "b2",
    name: "Sales FY2026",
    department: "Sales",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 3200000,
    totalActual: 3580000,
    totalVariance: 380000,
    variancePct: 11.9,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Khalid Al Rashidi",
    lines: [
      { id: "bl9", category: "Salaries & Commission", budgetAmount: 1800000, actualAmount: 2050000, variance: 250000, variancePct: 13.9, isOverBudget: true },
      { id: "bl10", category: "Client Entertainment", budgetAmount: 280000, actualAmount: 342000, variance: 62000, variancePct: 22.1, isOverBudget: true },
      { id: "bl11", category: "Trade Shows & Events", budgetAmount: 320000, actualAmount: 385000, variance: 65000, variancePct: 20.3, isOverBudget: true },
      { id: "bl12", category: "Sales Tools (CRM)", budgetAmount: 180000, actualAmount: 168000, variance: -12000, variancePct: -6.7, isOverBudget: false },
      { id: "bl13", category: "Travel", budgetAmount: 360000, actualAmount: 520000, variance: 160000, variancePct: 44.4, isOverBudget: true },
      { id: "bl14", category: "Training", budgetAmount: 120000, actualAmount: 72000, variance: -48000, variancePct: -40.0, isOverBudget: false },
      { id: "bl15", category: "Office Supplies", budgetAmount: 60000, actualAmount: 43000, variance: -17000, variancePct: -28.3, isOverBudget: false },
      { id: "bl16", category: "Miscellaneous", budgetAmount: 80000, actualAmount: 0, variance: -80000, variancePct: -100.0, isOverBudget: false },
    ],
  },
  {
    id: "b3",
    name: "Marketing FY2026",
    department: "Marketing",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 2400000,
    totalActual: 2180000,
    totalVariance: -220000,
    variancePct: -9.2,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Layla Al Farsi",
    lines: [
      { id: "bl17", category: "Digital Advertising", budgetAmount: 720000, actualAmount: 685000, variance: -35000, variancePct: -4.9, isOverBudget: false },
      { id: "bl18", category: "Content Creation", budgetAmount: 360000, actualAmount: 295000, variance: -65000, variancePct: -18.1, isOverBudget: false },
      { id: "bl19", category: "Brand & Creative", budgetAmount: 280000, actualAmount: 312000, variance: 32000, variancePct: 11.4, isOverBudget: true },
      { id: "bl20", category: "PR & Media", budgetAmount: 240000, actualAmount: 198000, variance: -42000, variancePct: -17.5, isOverBudget: false },
      { id: "bl21", category: "Salaries", budgetAmount: 480000, actualAmount: 480000, variance: 0, variancePct: 0, isOverBudget: false },
      { id: "bl22", category: "Tools & Subscriptions", budgetAmount: 120000, actualAmount: 135000, variance: 15000, variancePct: 12.5, isOverBudget: true },
      { id: "bl23", category: "Events & Sponsorships", budgetAmount: 160000, actualAmount: 75000, variance: -85000, variancePct: -53.1, isOverBudget: false },
      { id: "bl24", category: "Research & Analytics", budgetAmount: 40000, actualAmount: 0, variance: -40000, variancePct: -100.0, isOverBudget: false },
    ],
  },
  {
    id: "b4",
    name: "HR & People FY2026",
    department: "HR",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 1800000,
    totalActual: 1650000,
    totalVariance: -150000,
    variancePct: -8.3,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Fatima Al Zaabi",
    lines: [
      { id: "bl25", category: "HR Team Salaries", budgetAmount: 960000, actualAmount: 880000, variance: -80000, variancePct: -8.3, isOverBudget: false },
      { id: "bl26", category: "Recruitment Costs", budgetAmount: 240000, actualAmount: 285000, variance: 45000, variancePct: 18.8, isOverBudget: true },
      { id: "bl27", category: "Employee Training", budgetAmount: 180000, actualAmount: 145000, variance: -35000, variancePct: -19.4, isOverBudget: false },
      { id: "bl28", category: "Employee Benefits Admin", budgetAmount: 120000, actualAmount: 115000, variance: -5000, variancePct: -4.2, isOverBudget: false },
      { id: "bl29", category: "HRMS Software", budgetAmount: 120000, actualAmount: 120000, variance: 0, variancePct: 0, isOverBudget: false },
      { id: "bl30", category: "Employee Events", budgetAmount: 100000, actualAmount: 82000, variance: -18000, variancePct: -18.0, isOverBudget: false },
      { id: "bl31", category: "Compliance & Legal", budgetAmount: 60000, actualAmount: 23000, variance: -37000, variancePct: -61.7, isOverBudget: false },
      { id: "bl32", category: "Miscellaneous", budgetAmount: 20000, actualAmount: 0, variance: -20000, variancePct: -100.0, isOverBudget: false },
    ],
  },
  {
    id: "b5",
    name: "IT Infrastructure FY2026",
    department: "IT",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 2100000,
    totalActual: 2380000,
    totalVariance: 280000,
    variancePct: 13.3,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Omar Al Tamimi",
    lines: [
      { id: "bl33", category: "IT Staff Salaries", budgetAmount: 960000, actualAmount: 980000, variance: 20000, variancePct: 2.1, isOverBudget: true },
      { id: "bl34", category: "Cloud Services (AWS/Azure)", budgetAmount: 420000, actualAmount: 512000, variance: 92000, variancePct: 21.9, isOverBudget: true },
      { id: "bl35", category: "Network & Security", budgetAmount: 240000, actualAmount: 285000, variance: 45000, variancePct: 18.8, isOverBudget: true },
      { id: "bl36", category: "Hardware Refresh", budgetAmount: 180000, actualAmount: 245000, variance: 65000, variancePct: 36.1, isOverBudget: true },
      { id: "bl37", category: "Software Licenses", budgetAmount: 180000, actualAmount: 225000, variance: 45000, variancePct: 25.0, isOverBudget: true },
      { id: "bl38", category: "Backup & DR", budgetAmount: 60000, actualAmount: 68000, variance: 8000, variancePct: 13.3, isOverBudget: true },
      { id: "bl39", category: "Support Contracts", budgetAmount: 48000, actualAmount: 58000, variance: 10000, variancePct: 20.8, isOverBudget: true },
      { id: "bl40", category: "Training", budgetAmount: 12000, actualAmount: 7000, variance: -5000, variancePct: -41.7, isOverBudget: false },
    ],
  },
  {
    id: "b6",
    name: "Operations FY2026",
    department: "Operations",
    fiscalYear: "2026",
    period: "annual",
    status: "active",
    totalBudget: 3600000,
    totalActual: 3420000,
    totalVariance: -180000,
    variancePct: -5.0,
    approvedBy: "Ahmed Al Mansoori",
    createdBy: "Hassan Al Nuaimi",
    lines: [
      { id: "bl41", category: "Operations Staff", budgetAmount: 1680000, actualAmount: 1620000, variance: -60000, variancePct: -3.6, isOverBudget: false },
      { id: "bl42", category: "Facility Costs", budgetAmount: 480000, actualAmount: 510000, variance: 30000, variancePct: 6.3, isOverBudget: true },
      { id: "bl43", category: "Logistics & Shipping", budgetAmount: 360000, actualAmount: 295000, variance: -65000, variancePct: -18.1, isOverBudget: false },
      { id: "bl44", category: "Vehicle Fleet", budgetAmount: 240000, actualAmount: 228000, variance: -12000, variancePct: -5.0, isOverBudget: false },
      { id: "bl45", category: "Maintenance & Repair", budgetAmount: 360000, actualAmount: 392000, variance: 32000, variancePct: 8.9, isOverBudget: true },
      { id: "bl46", category: "Safety & Compliance", budgetAmount: 180000, actualAmount: 145000, variance: -35000, variancePct: -19.4, isOverBudget: false },
      { id: "bl47", category: "Energy & Utilities", budgetAmount: 180000, actualAmount: 168000, variance: -12000, variancePct: -6.7, isOverBudget: false },
      { id: "bl48", category: "Miscellaneous", budgetAmount: 120000, actualAmount: 62000, variance: -58000, variancePct: -48.3, isOverBudget: false },
    ],
  },
];

export const budgetingSummary = {
  totalBudget: 17900000,
  totalActual: 17160000,
  overallVariance: -740000,
  variancePct: -4.1,
  depsOverBudget: 2,
  depsUnderBudget: 4,
  utilisation: 95.9,
};
