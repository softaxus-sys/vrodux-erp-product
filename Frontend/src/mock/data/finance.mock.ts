import type { Status } from "@/types";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";
export type PaymentMethod = "bank_transfer" | "cash" | "cheque" | "card" | "online";

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerTrn?: string; // UAE Tax Registration Number
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  items: InvoiceItem[];
  branch: string;
  createdBy: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export const mockInvoices: Invoice[] = [
  {
    id: "inv-001",
    number: "INV-2026-0891",
    customerId: "cust-001",
    customerName: "Emirates NBD",
    customerEmail: "accounts@emiratesnbd.com",
    customerTrn: "100234567800003",
    issueDate: "2026-05-19",
    dueDate: "2026-06-18",
    status: "sent",
    currency: "AED",
    subtotal: 138095,
    vatAmount: 6905,
    vatRate: 5,
    discount: 0,
    total: 145000,
    paidAmount: 0,
    balanceDue: 145000,
    reference: "PO-EMB-2026-441",
    notes: "Payment due within 30 days. Bank transfer preferred.",
    branch: "Dubai HQ",
    createdBy: "Sara Al Hashimi",
    createdAt: "2026-05-19T09:15:00Z",
    items: [
      { id: "item-001", description: "IT Infrastructure Consulting", quantity: 1, unitPrice: 80000, vatRate: 5, vatAmount: 4000, total: 84000 },
      { id: "item-002", description: "Software License (Annual)", quantity: 3, unitPrice: 18000, vatRate: 5, vatAmount: 2700, total: 56700 },
      { id: "item-003", description: "Support & Maintenance", quantity: 1, unitPrice: 4300, vatRate: 5, vatAmount: 215, total: 4515 },
    ],
  },
  {
    id: "inv-002",
    number: "INV-2026-0890",
    customerId: "cust-002",
    customerName: "DAMAC Properties",
    customerEmail: "finance@damacgroup.com",
    customerTrn: "100345678900004",
    issueDate: "2026-05-10",
    dueDate: "2026-05-25",
    paidDate: "2026-05-14",
    status: "paid",
    currency: "AED",
    subtotal: 2285714,
    vatAmount: 114286,
    vatRate: 5,
    discount: 0,
    total: 2400000,
    paidAmount: 2400000,
    balanceDue: 0,
    paymentMethod: "bank_transfer",
    reference: "PO-DMC-2026-089",
    branch: "Dubai HQ",
    createdBy: "Ahmed Al Mansouri",
    createdAt: "2026-05-10T10:00:00Z",
    items: [
      { id: "item-004", description: "Real Estate Consultancy Services", quantity: 1, unitPrice: 2285714, vatRate: 5, vatAmount: 114286, total: 2400000 },
    ],
  },
  {
    id: "inv-003",
    number: "INV-2026-0889",
    customerId: "cust-003",
    customerName: "Abu Dhabi National Energy",
    customerEmail: "ap@taqa.ae",
    customerTrn: "100456789000005",
    issueDate: "2026-04-15",
    dueDate: "2026-05-15",
    status: "overdue",
    currency: "AED",
    subtotal: 380952,
    vatAmount: 19048,
    vatRate: 5,
    discount: 0,
    total: 400000,
    paidAmount: 0,
    balanceDue: 400000,
    reference: "PO-TAQA-2026-112",
    branch: "Abu Dhabi",
    createdBy: "Sara Al Hashimi",
    createdAt: "2026-04-15T11:30:00Z",
    items: [
      { id: "item-005", description: "Energy Management System Implementation", quantity: 1, unitPrice: 280952, vatRate: 5, vatAmount: 14048, total: 295000 },
      { id: "item-006", description: "Training & Onboarding (10 days)", quantity: 10, unitPrice: 10000, vatRate: 5, vatAmount: 5000, total: 105000 },
    ],
  },
  {
    id: "inv-004",
    number: "INV-2026-0888",
    customerId: "cust-004",
    customerName: "Majid Al Futtaim",
    customerEmail: "vendors@majidalfuttaim.com",
    issueDate: "2026-05-18",
    dueDate: "2026-06-17",
    status: "draft",
    currency: "AED",
    subtotal: 95238,
    vatAmount: 4762,
    vatRate: 5,
    discount: 5000,
    total: 95000,
    paidAmount: 0,
    balanceDue: 95000,
    branch: "Dubai HQ",
    createdBy: "Omar Al Farsi",
    createdAt: "2026-05-18T14:00:00Z",
    items: [
      { id: "item-007", description: "Digital Marketing Campaign", quantity: 1, unitPrice: 75000, vatRate: 5, vatAmount: 3750, total: 78750 },
      { id: "item-008", description: "Social Media Management (3 months)", quantity: 3, unitPrice: 7000, vatRate: 5, vatAmount: 1050, total: 22050 },
    ],
  },
  {
    id: "inv-005",
    number: "INV-2026-0887",
    customerId: "cust-005",
    customerName: "Emaar Properties",
    customerEmail: "finance@emaar.ae",
    customerTrn: "100567890100006",
    issueDate: "2026-05-01",
    dueDate: "2026-05-31",
    status: "partial",
    currency: "AED",
    subtotal: 476190,
    vatAmount: 23810,
    vatRate: 5,
    discount: 0,
    total: 500000,
    paidAmount: 250000,
    balanceDue: 250000,
    paymentMethod: "bank_transfer",
    reference: "PO-EMR-2026-334",
    branch: "Dubai HQ",
    createdBy: "Fatima Al Zaabi",
    createdAt: "2026-05-01T09:00:00Z",
    items: [
      { id: "item-009", description: "Property Management Software", quantity: 1, unitPrice: 350000, vatRate: 5, vatAmount: 17500, total: 367500 },
      { id: "item-010", description: "Implementation Services", quantity: 1, unitPrice: 126190, vatRate: 5, vatAmount: 6310, total: 132500 },
    ],
  },
  {
    id: "inv-006",
    number: "INV-2026-0886",
    customerId: "cust-006",
    customerName: "du Telecom",
    customerEmail: "procurement@du.ae",
    issueDate: "2026-04-20",
    dueDate: "2026-05-20",
    status: "paid",
    currency: "AED",
    subtotal: 47619,
    vatAmount: 2381,
    vatRate: 5,
    discount: 0,
    total: 50000,
    paidAmount: 50000,
    balanceDue: 0,
    paymentMethod: "bank_transfer",
    branch: "Dubai HQ",
    createdBy: "Sara Al Hashimi",
    createdAt: "2026-04-20T11:00:00Z",
    items: [
      { id: "item-011", description: "Network Security Audit", quantity: 1, unitPrice: 47619, vatRate: 5, vatAmount: 2381, total: 50000 },
    ],
  },
  {
    id: "inv-007",
    number: "INV-2026-0885",
    customerId: "cust-007",
    customerName: "Etihad Airways",
    customerEmail: "ap@etihad.ae",
    customerTrn: "100678901200007",
    issueDate: "2026-03-15",
    dueDate: "2026-04-14",
    status: "cancelled",
    currency: "AED",
    subtotal: 190476,
    vatAmount: 9524,
    vatRate: 5,
    discount: 0,
    total: 200000,
    paidAmount: 0,
    balanceDue: 0,
    notes: "Cancelled per customer request on 2026-04-01",
    branch: "Abu Dhabi",
    createdBy: "Ahmed Al Mansouri",
    createdAt: "2026-03-15T08:00:00Z",
    items: [
      { id: "item-012", description: "Aviation Software Integration", quantity: 1, unitPrice: 190476, vatRate: 5, vatAmount: 9524, total: 200000 },
    ],
  },
  {
    id: "inv-008",
    number: "INV-2026-0884",
    customerId: "cust-008",
    customerName: "Aldar Properties",
    customerEmail: "finance@aldar.com",
    issueDate: "2026-05-16",
    dueDate: "2026-06-15",
    status: "sent",
    currency: "AED",
    subtotal: 228571,
    vatAmount: 11429,
    vatRate: 5,
    discount: 10000,
    total: 230000,
    paidAmount: 0,
    balanceDue: 230000,
    reference: "PO-ALD-2026-221",
    branch: "Abu Dhabi",
    createdBy: "Nour Al Shamsi",
    createdAt: "2026-05-16T13:00:00Z",
    items: [
      { id: "item-013", description: "Construction Project Management Software", quantity: 1, unitPrice: 228571, vatRate: 5, vatAmount: 11429, total: 240000 },
    ],
  },
];

export const invoiceSummary = {
  totalInvoices: mockInvoices.length,
  totalAmount: mockInvoices.reduce((s, i) => s + i.total, 0),
  totalPaid: mockInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
  totalOverdue: mockInvoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.balanceDue, 0),
  totalOutstanding: mockInvoices.filter(i => ["sent", "partial", "overdue"].includes(i.status)).reduce((s, i) => s + i.balanceDue, 0),
  draftCount: mockInvoices.filter(i => i.status === "draft").length,
};
