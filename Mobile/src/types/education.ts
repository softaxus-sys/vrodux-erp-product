/** Education pack: Admissions -> Students -> Enrollments (with fee tracking).
 *  Read-only browse -- see README's Education section for what's deferred. */

export interface AdmissionDto {
  id: string;
  admissionNumber: string;
  leadId: string | null;
  studentId: string | null;
  applicantName: string;
  program: string;
  intakeTerm: string;
  guardianName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  appliedDate: string;
  notes: string | null;
  createdAt: string;
}

export interface StudentDto {
  id: string;
  studentNumber: string;
  customerId: string | null;
  fullName: string;
  gender: string;
  program: string;
  guardianName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  enrolledDate: string;
  notes: string | null;
  createdAt: string;
}

export interface EnrollmentDto {
  id: string;
  enrollmentNumber: string;
  studentId: string;
  studentName: string;
  course: string;
  term: string;
  feeTotal: number;
  feePaid: number;
  feeBalance: number;
  status: string;
  enrollDate: string;
  notes: string | null;
  createdAt: string;
}

export interface EducationSummaryDto {
  openInquiries: number;
  totalAdmissions: number;
  enrolledStudents: number;
  activeEnrollments: number;
  feesBilled: number;
  feesCollected: number;
  feesOutstanding: number;
}
