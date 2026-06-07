export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type DealPriority = "low" | "medium" | "high";
export type ActivityType = "call" | "email" | "meeting" | "note" | "task";

export interface DealActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface Contact {
  name: string;
  title: string;
  email: string;
  phone: string;
  avatar?: string;
}

export interface Deal {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  value: number;
  currency: "AED" | "USD" | "SAR";
  stage: DealStage;
  priority: DealPriority;
  probability: number;
  expectedCloseDate: string;
  createdDate: string;
  assignedTo: string;
  assignedAvatar?: string;
  contact: Contact;
  source: string;
  industry: string;
  description: string;
  tags: string[];
  activities: DealActivity[];
  nextAction?: string;
  nextActionDate?: string;
}

export const PIPELINE_STAGES: { key: DealStage; label: string; color: string; bg: string }[] = [
  { key: "lead",        label: "Lead",        color: "text-slate-600",      bg: "bg-slate-100 dark:bg-slate-800/50" },
  { key: "qualified",   label: "Qualified",   color: "text-blue-600",       bg: "bg-blue-50 dark:bg-blue-900/20" },
  { key: "proposal",    label: "Proposal",    color: "text-violet-600",     bg: "bg-violet-50 dark:bg-violet-900/20" },
  { key: "negotiation", label: "Negotiation", color: "text-amber-600",      bg: "bg-amber-50 dark:bg-amber-900/20" },
  { key: "won",         label: "Won",         color: "text-emerald-600",    bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { key: "lost",        label: "Lost",        color: "text-red-600",        bg: "bg-red-50 dark:bg-red-900/20" },
];

export const mockDeals: Deal[] = [
  {
    id: "deal-001",
    title: "Enterprise ERP Implementation",
    company: "Emaar Properties",
    value: 480000,
    currency: "AED",
    stage: "negotiation",
    priority: "high",
    probability: 75,
    expectedCloseDate: "2024-03-31",
    createdDate: "2024-01-10",
    assignedTo: "Sarah Mitchell",
    source: "Referral",
    industry: "Real Estate",
    description: "Full ERP suite implementation for Emaar's construction and property management divisions. Includes Finance, HR, Procurement, and Project Management modules.",
    tags: ["Enterprise", "ERP", "Real Estate"],
    contact: {
      name: "Khalid Al Rashidi",
      title: "Chief Technology Officer",
      email: "k.rashidi@emaar.ae",
      phone: "+971 50 234 5678",
    },
    activities: [
      { id: "a1", type: "meeting", title: "Executive Presentation", description: "Presented ERP solution to CTO and IT team. Very positive response.", date: "2024-02-15", by: "Sarah Mitchell" },
      { id: "a2", type: "email", title: "Proposal Sent", description: "Sent detailed proposal with pricing and implementation timeline.", date: "2024-02-20", by: "Sarah Mitchell" },
      { id: "a3", type: "call", title: "Follow-up Call", description: "Discussed contract terms. Legal review in progress.", date: "2024-02-28", by: "Sarah Mitchell" },
    ],
    nextAction: "Contract signing",
    nextActionDate: "2024-03-10",
  },
  {
    id: "deal-002",
    title: "HR & Payroll Module",
    company: "DAMAC Holdings",
    value: 125000,
    currency: "AED",
    stage: "proposal",
    priority: "high",
    probability: 60,
    expectedCloseDate: "2024-04-15",
    createdDate: "2024-01-25",
    assignedTo: "Omar Farooq",
    source: "LinkedIn",
    industry: "Real Estate",
    description: "HR management system including payroll, leave management, performance reviews, and recruitment module for 2,000+ employees.",
    tags: ["HR", "Payroll", "SaaS"],
    contact: {
      name: "Fatima Al Maktoum",
      title: "HR Director",
      email: "f.maktoum@damac.ae",
      phone: "+971 55 876 4321",
    },
    activities: [
      { id: "a4", type: "meeting", title: "Requirements Workshop", description: "3-hour session mapping current HR processes.", date: "2024-02-10", by: "Omar Farooq" },
      { id: "a5", type: "note", title: "Key Requirements", description: "WPS compliance, multi-branch payroll, Arabic support mandatory.", date: "2024-02-10", by: "Omar Farooq" },
    ],
    nextAction: "Demo presentation",
    nextActionDate: "2024-03-05",
  },
  {
    id: "deal-003",
    title: "Inventory & Supply Chain",
    company: "Al Futtaim Retail",
    value: 220000,
    currency: "AED",
    stage: "qualified",
    priority: "medium",
    probability: 45,
    expectedCloseDate: "2024-05-30",
    createdDate: "2024-02-01",
    assignedTo: "Priya Sharma",
    source: "Trade Show",
    industry: "Retail",
    description: "Inventory management, POS integration, and supply chain optimization for 50+ retail outlets across UAE.",
    tags: ["Retail", "Inventory", "POS"],
    contact: {
      name: "James Whitfield",
      title: "Operations Director",
      email: "j.whitfield@alfuttaim.ae",
      phone: "+971 50 111 2233",
    },
    activities: [
      { id: "a6", type: "call", title: "Initial Discovery", description: "Discussed pain points with current inventory system.", date: "2024-02-05", by: "Priya Sharma" },
      { id: "a7", type: "email", title: "Sent Product Overview", description: "Shared product deck and case studies.", date: "2024-02-08", by: "Priya Sharma" },
    ],
    nextAction: "Technical demo",
    nextActionDate: "2024-03-12",
  },
  {
    id: "deal-004",
    title: "Hotel Management System",
    company: "Jumeirah Group",
    value: 380000,
    currency: "AED",
    stage: "lead",
    priority: "high",
    probability: 25,
    expectedCloseDate: "2024-06-30",
    createdDate: "2024-02-10",
    assignedTo: "Sarah Mitchell",
    source: "Website",
    industry: "Hospitality",
    description: "Comprehensive PMS, F&B management, housekeeping, and guest experience platform for Jumeirah's 5-star properties.",
    tags: ["Hospitality", "PMS", "Enterprise"],
    contact: {
      name: "Elena Voronova",
      title: "VP Technology",
      email: "e.voronova@jumeirah.com",
      phone: "+971 4 366 5000",
    },
    activities: [
      { id: "a8", type: "email", title: "Introductory Email", description: "Sent introduction and hospitality module overview.", date: "2024-02-12", by: "Sarah Mitchell" },
    ],
    nextAction: "Qualification call",
    nextActionDate: "2024-03-01",
  },
  {
    id: "deal-005",
    title: "Construction Project ERP",
    company: "Arabtec Holding",
    value: 290000,
    currency: "AED",
    stage: "qualified",
    priority: "medium",
    probability: 40,
    expectedCloseDate: "2024-05-15",
    createdDate: "2024-01-20",
    assignedTo: "Omar Farooq",
    source: "Partner Referral",
    industry: "Construction",
    description: "Project costing, procurement, subcontractor management, and site management tools for large-scale construction projects.",
    tags: ["Construction", "Project Management"],
    contact: {
      name: "Mohammed Al Qassim",
      title: "IT Manager",
      email: "m.qassim@arabtec.ae",
      phone: "+971 50 987 6543",
    },
    activities: [
      { id: "a9", type: "meeting", title: "Site Visit", description: "Visited main office, met IT and finance team.", date: "2024-01-25", by: "Omar Farooq" },
      { id: "a10", type: "task", title: "Send Construction Module Specs", description: "Prepare tailored spec document for construction use case.", date: "2024-01-30", by: "Omar Farooq" },
    ],
    nextAction: "Proposal preparation",
    nextActionDate: "2024-03-08",
  },
  {
    id: "deal-006",
    title: "Finance & Accounting Suite",
    company: "Emirates NBD",
    value: 175000,
    currency: "AED",
    stage: "won",
    priority: "high",
    probability: 100,
    expectedCloseDate: "2024-02-28",
    createdDate: "2023-11-15",
    assignedTo: "Priya Sharma",
    source: "Cold Outreach",
    industry: "Banking",
    description: "Full accounting module with IFRS compliance, multi-currency, automated reconciliation, and financial reporting.",
    tags: ["Finance", "IFRS", "Banking"],
    contact: {
      name: "Suresh Menon",
      title: "CFO",
      email: "s.menon@emiratesnbd.com",
      phone: "+971 4 201 2000",
    },
    activities: [
      { id: "a11", type: "meeting", title: "Contract Signed", description: "Deal closed! Implementation kick-off scheduled for March 1.", date: "2024-02-28", by: "Priya Sharma" },
    ],
  },
  {
    id: "deal-007",
    title: "SME Accounting Package",
    company: "Desert Rose Trading",
    value: 18000,
    currency: "AED",
    stage: "lead",
    priority: "low",
    probability: 20,
    expectedCloseDate: "2024-04-30",
    createdDate: "2024-02-14",
    assignedTo: "Omar Farooq",
    source: "Google Ads",
    industry: "Trading",
    description: "Basic accounting and invoicing for SME with 15 employees. Cloud-based subscription model.",
    tags: ["SME", "Accounting", "Cloud"],
    contact: {
      name: "Ahmad Siddiqui",
      title: "Owner",
      email: "ahmad@desertrose.ae",
      phone: "+971 55 443 2211",
    },
    activities: [
      { id: "a12", type: "call", title: "Inbound Lead Call", description: "Quick discovery call. Interested in basic accounting module.", date: "2024-02-14", by: "Omar Farooq" },
    ],
    nextAction: "Send pricing",
    nextActionDate: "2024-02-20",
  },
  {
    id: "deal-008",
    title: "Healthcare ERP",
    company: "Aster DM Healthcare",
    value: 520000,
    currency: "AED",
    stage: "proposal",
    priority: "high",
    probability: 55,
    expectedCloseDate: "2024-06-15",
    createdDate: "2024-01-08",
    assignedTo: "Sarah Mitchell",
    source: "Conference",
    industry: "Healthcare",
    description: "Comprehensive healthcare ERP including patient management, pharmacy, lab, billing, and HR modules for 10 hospital network.",
    tags: ["Healthcare", "Enterprise", "Multi-site"],
    contact: {
      name: "Dr. Sanjay Kumar",
      title: "Group CIO",
      email: "s.kumar@asterdm.com",
      phone: "+971 4 440 0500",
    },
    activities: [
      { id: "a13", type: "meeting", title: "RFP Response Presentation", description: "Presented our response to their formal RFP. Strong competition from SAP.", date: "2024-02-20", by: "Sarah Mitchell" },
      { id: "a14", type: "email", title: "Reference Customer Intro", description: "Connected them with existing healthcare customer for reference call.", date: "2024-02-25", by: "Sarah Mitchell" },
    ],
    nextAction: "Board presentation",
    nextActionDate: "2024-03-15",
  },
  {
    id: "deal-009",
    title: "Payroll Only - Pilot",
    company: "Careem",
    value: 42000,
    currency: "AED",
    stage: "negotiation",
    priority: "medium",
    probability: 80,
    expectedCloseDate: "2024-03-20",
    createdDate: "2024-01-30",
    assignedTo: "Priya Sharma",
    source: "Partner",
    industry: "Technology",
    description: "3-month payroll pilot for UAE entity with 200 employees. Potential to expand to full HR suite.",
    tags: ["Payroll", "Pilot", "Tech"],
    contact: {
      name: "Nadia Al Hajj",
      title: "HR Lead",
      email: "n.hajj@careem.com",
      phone: "+971 50 700 1234",
    },
    activities: [
      { id: "a15", type: "call", title: "Pricing Negotiation", description: "Agreed on 15% discount for pilot. Paperwork in progress.", date: "2024-03-01", by: "Priya Sharma" },
    ],
    nextAction: "Send final contract",
    nextActionDate: "2024-03-05",
  },
  {
    id: "deal-010",
    title: "POS & Loyalty System",
    company: "Majid Al Futtaim",
    value: 160000,
    currency: "AED",
    stage: "lost",
    priority: "medium",
    probability: 0,
    expectedCloseDate: "2024-02-15",
    createdDate: "2023-12-01",
    assignedTo: "Omar Farooq",
    source: "Referral",
    industry: "Retail",
    description: "POS system with loyalty program integration for Mall of the Emirates outlets.",
    tags: ["POS", "Retail", "Loyalty"],
    contact: {
      name: "Mark Thompson",
      title: "Digital Director",
      email: "m.thompson@maf.ae",
      phone: "+971 4 294 0000",
    },
    activities: [
      { id: "a16", type: "note", title: "Deal Lost", description: "Lost to Oracle Retail. Price was the primary factor. Keep in touch for next cycle.", date: "2024-02-15", by: "Omar Farooq" },
    ],
  },
  {
    id: "deal-011",
    title: "Real Estate CRM + ERP",
    company: "Nakheel Properties",
    value: 340000,
    currency: "AED",
    stage: "qualified",
    priority: "high",
    probability: 50,
    expectedCloseDate: "2024-07-01",
    createdDate: "2024-02-05",
    assignedTo: "Sarah Mitchell",
    source: "LinkedIn",
    industry: "Real Estate",
    description: "Integrated CRM, lease management, owner portal, and finance module for Nakheel's residential portfolio.",
    tags: ["Real Estate", "CRM", "Enterprise"],
    contact: {
      name: "Rashid Al Falasi",
      title: "Head of IT",
      email: "r.falasi@nakheel.com",
      phone: "+971 4 390 3333",
    },
    activities: [
      { id: "a17", type: "meeting", title: "Needs Assessment", description: "2-hour session with IT and operations teams.", date: "2024-02-08", by: "Sarah Mitchell" },
    ],
    nextAction: "Proposal submission",
    nextActionDate: "2024-03-20",
  },
  {
    id: "deal-012",
    title: "School ERP - K12",
    company: "GEMS Education",
    value: 195000,
    currency: "AED",
    stage: "lead",
    priority: "medium",
    probability: 30,
    expectedCloseDate: "2024-08-01",
    createdDate: "2024-02-18",
    assignedTo: "Priya Sharma",
    source: "Website",
    industry: "Education",
    description: "Student information system, fee management, HR, and parent portal for network of 15 schools.",
    tags: ["Education", "SIS", "Multi-school"],
    contact: {
      name: "Caroline Hughes",
      title: "Technology Director",
      email: "c.hughes@gemseducation.com",
      phone: "+971 4 373 8888",
    },
    activities: [
      { id: "a18", type: "email", title: "Initial Outreach", description: "Sent education module overview and case study.", date: "2024-02-18", by: "Priya Sharma" },
    ],
    nextAction: "Book discovery call",
    nextActionDate: "2024-03-02",
  },
];

export const crmSummary = {
  totalDeals: mockDeals.length,
  totalValue: mockDeals.filter(d => d.stage !== "lost").reduce((s, d) => s + d.value, 0),
  wonValue: mockDeals.filter(d => d.stage === "won").reduce((s, d) => s + d.value, 0),
  lostDeals: mockDeals.filter(d => d.stage === "lost").length,
  avgDealSize: Math.round(mockDeals.filter(d => d.stage !== "lost").reduce((s, d) => s + d.value, 0) / mockDeals.filter(d => d.stage !== "lost").length),
  winRate: Math.round((mockDeals.filter(d => d.stage === "won").length / mockDeals.filter(d => d.stage === "won" || d.stage === "lost").length) * 100),
};
