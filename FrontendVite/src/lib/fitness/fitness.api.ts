import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/fitness`;

/** Today as the desk sees it (yyyy-MM-dd, local). The server clock is UTC, so every dated call sends this. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const localTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface BranchDto { id: string; name: string; code?: string; address?: string; phone?: string; email?: string; openingTime?: string; closingTime?: string; capacity?: number; isActive: boolean; members: number; inGymNow: number; }
export interface PlanDto { id: string; name: string; code?: string; description?: string; category: string; durationDays: number; price: number; joiningFee: number; classCredits?: number; ptSessions: number; visitsPerDay?: number; totalVisits?: number; allowFreeze: boolean; maxFreezeDays: number; guestPasses: number; allBranches: boolean; accessFrom?: string; accessUntil?: string; isActive: boolean; activeMembers: number; }
export interface SettingsDto { memberNumberPrefix: string; graceDays: number; allowCheckInWithDues: boolean; requireWaiver: boolean; expiringWithinDays: number; lateCancelHours: number; chargeCreditForNoShow: boolean; bookingWindowDays: number; expiryAlertsEnabled: boolean; }

export interface MemberSummaryDto { id: string; memberNumber: string; fullName: string; phone?: string; email?: string; gender?: string; homeBranchId: string; homeBranchName?: string; status: string; planName?: string; endDate?: string; membershipState: string; daysLeft?: number; balance: number; joinedOn: string; hasPhoto: boolean; }
export interface MemberPageDto { items: MemberSummaryDto[]; total: number; page: number; pageSize: number; }
export interface SubscriptionDto { id: string; memberId: string; planId: string; planName: string; category: string; branchId?: string; startDate: string; endDate: string; durationDays: number; price: number; discount: number; joiningFee: number; total: number; amountPaid: number; balance: number; classCredits?: number; classCreditsLeft?: number; ptSessionsLeft: number; visitsPerDay?: number; totalVisits?: number; visitsUsed: number; allowFreeze: boolean; maxFreezeDays: number; freezeDaysUsed: number; guestPassesLeft: number; allBranches: boolean; accessFrom?: string; accessUntil?: string; status: string; state: string; frozenFrom?: string; cancelledOn?: string; cancelReason?: string; renewedFromId?: string; soldByName?: string; notes?: string; createdAt: string; }
export interface FreezeDto { id: string; subscriptionId: string; fromDate: string; toDate?: string; days: number; reason?: string; }
export interface MemberDetailDto { id: string; memberNumber: string; firstName: string; lastName: string; fullName: string; gender?: string; dateOfBirth?: string; phone?: string; email?: string; address?: string; nationalId?: string; emergencyName?: string; emergencyPhone?: string; healthNotes?: string; fitnessGoal?: string; source?: string; referredBy?: string; notes?: string; photoData?: string; homeBranchId: string; homeBranchName?: string; trainerId?: string; trainerName?: string; joinedOn: string; waiverSignedOn?: string; status: string; statusReason?: string; balance: number; visits30Days: number; lastVisit?: string; subscriptions: SubscriptionDto[]; freezes: FreezeDto[]; lockerNumber?: string; hasPortalAccess?: boolean; }
export interface ProgramDto { id: string; type: string; name: string; goal?: string; level?: string; weeks?: number; description?: string; itemsJson: string; memberId?: string; memberName?: string; trainerId?: string; trainerName?: string; templateId?: string; startDate?: string; isActive: boolean; createdAt: string; }
export interface MemberInput { firstName: string; lastName?: string; gender?: string; dateOfBirth?: string; phone?: string; email?: string; address?: string; nationalId?: string; emergencyName?: string; emergencyPhone?: string; healthNotes?: string; fitnessGoal?: string; source?: string; referredBy?: string; notes?: string; homeBranchId?: string; trainerId?: string; waiverSignedOn?: string; joinedOn?: string; photoData?: string; }
export interface PaymentDto { id: string; receiptNumber: string; memberId: string; memberName?: string; memberNumber?: string; subscriptionId?: string; ptPackageId?: string; branchId?: string; amount: number; method: string; paidOn: string; reference?: string; notes?: string; receivedByName?: string; isVoided: boolean; voidReason?: string; voidedByName?: string; createdAt: string; }
export interface MeasurementDto { id: string; memberId: string; measuredOn: string; weightKg?: number; heightCm?: number; bodyFatPct?: number; muscleMassKg?: number; chestCm?: number; waistCm?: number; hipsCm?: number; armCm?: number; thighCm?: number; restingHeartRate?: number; bloodPressure?: string; notes?: string; bmi?: number; trainerId?: string; }

export interface CheckInResultDto { id: string; allowed: boolean; denyReason?: string; memberId: string; memberName: string; memberNumber: string; hasPhoto: boolean; planName?: string; endDate?: string; daysLeft?: number; balance: number; classCreditsLeft?: number; visitsLeft?: number; healthNotes?: string; warnings: string[]; at: string; }
export interface VisitDto { id: string; memberId: string; memberName: string; memberNumber: string; branchId: string; branchName?: string; date: string; checkedInAt: string; checkedOutAt?: string; allowed: boolean; denyReason?: string; method: string; isGuest: boolean; guestName?: string; recordedByName?: string; }
export interface OccupancyDto { branchId: string; branchName: string; inGym: number; capacity?: number; visitsToday: number; }

export interface ClassTypeDto { id: string; name: string; description?: string; level?: string; durationMinutes: number; capacity: number; color?: string; creditCost: number; dropInPrice: number; isActive: boolean; }
export interface SessionDto { id: string; classTypeId: string; className: string; color?: string; branchId: string; branchName?: string; trainerId?: string; trainerName?: string; date: string; startTime: string; endTime: string; capacity: number; creditCost: number; room?: string; notes?: string; status: string; cancelReason?: string; seriesId?: string; booked: number; waitlisted: number; attended: number; }
export interface BookingDto { id: string; sessionId: string; memberId: string; memberName: string; memberNumber: string; phone?: string; status: string; waitlistPosition?: number; creditUsed: boolean; bookedAt: string; cancelledAt?: string; className?: string; date?: string; startTime?: string; }

export interface TrainerDto { id: string; name: string; phone?: string; email?: string; specialties?: string; certifications?: string; bio?: string; branchId?: string; branchName?: string; linkedUserId?: string; sessionRate: number; commissionPct: number; hasPhoto: boolean; isActive: boolean; clients: number; upcomingSessions: number; }
export interface PtPackageDto { id: string; memberId: string; memberName?: string; memberNumber?: string; trainerId: string; trainerName?: string; name: string; totalSessions: number; usedSessions: number; remaining: number; price: number; amountPaid: number; balance: number; startDate: string; expiresOn?: string; notes?: string; isCancelled: boolean; state: string; createdAt: string; }
export interface PtSessionDto { id: string; packageId: string; packageName?: string; memberId: string; memberName?: string; trainerId: string; trainerName?: string; branchId?: string; date: string; startTime: string; durationMinutes: number; status: string; notes?: string; sessionLog?: string; counted: boolean; }

export interface EquipmentDto { id: string; name: string; category?: string; brand?: string; model?: string; serialNumber?: string; branchId: string; branchName?: string; location?: string; purchasedOn?: string; purchaseCost: number; warrantyUntil?: string; serviceIntervalDays: number; lastServicedOn?: string; nextServiceOn?: string; status: string; notes?: string; serviceDue: boolean; maintenanceCost: number; }
export interface MaintenanceDto { id: string; equipmentId: string; date: string; type: string; description: string; cost: number; performedBy?: string; statusAfter: string; recordedByName?: string; createdAt: string; }
export interface LockerDto { id: string; number: string; branchId: string; branchName?: string; area?: string; size?: string; monthlyRate: number; memberId?: string; memberName?: string; memberNumber?: string; assignedFrom?: string; assignedUntil?: string; outOfUse: boolean; notes?: string; state: string; }
export interface LeadDto { id: string; name: string; phone?: string; email?: string; gender?: string; source?: string; interest?: string; branchId?: string; branchName?: string; assignedToUserId?: string; assignedToName?: string; status: string; trialDate?: string; followUpOn?: string; lostReason?: string; notes?: string; memberId?: string; followUpDue: boolean; createdAt: string; }

export interface FitnessDashboardDto { activeMembers: number; totalMembers: number; newThisMonth: number; expiringSoon: number; expiredLast30: number; frozen: number; inGymNow: number; visitsToday: number; classesToday: number; bookingsToday: number; ptSessionsToday: number; revenueToday: number; revenueThisMonth: number; outstanding: number; openLeads: number; leadsFollowUpDue: number; equipmentNeedingService: number; retentionRate: number; last14Days: { date: string; visits: number; revenue: number }[]; membersByPlan: { name: string; count: number }[]; peakHours: { name: string; count: number }[]; expiring: { memberId: string; memberName: string; memberNumber: string; phone?: string; planName: string; endDate: string; daysLeft: number }[]; }

export const PLAN_CATEGORIES: { value: string; label: string }[] = [
  { value: "gym", label: "Gym access" }, { value: "classes", label: "Classes only" }, { value: "combo", label: "Gym + classes" },
  { value: "personal_training", label: "Personal training" }, { value: "day_pass", label: "Day pass" },
];
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" }, { value: "card", label: "Card" }, { value: "bank_transfer", label: "Bank transfer" },
  { value: "online", label: "Online" }, { value: "cheque", label: "Cheque" }, { value: "other", label: "Other" },
];
export const LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "trial_booked", label: "Trial booked" },
  { value: "visited", label: "Visited" }, { value: "converted", label: "Converted" }, { value: "lost", label: "Lost" },
];
export const EQUIPMENT_STATUSES: { value: string; label: string }[] = [
  { value: "working", label: "Working" }, { value: "needs_service", label: "Needs service" },
  { value: "out_of_order", label: "Out of order" }, { value: "retired", label: "Retired" },
];

/** Colours for the state words the API returns. Unknown values fall back to a neutral pill. */
const META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Active" },
  expiring: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", label: "Expiring" },
  expired: { color: "text-red-700 dark:text-red-300", bg: "bg-red-500/10", label: "Expired" },
  frozen: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", label: "Frozen" },
  upcoming: { color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-500/10", label: "Upcoming" },
  cancelled: { color: "text-muted-foreground", bg: "bg-muted", label: "Cancelled" },
  none: { color: "text-muted-foreground", bg: "bg-muted", label: "No plan" },
  inactive: { color: "text-muted-foreground", bg: "bg-muted", label: "Inactive" },
  blacklisted: { color: "text-red-700 dark:text-red-300", bg: "bg-red-500/10", label: "Blacklisted" },
  scheduled: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", label: "Scheduled" },
  completed: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Completed" },
  booked: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", label: "Booked" },
  waitlisted: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", label: "Waitlist" },
  attended: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Attended" },
  no_show: { color: "text-red-700 dark:text-red-300", bg: "bg-red-500/10", label: "No-show" },
  late_cancel: { color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-500/10", label: "Late cancel" },
  working: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Working" },
  needs_service: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", label: "Needs service" },
  out_of_order: { color: "text-red-700 dark:text-red-300", bg: "bg-red-500/10", label: "Out of order" },
  retired: { color: "text-muted-foreground", bg: "bg-muted", label: "Retired" },
  available: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Available" },
  assigned: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", label: "Assigned" },
  out_of_use: { color: "text-muted-foreground", bg: "bg-muted", label: "Out of use" },
  new: { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", label: "New" },
  contacted: { color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-500/10", label: "Contacted" },
  trial_booked: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", label: "Trial booked" },
  visited: { color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-500/10", label: "Visited" },
  converted: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", label: "Converted" },
  lost: { color: "text-red-700 dark:text-red-300", bg: "bg-red-500/10", label: "Lost" },
};
export const statusMeta = (s: string) =>
  META[s] ?? { color: "text-muted-foreground", bg: "bg-muted", label: s.replace(/_/g, " ") };

// ── Client ──────────────────────────────────────────────────────────────────

const get = <T,>(path: string) => rawApiClient.get<T>(`${BASE}${path}`);
const post = <T,>(path: string, body?: unknown) => rawApiClient.post<T>(`${BASE}${path}`, body ?? {});
const put = <T,>(path: string, body?: unknown) => rawApiClient.put<T>(`${BASE}${path}`, body ?? {});
const patch = <T,>(path: string, body?: unknown) => rawApiClient.patch<T>(`${BASE}${path}`, body ?? {});
const del = (path: string) => rawApiClient.delete<void>(`${BASE}${path}`);

export const fitnessApi = {
  // setup
  branches: (activeOnly = false) => get<BranchDto[]>(`/branches${qs({ activeOnly })}`),
  saveBranch: (id: string | null, b: Record<string, unknown>) => id ? put<BranchDto>(`/branches/${id}`, b) : post<BranchDto>("/branches", b),
  deleteBranch: (id: string) => del(`/branches/${id}`),
  plans: (activeOnly = false) => get<PlanDto[]>(`/plans${qs({ activeOnly })}`),
  savePlan: (id: string | null, p: Record<string, unknown>) => id ? put<PlanDto>(`/plans/${id}`, p) : post<PlanDto>("/plans", p),
  deletePlan: (id: string) => del(`/plans/${id}`),
  settings: () => get<SettingsDto>("/settings"),
  saveSettings: (s: SettingsDto) => put<SettingsDto>("/settings", s),
  // members
  members: (q: { search?: string; state?: string; branchId?: string; planId?: string; page?: number; pageSize?: number }) =>
    get<MemberPageDto>(`/members${qs({ ...q, today: localToday() })}`),
  member: (id: string) => get<MemberDetailDto>(`/members/${id}${qs({ today: localToday() })}`),
  createMember: (m: MemberInput, leadId?: string) => post<MemberDetailDto>("/members", { member: m, leadId, today: localToday() }),
  updateMember: (id: string, m: MemberInput) => put<MemberDetailDto>(`/members/${id}`, { member: m, today: localToday() }),
  setMemberStatus: (id: string, status: string, reason?: string) => patch<void>(`/members/${id}/status`, { status, reason }),
  deleteMember: (id: string) => del(`/members/${id}`),
  sell: (memberId: string, body: Record<string, unknown>) => post<SubscriptionDto>(`/members/${memberId}/memberships`, { ...body, today: localToday() }),
  freeze: (id: string, body: { fromDate?: string; reason?: string }) => post<SubscriptionDto>(`/memberships/${id}/freeze`, { ...body, today: localToday() }),
  unfreeze: (id: string) => post<SubscriptionDto>(`/memberships/${id}/unfreeze${qs({ today: localToday() })}`),
  cancelMembership: (id: string, reason?: string) => post<SubscriptionDto>(`/memberships/${id}/cancel`, { reason, today: localToday() }),
  adjustMembership: (id: string, discount: number, endDate?: string) => put<SubscriptionDto>(`/memberships/${id}/adjust`, { discount, endDate }),
  payments: (q: { memberId?: string; from?: string; to?: string; method?: string; branchId?: string; includeVoided?: boolean; page?: number; pageSize?: number }) =>
    get<{ items: PaymentDto[]; total: number; totalAmount: number }>(`/payments${qs(q)}`),
  recordPayment: (body: Record<string, unknown>) => post<PaymentDto>("/payments", { ...body, today: localToday() }),
  voidPayment: (id: string, reason: string) => post<PaymentDto>(`/payments/${id}/void`, { reason }),
  measurements: (memberId: string) => get<MeasurementDto[]>(`/members/${memberId}/measurements`),
  saveMeasurement: (memberId: string, id: string | null, body: Record<string, unknown>) =>
    id ? put<MeasurementDto>(`/measurements/${id}`, { ...body, memberId }) : post<MeasurementDto>(`/members/${memberId}/measurements`, { ...body, memberId }),
  deleteMeasurement: (id: string) => del(`/measurements/${id}`),
  // desk
  checkIn: (memberRef: string, branchId: string, override = false) =>
    post<CheckInResultDto>("/checkin", { memberRef, branchId, override, method: "desk", today: localToday(), localTime: localTime() }),
  guestCheckIn: (hostMemberId: string, branchId: string, guestName: string) => post<VisitDto>("/checkin/guest", { hostMemberId, branchId, guestName, today: localToday() }),
  checkOut: (visitId: string) => post<VisitDto>(`/visits/${visitId}/checkout`),
  checkOutAll: (branchId: string) => post<number>("/checkout-all", { branchId, today: localToday() }),
  visits: (q: { branchId?: string; memberId?: string; from?: string; to?: string; inGymOnly?: boolean; includeRefused?: boolean; page?: number; pageSize?: number }) =>
    get<{ items: VisitDto[]; total: number }>(`/visits${qs(q)}`),
  occupancy: () => get<OccupancyDto[]>(`/occupancy${qs({ today: localToday() })}`),
  // classes
  classTypes: (activeOnly = false) => get<ClassTypeDto[]>(`/class-types${qs({ activeOnly })}`),
  saveClassType: (id: string | null, b: Record<string, unknown>) => id ? put<ClassTypeDto>(`/class-types/${id}`, b) : post<ClassTypeDto>("/class-types", b),
  deleteClassType: (id: string) => del(`/class-types/${id}`),
  sessions: (q: { from: string; to: string; branchId?: string; trainerId?: string; classTypeId?: string }) => get<SessionDto[]>(`/sessions${qs(q)}`),
  schedule: (b: Record<string, unknown>) => post<SessionDto[]>("/sessions", b),
  updateSession: (id: string, b: Record<string, unknown>) => put<SessionDto>(`/sessions/${id}`, b),
  cancelSession: (id: string, reason?: string, cancelSeries = false) => post<number>(`/sessions/${id}/cancel`, { reason, cancelSeries }),
  completeSession: (id: string, markUnattendedAsNoShow: boolean) => post<SessionDto>(`/sessions/${id}/complete`, { markUnattendedAsNoShow }),
  bookings: (q: { sessionId?: string; memberId?: string; upcomingOnly?: boolean }) => get<BookingDto[]>(`/bookings${qs({ ...q, today: localToday() })}`),
  book: (sessionId: string, memberId: string, allowWaitlist = true) => post<BookingDto>("/bookings", { sessionId, memberId, allowWaitlist, today: localToday(), localTime: localTime() }),
  cancelBooking: (id: string) => post<BookingDto>(`/bookings/${id}/cancel${qs({ today: localToday(), localTime: localTime() })}`),
  markAttendance: (id: string, status: "attended" | "no_show") => put<BookingDto>(`/bookings/${id}/attendance`, { status }),
  // training
  trainers: (activeOnly = false) => get<TrainerDto[]>(`/trainers${qs({ activeOnly })}`),
  saveTrainer: (id: string | null, b: Record<string, unknown>) => id ? put<TrainerDto>(`/trainers/${id}`, b) : post<TrainerDto>("/trainers", b),
  deleteTrainer: (id: string) => del(`/trainers/${id}`),
  ptPackages: (q: { memberId?: string; trainerId?: string; activeOnly?: boolean }) => get<PtPackageDto[]>(`/pt-packages${qs({ ...q, today: localToday() })}`),
  sellPt: (b: Record<string, unknown>) => post<PtPackageDto>("/pt-packages", { ...b, today: localToday() }),
  cancelPt: (id: string) => post<PtPackageDto>(`/pt-packages/${id}/cancel`),
  ptSessions: (q: { from?: string; to?: string; trainerId?: string; memberId?: string; packageId?: string }) => get<PtSessionDto[]>(`/pt-sessions${qs(q)}`),
  bookPt: (b: Record<string, unknown>) => post<PtSessionDto>("/pt-sessions", b),
  reschedulePt: (id: string, b: Record<string, unknown>) => put<PtSessionDto>(`/pt-sessions/${id}`, b),
  closePt: (id: string, status: string, sessionLog?: string) => post<PtSessionDto>(`/pt-sessions/${id}/close`, { status, sessionLog }),
  // facility
  equipment: (q: { branchId?: string; status?: string; serviceDueOnly?: boolean }) => get<EquipmentDto[]>(`/equipment${qs({ ...q, today: localToday() })}`),
  saveEquipment: (id: string | null, b: Record<string, unknown>) => id ? put<EquipmentDto>(`/equipment/${id}`, b) : post<EquipmentDto>("/equipment", b),
  deleteEquipment: (id: string) => del(`/equipment/${id}`),
  maintenance: (id: string) => get<MaintenanceDto[]>(`/equipment/${id}/maintenance`),
  recordMaintenance: (id: string, b: Record<string, unknown>) => post<MaintenanceDto>(`/equipment/${id}/maintenance`, b),
  lockers: (q: { branchId?: string; state?: string }) => get<LockerDto[]>(`/lockers${qs({ ...q, today: localToday() })}`),
  saveLocker: (id: string | null, b: Record<string, unknown>) => id ? put<LockerDto>(`/lockers/${id}`, b) : post<LockerDto>("/lockers", b),
  addLockers: (b: Record<string, unknown>) => post<number>("/lockers/bulk", b),
  assignLocker: (id: string, memberId: string, until?: string) => post<LockerDto>(`/lockers/${id}/assign`, { memberId, until, today: localToday() }),
  releaseLocker: (id: string) => post<LockerDto>(`/lockers/${id}/release`),
  deleteLocker: (id: string) => del(`/lockers/${id}`),
  leads: (q: { status?: string; search?: string; branchId?: string; followUpDueOnly?: boolean }) => get<LeadDto[]>(`/leads${qs({ ...q, today: localToday() })}`),
  saveLead: (id: string | null, b: Record<string, unknown>) => id ? put<LeadDto>(`/leads/${id}`, b) : post<LeadDto>("/leads", b),
  deleteLead: (id: string) => del(`/leads/${id}`),
  programs: (q: { type?: string; memberId?: string; templatesOnly?: boolean }) => get<ProgramDto[]>(`/programs${qs(q)}`),
  saveProgram: (id: string | null, b: Record<string, unknown>) => id ? put<ProgramDto>(`/programs/${id}`, b) : post<ProgramDto>("/programs", b),
  assignProgram: (templateId: string, b: { memberId: string; trainerId?: string; startDate?: string }) => post<ProgramDto>(`/programs/${templateId}/assign`, b),
  deleteProgram: (id: string) => del(`/programs/${id}`),
  // dashboard + reports
  dashboard: (branchId?: string) => get<FitnessDashboardDto>(`/dashboard${qs({ branchId, today: localToday() })}`),
  runReport: (id: string, q: { from?: string; to?: string; branchId?: string }) =>
    get<{ rows: Record<string, unknown>[]; totalCount: number }>(`/reports/run/${id}${qs({ ...q, today: localToday() })}`),
};
