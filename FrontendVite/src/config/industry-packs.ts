import type { ModuleKey } from "@/types";

/**
 * ── Industry Pack Registry ──────────────────────────────────────────────────
 * The single source of truth for the plugin-based Industry Pack framework.
 *
 * An Industry Pack is activated by the tenant's selected industry. Activation
 * simply adds the pack's `moduleKey` to the tenant's resolved modules (handled
 * server-side in Tenant.ResolvedModules), so the existing module-gated sidebar,
 * route guards (ModuleGuard) and permission model light the pack up with NO new
 * plumbing. Packs ADD industry-specific screens that reuse the core CRM
 * (Leads / Pipeline / Customers / Activities) — they never duplicate it.
 *
 * To add a NEW industry later: append one entry here + (backend) one schema in
 * the Verticals service. The framework needs no other changes.
 */

export interface IndustryPackFeature {
  /** Feature-flag key, e.g. "reservations". Gate optional sub-features with this. */
  key: string;
  label: string;
}

export interface IndustryPack {
  /** Industry value stored on the tenant (JWT `industry` claim / Tenant.Industry). */
  industry: string;
  /** Module code folded into the tenant's resolved modules → gates menu + routes. */
  moduleKey: ModuleKey;
  label: string;
  description: string;
  /** Lucide icon name (resolved by the nav icon map). */
  icon: string;
  /** Core CRM lifecycle this pack maps onto (shown in admin/help). */
  crmFlow: string;
  /** Industry-specific entities the pack adds (reporting/UI scaffolding reference). */
  entities: string[];
  /** Optional toggleable sub-features within the pack. */
  features: IndustryPackFeature[];
}

export const INDUSTRY_PACKS: IndustryPack[] = [
  {
    industry: "real_estate",
    moduleKey: "real-estate",
    label: "Real Estate",
    description: "Property sales, projects, units, site visits, reservations & handover.",
    icon: "Building",
    crmFlow: "Lead → Property Inquiry → Site Visit → Reservation → Booking → Payment Plan → Handover",
    entities: ["Properties", "Projects", "Units", "Site Visits", "Reservations", "Bookings", "Installment Plans", "Brokers", "Commissions", "Handover"],
    features: [
      { key: "site_visits", label: "Site Visits" },
      { key: "reservations", label: "Reservations & Bookings" },
      { key: "installments", label: "Installment Plans" },
      { key: "brokers", label: "Brokers & Commissions" },
      { key: "handover", label: "Handover Management" },
    ],
  },
  {
    industry: "construction",
    moduleKey: "construction",
    label: "Construction",
    description: "RFQs, tenders, BOQs, estimates, contractors, contracts & projects.",
    icon: "HardHat",
    crmFlow: "Lead → RFQ → Estimate → Proposal → Contract → Project",
    entities: ["RFQs", "Tenders", "BOQs", "Estimates", "Site Surveys", "Contractors", "Vendors", "Contracts", "Projects"],
    features: [
      { key: "rfq", label: "RFQs & Tenders" },
      { key: "boq", label: "BOQs & Estimates" },
      { key: "contractors", label: "Contractors & Vendors" },
      { key: "contracts", label: "Contracts & Projects" },
    ],
  },
  {
    industry: "healthcare",
    moduleKey: "healthcare",
    label: "Healthcare",
    description: "Patients, appointments, doctors, treatment plans & insurance claims.",
    icon: "Hotel",
    crmFlow: "Lead → Patient Registration → Appointment → Treatment → Follow-up",
    entities: ["Patients", "Appointments", "Doctors", "Medical Records", "Treatment Plans", "Prescriptions", "Insurance Claims"],
    features: [
      { key: "appointments", label: "Appointments" },
      { key: "records", label: "Medical Records" },
      { key: "treatment", label: "Treatment Plans" },
      { key: "claims", label: "Insurance Claims" },
    ],
  },
  {
    industry: "education",
    moduleKey: "education",
    label: "Education",
    description: "Students, admissions, courses, enrollments & fee tracking.",
    icon: "BookOpen",
    crmFlow: "Lead → Admission Inquiry → Application → Enrollment → Student Lifecycle",
    entities: ["Students", "Admissions", "Courses", "Classes", "Enrollments", "Academic Records", "Fee Tracking"],
    features: [
      { key: "admissions", label: "Admissions" },
      { key: "courses", label: "Courses & Classes" },
      { key: "enrollments", label: "Enrollments" },
      { key: "fees", label: "Fee Tracking" },
    ],
  },
  {
    industry: "insurance",
    moduleKey: "insurance",
    label: "Insurance",
    description: "Policies, products, renewals, claims, agents & commissions.",
    icon: "ShieldCheck",
    crmFlow: "Lead → Policy Proposal → Policy Issuance → Renewal → Claims",
    entities: ["Policies", "Insurance Products", "Policy Renewals", "Claims", "Agents", "Commissions"],
    features: [
      { key: "policies", label: "Policies & Products" },
      { key: "renewals", label: "Renewals" },
      { key: "claims", label: "Claims" },
      { key: "agents", label: "Agents & Commissions" },
    ],
  },
  {
    industry: "b2b_services",
    moduleKey: "b2b",
    label: "B2B Services",
    description: "Discovery, proposals, contracts, projects, AMC, SLA & support.",
    icon: "Briefcase",
    crmFlow: "Lead → Discovery → Proposal → Contract → Project → Support → Renewal",
    entities: ["Discovery Meetings", "Proposals", "Project Estimation", "Contracts", "Project Handover", "AMC Contracts", "SLA Management", "Support Tickets", "Renewals", "Customer Success"],
    features: [
      { key: "proposals", label: "Proposals" },
      { key: "contracts", label: "Contracts & Projects" },
      { key: "amc", label: "AMC & SLA" },
      { key: "support", label: "Support & Renewals" },
    ],
  },
  {
    industry: "visa_services",
    moduleKey: "visa",
    label: "Visa Services",
    description: "UAE visa consultancy — cases, applicants, document checklists, government submission & tracking.",
    icon: "Stamp",
    crmFlow: "Lead → Case Intake → Documents → Submission → Tracking → Outcome → Renewal",
    entities: ["Visa Cases", "Applicants", "Visa Types", "Document Checklists", "Government Submissions", "Renewals"],
    features: [
      { key: "documents", label: "Document Checklists" },
      { key: "submission", label: "Government Submission" },
      { key: "tracking", label: "Status Tracking" },
      { key: "renewals", label: "Renewals & Alerts" },
    ],
  },
];

/** Industries offered in the Create-Tenant picker (value + label). */
export const INDUSTRY_OPTIONS = [
  { value: "", label: "Generic (CRM only — no industry pack)" },
  ...INDUSTRY_PACKS.map(p => ({ value: p.industry, label: p.label })),
];

export const getPackByIndustry = (industry?: string | null): IndustryPack | undefined =>
  industry ? INDUSTRY_PACKS.find(p => p.industry === industry) : undefined;
