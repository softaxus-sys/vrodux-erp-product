/** Healthcare pack: Patients -> Appointments -> Treatment Plans.
 *  Read-only browse -- see README's Healthcare section for what's deferred. */

export interface PatientDto {
  id: string;
  patientNumber: string;
  leadId: string | null;
  customerId: string | null;
  fullName: string;
  gender: string;
  dateOfBirth: string | null;
  phone: string;
  email: string | null;
  bloodGroup: string | null;
  assignedDoctor: string | null;
  status: string;
  registeredDate: string;
  notes: string | null;
  createdAt: string;
}

export interface AppointmentDto {
  id: string;
  appointmentNumber: string;
  patientId: string;
  patientName: string;
  doctor: string;
  department: string | null;
  scheduledAt: string;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TreatmentPlanDto {
  id: string;
  patientId: string;
  patientName: string;
  diagnosis: string;
  plan: string;
  doctor: string;
  startDate: string;
  followUpDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface HealthcareSummaryDto {
  patients: number;
  scheduledAppointments: number;
  todayAppointments: number;
  completedAppointments: number;
  activeTreatments: number;
}
