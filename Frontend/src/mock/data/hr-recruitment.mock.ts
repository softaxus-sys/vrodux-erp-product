export type JobStatus = "open" | "closed" | "on_hold" | "draft";
export type ApplicantStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type ExperienceLevel = "junior" | "mid" | "senior" | "lead" | "executive";

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  branch: string;
  type: "full_time" | "part_time" | "contract";
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  status: JobStatus;
  postedDate: string;
  closingDate: string;
  applicants: number;
  description: string;
  requirements: string[];
  hiringManager: string;
}

export interface Applicant {
  id: string;
  jobId: string;
  jobTitle: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  currentRole: string;
  currentCompany: string;
  experience: number;
  stage: ApplicantStage;
  appliedDate: string;
  rating?: number;
  notes?: string;
  source: string;
}

export const mockJobPostings: JobPosting[] = [
  {
    id: "job-001", title: "Senior Full Stack Developer", department: "Technology", branch: "Dubai HQ",
    type: "full_time", experienceLevel: "senior", salaryMin: 20000, salaryMax: 28000, currency: "AED",
    status: "open", postedDate: "2026-05-01", closingDate: "2026-05-31", applicants: 24,
    description: "We are looking for an experienced Full Stack Developer to join our growing technology team.",
    requirements: ["5+ years experience", "React / Next.js", "Node.js", "PostgreSQL", "Cloud (AWS/Azure)"],
    hiringManager: "Ahmed Al Mansouri",
  },
  {
    id: "job-002", title: "Financial Analyst", department: "Finance", branch: "Dubai HQ",
    type: "full_time", experienceLevel: "mid", salaryMin: 15000, salaryMax: 20000, currency: "AED",
    status: "open", postedDate: "2026-04-28", closingDate: "2026-05-28", applicants: 18,
    description: "Join our finance team to drive financial planning, analysis, and reporting.",
    requirements: ["3+ years experience", "ACCA/CPA preferred", "IFRS knowledge", "Excel advanced", "ERP experience"],
    hiringManager: "Tariq Al Ameri",
  },
  {
    id: "job-003", title: "Sales Executive – Real Estate", department: "Real Estate", branch: "Abu Dhabi",
    type: "full_time", experienceLevel: "mid", salaryMin: 12000, salaryMax: 18000, currency: "AED",
    status: "open", postedDate: "2026-05-05", closingDate: "2026-06-05", applicants: 31,
    description: "Drive real estate sales across residential and commercial properties in Abu Dhabi.",
    requirements: ["2+ years real estate sales", "RERA certified preferred", "Arabic/English fluent", "UAE driving license"],
    hiringManager: "Fatima Al Zaabi",
  },
  {
    id: "job-004", title: "HR Manager", department: "Human Resources", branch: "Dubai HQ",
    type: "full_time", experienceLevel: "senior", salaryMin: 20000, salaryMax: 26000, currency: "AED",
    status: "open", postedDate: "2026-05-10", closingDate: "2026-06-10", applicants: 12,
    description: "Lead HR operations for our rapidly growing organization across UAE branches.",
    requirements: ["7+ years HR experience", "UAE Labor Law expert", "HRIS experience", "Arabic preferred"],
    hiringManager: "Nour Al Shamsi",
  },
  {
    id: "job-005", title: "Construction Project Manager", department: "Construction", branch: "Dubai HQ",
    type: "full_time", experienceLevel: "lead", salaryMin: 30000, salaryMax: 40000, currency: "AED",
    status: "on_hold", postedDate: "2026-04-15", closingDate: "2026-05-15", applicants: 8,
    description: "Manage large-scale construction projects from inception to delivery.",
    requirements: ["10+ years construction", "PMP certified", "FIDIC contracts", "AutoCAD / BIM"],
    hiringManager: "James Mitchell",
  },
  {
    id: "job-006", title: "Marketing Specialist", department: "Sales & Marketing", branch: "Dubai HQ",
    type: "full_time", experienceLevel: "junior", salaryMin: 9000, salaryMax: 12000, currency: "AED",
    status: "closed", postedDate: "2026-03-01", closingDate: "2026-04-01", applicants: 45,
    description: "Support the marketing team in executing digital campaigns and brand initiatives.",
    requirements: ["1-2 years marketing", "Social media", "Content creation", "Adobe Creative Suite"],
    hiringManager: "Fatima Al Zaabi",
  },
  {
    id: "job-007", title: "Operations Coordinator", department: "Operations", branch: "Abu Dhabi",
    type: "full_time", experienceLevel: "junior", salaryMin: 8000, salaryMax: 11000, currency: "AED",
    status: "open", postedDate: "2026-05-12", closingDate: "2026-06-12", applicants: 9,
    description: "Coordinate daily operations activities and support process improvement initiatives.",
    requirements: ["1+ years operations", "Strong organizational skills", "MS Office", "Arabic/English"],
    hiringManager: "Mohammed Al Rashid",
  },
];

export const mockApplicants: Applicant[] = [
  { id: "ap-001", jobId: "job-001", jobTitle: "Senior Full Stack Developer", name: "Aditya Sharma", email: "aditya.s@gmail.com", phone: "+971 50 111 2222", nationality: "Indian", currentRole: "Full Stack Developer", currentCompany: "Careem", experience: 6, stage: "offer", appliedDate: "2026-05-03", rating: 4, notes: "Strong React/Node.js. Final offer being prepared.", source: "LinkedIn" },
  { id: "ap-002", jobId: "job-001", jobTitle: "Senior Full Stack Developer", name: "Rami Al Khatib", email: "rami.k@outlook.com", phone: "+971 55 333 4444", nationality: "Jordanian", currentRole: "Software Engineer", currentCompany: "Noon", experience: 5, stage: "interview", appliedDate: "2026-05-04", rating: 3, notes: "2nd round technical interview scheduled.", source: "Bayt" },
  { id: "ap-003", jobId: "job-001", jobTitle: "Senior Full Stack Developer", name: "Priyanka Nair", email: "priyanka.n@hotmail.com", phone: "+971 52 555 6666", nationality: "Indian", currentRole: "React Developer", currentCompany: "Dubizzle", experience: 4, stage: "screening", appliedDate: "2026-05-06", rating: 3, source: "GulfTalent" },
  { id: "ap-004", jobId: "job-001", jobTitle: "Senior Full Stack Developer", name: "Carlos Mendes", email: "carlos.m@gmail.com", phone: "+971 56 777 8888", nationality: "Portuguese", currentRole: "Senior Developer", currentCompany: "Accenture", experience: 7, stage: "rejected", appliedDate: "2026-05-02", notes: "Salary expectations too high.", source: "Indeed" },
  { id: "ap-005", jobId: "job-002", jobTitle: "Financial Analyst", name: "Sneha Patel", email: "sneha.p@gmail.com", phone: "+971 54 123 4567", nationality: "Indian", currentRole: "Financial Analyst", currentCompany: "KPMG", experience: 3, stage: "offer", appliedDate: "2026-04-30", rating: 5, notes: "Excellent IFRS knowledge. ACCA finalist.", source: "LinkedIn" },
  { id: "ap-006", jobId: "job-002", jobTitle: "Financial Analyst", name: "Omar Younes", email: "omar.y@gmail.com", phone: "+971 50 987 6543", nationality: "Lebanese", currentRole: "Junior Analyst", currentCompany: "PwC", experience: 2, stage: "interview", appliedDate: "2026-05-01", rating: 3, source: "Bayt" },
  { id: "ap-007", jobId: "job-003", jobTitle: "Sales Executive – Real Estate", name: "Khalid Mahmoud", email: "khalid.m@email.com", phone: "+971 55 246 8101", nationality: "Egyptian", currentRole: "Property Consultant", currentCompany: "Bayut", experience: 4, stage: "hired", appliedDate: "2026-05-06", rating: 5, notes: "Joined 2026-05-18. Excellent fit.", source: "Referral" },
  { id: "ap-008", jobId: "job-003", jobTitle: "Sales Executive – Real Estate", name: "Dana Al Bassam", email: "dana.b@email.com", phone: "+971 52 369 1215", nationality: "Bahraini", currentRole: "Sales Agent", currentCompany: "Emaar Sales", experience: 3, stage: "interview", appliedDate: "2026-05-08", rating: 4, source: "LinkedIn" },
  { id: "ap-009", jobId: "job-004", jobTitle: "HR Manager", name: "Reem Al Otaibi", email: "reem.o@email.com", phone: "+971 56 147 2589", nationality: "Saudi", currentRole: "HR Business Partner", currentCompany: "Emirates", experience: 8, stage: "interview", appliedDate: "2026-05-12", rating: 4, notes: "Strong UAE labor law knowledge.", source: "LinkedIn" },
  { id: "ap-010", jobId: "job-007", jobTitle: "Operations Coordinator", name: "Suraj Kumar", email: "suraj.k@gmail.com", phone: "+971 50 852 9630", nationality: "Indian", currentRole: "Operations Assistant", currentCompany: "Aramex", experience: 1, stage: "screening", appliedDate: "2026-05-14", rating: 3, source: "Indeed" },
  { id: "ap-011", jobId: "job-001", jobTitle: "Senior Full Stack Developer", name: "Lina Nassar", email: "lina.n@gmail.com", phone: "+971 55 741 8520", nationality: "Syrian", currentRole: "Backend Developer", currentCompany: "du Telecom", experience: 5, stage: "applied", appliedDate: "2026-05-17", source: "Company Website" },
  { id: "ap-012", jobId: "job-002", jobTitle: "Financial Analyst", name: "Vishal Gupta", email: "vishal.g@gmail.com", phone: "+971 54 963 7410", nationality: "Indian", currentRole: "Senior Accountant", currentCompany: "Deloitte", experience: 4, stage: "rejected", appliedDate: "2026-04-29", notes: "Good profile but not ACCA. Preferred internal candidate.", source: "GulfTalent" },
];

export const recruitmentSummary = {
  openPositions: mockJobPostings.filter(j => j.status === "open").length,
  totalApplicants: mockJobPostings.reduce((s, j) => s + j.applicants, 0),
  inInterview: mockApplicants.filter(a => a.stage === "interview").length,
  offers: mockApplicants.filter(a => a.stage === "offer").length,
  hiredThisMonth: mockApplicants.filter(a => a.stage === "hired").length,
  avgTimeToHire: 18,
};
