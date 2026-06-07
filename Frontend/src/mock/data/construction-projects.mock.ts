export type ProjectStatus = "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type ProjectType = "residential" | "commercial" | "infrastructure" | "industrial";

export interface ProjectPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "not_started" | "in_progress" | "completed" | "delayed";
  completionPct: number;
}

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  client: string;
  location: string;
  projectType: ProjectType;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  contractValue: number;
  budgetSpent: number;
  budgetRemaining: number;
  completionPct: number;
  projectManager: string;
  siteEngineer: string;
  phases: ProjectPhase[];
  workers: number;
  notes: string;
}

export const projects: Project[] = [
  {
    id: "proj-001",
    projectNumber: "CONS-2024-001",
    name: "Luxury Villa Complex",
    client: "Nakheel Properties",
    location: "Palm Jumeirah, Dubai",
    projectType: "residential",
    status: "in_progress",
    startDate: "2024-03-01",
    endDate: "2026-08-31",
    contractValue: 85000000,
    budgetSpent: 52400000,
    budgetRemaining: 32600000,
    completionPct: 62,
    projectManager: "Eng. Hamad Al Falasi",
    siteEngineer: "Eng. Pradeep Nambiar",
    workers: 340,
    notes: "24 luxury villas with private pools. Ahead of schedule by 3 weeks.",
    phases: [
      { id: "ph-001a", name: "Foundation & Substructure", startDate: "2024-03-01", endDate: "2024-09-30", status: "completed", completionPct: 100 },
      { id: "ph-001b", name: "Superstructure", startDate: "2024-10-01", endDate: "2025-06-30", status: "completed", completionPct: 100 },
      { id: "ph-001c", name: "MEP Rough-In", startDate: "2025-07-01", endDate: "2025-12-31", status: "completed", completionPct: 100 },
      { id: "ph-001d", name: "Finishing & Fit-Out", startDate: "2026-01-01", endDate: "2026-06-30", status: "in_progress", completionPct: 55 },
      { id: "ph-001e", name: "Landscaping & External Works", startDate: "2026-05-01", endDate: "2026-08-31", status: "in_progress", completionPct: 15 },
    ],
  },
  {
    id: "proj-002",
    projectNumber: "CONS-2024-002",
    name: "Commercial Tower — Business Bay",
    client: "DAMAC Properties",
    location: "Business Bay, Dubai",
    projectType: "commercial",
    status: "in_progress",
    startDate: "2024-06-01",
    endDate: "2027-05-31",
    contractValue: 320000000,
    budgetSpent: 96500000,
    budgetRemaining: 223500000,
    completionPct: 30,
    projectManager: "Eng. Yousuf Al Khoury",
    siteEngineer: "Eng. Ramesh Subramaniam",
    workers: 680,
    notes: "48-storey mixed-use tower. Floor 1-20 structural works complete.",
    phases: [
      { id: "ph-002a", name: "Site Preparation & Piling", startDate: "2024-06-01", endDate: "2024-10-31", status: "completed", completionPct: 100 },
      { id: "ph-002b", name: "Basement & Podium", startDate: "2024-11-01", endDate: "2025-04-30", status: "completed", completionPct: 100 },
      { id: "ph-002c", name: "Tower Structure (Floors 1-24)", startDate: "2025-05-01", endDate: "2025-12-31", status: "in_progress", completionPct: 62 },
      { id: "ph-002d", name: "Tower Structure (Floors 25-48)", startDate: "2026-01-01", endDate: "2026-08-31", status: "not_started", completionPct: 0 },
      { id: "ph-002e", name: "Facade & External Cladding", startDate: "2026-06-01", endDate: "2026-12-31", status: "not_started", completionPct: 0 },
      { id: "ph-002f", name: "MEP & Fit-Out", startDate: "2026-09-01", endDate: "2027-04-30", status: "not_started", completionPct: 0 },
    ],
  },
  {
    id: "proj-003",
    projectNumber: "CONS-2023-003",
    name: "Abu Dhabi Ring Road Expansion",
    client: "Abu Dhabi Department of Municipalities",
    location: "Abu Dhabi Ring Road, Abu Dhabi",
    projectType: "infrastructure",
    status: "in_progress",
    startDate: "2023-09-01",
    endDate: "2026-06-30",
    contractValue: 145000000,
    budgetSpent: 118000000,
    budgetRemaining: 27000000,
    completionPct: 81,
    projectManager: "Eng. Sultan Al Dhaheri",
    siteEngineer: "Eng. Vijay Krishnamurthy",
    workers: 520,
    notes: "18km dual-carriageway road with 3 interchanges and 5 bridges.",
    phases: [
      { id: "ph-003a", name: "Earthworks & Grading", startDate: "2023-09-01", endDate: "2024-03-31", status: "completed", completionPct: 100 },
      { id: "ph-003b", name: "Drainage & Utilities", startDate: "2024-01-01", endDate: "2024-09-30", status: "completed", completionPct: 100 },
      { id: "ph-003c", name: "Pavement & Asphalt", startDate: "2024-06-01", endDate: "2025-06-30", status: "completed", completionPct: 100 },
      { id: "ph-003d", name: "Bridge Works", startDate: "2024-03-01", endDate: "2026-03-31", status: "in_progress", completionPct: 90 },
      { id: "ph-003e", name: "Road Furniture & Landscaping", startDate: "2025-10-01", endDate: "2026-06-30", status: "in_progress", completionPct: 45 },
    ],
  },
  {
    id: "proj-004",
    projectNumber: "CONS-2025-004",
    name: "KIZAD Industrial Warehouse Complex",
    client: "Abu Dhabi Ports",
    location: "KIZAD, Abu Dhabi",
    projectType: "industrial",
    status: "in_progress",
    startDate: "2025-01-15",
    endDate: "2026-10-31",
    contractValue: 62000000,
    budgetSpent: 28500000,
    budgetRemaining: 33500000,
    completionPct: 46,
    projectManager: "Eng. Mariam Al Nuaimi",
    siteEngineer: "Eng. Suresh Menon",
    workers: 290,
    notes: "6 industrial warehouse units totalling 48,000 sqm. Pre-engineered steel structure.",
    phases: [
      { id: "ph-004a", name: "Site Clearance & Earthworks", startDate: "2025-01-15", endDate: "2025-03-31", status: "completed", completionPct: 100 },
      { id: "ph-004b", name: "Foundation", startDate: "2025-04-01", endDate: "2025-07-31", status: "completed", completionPct: 100 },
      { id: "ph-004c", name: "Steel Structure Erection", startDate: "2025-08-01", endDate: "2026-01-31", status: "in_progress", completionPct: 70 },
      { id: "ph-004d", name: "Roofing & Cladding", startDate: "2025-12-01", endDate: "2026-05-31", status: "in_progress", completionPct: 20 },
      { id: "ph-004e", name: "Internal Services & Fit-Out", startDate: "2026-05-01", endDate: "2026-10-31", status: "not_started", completionPct: 0 },
    ],
  },
  {
    id: "proj-005",
    projectNumber: "CONS-2025-005",
    name: "JBR Hotel Renovation",
    client: "Jumeirah Group",
    location: "Jumeirah Beach Residence, Dubai",
    projectType: "commercial",
    status: "on_hold",
    startDate: "2025-03-01",
    endDate: "2026-04-30",
    contractValue: 28000000,
    budgetSpent: 8400000,
    budgetRemaining: 19600000,
    completionPct: 30,
    projectManager: "Eng. Leila Hassan",
    siteEngineer: "Eng. Anwar Ibrahim",
    workers: 0,
    notes: "5-star hotel full renovation. On hold pending client approvals for revised design.",
    phases: [
      { id: "ph-005a", name: "Demolition & Strip Out", startDate: "2025-03-01", endDate: "2025-05-31", status: "completed", completionPct: 100 },
      { id: "ph-005b", name: "Structural Repairs", startDate: "2025-06-01", endDate: "2025-08-31", status: "completed", completionPct: 100 },
      { id: "ph-005c", name: "MEP Upgrade", startDate: "2025-09-01", endDate: "2025-12-31", status: "in_progress", completionPct: 40 },
      { id: "ph-005d", name: "Fit-Out & FF&E", startDate: "2026-01-01", endDate: "2026-04-30", status: "not_started", completionPct: 0 },
    ],
  },
  {
    id: "proj-006",
    projectNumber: "CONS-2024-006",
    name: "Dubai Creek Mixed-Use Development",
    client: "Dubai Creek Harbour LLC",
    location: "Dubai Creek Harbour, Dubai",
    projectType: "residential",
    status: "planning",
    startDate: "2026-09-01",
    endDate: "2029-12-31",
    contractValue: 580000000,
    budgetSpent: 4200000,
    budgetRemaining: 575800000,
    completionPct: 1,
    projectManager: "Eng. Khalifa Al Marzouqi",
    siteEngineer: "TBD",
    workers: 0,
    notes: "3 towers (35, 40, 45 floors) with retail podium and waterfront promenade. Design phase.",
    phases: [
      { id: "ph-006a", name: "Design & Approvals", startDate: "2026-09-01", endDate: "2026-12-31", status: "in_progress", completionPct: 30 },
      { id: "ph-006b", name: "Piling & Foundation", startDate: "2027-01-01", endDate: "2027-08-31", status: "not_started", completionPct: 0 },
      { id: "ph-006c", name: "Tower Structure", startDate: "2027-09-01", endDate: "2028-12-31", status: "not_started", completionPct: 0 },
      { id: "ph-006d", name: "Facade & Fit-Out", startDate: "2029-01-01", endDate: "2029-12-31", status: "not_started", completionPct: 0 },
    ],
  },
  {
    id: "proj-007",
    projectNumber: "CONS-2023-007",
    name: "Sharjah Model School",
    client: "Sharjah Education Council",
    location: "Al Majaz, Sharjah",
    projectType: "commercial",
    status: "completed",
    startDate: "2023-06-01",
    endDate: "2025-08-31",
    contractValue: 18500000,
    budgetSpent: 17900000,
    budgetRemaining: 600000,
    completionPct: 100,
    projectManager: "Eng. Noura Al Qasimi",
    siteEngineer: "Eng. Thomas George",
    workers: 0,
    notes: "K-12 school building, 3-storey, 42 classrooms, smart labs, gymnasium.",
    phases: [
      { id: "ph-007a", name: "Foundation", startDate: "2023-06-01", endDate: "2023-10-31", status: "completed", completionPct: 100 },
      { id: "ph-007b", name: "Superstructure", startDate: "2023-11-01", endDate: "2024-06-30", status: "completed", completionPct: 100 },
      { id: "ph-007c", name: "MEP", startDate: "2024-07-01", endDate: "2024-12-31", status: "completed", completionPct: 100 },
      { id: "ph-007d", name: "Finishing", startDate: "2025-01-01", endDate: "2025-06-30", status: "completed", completionPct: 100 },
      { id: "ph-007e", name: "External Works & Handover", startDate: "2025-07-01", endDate: "2025-08-31", status: "completed", completionPct: 100 },
    ],
  },
  {
    id: "proj-008",
    projectNumber: "CONS-2025-008",
    name: "Dubai South Data Centre",
    client: "Khazna Data Centres",
    location: "Dubai South, Dubai",
    projectType: "industrial",
    status: "in_progress",
    startDate: "2025-05-01",
    endDate: "2027-02-28",
    contractValue: 210000000,
    budgetSpent: 38600000,
    budgetRemaining: 171400000,
    completionPct: 18,
    projectManager: "Eng. Saeed Al Suwaidi",
    siteEngineer: "Eng. Deepak Sharma",
    workers: 420,
    notes: "Tier III data centre, 20MW IT load capacity. Hyperscale design.",
    phases: [
      { id: "ph-008a", name: "Civil & Structural", startDate: "2025-05-01", endDate: "2025-12-31", status: "in_progress", completionPct: 75 },
      { id: "ph-008b", name: "Power Infrastructure", startDate: "2025-10-01", endDate: "2026-06-30", status: "in_progress", completionPct: 20 },
      { id: "ph-008c", name: "Cooling Systems", startDate: "2026-01-01", endDate: "2026-08-31", status: "not_started", completionPct: 0 },
      { id: "ph-008d", name: "IT Infrastructure Fit-Out", startDate: "2026-07-01", endDate: "2027-01-31", status: "not_started", completionPct: 0 },
      { id: "ph-008e", name: "Testing, Commissioning & Handover", startDate: "2026-12-01", endDate: "2027-02-28", status: "not_started", completionPct: 0 },
    ],
  },
];

export const projectsSummary = {
  total: projects.length,
  inProgress: projects.filter((p) => p.status === "in_progress").length,
  completed: projects.filter((p) => p.status === "completed").length,
  onHold: projects.filter((p) => p.status === "on_hold").length,
  planning: projects.filter((p) => p.status === "planning").length,
  totalContractValue: projects.reduce((s, p) => s + p.contractValue, 0),
  totalSpent: projects.reduce((s, p) => s + p.budgetSpent, 0),
  avgCompletion: Math.round(
    projects.filter((p) => p.status !== "planning").reduce((s, p) => s + p.completionPct, 0) /
      projects.filter((p) => p.status !== "planning").length
  ),
};
