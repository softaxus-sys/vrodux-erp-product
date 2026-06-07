export type LeaveType = "annual" | "sick" | "unpaid" | "maternity" | "paternity" | "emergency" | "hajj";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  rejectionReason?: string;
  coveringEmployee?: string;
}

export interface LeaveBalance {
  employeeId: string;
  employeeName: string;
  department: string;
  annual: { entitled: number; taken: number; balance: number };
  sick: { entitled: number; taken: number; balance: number };
  unpaid: { entitled: number; taken: number; balance: number };
}

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "lv-001", employeeId: "emp-005", employeeName: "Omar Al Farsi",
    department: "Real Estate", designation: "Senior Sales Executive",
    leaveType: "annual", fromDate: "2026-05-12", toDate: "2026-05-16", days: 5,
    reason: "Family vacation to Europe.", status: "approved",
    appliedOn: "2026-05-05", approvedBy: "Fatima Al Zaabi", approvedOn: "2026-05-06",
    coveringEmployee: "Layla Hassan",
  },
  {
    id: "lv-002", employeeId: "emp-007", employeeName: "Layla Hassan",
    department: "Sales & Marketing", designation: "Account Executive",
    leaveType: "sick", fromDate: "2026-05-18", toDate: "2026-05-19", days: 2,
    reason: "Fever and flu symptoms. Doctor's note attached.", status: "approved",
    appliedOn: "2026-05-18", approvedBy: "Fatima Al Zaabi", approvedOn: "2026-05-18",
  },
  {
    id: "lv-003", employeeId: "emp-003", employeeName: "Khalid Al Marri",
    department: "Technology", designation: "Senior Software Engineer",
    leaveType: "annual", fromDate: "2026-06-01", toDate: "2026-06-05", days: 5,
    reason: "Personal travel plans.", status: "pending",
    appliedOn: "2026-05-15",
    coveringEmployee: "Ahmed Al Mansouri",
  },
  {
    id: "lv-004", employeeId: "emp-009", employeeName: "Nour Al Shamsi",
    department: "Human Resources", designation: "HR Business Partner",
    leaveType: "annual", fromDate: "2026-05-25", toDate: "2026-05-29", days: 5,
    reason: "Annual family trip.", status: "pending",
    appliedOn: "2026-05-14",
  },
  {
    id: "lv-005", employeeId: "emp-002", employeeName: "Sara Al Hashimi",
    department: "Finance", designation: "Senior Financial Analyst",
    leaveType: "emergency", fromDate: "2026-04-28", toDate: "2026-04-29", days: 2,
    reason: "Family medical emergency.", status: "approved",
    appliedOn: "2026-04-28", approvedBy: "Ahmed Al Mansouri", approvedOn: "2026-04-28",
  },
  {
    id: "lv-006", employeeId: "emp-008", employeeName: "Tariq Al Ameri",
    department: "Finance", designation: "Finance Manager",
    leaveType: "annual", fromDate: "2026-04-14", toDate: "2026-04-18", days: 5,
    reason: "Eid Al Fitr holiday extension.", status: "approved",
    appliedOn: "2026-04-01", approvedBy: "Ahmed Al Mansouri", approvedOn: "2026-04-02",
  },
  {
    id: "lv-007", employeeId: "emp-004", employeeName: "Fatima Al Zaabi",
    department: "Sales & Marketing", designation: "Sales Manager",
    leaveType: "hajj", fromDate: "2026-06-10", toDate: "2026-06-24", days: 15,
    reason: "Performing Hajj pilgrimage.", status: "approved",
    appliedOn: "2026-04-20", approvedBy: "Ahmed Al Mansouri", approvedOn: "2026-04-22",
  },
  {
    id: "lv-008", employeeId: "emp-006", employeeName: "Mohammed Al Rashid",
    department: "Operations", designation: "Operations Director",
    leaveType: "annual", fromDate: "2026-07-01", toDate: "2026-07-14", days: 14,
    reason: "Summer family vacation.", status: "pending",
    appliedOn: "2026-05-10",
  },
  {
    id: "lv-009", employeeId: "emp-010", employeeName: "James Mitchell",
    department: "Construction", designation: "Project Director",
    leaveType: "annual", fromDate: "2026-08-01", toDate: "2026-08-21", days: 21,
    reason: "UK family visit.", status: "pending",
    appliedOn: "2026-05-12",
  },
  {
    id: "lv-010", employeeId: "emp-001", employeeName: "Ahmed Al Mansouri",
    department: "Technology", designation: "Chief Technology Officer",
    leaveType: "annual", fromDate: "2026-03-10", toDate: "2026-03-14", days: 5,
    reason: "Personal travel.", status: "approved",
    appliedOn: "2026-03-01", approvedBy: "CEO", approvedOn: "2026-03-02",
  },
  {
    id: "lv-011", employeeId: "emp-003", employeeName: "Khalid Al Marri",
    department: "Technology", designation: "Senior Software Engineer",
    leaveType: "sick", fromDate: "2026-04-05", toDate: "2026-04-06", days: 2,
    reason: "Medical appointment and recovery.", status: "approved",
    appliedOn: "2026-04-05", approvedBy: "Ahmed Al Mansouri", approvedOn: "2026-04-05",
  },
  {
    id: "lv-012", employeeId: "emp-007", employeeName: "Layla Hassan",
    department: "Sales & Marketing", designation: "Account Executive",
    leaveType: "annual", fromDate: "2026-06-20", toDate: "2026-06-22", days: 3,
    reason: "Personal reasons.", status: "rejected",
    appliedOn: "2026-05-18",
    rejectionReason: "Critical project delivery period. Please resubmit for July.",
  },
];

export const mockLeaveBalances: LeaveBalance[] = [
  { employeeId: "emp-001", employeeName: "Ahmed Al Mansouri", department: "Technology",    annual: { entitled: 30, taken: 12, balance: 18 }, sick: { entitled: 15, taken: 5,  balance: 10 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-002", employeeName: "Sara Al Hashimi",   department: "Finance",        annual: { entitled: 30, taken: 18, balance: 12 }, sick: { entitled: 15, taken: 5,  balance: 10 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-003", employeeName: "Khalid Al Marri",   department: "Technology",     annual: { entitled: 10, taken: 5,  balance: 5  }, sick: { entitled: 15, taken: 2,  balance: 13 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-004", employeeName: "Fatima Al Zaabi",   department: "Sales & Marketing", annual: { entitled: 30, taken: 8, balance: 22 }, sick: { entitled: 15, taken: 0,  balance: 15 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-005", employeeName: "Omar Al Farsi",     department: "Real Estate",    annual: { entitled: 30, taken: 30, balance: 0  }, sick: { entitled: 15, taken: 7,  balance: 8  }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-006", employeeName: "Mohammed Al Rashid", department: "Operations",    annual: { entitled: 30, taken: 6,  balance: 24 }, sick: { entitled: 15, taken: 0,  balance: 15 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-007", employeeName: "Layla Hassan",      department: "Sales & Marketing", annual: { entitled: 30, taken: 16, balance: 14 }, sick: { entitled: 15, taken: 5, balance: 10 }, unpaid: { entitled: 0, taken: 2, balance: 0 } },
  { employeeId: "emp-008", employeeName: "Tariq Al Ameri",    department: "Finance",        annual: { entitled: 30, taken: 10, balance: 20 }, sick: { entitled: 15, taken: 0,  balance: 15 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-009", employeeName: "Nour Al Shamsi",    department: "Human Resources", annual: { entitled: 30, taken: 14, balance: 16 }, sick: { entitled: 15, taken: 4, balance: 11 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
  { employeeId: "emp-010", employeeName: "James Mitchell",    department: "Construction",   annual: { entitled: 30, taken: 0,  balance: 30 }, sick: { entitled: 15, taken: 0,  balance: 15 }, unpaid: { entitled: 0, taken: 0, balance: 0 } },
];

export const leaveSummary = {
  totalRequests: mockLeaveRequests.length,
  pending: mockLeaveRequests.filter(l => l.status === "pending").length,
  approved: mockLeaveRequests.filter(l => l.status === "approved").length,
  rejected: mockLeaveRequests.filter(l => l.status === "rejected").length,
  onLeaveToday: 1,
  avgLeaveDays: Math.round(mockLeaveRequests.filter(l => l.status === "approved").reduce((s, l) => s + l.days, 0) / mockLeaveRequests.filter(l => l.status === "approved").length),
};
