// ─── Vendors ─────────────────────────────────────────────────────────────────
export type VendorStatus   = "active" | "inactive" | "blacklisted";
export type VendorCategory = "software" | "cloud" | "hardware" | "telecom" | "office_supplies" | "facilities" | "professional_services" | "logistics";
export type PaymentTerms   = "net_15" | "net_30" | "net_45" | "net_60" | "prepaid" | "cod";

export interface VendorContact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

export interface VendorTransaction {
  id: string;
  poNumber: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
}

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  legalName: string;
  category: VendorCategory;
  status: VendorStatus;
  country: string;
  city: string;
  address: string;
  website: string;
  taxRegistration: string;
  paymentTerms: PaymentTerms;
  currency: "AED" | "USD";
  creditLimit: number;
  outstandingBalance: number;
  rating: number; // 1-5
  totalSpend: number;
  contacts: VendorContact[];
  recentTransactions: VendorTransaction[];
  notes?: string;
  since: string; // onboarded date
  tags: string[];
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export type POStatus = "draft" | "sent" | "acknowledged" | "partial" | "received" | "cancelled";

export interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  vendorContact: string;
  requestedBy: string;
  approvedBy: string;
  issueDate: string;
  deliveryDate: string;
  status: POStatus;
  currency: "AED" | "USD";
  lineItems: POLineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  deliveryAddress: string;
  paymentTerms: PaymentTerms;
  notes?: string;
  receivedDate?: string;
}

// ─── Approvals (Purchase Requests) ───────────────────────────────────────────
export type ApprovalStatus   = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalPriority = "low" | "medium" | "high" | "urgent";
export type ApprovalCategory = VendorCategory;

export interface ApprovalItem {
  id: string;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  total: number;
}

export interface PurchaseApproval {
  id: string;
  requestNumber: string;
  title: string;
  requestedBy: string;
  department: string;
  requestDate: string;
  requiredBy: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  category: ApprovalCategory;
  vendorSuggestion?: string;
  items: ApprovalItem[];
  totalAmount: number;
  currency: "AED" | "USD";
  justification: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  convertedToPO?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function poItem(id: string, desc: string, qty: number, price: number, vat = 5, recvd = 0): POLineItem {
  const subtotal  = qty * price;
  const vatAmount = parseFloat((subtotal * vat / 100).toFixed(2));
  return { id, description: desc, quantity: qty, unitPrice: price, vatRate: vat,
    subtotal, vatAmount, total: parseFloat((subtotal + vatAmount).toFixed(2)), receivedQty: recvd };
}

// ── Vendors ──
export const mockVendors: Vendor[] = [
  {
    id: "v-001", vendorCode: "VND-0021", name: "Microsoft UAE", legalName: "Microsoft Gulf FZ-LLC",
    category: "software", status: "active", country: "UAE", city: "Dubai",
    address: "Microsoft Gulf, Building 1, Dubai Internet City, Dubai, UAE",
    website: "microsoft.com", taxRegistration: "TRN100254876300003",
    paymentTerms: "net_30", currency: "USD", creditLimit: 500000, outstandingBalance: 78450, rating: 4.5,
    totalSpend: 1245000, since: "2019-01-15", tags: ["strategic", "preferred", "enterprise"],
    contacts: [
      { id: "vc1", name: "Ahmed Al Rashid", title: "Account Executive", email: "ahmed.rashid@microsoft.com", phone: "+971-4-390-5000", isPrimary: true },
      { id: "vc2", name: "Sara Johnson",   title: "Technical Specialist", email: "sara.johnson@microsoft.com", phone: "+971-4-390-5001", isPrimary: false },
    ],
    recentTransactions: [
      { id: "vt1", poNumber: "PO-2026-0031", date: "2026-04-01", amount: 45000, status: "paid" },
      { id: "vt2", poNumber: "PO-2026-0028", date: "2026-02-15", amount: 33450, status: "paid" },
      { id: "vt3", poNumber: "PO-2026-0035", date: "2026-05-10", amount: 78450, status: "pending" },
    ],
  },
  {
    id: "v-002", vendorCode: "VND-0022", name: "Amazon Web Services", legalName: "Amazon Web Services MENA FZ-LLC",
    category: "cloud", status: "active", country: "UAE", city: "Dubai",
    address: "AWS MENA Hub, Dubai Internet City, Building 18, Dubai, UAE",
    website: "aws.amazon.com", taxRegistration: "TRN100487321400001",
    paymentTerms: "net_30", currency: "USD", creditLimit: 300000, outstandingBalance: 52800, rating: 4.8,
    totalSpend: 980000, since: "2020-03-10", tags: ["cloud", "strategic", "auto-pay"],
    contacts: [
      { id: "vc3", name: "Naveed Hussain", title: "Enterprise Account Manager", email: "naveed.h@amazon.com", phone: "+971-4-448-3000", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt4", poNumber: "PO-2026-0032", date: "2026-05-01", amount: 52800, status: "pending" },
      { id: "vt5", poNumber: "PO-2026-0026", date: "2026-03-01", amount: 49200, status: "paid" },
    ],
  },
  {
    id: "v-003", vendorCode: "VND-0015", name: "Oracle UAE", legalName: "Oracle Middle East Ltd",
    category: "software", status: "active", country: "UAE", city: "Dubai",
    address: "Emaar Business Park, Sheikh Zayed Road, Dubai, UAE",
    website: "oracle.com", taxRegistration: "TRN100312654200002",
    paymentTerms: "net_45", currency: "USD", creditLimit: 600000, outstandingBalance: 0, rating: 3.8,
    totalSpend: 760000, since: "2018-06-01", tags: ["database", "enterprise"],
    contacts: [
      { id: "vc4", name: "Faisal Al Mansoori", title: "Sales Director", email: "fmansoori@oracle.com", phone: "+971-4-440-6000", isPrimary: true },
      { id: "vc5", name: "Priya Nair",         title: "License Specialist",   email: "pnair@oracle.com",      phone: "+971-4-440-6021", isPrimary: false },
    ],
    recentTransactions: [
      { id: "vt6", poNumber: "PO-2026-0022", date: "2026-01-20", amount: 95000, status: "paid" },
    ],
  },
  {
    id: "v-004", vendorCode: "VND-0018", name: "Dell Technologies ME", legalName: "Dell EMC Middle East FZ LLC",
    category: "hardware", status: "active", country: "UAE", city: "Dubai",
    address: "Internet City, Building 11, Ground Floor, Dubai, UAE",
    website: "dell.com", taxRegistration: "TRN100221435100004",
    paymentTerms: "net_30", currency: "AED", creditLimit: 200000, outstandingBalance: 38500, rating: 4.2,
    totalSpend: 455000, since: "2020-09-01", tags: ["hardware", "servers", "workstations"],
    contacts: [
      { id: "vc6", name: "Khaled Younes", title: "Account Manager", email: "khaled.younes@dell.com", phone: "+971-4-447-1000", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt7", poNumber: "PO-2026-0033", date: "2026-05-05", amount: 38500, status: "pending" },
      { id: "vt8", poNumber: "PO-2026-0027", date: "2026-03-10", amount: 62000, status: "paid" },
    ],
  },
  {
    id: "v-005", vendorCode: "VND-0009", name: "Cisco Systems UAE", legalName: "Cisco Systems International BV",
    category: "hardware", status: "active", country: "UAE", city: "Abu Dhabi",
    address: "ADNEC Area, Khaleej Al Arabi, Abu Dhabi, UAE",
    website: "cisco.com", taxRegistration: "TRN100195432600001",
    paymentTerms: "net_45", currency: "USD", creditLimit: 350000, outstandingBalance: 0, rating: 4.3,
    totalSpend: 320000, since: "2021-02-15", tags: ["networking", "security", "infrastructure"],
    contacts: [
      { id: "vc7", name: "Mohammed Rashwan", title: "Systems Engineer", email: "mrashwan@cisco.com", phone: "+971-2-697-4200", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt9", poNumber: "PO-2026-0020", date: "2025-12-01", amount: 85000, status: "paid" },
    ],
  },
  {
    id: "v-006", vendorCode: "VND-0031", name: "STC Business UAE", legalName: "Saudi Telecom Company UAE",
    category: "telecom", status: "active", country: "UAE", city: "Dubai",
    address: "Deira, Dubai, UAE",
    website: "stc.com.sa", taxRegistration: "TRN100398712500003",
    paymentTerms: "net_15", currency: "AED", creditLimit: 50000, outstandingBalance: 8400, rating: 3.5,
    totalSpend: 144000, since: "2022-01-01", tags: ["telecom", "internet", "monthly"],
    contacts: [
      { id: "vc8", name: "Rania Al Sayed", title: "Business Account Manager", email: "rania.sayed@stc.com.sa", phone: "+971-4-222-1000", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt10", poNumber: "PO-2026-0036", date: "2026-05-01", amount: 2800, status: "pending" },
      { id: "vt11", poNumber: "PO-2026-0030", date: "2026-04-01", amount: 2800, status: "paid" },
    ],
    notes: "Monthly telecom & leased line subscription.",
  },
  {
    id: "v-007", vendorCode: "VND-0027", name: "Emirates Office Solutions", legalName: "Emirates Office Solutions LLC",
    category: "office_supplies", status: "active", country: "UAE", city: "Dubai",
    address: "Al Quoz Industrial Area 4, Dubai, UAE",
    website: "emiratesoffice.ae", taxRegistration: "TRN100154321700005",
    paymentTerms: "cod", currency: "AED", creditLimit: 25000, outstandingBalance: 0, rating: 4.0,
    totalSpend: 62000, since: "2021-06-01", tags: ["office", "stationery", "ad-hoc"],
    contacts: [
      { id: "vc9", name: "Suresh Pillai", title: "Sales Rep", email: "suresh@emiratesoffice.ae", phone: "+971-50-333-4444", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt12", poNumber: "PO-2026-0034", date: "2026-05-08", amount: 3200, status: "paid" },
    ],
  },
  {
    id: "v-008", vendorCode: "VND-0012", name: "PwC Advisory UAE", legalName: "PricewaterhouseCoopers Middle East",
    category: "professional_services", status: "active", country: "UAE", city: "Dubai",
    address: "Al Fattan Currency House, DIFC, Dubai, UAE",
    website: "pwc.com/m1", taxRegistration: "TRN100287654300002",
    paymentTerms: "net_30", currency: "AED", creditLimit: 500000, outstandingBalance: 125000, rating: 4.7,
    totalSpend: 890000, since: "2018-01-01", tags: ["audit", "consulting", "strategic"],
    contacts: [
      { id: "vc10", name: "James Whitmore", title: "Partner — Advisory", email: "j.whitmore@pwc.com", phone: "+971-4-304-3100", isPrimary: true },
      { id: "vc11", name: "Layla Hassan",   title: "Senior Manager",     email: "layla.hassan@pwc.com", phone: "+971-4-304-3200", isPrimary: false },
    ],
    recentTransactions: [
      { id: "vt13", poNumber: "PO-2026-0029", date: "2026-04-15", amount: 125000, status: "pending" },
      { id: "vt14", poNumber: "PO-2026-0021", date: "2026-01-10", amount: 95000, status: "paid" },
    ],
  },
  {
    id: "v-009", vendorCode: "VND-0035", name: "Aramex UAE", legalName: "Aramex International LLC",
    category: "logistics", status: "active", country: "UAE", city: "Dubai",
    address: "Jebel Ali Free Zone, Dubai, UAE",
    website: "aramex.com", taxRegistration: "TRN100412587600004",
    paymentTerms: "net_15", currency: "AED", creditLimit: 30000, outstandingBalance: 1850, rating: 4.1,
    totalSpend: 48000, since: "2022-09-01", tags: ["courier", "logistics", "delivery"],
    contacts: [
      { id: "vc12", name: "Omar Khatib", title: "Corporate Account Manager", email: "o.khatib@aramex.com", phone: "+971-4-286-5000", isPrimary: true },
    ],
    recentTransactions: [
      { id: "vt15", poNumber: "PO-2026-0037", date: "2026-05-12", amount: 1850, status: "pending" },
    ],
  },
  {
    id: "v-010", vendorCode: "VND-0008", name: "Biz Al Najah Facilities", legalName: "Biz Al Najah Facilities Management LLC",
    category: "facilities", status: "inactive", country: "UAE", city: "Sharjah",
    address: "Al Nahda, Sharjah, UAE",
    website: "", taxRegistration: "TRN100098765400006",
    paymentTerms: "net_30", currency: "AED", creditLimit: 50000, outstandingBalance: 0, rating: 2.8,
    totalSpend: 95000, since: "2019-03-01", tags: ["facilities", "cleaning", "maintenance"],
    contacts: [
      { id: "vc13", name: "Ali Al Sharqi", title: "Operations Manager", email: "ali@bnfacilities.ae", phone: "+971-6-555-1234", isPrimary: true },
    ],
    recentTransactions: [],
    notes: "Contract not renewed. Service quality below standard. Do not re-engage without management approval.",
  },
];

// ── Purchase Orders ──
export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po-001", poNumber: "PO-2026-0035",
    vendorId: "v-001", vendorName: "Microsoft UAE", vendorContact: "Ahmed Al Rashid",
    requestedBy: "Omar Farooq", approvedBy: "Sarah Mitchell",
    issueDate: "2026-05-08", deliveryDate: "2026-05-31", status: "acknowledged",
    currency: "USD",
    lineItems: [
      poItem("pl1", "Microsoft 365 Business Premium — 50 seats (Annual)", 50, 220, 5, 0),
      poItem("pl2", "Azure Active Directory P2 — 50 licenses (Annual)", 50, 108, 5, 0),
      poItem("pl3", "Microsoft Defender for Business — 50 seats",        50, 36, 5, 0),
    ],
    subtotal: 18200, vatAmount: 910, total: 19110,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "net_30",
    notes: "Annual license renewal. Must be activated before June 1 (existing licenses expire).",
  },
  {
    id: "po-002", poNumber: "PO-2026-0032",
    vendorId: "v-002", vendorName: "Amazon Web Services", vendorContact: "Naveed Hussain",
    requestedBy: "Priya Sharma", approvedBy: "Omar Farooq",
    issueDate: "2026-04-28", deliveryDate: "2026-05-01", status: "received",
    currency: "USD",
    lineItems: [
      poItem("pl4", "AWS EC2 Reserved Instances — r6g.2xlarge × 4 (1yr)", 4, 3500, 5, 4),
      poItem("pl5", "AWS RDS Reserved — db.r6g.xlarge × 2 (1yr)",          2, 2800, 5, 2),
      poItem("pl6", "AWS S3 Storage — 50TB annual commitment",              1, 3600, 5, 1),
    ],
    subtotal: 24400, vatAmount: 1220, total: 25620,
    deliveryAddress: "AWS Region: me-south-1 (Bahrain)",
    paymentTerms: "net_30",
    receivedDate: "2026-05-01",
  },
  {
    id: "po-003", poNumber: "PO-2026-0033",
    vendorId: "v-004", vendorName: "Dell Technologies ME", vendorContact: "Khaled Younes",
    requestedBy: "Priya Sharma", approvedBy: "Sarah Mitchell",
    issueDate: "2026-05-03", deliveryDate: "2026-05-25", status: "sent",
    currency: "AED",
    lineItems: [
      poItem("pl7",  "Dell PowerEdge R750 Server × 2",          2, 28000, 5, 0),
      poItem("pl8",  "Dell Precision 5680 Workstation × 5",     5, 8500,  5, 0),
      poItem("pl9",  "Dell UltraSharp 32\" 4K Monitor × 8",    8, 2200,  5, 0),
      poItem("pl10", "3-Year ProSupport Plus (per server)",     2, 4500,  5, 0),
    ],
    subtotal: 130600, vatAmount: 6530, total: 137130,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "net_30",
    notes: "Server rack space already prepared. Coordinate delivery date with IT team.",
  },
  {
    id: "po-004", poNumber: "PO-2026-0029",
    vendorId: "v-008", vendorName: "PwC Advisory UAE", vendorContact: "James Whitmore",
    requestedBy: "Sarah Mitchell", approvedBy: "CEO",
    issueDate: "2026-04-10", deliveryDate: "2026-06-30", status: "acknowledged",
    currency: "AED",
    lineItems: [
      poItem("pl11", "ISO 27001 Readiness Assessment",   1, 45000, 5, 0),
      poItem("pl12", "SOC 2 Type II Audit Preparation",  1, 55000, 5, 0),
      poItem("pl13", "Data Privacy Impact Assessment",   1, 25000, 5, 0),
    ],
    subtotal: 125000, vatAmount: 6250, total: 131250,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "net_30",
    notes: "Milestone 1: IS027001 assessment complete by May 31. Full engagement through Q2.",
  },
  {
    id: "po-005", poNumber: "PO-2026-0036",
    vendorId: "v-006", vendorName: "STC Business UAE", vendorContact: "Rania Al Sayed",
    requestedBy: "Priya Sharma", approvedBy: "Omar Farooq",
    issueDate: "2026-05-01", deliveryDate: "2026-05-05", status: "received",
    currency: "AED",
    lineItems: [
      poItem("pl14", "Dedicated Leased Line 1Gbps — Monthly",  1, 2200, 5, 1),
      poItem("pl15", "Business VoIP Bundle — 20 lines Monthly", 1,  600, 5, 1),
    ],
    subtotal: 2800, vatAmount: 140, total: 2940,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "net_15",
    receivedDate: "2026-05-05",
    notes: "Recurring monthly PO. Auto-generated from standing order.",
  },
  {
    id: "po-006", poNumber: "PO-2026-0034",
    vendorId: "v-007", vendorName: "Emirates Office Solutions", vendorContact: "Suresh Pillai",
    requestedBy: "Hana Al Rashid", approvedBy: "Omar Farooq",
    issueDate: "2026-05-06", deliveryDate: "2026-05-09", status: "received",
    currency: "AED",
    lineItems: [
      poItem("pl16", "A4 Paper — 80gsm (Box of 5 reams) × 20 boxes", 20, 85,  5, 20),
      poItem("pl17", "Printer Toner — HP 508A (BK/C/M/Y set) × 4",   4, 380, 5, 4),
      poItem("pl18", "Office Stationery Bulk Kit × 5",                 5, 120, 5, 5),
    ],
    subtotal: 3300, vatAmount: 165, total: 3465,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "cod",
    receivedDate: "2026-05-09",
  },
  {
    id: "po-007", poNumber: "PO-2026-0038",
    vendorId: "v-001", vendorName: "Microsoft UAE", vendorContact: "Ahmed Al Rashid",
    requestedBy: "Omar Farooq", approvedBy: "Sarah Mitchell",
    issueDate: "2026-05-14", deliveryDate: "2026-06-14", status: "draft",
    currency: "USD",
    lineItems: [
      poItem("pl19", "GitHub Enterprise Cloud — 25 seats (Annual)", 25, 231, 5, 0),
      poItem("pl20", "Azure DevOps Advanced Security — 25 users",   25, 130, 5, 0),
    ],
    subtotal: 9025, vatAmount: 451.25, total: 9476.25,
    deliveryAddress: "Softaxis HQ, Dubai Internet City, Building 10, Dubai, UAE",
    paymentTerms: "net_30",
    notes: "Pending final headcount confirmation from Engineering team.",
  },
  {
    id: "po-008", poNumber: "PO-2026-0037",
    vendorId: "v-009", vendorName: "Aramex UAE", vendorContact: "Omar Khatib",
    requestedBy: "Hana Al Rashid", approvedBy: "Omar Farooq",
    issueDate: "2026-05-10", deliveryDate: "2026-05-14", status: "partial",
    currency: "AED",
    lineItems: [
      poItem("pl21", "Express Delivery — Client Docs & Contracts × 8",  8, 125, 5, 5),
      poItem("pl22", "International Courier — KSA shipments × 3",        3, 350, 5, 1),
    ],
    subtotal: 2050, vatAmount: 102.5, total: 2152.5,
    deliveryAddress: "Various client locations",
    paymentTerms: "net_15",
    notes: "Remaining 3 local + 2 KSA shipments pending. Expected completion May 18.",
  },
];

// ── Purchase Approvals (Requisitions) ──
export const mockApprovals: PurchaseApproval[] = [
  {
    id: "pa-001", requestNumber: "PR-2026-0051",
    title: "GitHub Enterprise & DevOps Security Licenses",
    requestedBy: "Omar Farooq", department: "Engineering",
    requestDate: "2026-05-12", requiredBy: "2026-06-01",
    status: "approved", priority: "high", category: "software",
    vendorSuggestion: "Microsoft UAE (GitHub)",
    items: [
      { id: "ai1", description: "GitHub Enterprise Cloud — 25 seats (Annual)", quantity: 25, estimatedUnitPrice: 231, total: 5775 },
      { id: "ai2", description: "Azure DevOps Advanced Security — 25 users",    quantity: 25, estimatedUnitPrice: 130, total: 3250 },
    ],
    totalAmount: 9025, currency: "USD",
    justification: "Engineering team expanding from 18 to 25 developers. Current GitHub Team plan insufficient for enterprise security scanning and compliance requirements.",
    approvedBy: "Sarah Mitchell", approvedDate: "2026-05-13",
    convertedToPO: "PO-2026-0038",
  },
  {
    id: "pa-002", requestNumber: "PR-2026-0052",
    title: "Standing Desk Upgrades — Engineering Floor",
    requestedBy: "Hana Al Rashid", department: "Administration",
    requestDate: "2026-05-14", requiredBy: "2026-06-15",
    status: "pending", priority: "medium", category: "office_supplies",
    vendorSuggestion: "IKEA Business UAE",
    items: [
      { id: "ai3", description: "Height-Adjustable Standing Desk (IKEA BEKANT 160×80cm) × 12", quantity: 12, estimatedUnitPrice: 1450, total: 17400 },
      { id: "ai4", description: "Ergonomic Chair (MARKUS) × 12",                                 quantity: 12, estimatedUnitPrice: 1100, total: 13200 },
      { id: "ai5", description: "Monitor Arm Dual (VATTENKAR) × 12",                             quantity: 12, estimatedUnitPrice:  350, total:  4200 },
    ],
    totalAmount: 34800, currency: "AED",
    justification: "Engineering floor renovation underway. 12 new desks required before the team moves in June 15. Ergonomic upgrade improves productivity and reduces sick days.",
  },
  {
    id: "pa-003", requestNumber: "PR-2026-0048",
    title: "Annual Penetration Testing — External Vendor",
    requestedBy: "Sarah Mitchell", department: "Security",
    requestDate: "2026-05-05", requiredBy: "2026-05-31",
    status: "approved", priority: "urgent", category: "professional_services",
    vendorSuggestion: "CrowdStrike Services / Rapid7",
    items: [
      { id: "ai6", description: "External Penetration Test — Web Applications & APIs",   quantity: 1, estimatedUnitPrice: 35000, total: 35000 },
      { id: "ai7", description: "Internal Network Penetration Test",                      quantity: 1, estimatedUnitPrice: 25000, total: 25000 },
      { id: "ai8", description: "Remediation Retesting (2 rounds)",                       quantity: 2, estimatedUnitPrice:  5000, total: 10000 },
    ],
    totalAmount: 70000, currency: "AED",
    justification: "Mandatory for SOC 2 Type II compliance. Customer contracts (Emirates NBD, Emaar) require annual pen test certification. Must be completed before Q2 close.",
    approvedBy: "CEO", approvedDate: "2026-05-06",
  },
  {
    id: "pa-004", requestNumber: "PR-2026-0050",
    title: "Cloud Monitoring & Observability Platform",
    requestedBy: "Priya Sharma", department: "DevOps",
    requestDate: "2026-05-10", requiredBy: "2026-06-01",
    status: "pending", priority: "high", category: "cloud",
    vendorSuggestion: "Datadog / New Relic",
    items: [
      { id: "ai9",  description: "Datadog Infrastructure — 20 hosts (Annual)", quantity: 20, estimatedUnitPrice: 948,  total: 18960 },
      { id: "ai10", description: "Datadog APM — 20 hosts (Annual)",            quantity: 20, estimatedUnitPrice: 396,  total: 7920 },
      { id: "ai11", description: "Datadog Log Management — 50GB/day (Annual)", quantity: 1,  estimatedUnitPrice: 4200, total: 4200 },
    ],
    totalAmount: 31080, currency: "USD",
    justification: "Production environment now spans 20 microservices. Current CloudWatch monitoring insufficient. Customer SLA of 99.9% uptime requires proactive observability. Outages in March cost 2 days of SLA credits.",
  },
  {
    id: "pa-005", requestNumber: "PR-2026-0046",
    title: "Office Coffee Machine Replacement",
    requestedBy: "Hana Al Rashid", department: "Administration",
    requestDate: "2026-04-28", requiredBy: "2026-05-15",
    status: "rejected", priority: "low", category: "facilities",
    vendorSuggestion: "Nespresso Business",
    items: [
      { id: "ai12", description: "Nespresso Zenius Pro Coffee Machine × 2", quantity: 2, estimatedUnitPrice: 1800, total: 3600 },
      { id: "ai13", description: "Nespresso Pods — 6-month supply",          quantity: 6, estimatedUnitPrice:  420, total: 2520 },
    ],
    totalAmount: 6120, currency: "AED",
    justification: "Existing Delonghi machine in kitchen is 4 years old and producing poor quality coffee. Frequent breakdowns. New machine will improve office morale.",
    approvedBy: "Omar Farooq", approvedDate: "2026-04-30",
    rejectionReason: "Non-essential purchase. Budget freeze on facilities capex for Q2. Re-submit in Q3 with Finance approval.",
  },
  {
    id: "pa-006", requestNumber: "PR-2026-0053",
    title: "Figma Enterprise Licenses — Design Team",
    requestedBy: "Lina Khoury", department: "Product & Design",
    requestDate: "2026-05-16", requiredBy: "2026-06-01",
    status: "pending", priority: "medium", category: "software",
    vendorSuggestion: "Figma Inc. (Direct)",
    items: [
      { id: "ai14", description: "Figma Enterprise — 8 seats (Annual)", quantity: 8, estimatedUnitPrice: 900, total: 7200 },
    ],
    totalAmount: 7200, currency: "USD",
    justification: "Design team growing from 4 to 8 designers. Current Figma Professional plan (4 seats) at capacity. Enterprise plan provides SSO, advanced admin, and unlimited version history required for ERP project design work.",
  },
  {
    id: "pa-007", requestNumber: "PR-2026-0044",
    title: "Security Cameras — Office Premises",
    requestedBy: "Hana Al Rashid", department: "Administration",
    requestDate: "2026-04-20", requiredBy: "2026-05-10",
    status: "approved", priority: "high", category: "facilities",
    vendorSuggestion: "Hikvision UAE Distributor",
    items: [
      { id: "ai15", description: "Hikvision DS-2CD2143G2 IP Camera × 12", quantity: 12, estimatedUnitPrice: 550, total: 6600 },
      { id: "ai16", description: "Hikvision 32-CH NVR with 8TB Storage",   quantity: 1,  estimatedUnitPrice: 3800, total: 3800 },
      { id: "ai17", description: "Installation & Cabling (per point)",      quantity: 12, estimatedUnitPrice: 200,  total: 2400 },
    ],
    totalAmount: 12800, currency: "AED",
    justification: "New office premises require security coverage. Landlord confirmed CCTV is tenant responsibility. Insurance certificate requires camera coverage of all entry points.",
    approvedBy: "Sarah Mitchell", approvedDate: "2026-04-22",
    convertedToPO: "PO-2026-0031",
  },
];

// ── Summaries ──
export const vendorsSummary = {
  total:    mockVendors.length,
  active:   mockVendors.filter(v => v.status === "active").length,
  inactive: mockVendors.filter(v => v.status === "inactive").length,
  totalSpend: mockVendors.reduce((s, v) => s + v.totalSpend, 0),
  outstanding: mockVendors.reduce((s, v) => s + v.outstandingBalance, 0),
};

export const poSummary = {
  total:        mockPurchaseOrders.length,
  draft:        mockPurchaseOrders.filter(p => p.status === "draft").length,
  sent:         mockPurchaseOrders.filter(p => p.status === "sent").length,
  acknowledged: mockPurchaseOrders.filter(p => p.status === "acknowledged").length,
  received:     mockPurchaseOrders.filter(p => ["received","partial"].includes(p.status)).length,
  totalValue:   mockPurchaseOrders.reduce((s, p) => s + p.total, 0),
};

export const approvalsSummary = {
  total:    mockApprovals.length,
  pending:  mockApprovals.filter(a => a.status === "pending").length,
  approved: mockApprovals.filter(a => a.status === "approved").length,
  rejected: mockApprovals.filter(a => a.status === "rejected").length,
  totalRequestedValue: mockApprovals.filter(a => a.status !== "rejected").reduce((s, a) => s + a.totalAmount, 0),
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  net_15:  "Net 15 Days",
  net_30:  "Net 30 Days",
  net_45:  "Net 45 Days",
  net_60:  "Net 60 Days",
  prepaid: "Prepaid",
  cod:     "Cash on Delivery",
};

export const CATEGORY_LABELS: Record<VendorCategory, string> = {
  software:              "Software",
  cloud:                 "Cloud Services",
  hardware:              "Hardware",
  telecom:               "Telecom",
  office_supplies:       "Office Supplies",
  facilities:            "Facilities",
  professional_services: "Professional Services",
  logistics:             "Logistics",
};
