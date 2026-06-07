// ─── Shared ──────────────────────────────────────────────────────────────────
export type Currency = "AED" | "USD" | "SAR";

export interface SalesLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage
  vatRate: number;  // percentage (5 for UAE VAT)
  subtotal: number;
  vatAmount: number;
  total: number;
}

// ─── Quotations ──────────────────────────────────────────────────────────────
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export interface Quotation {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  contactPerson: string;
  date: string;
  validUntil: string;
  status: QuoteStatus;
  currency: Currency;
  lineItems: SalesLineItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  assignedTo: string;
  convertedToOrderId?: string;
}

// ─── Sales Orders ────────────────────────────────────────────────────────────
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export interface SalesOrder {
  id: string;
  orderNumber: string;
  quoteRef?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  contactPerson: string;
  orderDate: string;
  deliveryDate: string;
  status: OrderStatus;
  currency: Currency;
  lineItems: SalesLineItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  shippingAddress: string;
  paymentTerms: string;
  notes?: string;
  assignedTo: string;
  deliveredDate?: string;
  trackingNumber?: string;
}

// ─── Returns ─────────────────────────────────────────────────────────────────
export type ReturnStatus = "pending" | "approved" | "rejected" | "refunded" | "completed";
export type ReturnReason = "defective" | "wrong_item" | "not_as_described" | "duplicate_order" | "changed_mind" | "other";

export interface ReturnItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  requestDate: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonDetail: string;
  items: ReturnItem[];
  refundAmount: number;
  currency: Currency;
  creditNote?: string;
  processedBy?: string;
  processedDate?: string;
  refundMethod?: "bank_transfer" | "credit_note" | "cash";
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

function buildItem(id: string, desc: string, qty: number, price: number, disc = 0, vat = 5): SalesLineItem {
  const subtotal = qty * price;
  const discAmt  = subtotal * (disc / 100);
  const vatAmt   = (subtotal - discAmt) * (vat / 100);
  return { id, description: desc, quantity: qty, unitPrice: price, discount: disc, vatRate: vat,
    subtotal, vatAmount: parseFloat(vatAmt.toFixed(2)), total: parseFloat((subtotal - discAmt + vatAmt).toFixed(2)) };
}

// ── Quotations ──
export const mockQuotations: Quotation[] = [
  {
    id: "qt-001", quoteNumber: "QT-2026-0041",
    customerId: "cust-001", customerName: "Emirates NBD", customerEmail: "erp@emiratesnbd.com", contactPerson: "Suresh Menon",
    date: "2026-05-10", validUntil: "2026-06-10", status: "sent", currency: "AED",
    lineItems: [
      buildItem("li1", "HR Module — Enterprise License (Annual)", 1, 65000, 0, 5),
      buildItem("li2", "Implementation & Configuration", 1, 15000, 10, 5),
      buildItem("li3", "Training (5 days on-site)", 5, 1000, 0, 5),
    ],
    subtotal: 84500, discountAmount: 1500, vatAmount: 4150, total: 87150,
    notes: "Proposal for HR module add-on to existing Finance implementation.",
    terms: "Payment: 50% on order, 50% on go-live. Net 30.",
    assignedTo: "Priya Sharma",
  },
  {
    id: "qt-002", quoteNumber: "QT-2026-0040",
    customerId: "cust-002", customerName: "Emaar Properties", customerEmail: "erp@emaar.ae", contactPerson: "Khalid Al Rashidi",
    date: "2026-04-28", validUntil: "2026-05-28", status: "accepted", currency: "AED",
    lineItems: [
      buildItem("li4", "ERP Platform — Platinum License", 1, 380000, 0, 5),
      buildItem("li5", "Enterprise Implementation (12 months)", 1, 75000, 5, 5),
      buildItem("li6", "Data Migration Services", 1, 20000, 0, 5),
      buildItem("li7", "Annual Support & Maintenance", 1, 38000, 0, 5),
    ],
    subtotal: 513000, discountAmount: 3750, vatAmount: 25463, total: 534713,
    terms: "Payment milestones per implementation schedule.",
    assignedTo: "Sarah Mitchell",
    convertedToOrderId: "so-001",
  },
  {
    id: "qt-003", quoteNumber: "QT-2026-0038",
    customerId: "cust-003", customerName: "DAMAC Holdings", customerEmail: "tech@damac.ae", contactPerson: "Fatima Al Maktoum",
    date: "2026-05-02", validUntil: "2026-06-02", status: "sent", currency: "AED",
    lineItems: [
      buildItem("li8", "HR & Payroll Module — Gold License", 1, 95000, 0, 5),
      buildItem("li9", "WPS Integration Setup", 1, 8000, 0, 5),
      buildItem("li10", "Employee Self-Service Portal", 1, 12000, 10, 5),
      buildItem("li11", "Training (3 days)", 3, 1000, 0, 5),
    ],
    subtotal: 117200, discountAmount: 1200, vatAmount: 5800, total: 121800,
    notes: "Includes WPS compliance and Arabic interface.",
    terms: "Net 45 days from invoice date.",
    assignedTo: "Omar Farooq",
  },
  {
    id: "qt-004", quoteNumber: "QT-2026-0037",
    customerId: "cust-007", customerName: "Aster DM Healthcare", customerEmail: "cio@asterdm.com", contactPerson: "Dr. Sanjay Kumar",
    date: "2026-04-15", validUntil: "2026-05-15", status: "expired", currency: "AED",
    lineItems: [
      buildItem("li12", "Healthcare ERP — Enterprise Suite", 1, 420000, 0, 5),
      buildItem("li13", "Implementation (18 months)", 1, 85000, 0, 5),
      buildItem("li14", "HIPAA-adjacent Compliance Module", 1, 15000, 0, 5),
    ],
    subtotal: 520000, discountAmount: 0, vatAmount: 26000, total: 546000,
    notes: "Re-issue with updated pricing if still interested.",
    assignedTo: "Sarah Mitchell",
  },
  {
    id: "qt-005", quoteNumber: "QT-2026-0036",
    customerId: "cust-008", customerName: "Careem", customerEmail: "hr@careem.com", contactPerson: "Nadia Al Hajj",
    date: "2026-02-20", validUntil: "2026-03-20", status: "converted", currency: "AED",
    lineItems: [
      buildItem("li15", "Payroll Module — Pilot (3 months)", 1, 35000, 0, 5),
      buildItem("li16", "Implementation & Setup", 1, 5000, 0, 5),
      buildItem("li17", "Support SLA (3 months)", 1, 2000, 0, 5),
    ],
    subtotal: 42000, discountAmount: 0, vatAmount: 2100, total: 44100,
    assignedTo: "Priya Sharma",
    convertedToOrderId: "so-004",
  },
  {
    id: "qt-006", quoteNumber: "QT-2026-0043",
    customerId: "cust-004", customerName: "Al Futtaim Retail", customerEmail: "digital@alfuttaim.ae", contactPerson: "James Whitfield",
    date: "2026-05-14", validUntil: "2026-06-14", status: "draft", currency: "AED",
    lineItems: [
      buildItem("li18", "Inventory Management — Gold License", 1, 145000, 0, 5),
      buildItem("li19", "POS Integration (50 outlets)", 50, 1200, 10, 5),
      buildItem("li20", "Supply Chain Module", 1, 35000, 0, 5),
      buildItem("li21", "Implementation Services", 1, 30000, 0, 5),
    ],
    subtotal: 275000, discountAmount: 6000, vatAmount: 13450, total: 282450,
    notes: "Draft — pending pricing approval from management.",
    assignedTo: "Priya Sharma",
  },
  {
    id: "qt-007", quoteNumber: "QT-2026-0042",
    customerId: "cust-006", customerName: "Arabtec Holding", customerEmail: "it@arabtec.ae", contactPerson: "Mohammed Al Qassim",
    date: "2026-05-08", validUntil: "2026-06-08", status: "sent", currency: "AED",
    lineItems: [
      buildItem("li22", "Construction ERP — Gold License", 1, 220000, 0, 5),
      buildItem("li23", "Project Cost Management Module", 1, 45000, 5, 5),
      buildItem("li24", "Subcontractor Management", 1, 20000, 0, 5),
      buildItem("li25", "Implementation (9 months)", 1, 55000, 0, 5),
    ],
    subtotal: 340000, discountAmount: 2250, vatAmount: 16888, total: 354638,
    terms: "Payment: 30% deposit, 40% midpoint, 30% on completion.",
    assignedTo: "Omar Farooq",
  },
  {
    id: "qt-008", quoteNumber: "QT-2026-0035",
    customerId: "cust-009", customerName: "Nakheel Properties", customerEmail: "it@nakheel.com", contactPerson: "Rashid Al Falasi",
    date: "2026-04-20", validUntil: "2026-05-20", status: "rejected", currency: "AED",
    lineItems: [
      buildItem("li26", "Real Estate CRM — Enterprise", 1, 280000, 0, 5),
      buildItem("li27", "Lease Management Module", 1, 45000, 0, 5),
      buildItem("li28", "Owner Portal Development", 1, 25000, 0, 5),
    ],
    subtotal: 350000, discountAmount: 0, vatAmount: 17500, total: 367500,
    notes: "Lost on price. Competitor offered 20% lower. Consider re-pricing for next cycle.",
    assignedTo: "Sarah Mitchell",
  },
];

// ── Sales Orders ──
export const mockSalesOrders: SalesOrder[] = [
  {
    id: "so-001", orderNumber: "SO-2026-0021", quoteRef: "QT-2026-0040",
    customerId: "cust-002", customerName: "Emaar Properties", customerEmail: "erp@emaar.ae", contactPerson: "Khalid Al Rashidi",
    orderDate: "2026-05-02", deliveryDate: "2026-05-30", status: "processing",
    currency: "AED",
    lineItems: [
      buildItem("o-li1", "ERP Platform — Platinum License", 1, 380000, 0, 5),
      buildItem("o-li2", "Enterprise Implementation (12 months)", 1, 75000, 5, 5),
      buildItem("o-li3", "Data Migration Services", 1, 20000, 0, 5),
      buildItem("o-li4", "Annual Support & Maintenance", 1, 38000, 0, 5),
    ],
    subtotal: 513000, discountAmount: 3750, vatAmount: 25463, total: 534713,
    shippingAddress: "Emaar Square, Downtown Dubai, UAE",
    paymentTerms: "Milestone-based payments",
    assignedTo: "Sarah Mitchell",
  },
  {
    id: "so-002", orderNumber: "SO-2026-0020",
    customerId: "cust-001", customerName: "Emirates NBD", customerEmail: "erp@emiratesnbd.com", contactPerson: "Suresh Menon",
    orderDate: "2026-02-01", deliveryDate: "2026-02-28", status: "delivered",
    currency: "AED",
    lineItems: [
      buildItem("o-li5", "Finance & Accounting Suite — Platinum", 1, 145000, 0, 5),
      buildItem("o-li6", "Implementation (6 months)", 1, 25000, 0, 5),
      buildItem("o-li7", "Training (5 days)", 5, 1000, 0, 5),
    ],
    subtotal: 175000, discountAmount: 0, vatAmount: 8750, total: 183750,
    shippingAddress: "Baniyas Road, Deira, Dubai, UAE",
    paymentTerms: "50% upfront, 50% on delivery",
    assignedTo: "Priya Sharma",
    deliveredDate: "2026-02-26",
  },
  {
    id: "so-003", orderNumber: "SO-2026-0019",
    customerId: "cust-006", customerName: "Arabtec Holding", customerEmail: "it@arabtec.ae", contactPerson: "Mohammed Al Qassim",
    orderDate: "2026-04-01", deliveryDate: "2026-06-30", status: "confirmed",
    currency: "AED",
    lineItems: [
      buildItem("o-li8", "Construction ERP — Gold License", 1, 220000, 0, 5),
      buildItem("o-li9", "Project Cost Management Module", 1, 42750, 5, 5),
      buildItem("o-li10", "Implementation (9 months)", 1, 55000, 0, 5),
    ],
    subtotal: 317750, discountAmount: 2250, vatAmount: 15775, total: 331275,
    shippingAddress: "Arabtec Tower, Business Bay, Dubai, UAE",
    paymentTerms: "30/40/30 milestone payments",
    assignedTo: "Omar Farooq",
  },
  {
    id: "so-004", orderNumber: "SO-2026-0018", quoteRef: "QT-2026-0036",
    customerId: "cust-008", customerName: "Careem", customerEmail: "hr@careem.com", contactPerson: "Nadia Al Hajj",
    orderDate: "2026-03-01", deliveryDate: "2026-03-20", status: "delivered",
    currency: "AED",
    lineItems: [
      buildItem("o-li11", "Payroll Module — Pilot (3 months)", 1, 35000, 0, 5),
      buildItem("o-li12", "Implementation & Setup", 1, 5000, 0, 5),
      buildItem("o-li13", "Support SLA (3 months)", 1, 2000, 0, 5),
    ],
    subtotal: 42000, discountAmount: 0, vatAmount: 2100, total: 44100,
    shippingAddress: "Dubai Internet City, Dubai, UAE",
    paymentTerms: "Paid upfront",
    assignedTo: "Priya Sharma",
    deliveredDate: "2026-03-18",
  },
  {
    id: "so-005", orderNumber: "SO-2026-0022",
    customerId: "cust-003", customerName: "DAMAC Holdings", customerEmail: "tech@damac.ae", contactPerson: "Fatima Al Maktoum",
    orderDate: "2026-05-15", deliveryDate: "2026-07-15", status: "pending",
    currency: "AED",
    lineItems: [
      buildItem("o-li14", "HR & Payroll Module — Gold License", 1, 95000, 0, 5),
      buildItem("o-li15", "WPS Integration Setup", 1, 8000, 0, 5),
      buildItem("o-li16", "Employee Self-Service Portal", 1, 10800, 10, 5),
    ],
    subtotal: 113800, discountAmount: 1200, vatAmount: 5630, total: 118230,
    shippingAddress: "DAMAC Tower, Business Bay, Dubai, UAE",
    paymentTerms: "Net 45 days",
    assignedTo: "Omar Farooq",
  },
  {
    id: "so-006", orderNumber: "SO-2026-0017",
    customerId: "cust-005", customerName: "Jumeirah Group", customerEmail: "technology@jumeirah.com", contactPerson: "Elena Voronova",
    orderDate: "2026-01-15", deliveryDate: "2026-02-15", status: "cancelled",
    currency: "AED",
    lineItems: [
      buildItem("o-li17", "Hotel Management System — Pilot", 1, 45000, 0, 5),
      buildItem("o-li18", "Setup & Configuration", 1, 8000, 0, 5),
    ],
    subtotal: 53000, discountAmount: 0, vatAmount: 2650, total: 55650,
    shippingAddress: "Jumeirah Beach Road, Dubai, UAE",
    paymentTerms: "Net 30",
    notes: "Order cancelled by customer. Full refund processed.",
    assignedTo: "Sarah Mitchell",
  },
  {
    id: "so-007", orderNumber: "SO-2026-0023",
    customerId: "cust-004", customerName: "Al Futtaim Retail", customerEmail: "digital@alfuttaim.ae", contactPerson: "James Whitfield",
    orderDate: "2026-05-18", deliveryDate: "2026-08-18", status: "confirmed",
    currency: "AED",
    lineItems: [
      buildItem("o-li19", "Inventory Management — Gold License", 1, 145000, 0, 5),
      buildItem("o-li20", "POS Integration (50 outlets)", 50, 1080, 10, 5),
      buildItem("o-li21", "Supply Chain Module", 1, 35000, 0, 5),
    ],
    subtotal: 234000, discountAmount: 6000, vatAmount: 11400, total: 239400,
    shippingAddress: "Festival City, Dubai, UAE",
    paymentTerms: "30% deposit, balance net 60",
    assignedTo: "Priya Sharma",
    trackingNumber: "AF-2026-0054",
  },
];

// ── Returns ──
export const mockReturns: SalesReturn[] = [
  {
    id: "rt-001", returnNumber: "RT-2026-0008",
    orderId: "so-006", orderNumber: "SO-2026-0017",
    customerId: "cust-005", customerName: "Jumeirah Group",
    requestDate: "2026-02-18", status: "refunded",
    reason: "changed_mind", reasonDetail: "Business decision changed. Delaying hotel PMS project by 12 months.",
    items: [
      { id: "ri1", description: "Hotel Management System — Pilot", quantity: 1, unitPrice: 45000, total: 45000 },
      { id: "ri2", description: "Setup & Configuration", quantity: 1, unitPrice: 8000, total: 8000 },
    ],
    refundAmount: 55650, currency: "AED",
    creditNote: "CN-2026-0005",
    processedBy: "Sarah Mitchell", processedDate: "2026-02-20",
    refundMethod: "bank_transfer",
  },
  {
    id: "rt-002", returnNumber: "RT-2026-0009",
    orderId: "so-002", orderNumber: "SO-2026-0020",
    customerId: "cust-001", customerName: "Emirates NBD",
    requestDate: "2026-03-05", status: "completed",
    reason: "not_as_described", reasonDetail: "Training days were shorter than agreed scope. Requesting partial refund for 2 training days.",
    items: [
      { id: "ri3", description: "Training Days (2 days — disputed)", quantity: 2, unitPrice: 1000, total: 2000 },
    ],
    refundAmount: 2100, currency: "AED",
    creditNote: "CN-2026-0006",
    processedBy: "Priya Sharma", processedDate: "2026-03-08",
    refundMethod: "credit_note",
  },
  {
    id: "rt-003", returnNumber: "RT-2026-0010",
    orderId: "so-003", orderNumber: "SO-2026-0019",
    customerId: "cust-006", customerName: "Arabtec Holding",
    requestDate: "2026-05-10", status: "pending",
    reason: "defective", reasonDetail: "Project cost tracking module showing calculation errors in budget variance reports. Need investigation.",
    items: [
      { id: "ri4", description: "Project Cost Management Module", quantity: 1, unitPrice: 42750, total: 42750 },
    ],
    refundAmount: 44888, currency: "AED",
  },
  {
    id: "rt-004", returnNumber: "RT-2026-0011",
    orderId: "so-004", orderNumber: "SO-2026-0018",
    customerId: "cust-008", customerName: "Careem",
    requestDate: "2026-05-15", status: "approved",
    reason: "other", reasonDetail: "Pilot extended by 1 month. Requesting partial refund for unused support period.",
    items: [
      { id: "ri5", description: "Support SLA — 1 Month Refund", quantity: 1, unitPrice: 667, total: 667 },
    ],
    refundAmount: 700, currency: "AED",
    processedBy: "Priya Sharma", processedDate: "2026-05-16",
    refundMethod: "credit_note",
  },
  {
    id: "rt-005", returnNumber: "RT-2026-0012",
    orderId: "so-007", orderNumber: "SO-2026-0023",
    customerId: "cust-004", customerName: "Al Futtaim Retail",
    requestDate: "2026-05-19", status: "pending",
    reason: "wrong_item", reasonDetail: "POS integration delivered for 45 outlets, order was for 50. Need remaining 5 or partial refund.",
    items: [
      { id: "ri6", description: "POS Integration — 5 outlets shortfall", quantity: 5, unitPrice: 1080, total: 5400 },
    ],
    refundAmount: 5670, currency: "AED",
  },
];

// ── Summaries ──
export const quotationsSummary = {
  total: mockQuotations.length,
  draft: mockQuotations.filter(q => q.status === "draft").length,
  sent: mockQuotations.filter(q => q.status === "sent").length,
  accepted: mockQuotations.filter(q => q.status === "accepted").length,
  converted: mockQuotations.filter(q => q.status === "converted").length,
  totalValue: mockQuotations.filter(q => !["rejected","expired"].includes(q.status)).reduce((s, q) => s + q.total, 0),
  acceptanceRate: Math.round((mockQuotations.filter(q => ["accepted","converted"].includes(q.status)).length /
    mockQuotations.filter(q => q.status !== "draft").length) * 100),
};

export const ordersSummary = {
  total: mockSalesOrders.length,
  pending: mockSalesOrders.filter(o => o.status === "pending").length,
  confirmed: mockSalesOrders.filter(o => o.status === "confirmed").length,
  processing: mockSalesOrders.filter(o => o.status === "processing").length,
  delivered: mockSalesOrders.filter(o => o.status === "delivered").length,
  cancelled: mockSalesOrders.filter(o => o.status === "cancelled").length,
  totalRevenue: mockSalesOrders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0),
};

export const returnsSummary = {
  total: mockReturns.length,
  pending: mockReturns.filter(r => r.status === "pending").length,
  approved: mockReturns.filter(r => r.status === "approved").length,
  refunded: mockReturns.filter(r => ["refunded","completed"].includes(r.status)).length,
  totalRefundValue: mockReturns.reduce((s, r) => s + r.refundAmount, 0),
};
