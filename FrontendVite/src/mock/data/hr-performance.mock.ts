export type ReviewStatus = "pending" | "in_progress" | "completed" | "overdue";
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface PerformanceGoal {
  id: string;
  title: string;
  target: string;
  progress: number;
  status: "on_track" | "at_risk" | "achieved" | "missed";
  dueDate: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  reviewPeriod: string;
  reviewType: "annual" | "mid_year" | "probation" | "pip";
  status: ReviewStatus;
  overallRating?: Rating;
  technicalRating?: Rating;
  communicationRating?: Rating;
  teamworkRating?: Rating;
  leadershipRating?: Rating;
  reviewedBy: string;
  dueDate: string;
  completedDate?: string;
  strengths?: string;
  improvements?: string;
  goals: PerformanceGoal[];
}

export const mockPerformanceReviews: PerformanceReview[] = [
  {
    id: "pr-001", employeeId: "emp-001", employeeName: "Ahmed Al Mansouri",
    department: "Technology", designation: "Chief Technology Officer",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "completed",
    overallRating: 5, technicalRating: 5, communicationRating: 5, teamworkRating: 4, leadershipRating: 5,
    reviewedBy: "CEO", dueDate: "2026-04-30", completedDate: "2026-04-28",
    strengths: "Exceptional strategic vision. Successfully led the digital transformation program. Strong stakeholder management.",
    improvements: "Delegate more tactical decisions to team leads.",
    goals: [
      { id: "g1", title: "ERP Platform Launch", target: "Live by Q2 2026", progress: 90, status: "on_track", dueDate: "2026-06-30" },
      { id: "g2", title: "Team Growth", target: "Hire 5 engineers", progress: 80, status: "on_track", dueDate: "2026-06-30" },
      { id: "g3", title: "Security Certification", target: "ISO 27001 audit pass", progress: 60, status: "at_risk", dueDate: "2026-05-31" },
    ],
  },
  {
    id: "pr-002", employeeId: "emp-002", employeeName: "Sara Al Hashimi",
    department: "Finance", designation: "Senior Financial Analyst",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "completed",
    overallRating: 4, technicalRating: 5, communicationRating: 4, teamworkRating: 4, leadershipRating: 3,
    reviewedBy: "Tariq Al Ameri", dueDate: "2026-04-30", completedDate: "2026-04-30",
    strengths: "Outstanding financial modeling skills. High attention to detail. VAT compliance expertise.",
    improvements: "Build confidence in presenting to senior leadership.",
    goals: [
      { id: "g4", title: "VAT Audit Readiness", target: "100% compliance score", progress: 100, status: "achieved", dueDate: "2026-03-31" },
      { id: "g5", title: "Budget Forecast Accuracy", target: "Within 5% variance", progress: 75, status: "on_track", dueDate: "2026-06-30" },
    ],
  },
  {
    id: "pr-003", employeeId: "emp-003", employeeName: "Khalid Al Marri",
    department: "Technology", designation: "Senior Software Engineer",
    reviewPeriod: "Probation Q1 2026", reviewType: "probation", status: "completed",
    overallRating: 4, technicalRating: 5, communicationRating: 3, teamworkRating: 4, leadershipRating: 3,
    reviewedBy: "Ahmed Al Mansouri", dueDate: "2026-04-30", completedDate: "2026-04-25",
    strengths: "Excellent technical skills. Fast learner. Strong React/TypeScript expertise.",
    improvements: "Needs to improve proactive communication with team.",
    goals: [
      { id: "g6", title: "Complete ERP Frontend Module", target: "3 modules delivered", progress: 100, status: "achieved", dueDate: "2026-04-30" },
      { id: "g7", title: "Code Quality", target: "90%+ test coverage on new code", progress: 70, status: "at_risk", dueDate: "2026-05-31" },
    ],
  },
  {
    id: "pr-004", employeeId: "emp-004", employeeName: "Fatima Al Zaabi",
    department: "Sales & Marketing", designation: "Sales Manager",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "in_progress",
    reviewedBy: "Ahmed Al Mansouri", dueDate: "2026-05-31",
    goals: [
      { id: "g8", title: "Revenue Target Q1+Q2", target: "AED 8M revenue", progress: 85, status: "on_track", dueDate: "2026-06-30" },
      { id: "g9", title: "New Client Acquisition", target: "10 new enterprise clients", progress: 60, status: "on_track", dueDate: "2026-06-30" },
      { id: "g10", title: "Team Building", target: "Hire 2 sales execs", progress: 50, status: "at_risk", dueDate: "2026-05-31" },
    ],
  },
  {
    id: "pr-005", employeeId: "emp-005", employeeName: "Omar Al Farsi",
    department: "Real Estate", designation: "Senior Sales Executive",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "overdue",
    reviewedBy: "Fatima Al Zaabi", dueDate: "2026-05-10",
    goals: [
      { id: "g11", title: "Property Sales Target", target: "AED 15M sales", progress: 100, status: "achieved", dueDate: "2026-04-30" },
      { id: "g12", title: "Customer Satisfaction", target: "4.5+ rating", progress: 90, status: "on_track", dueDate: "2026-06-30" },
    ],
  },
  {
    id: "pr-006", employeeId: "emp-006", employeeName: "Mohammed Al Rashid",
    department: "Operations", designation: "Operations Director",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "in_progress",
    reviewedBy: "CEO", dueDate: "2026-05-31",
    goals: [
      { id: "g13", title: "Process Efficiency", target: "20% cost reduction", progress: 65, status: "on_track", dueDate: "2026-06-30" },
      { id: "g14", title: "ISO 9001 Certification", target: "Pass audit", progress: 80, status: "on_track", dueDate: "2026-07-31" },
    ],
  },
  {
    id: "pr-007", employeeId: "emp-007", employeeName: "Layla Hassan",
    department: "Sales & Marketing", designation: "Account Executive",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "pending",
    reviewedBy: "Fatima Al Zaabi", dueDate: "2026-05-31",
    goals: [
      { id: "g15", title: "Pipeline Target", target: "AED 2M in pipeline", progress: 55, status: "at_risk", dueDate: "2026-06-30" },
      { id: "g16", title: "Client Retention", target: "95% retention rate", progress: 100, status: "achieved", dueDate: "2026-06-30" },
    ],
  },
  {
    id: "pr-008", employeeId: "emp-008", employeeName: "Tariq Al Ameri",
    department: "Finance", designation: "Finance Manager",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "completed",
    overallRating: 4, technicalRating: 4, communicationRating: 4, teamworkRating: 5, leadershipRating: 4,
    reviewedBy: "Ahmed Al Mansouri", dueDate: "2026-04-30", completedDate: "2026-04-29",
    strengths: "Strong financial leadership. Excellent team management. Cost control champion.",
    improvements: "Adopt more technology-driven approaches to financial reporting.",
    goals: [
      { id: "g17", title: "ERP Finance Module Go-Live", target: "Q2 2026 launch", progress: 85, status: "on_track", dueDate: "2026-06-30" },
      { id: "g18", title: "Budget Savings", target: "5% under budget", progress: 70, status: "on_track", dueDate: "2026-12-31" },
    ],
  },
  {
    id: "pr-009", employeeId: "emp-009", employeeName: "Nour Al Shamsi",
    department: "Human Resources", designation: "HR Business Partner",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "pending",
    reviewedBy: "Mohammed Al Rashid", dueDate: "2026-05-31",
    goals: [
      { id: "g19", title: "Employee Engagement Score", target: "Above 80%", progress: 72, status: "at_risk", dueDate: "2026-06-30" },
      { id: "g20", title: "Time-to-Hire Reduction", target: "From 30 to 21 days avg", progress: 60, status: "on_track", dueDate: "2026-12-31" },
    ],
  },
  {
    id: "pr-010", employeeId: "emp-010", employeeName: "James Mitchell",
    department: "Construction", designation: "Project Director",
    reviewPeriod: "H1 2026", reviewType: "mid_year", status: "completed",
    overallRating: 5, technicalRating: 5, communicationRating: 4, teamworkRating: 5, leadershipRating: 5,
    reviewedBy: "Mohammed Al Rashid", dueDate: "2026-04-30", completedDate: "2026-04-28",
    strengths: "Exceptional project delivery record. Manages risk proactively. Highly respected by all stakeholders.",
    improvements: "Consider mentoring junior PMs to scale the team's capability.",
    goals: [
      { id: "g21", title: "Project Delivery On-Time", target: "3 major projects on schedule", progress: 100, status: "achieved", dueDate: "2026-06-30" },
      { id: "g22", title: "Safety Record", target: "Zero LTI incidents", progress: 100, status: "achieved", dueDate: "2026-12-31" },
    ],
  },
];

export const performanceSummary = {
  totalReviews: mockPerformanceReviews.length,
  completed: mockPerformanceReviews.filter(r => r.status === "completed").length,
  pending: mockPerformanceReviews.filter(r => r.status === "pending").length,
  inProgress: mockPerformanceReviews.filter(r => r.status === "in_progress").length,
  overdue: mockPerformanceReviews.filter(r => r.status === "overdue").length,
  avgRating: parseFloat(
    (mockPerformanceReviews
      .filter(r => r.overallRating)
      .reduce((s, r) => s + (r.overallRating ?? 0), 0) /
      mockPerformanceReviews.filter(r => r.overallRating).length
    ).toFixed(1)
  ),
};
