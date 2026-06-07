export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted" | "lost";
export type LeadSource =
  | "website" | "linkedin" | "referral" | "cold_call" | "trade_show"
  | "google_ads" | "email_campaign" | "partner" | "social_media" | "walk_in";
export type LeadPriority = "low" | "medium" | "high";

export interface LeadActivity {
  id: string;
  type: "call" | "email" | "meeting" | "note" | "task";
  title: string;
  description: string;
  date: string;
  by: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  company: string;
  industry: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  score: number; // 0–100
  estimatedValue: number;
  currency: "AED" | "USD" | "SAR";
  assignedTo: string;
  createdDate: string;
  lastContactDate?: string;
  nextFollowUp?: string;
  notes?: string;
  tags: string[];
  activities: LeadActivity[];
  convertedDealId?: string;
}

const SOURCES: LeadSource[] = [
  "website", "linkedin", "referral", "cold_call", "trade_show",
  "google_ads", "email_campaign", "partner", "social_media", "walk_in",
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  linkedin: "LinkedIn",
  referral: "Referral",
  cold_call: "Cold Call",
  trade_show: "Trade Show",
  google_ads: "Google Ads",
  email_campaign: "Email Campaign",
  partner: "Partner",
  social_media: "Social Media",
  walk_in: "Walk-in",
};

export const mockLeads: Lead[] = [
  {
    id: "ld-001",
    firstName: "Hassan", lastName: "Al Marzouqi", fullName: "Hassan Al Marzouqi",
    title: "CEO", company: "Al Marzouqi Holdings", industry: "Real Estate",
    email: "h.marzouqi@almarzouqi.ae", phone: "+971 50 123 9876",
    country: "UAE", city: "Dubai",
    source: "referral", status: "qualified", priority: "high",
    score: 85,
    estimatedValue: 320000, currency: "AED",
    assignedTo: "Sarah Mitchell",
    createdDate: "2026-04-10", lastContactDate: "2026-05-14", nextFollowUp: "2026-05-21",
    notes: "Very interested in full ERP suite. Has budget approved for Q3. Referred by Emaar contact.",
    tags: ["Enterprise", "Real Estate", "Hot Lead"],
    activities: [
      { id: "la1", type: "call", title: "Introductory Call", description: "1-hour discovery call. CEO is very engaged. Decision in 60 days.", date: "2026-04-12", by: "Sarah Mitchell" },
      { id: "la2", type: "meeting", title: "Office Visit", description: "Visited their Dubai Marina office. Showed live demo.", date: "2026-04-28", by: "Sarah Mitchell" },
      { id: "la3", type: "email", title: "Proposal Request Sent", description: "Sent detailed questionnaire to scope the full proposal.", date: "2026-05-14", by: "Sarah Mitchell" },
    ],
  },
  {
    id: "ld-002",
    firstName: "Priya", lastName: "Menon", fullName: "Priya Menon",
    title: "CFO", company: "Zenith Healthcare Group", industry: "Healthcare",
    email: "p.menon@zenithhealthcare.ae", phone: "+971 55 234 5678",
    country: "UAE", city: "Abu Dhabi",
    source: "trade_show", status: "qualified", priority: "high",
    score: 78,
    estimatedValue: 450000, currency: "AED",
    assignedTo: "Omar Farooq",
    createdDate: "2026-04-15", lastContactDate: "2026-05-10", nextFollowUp: "2026-05-22",
    notes: "Met at GITEX 2026. CFO is evaluating ERP for 5-hospital network. Strong interest in finance + HR modules.",
    tags: ["Healthcare", "Multi-site", "GITEX Lead"],
    activities: [
      { id: "la4", type: "meeting", title: "GITEX Booth Meeting", description: "30-min meeting at GITEX. Exchanged cards, live demo interest.", date: "2026-04-15", by: "Omar Farooq" },
      { id: "la5", type: "call", title: "Follow-up Call", description: "Discussed requirements. Needs HIPAA-adjacent compliance features.", date: "2026-04-22", by: "Omar Farooq" },
      { id: "la6", type: "email", title: "Healthcare Module Brochure", description: "Sent tailored healthcare module overview.", date: "2026-05-10", by: "Omar Farooq" },
    ],
  },
  {
    id: "ld-003",
    firstName: "Mark", lastName: "Henderson", fullName: "Mark Henderson",
    title: "IT Director", company: "Gulf Logistics Co.", industry: "Logistics",
    email: "m.henderson@gulflogi.ae", phone: "+971 50 345 6789",
    country: "UAE", city: "Sharjah",
    source: "website", status: "contacted", priority: "medium",
    score: 52,
    estimatedValue: 80000, currency: "AED",
    assignedTo: "Priya Sharma",
    createdDate: "2026-05-01", lastContactDate: "2026-05-08", nextFollowUp: "2026-05-24",
    notes: "Submitted contact form for inventory module. Mid-size company, 200 staff.",
    tags: ["Logistics", "Inventory", "Inbound"],
    activities: [
      { id: "la7", type: "email", title: "Welcome Email", description: "Sent product overview and case study for logistics.", date: "2026-05-01", by: "Priya Sharma" },
      { id: "la8", type: "call", title: "Discovery Call", description: "30-min call. Current pain: manual Excel tracking. Budget ~80K.", date: "2026-05-08", by: "Priya Sharma" },
    ],
  },
  {
    id: "ld-004",
    firstName: "Aisha", lastName: "Al Nuaimi", fullName: "Aisha Al Nuaimi",
    title: "Operations Head", company: "Desert Bloom Restaurants", industry: "Hospitality",
    email: "a.alnuaimi@desertbloom.ae", phone: "+971 52 456 7890",
    country: "UAE", city: "Dubai",
    source: "social_media", status: "new", priority: "medium",
    score: 35,
    estimatedValue: 55000, currency: "AED",
    assignedTo: "Sarah Mitchell",
    createdDate: "2026-05-16", nextFollowUp: "2026-05-22",
    notes: "DM'd on Instagram. Chain of 12 restaurants. Interested in POS + inventory.",
    tags: ["F&B", "POS", "SME"],
    activities: [
      { id: "la9", type: "note", title: "Social Media Lead", description: "Reached out via Instagram DM. Following up with email.", date: "2026-05-16", by: "Sarah Mitchell" },
    ],
  },
  {
    id: "ld-005",
    firstName: "Rajan", lastName: "Nair", fullName: "Rajan Nair",
    title: "Managing Director", company: "Pinnacle Construction LLC", industry: "Construction",
    email: "r.nair@pinnacle-const.ae", phone: "+971 54 567 8901",
    country: "UAE", city: "Dubai",
    source: "cold_call", status: "converted", priority: "high",
    score: 95,
    estimatedValue: 260000, currency: "AED",
    assignedTo: "Omar Farooq",
    createdDate: "2026-02-10", lastContactDate: "2026-04-01",
    notes: "Cold outreach turned into a major deal. Converted to Deal #deal-005.",
    tags: ["Construction", "Enterprise", "Converted"],
    activities: [
      { id: "la10", type: "call", title: "Cold Call", description: "Initial outreach. MD was interested after elevator pitch.", date: "2026-02-10", by: "Omar Farooq" },
      { id: "la11", type: "meeting", title: "Needs Analysis", description: "2-hour session mapping out all requirements.", date: "2026-03-15", by: "Omar Farooq" },
      { id: "la12", type: "note", title: "Converted to Deal", description: "Moved to active deal. Proposal being drafted.", date: "2026-04-01", by: "Omar Farooq" },
    ],
    convertedDealId: "deal-005",
  },
  {
    id: "ld-006",
    firstName: "Layla", lastName: "Khalid", fullName: "Layla Khalid",
    title: "Finance Manager", company: "Sunrise Trading FZE", industry: "Trading",
    email: "l.khalid@sunrise-trade.ae", phone: "+971 56 678 9012",
    country: "UAE", city: "Dubai",
    source: "google_ads", status: "contacted", priority: "low",
    score: 40,
    estimatedValue: 25000, currency: "AED",
    assignedTo: "Priya Sharma",
    createdDate: "2026-05-05", lastContactDate: "2026-05-12", nextFollowUp: "2026-05-26",
    notes: "Clicked Google Ad for accounting module. Small FZE, 10 staff. Budget limited.",
    tags: ["SME", "Accounting", "FZE"],
    activities: [
      { id: "la13", type: "email", title: "Ad Response Follow-up", description: "Sent accounting module pricing and brochure.", date: "2026-05-05", by: "Priya Sharma" },
      { id: "la14", type: "call", title: "Qualification Call", description: "10-min call. Very small company. Low budget.", date: "2026-05-12", by: "Priya Sharma" },
    ],
  },
  {
    id: "ld-007",
    firstName: "Tariq", lastName: "Bin Sulaiman", fullName: "Tariq Bin Sulaiman",
    title: "VP Technology", company: "United Education Network", industry: "Education",
    email: "t.sulaiman@uen.ae", phone: "+971 50 789 0123",
    country: "UAE", city: "Abu Dhabi",
    source: "email_campaign", status: "qualified", priority: "high",
    score: 72,
    estimatedValue: 190000, currency: "AED",
    assignedTo: "Sarah Mitchell",
    createdDate: "2026-04-20", lastContactDate: "2026-05-15", nextFollowUp: "2026-05-28",
    notes: "Responded to education sector email campaign. Network of 8 schools, 4,000 students.",
    tags: ["Education", "Multi-school", "Campaign Response"],
    activities: [
      { id: "la15", type: "email", title: "Campaign Response", description: "Replied to email with interest in SIS + HR modules.", date: "2026-04-20", by: "Sarah Mitchell" },
      { id: "la16", type: "call", title: "Detailed Discovery", description: "1-hour call. Complex requirements including parent portal, Arabic support.", date: "2026-05-06", by: "Sarah Mitchell" },
      { id: "la17", type: "email", title: "Education Proposal Outline", description: "Sent high-level scope and indicative pricing.", date: "2026-05-15", by: "Sarah Mitchell" },
    ],
  },
  {
    id: "ld-008",
    firstName: "Carlos", lastName: "De Silva", fullName: "Carlos De Silva",
    title: "Owner", company: "De Silva Printing Press", industry: "Manufacturing",
    email: "carlos@desilvaprint.ae", phone: "+971 55 890 1234",
    country: "UAE", city: "Ajman",
    source: "walk_in", status: "unqualified", priority: "low",
    score: 15,
    estimatedValue: 8000, currency: "AED",
    assignedTo: "Priya Sharma",
    createdDate: "2026-05-03", lastContactDate: "2026-05-03",
    notes: "Walked into office. Very small business, 3 staff. Not a fit for our product at this stage.",
    tags: ["SME", "Manufacturing", "Unqualified"],
    activities: [
      { id: "la18", type: "meeting", title: "Walk-in Visit", description: "Walk-in inquiry. Business too small for current product tier.", date: "2026-05-03", by: "Priya Sharma" },
    ],
  },
  {
    id: "ld-009",
    firstName: "Noura", lastName: "Al Ketbi", fullName: "Noura Al Ketbi",
    title: "CIO", company: "Federal Transport Authority", industry: "Government",
    email: "n.alketbi@fta.gov.ae", phone: "+971 2 555 0100",
    country: "UAE", city: "Abu Dhabi",
    source: "partner", status: "new", priority: "high",
    score: 60,
    estimatedValue: 800000, currency: "AED",
    assignedTo: "Sarah Mitchell",
    createdDate: "2026-05-18",
    notes: "Referred by technology partner. Government procurement process. Very large potential deal.",
    tags: ["Government", "Enterprise", "Partner Referral", "Strategic"],
    activities: [
      { id: "la19", type: "note", title: "Partner Introduction", description: "Partner introduced us to FTA CIO. Awaiting first meeting.", date: "2026-05-18", by: "Sarah Mitchell" },
    ],
  },
  {
    id: "ld-010",
    firstName: "James", lastName: "Okonkwo", fullName: "James Okonkwo",
    title: "COO", company: "Horizon Retail Group", industry: "Retail",
    email: "j.okonkwo@horizonretail.ae", phone: "+971 54 901 2345",
    country: "UAE", city: "Dubai",
    source: "linkedin", status: "contacted", priority: "medium",
    score: 48,
    estimatedValue: 140000, currency: "AED",
    assignedTo: "Omar Farooq",
    createdDate: "2026-04-25", lastContactDate: "2026-05-11", nextFollowUp: "2026-05-25",
    notes: "Connected on LinkedIn. 20-outlet retail chain. Looking to replace legacy POS.",
    tags: ["Retail", "POS", "LinkedIn Outreach"],
    activities: [
      { id: "la20", type: "email", title: "LinkedIn Connection Follow-up", description: "Sent intro email after LinkedIn connect.", date: "2026-04-25", by: "Omar Farooq" },
      { id: "la21", type: "call", title: "Initial Discovery", description: "30-min call. Legacy POS causing issues, wants cloud-based replacement.", date: "2026-05-11", by: "Omar Farooq" },
    ],
  },
  {
    id: "ld-011",
    firstName: "Fatima", lastName: "Al Suwaidi", fullName: "Fatima Al Suwaidi",
    title: "HR Director", company: "Emirates Ports & Logistics", industry: "Logistics",
    email: "f.suwaidi@emiratespl.ae", phone: "+971 50 012 3456",
    country: "UAE", city: "Dubai",
    source: "referral", status: "qualified", priority: "high",
    score: 80,
    estimatedValue: 380000, currency: "AED",
    assignedTo: "Sarah Mitchell",
    createdDate: "2026-04-05", lastContactDate: "2026-05-17", nextFollowUp: "2026-05-24",
    notes: "Referred by existing client Emirates NBD. HR Director wants to modernise 3,000-staff HR. Very strong lead.",
    tags: ["Logistics", "HR", "Referral", "Hot Lead"],
    activities: [
      { id: "la22", type: "call", title: "Referral Introduction Call", description: "Warm intro from Emirates NBD CFO. Very receptive.", date: "2026-04-07", by: "Sarah Mitchell" },
      { id: "la23", type: "meeting", title: "Requirements Workshop", description: "Half-day workshop mapping current HR pain points.", date: "2026-04-22", by: "Sarah Mitchell" },
      { id: "la24", type: "email", title: "RFP Response Draft", description: "Sent preliminary RFP response for review.", date: "2026-05-17", by: "Sarah Mitchell" },
    ],
  },
  {
    id: "ld-012",
    firstName: "Sanjay", lastName: "Patel", fullName: "Sanjay Patel",
    title: "Managing Director", company: "Patel Brothers Trading", industry: "Trading",
    email: "sanjay@patelbros.ae", phone: "+971 55 123 6789",
    country: "UAE", city: "Deira",
    source: "cold_call", status: "lost", priority: "low",
    score: 10,
    estimatedValue: 18000, currency: "AED",
    assignedTo: "Priya Sharma",
    createdDate: "2026-03-01", lastContactDate: "2026-03-15",
    notes: "Cold call lead. Lost to local accounting software. Price sensitive.",
    tags: ["SME", "Trading", "Price Sensitive"],
    activities: [
      { id: "la25", type: "call", title: "Cold Call", description: "Initial outreach. Some interest.", date: "2026-03-01", by: "Priya Sharma" },
      { id: "la26", type: "email", title: "Pricing Sent", description: "Sent pricing sheet.", date: "2026-03-08", by: "Priya Sharma" },
      { id: "la27", type: "note", title: "Lost Lead", description: "Went with a local cheaper alternative. No budget for cloud ERP.", date: "2026-03-15", by: "Priya Sharma" },
    ],
  },
];

export const leadsSummary = {
  total: mockLeads.length,
  newThisWeek: mockLeads.filter(l => l.status === "new").length,
  qualified: mockLeads.filter(l => l.status === "qualified").length,
  contacted: mockLeads.filter(l => l.status === "contacted").length,
  converted: mockLeads.filter(l => l.status === "converted").length,
  conversionRate: Math.round((mockLeads.filter(l => l.status === "converted").length / mockLeads.length) * 100),
  totalEstimatedValue: mockLeads.filter(l => !["lost","unqualified"].includes(l.status)).reduce((s, l) => s + l.estimatedValue, 0),
};
