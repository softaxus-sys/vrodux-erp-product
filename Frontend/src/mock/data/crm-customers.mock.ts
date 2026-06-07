export type CustomerStatus = "active" | "inactive" | "at_risk" | "churned";
export type CustomerTier = "standard" | "silver" | "gold" | "platinum";

export interface CustomerContact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  department: string;
}

export interface CustomerDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  closedDate?: string;
}

export interface CustomerActivity {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "support";
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface Customer {
  id: string;
  name: string;
  tradeName?: string;
  industry: string;
  website?: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: CustomerStatus;
  tier: CustomerTier;
  accountManager: string;
  since: string;
  lastActivity?: string;
  totalRevenue: number;
  openDeals: number;
  currency: string;
  employees?: string;
  description: string;
  contacts: CustomerContact[];
  deals: CustomerDeal[];
  activities: CustomerActivity[];
  tags: string[];
  contractRenewal?: string;
  npsScore?: number;
}

export const mockCustomers: Customer[] = [
  {
    id: "cust-001",
    name: "Emirates NBD",
    industry: "Banking",
    website: "emiratesnbd.com",
    country: "UAE", city: "Dubai",
    address: "Baniyas Road, Deira, Dubai, UAE",
    phone: "+971 4 201 2000",
    email: "erp@emiratesnbd.com",
    status: "active", tier: "platinum",
    accountManager: "Priya Sharma",
    since: "2024-02-28",
    lastActivity: "2026-05-15",
    totalRevenue: 175000,
    openDeals: 0,
    currency: "AED",
    employees: "5,000+",
    description: "Emirates NBD is one of the largest banking groups in the Middle East. Implemented our Finance & Accounting Suite in Q1 2024.",
    contacts: [
      { id: "cc1", name: "Suresh Menon", title: "CFO", email: "s.menon@emiratesnbd.com", phone: "+971 4 201 2001", isPrimary: true, department: "Finance" },
      { id: "cc2", name: "Rania Al Rashid", title: "IT Director", email: "r.rashid@emiratesnbd.com", phone: "+971 4 201 2050", isPrimary: false, department: "Technology" },
      { id: "cc3", name: "Joseph Thomas", title: "Finance Manager", email: "j.thomas@emiratesnbd.com", phone: "+971 4 201 2030", isPrimary: false, department: "Finance" },
    ],
    deals: [
      { id: "deal-006", title: "Finance & Accounting Suite", value: 175000, currency: "AED", status: "won", closedDate: "2024-02-28" },
    ],
    activities: [
      { id: "ca1", type: "meeting", title: "Quarterly Business Review", description: "Q1 2026 QBR. All KPIs green. Discussed upsell to HR module.", date: "2026-04-10", by: "Priya Sharma" },
      { id: "ca2", type: "email", title: "HR Module Proposal", description: "Sent HR module add-on proposal. Value: AED 85,000.", date: "2026-05-05", by: "Priya Sharma" },
      { id: "ca3", type: "call", title: "Support Follow-up", description: "Resolved month-end reporting query. Client satisfied.", date: "2026-05-15", by: "Priya Sharma" },
    ],
    tags: ["Banking", "Platinum", "Upsell Opportunity"],
    contractRenewal: "2027-02-28",
    npsScore: 9,
  },
  {
    id: "cust-002",
    name: "Emaar Properties",
    industry: "Real Estate",
    website: "emaar.com",
    country: "UAE", city: "Dubai",
    address: "Emaar Square, Downtown Dubai, UAE",
    phone: "+971 4 367 3888",
    email: "erp@emaar.ae",
    status: "active", tier: "platinum",
    accountManager: "Sarah Mitchell",
    since: "2024-03-31",
    lastActivity: "2026-05-18",
    totalRevenue: 480000,
    openDeals: 1,
    currency: "AED",
    employees: "15,000+",
    description: "Emaar Properties is a global property developer with iconic projects. Full ERP implementation across Finance, HR, Construction, and Real Estate modules.",
    contacts: [
      { id: "cc4", name: "Khalid Al Rashidi", title: "CTO", email: "k.rashidi@emaar.ae", phone: "+971 50 234 5678", isPrimary: true, department: "Technology" },
      { id: "cc5", name: "Samira Al Ansari", title: "Finance Director", email: "s.ansari@emaar.ae", phone: "+971 4 367 3900", isPrimary: false, department: "Finance" },
      { id: "cc6", name: "Brian Walsh", title: "IT Manager", email: "b.walsh@emaar.ae", phone: "+971 4 367 3901", isPrimary: false, department: "Technology" },
    ],
    deals: [
      { id: "deal-001", title: "Enterprise ERP Implementation", value: 480000, currency: "AED", status: "negotiation" },
    ],
    activities: [
      { id: "ca4", type: "meeting", title: "Contract Negotiation", description: "3rd negotiation round. Close to final terms.", date: "2026-05-18", by: "Sarah Mitchell" },
      { id: "ca5", type: "call", title: "Technical Deep-dive", description: "Architecture review with CTO. Approved cloud deployment model.", date: "2026-04-20", by: "Sarah Mitchell" },
    ],
    tags: ["Real Estate", "Platinum", "Enterprise", "Active Implementation"],
    contractRenewal: "2027-03-31",
    npsScore: 8,
  },
  {
    id: "cust-003",
    name: "DAMAC Holdings",
    industry: "Real Estate",
    website: "damacproperties.com",
    country: "UAE", city: "Dubai",
    address: "DAMAC Tower, Business Bay, Dubai, UAE",
    phone: "+971 4 319 9999",
    email: "tech@damac.ae",
    status: "active", tier: "gold",
    accountManager: "Omar Farooq",
    since: "2024-04-15",
    lastActivity: "2026-05-12",
    totalRevenue: 125000,
    openDeals: 1,
    currency: "AED",
    employees: "2,000+",
    description: "DAMAC Properties is a luxury real estate developer. Implemented HR & Payroll module for their UAE operations.",
    contacts: [
      { id: "cc7", name: "Fatima Al Maktoum", title: "HR Director", email: "f.maktoum@damac.ae", phone: "+971 55 876 4321", isPrimary: true, department: "HR" },
      { id: "cc8", name: "Ahmed Yousef", title: "IT Manager", email: "a.yousef@damac.ae", phone: "+971 4 319 9910", isPrimary: false, department: "Technology" },
    ],
    deals: [
      { id: "deal-002", title: "HR & Payroll Module", value: 125000, currency: "AED", status: "proposal" },
    ],
    activities: [
      { id: "ca6", type: "email", title: "HR Module Update", description: "Sent latest HR module capabilities. WPS compliance highlighted.", date: "2026-05-12", by: "Omar Farooq" },
      { id: "ca7", type: "call", title: "Demo Prep Call", description: "Aligned on demo agenda. 15 HR staff will attend.", date: "2026-05-02", by: "Omar Farooq" },
    ],
    tags: ["Real Estate", "Gold", "HR Module"],
    contractRenewal: "2025-04-15",
    npsScore: 7,
  },
  {
    id: "cust-004",
    name: "Al Futtaim Retail",
    industry: "Retail",
    website: "alfuttaim.com",
    country: "UAE", city: "Dubai",
    address: "Festival City, Dubai, UAE",
    phone: "+971 4 213 5000",
    email: "digital@alfuttaim.ae",
    status: "active", tier: "gold",
    accountManager: "Priya Sharma",
    since: "2024-05-30",
    lastActivity: "2026-05-10",
    totalRevenue: 220000,
    openDeals: 1,
    currency: "AED",
    employees: "10,000+",
    description: "Al Futtaim Retail operates 50+ outlets across UAE. Implementing Inventory & Supply Chain Management module.",
    contacts: [
      { id: "cc9", name: "James Whitfield", title: "Operations Director", email: "j.whitfield@alfuttaim.ae", phone: "+971 50 111 2233", isPrimary: true, department: "Operations" },
      { id: "cc10", name: "Sandra Liu", title: "IT Head", email: "s.liu@alfuttaim.ae", phone: "+971 4 213 5020", isPrimary: false, department: "Technology" },
    ],
    deals: [
      { id: "deal-003", title: "Inventory & Supply Chain", value: 220000, currency: "AED", status: "qualified" },
    ],
    activities: [
      { id: "ca8", type: "meeting", title: "Inventory Module Demo", description: "Live demo of inventory module to 8 stakeholders. Very positive feedback.", date: "2026-05-10", by: "Priya Sharma" },
    ],
    tags: ["Retail", "Gold", "Inventory"],
    contractRenewal: "2025-05-30",
    npsScore: 8,
  },
  {
    id: "cust-005",
    name: "Jumeirah Group",
    industry: "Hospitality",
    website: "jumeirah.com",
    country: "UAE", city: "Dubai",
    address: "Jumeirah Beach Road, Dubai, UAE",
    phone: "+971 4 366 5000",
    email: "technology@jumeirah.com",
    status: "active", tier: "silver",
    accountManager: "Sarah Mitchell",
    since: "2025-01-15",
    lastActivity: "2026-05-08",
    totalRevenue: 0,
    openDeals: 1,
    currency: "AED",
    employees: "14,000+",
    description: "Jumeirah Group is a global luxury hospitality company. Currently in lead stage for Hotel Management System.",
    contacts: [
      { id: "cc11", name: "Elena Voronova", title: "VP Technology", email: "e.voronova@jumeirah.com", phone: "+971 4 366 5001", isPrimary: true, department: "Technology" },
    ],
    deals: [
      { id: "deal-004", title: "Hotel Management System", value: 380000, currency: "AED", status: "lead" },
    ],
    activities: [
      { id: "ca9", type: "email", title: "Hospitality Module Update", description: "Shared latest product roadmap for hospitality features.", date: "2026-05-08", by: "Sarah Mitchell" },
    ],
    tags: ["Hospitality", "Silver", "PMS"],
    npsScore: 7,
  },
  {
    id: "cust-006",
    name: "Arabtec Holding",
    industry: "Construction",
    website: "arabtec.com",
    country: "UAE", city: "Dubai",
    address: "Arabtec Tower, Business Bay, Dubai, UAE",
    phone: "+971 4 600 1000",
    email: "it@arabtec.ae",
    status: "active", tier: "gold",
    accountManager: "Omar Farooq",
    since: "2025-05-15",
    lastActivity: "2026-05-09",
    totalRevenue: 290000,
    openDeals: 1,
    currency: "AED",
    employees: "20,000+",
    description: "One of the largest construction companies in the Middle East. Implementing Construction Project ERP for major infrastructure projects.",
    contacts: [
      { id: "cc12", name: "Mohammed Al Qassim", title: "IT Manager", email: "m.qassim@arabtec.ae", phone: "+971 50 987 6543", isPrimary: true, department: "Technology" },
      { id: "cc13", name: "Lara Haddad", title: "Finance Controller", email: "l.haddad@arabtec.ae", phone: "+971 4 600 1010", isPrimary: false, department: "Finance" },
    ],
    deals: [
      { id: "deal-005", title: "Construction Project ERP", value: 290000, currency: "AED", status: "qualified" },
    ],
    activities: [
      { id: "ca10", type: "meeting", title: "Proposal Review", description: "Reviewed proposal with IT and Finance. Minor revisions needed.", date: "2026-05-09", by: "Omar Farooq" },
    ],
    tags: ["Construction", "Gold", "Project Management"],
    contractRenewal: "2026-05-15",
    npsScore: 8,
  },
  {
    id: "cust-007",
    name: "Aster DM Healthcare",
    industry: "Healthcare",
    website: "asterdmhealthcare.com",
    country: "UAE", city: "Dubai",
    address: "Aster HQ, Al Qusais, Dubai, UAE",
    phone: "+971 4 440 0500",
    email: "cio@asterdm.com",
    status: "active", tier: "silver",
    accountManager: "Sarah Mitchell",
    since: "2025-03-01",
    lastActivity: "2026-05-17",
    totalRevenue: 0,
    openDeals: 1,
    currency: "AED",
    employees: "20,000+",
    description: "Aster DM Healthcare is a leading healthcare provider with 10 hospitals across UAE. In active proposal stage for comprehensive healthcare ERP.",
    contacts: [
      { id: "cc14", name: "Dr. Sanjay Kumar", title: "Group CIO", email: "s.kumar@asterdm.com", phone: "+971 4 440 0501", isPrimary: true, department: "Technology" },
      { id: "cc15", name: "Meera Krishnan", title: "Finance Director", email: "m.krishnan@asterdm.com", phone: "+971 4 440 0502", isPrimary: false, department: "Finance" },
    ],
    deals: [
      { id: "deal-008", title: "Healthcare ERP", value: 520000, currency: "AED", status: "proposal" },
    ],
    activities: [
      { id: "ca11", type: "meeting", title: "Board Presentation Prep", description: "Rehearsal session for upcoming board presentation.", date: "2026-05-17", by: "Sarah Mitchell" },
    ],
    tags: ["Healthcare", "Silver", "Multi-hospital", "High Value"],
    npsScore: 7,
  },
  {
    id: "cust-008",
    name: "Careem",
    industry: "Technology",
    website: "careem.com",
    country: "UAE", city: "Dubai",
    address: "Building 1, Dubai Internet City, UAE",
    phone: "+971 4 550 1234",
    email: "hr@careem.com",
    status: "active", tier: "silver",
    accountManager: "Priya Sharma",
    since: "2026-03-20",
    lastActivity: "2026-05-14",
    totalRevenue: 42000,
    openDeals: 1,
    currency: "AED",
    employees: "5,000+",
    description: "Careem is a leading ride-sharing and delivery platform. Running a 3-month payroll pilot for UAE entity.",
    contacts: [
      { id: "cc16", name: "Nadia Al Hajj", title: "HR Lead", email: "n.hajj@careem.com", phone: "+971 50 700 1234", isPrimary: true, department: "HR" },
    ],
    deals: [
      { id: "deal-009", title: "Payroll Only - Pilot", value: 42000, currency: "AED", status: "negotiation" },
    ],
    activities: [
      { id: "ca12", type: "call", title: "Pilot Progress Check", description: "2-week pilot check-in. HR team happy with payroll accuracy.", date: "2026-05-14", by: "Priya Sharma" },
    ],
    tags: ["Technology", "Silver", "Pilot", "Upsell Target"],
    npsScore: 8,
  },
  {
    id: "cust-009",
    name: "Nakheel Properties",
    industry: "Real Estate",
    website: "nakheel.com",
    country: "UAE", city: "Dubai",
    address: "Nakheel HQ, Palm Jumeirah, Dubai, UAE",
    phone: "+971 4 390 3333",
    email: "it@nakheel.com",
    status: "active", tier: "silver",
    accountManager: "Sarah Mitchell",
    since: "2025-06-01",
    lastActivity: "2026-05-11",
    totalRevenue: 0,
    openDeals: 1,
    currency: "AED",
    employees: "3,000+",
    description: "Nakheel Properties is an iconic developer behind Palm Jumeirah. In the qualified stage for Real Estate CRM + ERP.",
    contacts: [
      { id: "cc17", name: "Rashid Al Falasi", title: "Head of IT", email: "r.falasi@nakheel.com", phone: "+971 4 390 3334", isPrimary: true, department: "Technology" },
    ],
    deals: [
      { id: "deal-011", title: "Real Estate CRM + ERP", value: 340000, currency: "AED", status: "qualified" },
    ],
    activities: [
      { id: "ca13", type: "email", title: "Proposal Submission", description: "Submitted full proposal. Awaiting review committee.", date: "2026-05-11", by: "Sarah Mitchell" },
    ],
    tags: ["Real Estate", "Silver", "CRM"],
    npsScore: 7,
  },
  {
    id: "cust-010",
    name: "Majid Al Futtaim",
    industry: "Retail",
    website: "majidalfuttaim.com",
    country: "UAE", city: "Dubai",
    address: "Mall of the Emirates, Dubai, UAE",
    phone: "+971 4 294 0000",
    email: "digital@maf.ae",
    status: "inactive", tier: "standard",
    accountManager: "Omar Farooq",
    since: "2024-12-01",
    lastActivity: "2024-02-15",
    totalRevenue: 0,
    openDeals: 0,
    currency: "AED",
    employees: "40,000+",
    description: "Lost POS deal to Oracle Retail. Maintain relationship for future opportunities in other modules.",
    contacts: [
      { id: "cc18", name: "Mark Thompson", title: "Digital Director", email: "m.thompson@maf.ae", phone: "+971 4 294 0001", isPrimary: true, department: "Technology" },
    ],
    deals: [
      { id: "deal-010", title: "POS & Loyalty System", value: 160000, currency: "AED", status: "lost" },
    ],
    activities: [
      { id: "ca14", type: "note", title: "Lost Deal – Keep Relationship", description: "Lost to Oracle. Keep quarterly touchpoints. Potential for HR or Finance module.", date: "2024-02-15", by: "Omar Farooq" },
    ],
    tags: ["Retail", "Lost Deal", "Re-engage"],
    npsScore: 5,
  },
];

export const customersSummary = {
  total: mockCustomers.length,
  active: mockCustomers.filter(c => c.status === "active").length,
  inactive: mockCustomers.filter(c => c.status === "inactive").length,
  platinum: mockCustomers.filter(c => c.tier === "platinum").length,
  gold: mockCustomers.filter(c => c.tier === "gold").length,
  totalRevenue: mockCustomers.reduce((s, c) => s + c.totalRevenue, 0),
  openDeals: mockCustomers.reduce((s, c) => s + c.openDeals, 0),
  avgNps: parseFloat((mockCustomers.filter(c => c.npsScore).reduce((s, c) => s + (c.npsScore ?? 0), 0) / mockCustomers.filter(c => c.npsScore).length).toFixed(1)),
};
