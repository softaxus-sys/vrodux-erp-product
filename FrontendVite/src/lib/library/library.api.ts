import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/library`;

/**
 * Today as the desk sees it (yyyy-MM-dd, local). Sent with every circulation call: the server
 * clock is UTC, so without it a loan issued late in the evening could be dated tomorrow.
 */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface Paged<T> { items: T[]; total: number; }

export type CopyStatus = "available" | "on_loan" | "reserved" | "in_transit" | "lost" | "damaged" | "withdrawn";

const FALLBACK_META = { color: "text-muted-foreground", bg: "bg-muted" };

/** Styling only — labels come from i18n: t(`copyStatus.${status}`) in the `library` namespace. */
const COPY_STATUS_META: Record<CopyStatus, { color: string; bg: string }> = {
  available:  { color: "text-success",          bg: "bg-success/10" },
  on_loan:    { color: "text-blue-600",         bg: "bg-blue-50 dark:bg-blue-900/20" },
  reserved:   { color: "text-violet-600",       bg: "bg-violet-50 dark:bg-violet-900/20" },
  in_transit: { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  lost:       { color: "text-destructive",      bg: "bg-destructive/10" },
  damaged:    { color: "text-orange-600",       bg: "bg-orange-50 dark:bg-orange-900/20" },
  withdrawn:  { color: "text-muted-foreground", bg: "bg-muted" },
};
export const copyStatusMeta = (s: string) => COPY_STATUS_META[s as CopyStatus] ?? FALLBACK_META;

/** Statuses a librarian may set by hand; the rest are set by issuing, returning and transfers. */
export const MANUAL_COPY_STATUSES: CopyStatus[] = ["available", "damaged", "lost", "withdrawn"];

export const MATERIAL_TYPES = ["book", "reference", "journal", "magazine", "dvd", "audio", "other"] as const;
export const FINE_TYPES = ["overdue", "lost", "damage", "membership", "other"] as const;
export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "other"] as const;

const STATUS_META: Record<string, { color: string; bg: string }> = {
  active:    { color: "text-success",          bg: "bg-success/10" },
  suspended: { color: "text-destructive",      bg: "bg-destructive/10" },
  expired:   { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  overdue:   { color: "text-destructive",      bg: "bg-destructive/10" },
  returned:  { color: "text-muted-foreground", bg: "bg-muted" },
  lost:      { color: "text-destructive",      bg: "bg-destructive/10" },
  waiting:   { color: "text-amber-600",        bg: "bg-amber-50 dark:bg-amber-900/20" },
  ready:     { color: "text-success",          bg: "bg-success/10" },
  fulfilled: { color: "text-muted-foreground", bg: "bg-muted" },
  cancelled: { color: "text-muted-foreground", bg: "bg-muted" },
  unpaid:    { color: "text-destructive",      bg: "bg-destructive/10" },
  paid:      { color: "text-success",          bg: "bg-success/10" },
  waived:    { color: "text-muted-foreground", bg: "bg-muted" },
};
/** Member, loan, reservation and fine statuses share one palette. */
export const statusMeta = (s: string) => STATUS_META[s] ?? FALLBACK_META;

export interface BranchDto {
  id: string; name: string; code: string | null; address: string | null; phone: string | null;
  email: string | null; isActive: boolean; copies: number; available: number; onLoan: number;
  /** Staff limited to this branch. Empty unless the caller can see library setup. */
  staff: BranchStaffDto[];
}
export interface BranchStaffDto { userId: string; userName: string; }
/** Whether the signed-in user is limited to some branches, and which. */
export interface MyBranchesDto { restricted: boolean; branchIds: string[]; }
export interface BranchRequest {
  name: string; code?: string | null; address?: string | null; phone?: string | null; email?: string | null;
  isActive?: boolean;
}

export interface MembershipTypeDto {
  id: string; name: string; maxLoans: number; loanDays: number; maxRenewals: number; finePerDay: number;
  maxReservations: number; annualFee: number; isActive: boolean; members: number;
  /** Days a member holding a title waits before reserving it again. 0 = no wait. */
  sameTitleReserveAfterDays: number;
}
export type MembershipTypeRequest = Omit<MembershipTypeDto, "id" | "members">;

export interface CopyDto {
  id: string; titleId: string; title: string; authors: string; barcode: string;
  branchId: string; branchName: string; status: string; shelfLocation: string | null; condition: string;
  acquiredOn: string | null; price: number; notes: string | null;
  transitToBranchId: string | null; transitToBranchName: string | null;
  loanId: string | null; memberId: string | null; memberName: string | null; dueDate: string | null;
}

export interface TitleSummaryDto {
  id: string; title: string; subtitle: string | null; authors: string; isbn: string | null;
  category: string | null; materialType: string; publisher: string | null; publicationYear: number | null;
  language: string | null; totalCopies: number; availableCopies: number; waitingReservations: number;
}

export interface TitleDetailDto {
  id: string; title: string; subtitle: string | null; authors: string; isbn: string | null;
  publisher: string | null; publicationYear: number | null; edition: string | null; language: string | null;
  category: string | null; materialType: string; description: string | null; replacementCost: number;
  waitingReservations: number; copies: CopyDto[];
}

export interface TitleRequest {
  title: string; subtitle?: string | null; authors?: string | null; isbn?: string | null;
  publisher?: string | null; publicationYear?: number | null; edition?: string | null; language?: string | null;
  category?: string | null; materialType?: string | null; description?: string | null; replacementCost: number;
  /** Create only: copies to add with the title, and where they go. */
  copies?: number; branchId?: string | null; shelfLocation?: string | null;
}

export interface AddCopiesRequest {
  branchId: string; count: number; barcodes?: string[] | null; shelfLocation?: string | null;
  price: number; acquiredOn?: string | null;
}

export interface CopyRequest {
  barcode: string; shelfLocation?: string | null; condition?: string | null; status?: string | null;
  price: number; acquiredOn?: string | null; notes?: string | null;
}

export interface MemberDto {
  id: string; memberNumber: string; fullName: string; email: string | null; phone: string | null;
  address: string | null; idNumber: string | null; membershipTypeId: string; membershipTypeName: string;
  homeBranchId: string | null; homeBranchName: string | null; joinedOn: string; expiresOn: string | null;
  status: string; notes: string | null; activeLoans: number; overdueLoans: number; maxLoans: number;
  unpaidFines: number; isExpired: boolean;
  /** The member has a PIN for the online portal. */
  hasPortalAccess: boolean;
}

export interface MemberRequest {
  memberNumber?: string | null; fullName: string; email?: string | null; phone?: string | null;
  address?: string | null; idNumber?: string | null; membershipTypeId: string; homeBranchId?: string | null;
  joinedOn?: string | null; expiresOn?: string | null; status?: string | null; notes?: string | null;
}

export interface LoanDto {
  id: string; copyId: string; barcode: string; titleId: string; title: string; authors: string;
  memberId: string; memberNumber: string; memberName: string; memberPhone: string | null;
  branchId: string; branchName: string; issuedOn: string; dueDate: string; returnedOn: string | null;
  returnBranchName: string | null; renewalCount: number; status: string; isOverdue: boolean;
  daysOverdue: number; issuedByName: string | null;
}

export interface ReturnResultDto {
  loan: LoanDto; daysOverdue: number; fineAmount: number;
  heldForMemberName: string | null; heldAtBranchName: string | null;
}

export interface ReservationDto {
  id: string; titleId: string; title: string; memberId: string; memberNumber: string; memberName: string;
  memberPhone: string | null; pickupBranchId: string; pickupBranchName: string; status: string;
  copyId: string | null; barcode: string | null; reservedOn: string; readyOn: string | null;
  holdUntil: string | null; holdExpired: boolean;
}

export interface FineDto {
  id: string; memberId: string; memberNumber: string; memberName: string; loanId: string | null;
  title: string | null; type: string; amount: number; amountPaid: number; balance: number; status: string;
  reason: string | null; createdOn: string; settledOn: string | null; paymentMethod: string | null;
}

export interface FinesSummaryDto {
  outstanding: number; unpaidCount: number; collectedThisMonth: number; waivedThisMonth: number;
}

export interface LibraryDashboardDto {
  titles: number; copies: number; available: number; onLoan: number; overdue: number; dueToday: number;
  inTransit: number; activeMembers: number; waitingReservations: number; readyReservations: number;
  unpaidFines: number; issuedLast30Days: number; returnedLast30Days: number;
  branches: { branchId: string; name: string; copies: number; available: number; onLoan: number; overdue: number }[];
  topTitles: { titleId: string; title: string; authors: string; loans: number }[];
}

export interface ImportResultDto {
  created: number; existing: number; copiesAdded: number; failed: number; branchesCreated: number;
  errors: { row: number; message: string }[];
}

export interface ReminderSettingsDto {
  enabled: boolean; dueSoonDays: number; overdueEveryDays: number; overdueMaxReminders: number;
  notifyReady: boolean; libraryName: string | null; timeZoneId: string; lastDailyRunOn: string | null;
  /** False when this server has no mail account, so nothing can actually be sent. */
  emailConfigured: boolean;
}
export type ReminderSettingsRequest = Omit<ReminderSettingsDto, "lastDailyRunOn" | "emailConfigured">;

export interface ReminderRunDto {
  dryRun: boolean; dueSoon: number; overdue: number; ready: number; failed: number; noEmail: number;
  emails: { kind: string; memberName: string; toEmail: string; titles: string[] }[];
}

export interface ReminderLogDto {
  id: string; kind: string; memberName: string; toEmail: string; title: string; status: string;
  error: string | null; createdAt: string;
}

export interface LoanFilter {
  status?: string; branchId?: string; memberId?: string; titleId?: string; search?: string;
  page?: number; pageSize?: number;
}

// ── Client ──────────────────────────────────────────────────────────────────

export const libraryApi = {
  getDashboard: (): Promise<LibraryDashboardDto> => rawApiClient.get(`${BASE}/dashboard${qs({ today: localToday() })}`),

  // Setup
  getBranches:   (activeOnly = false): Promise<BranchDto[]> => rawApiClient.get(`${BASE}/branches${qs({ activeOnly })}`),
  getMyBranches: (): Promise<MyBranchesDto> => rawApiClient.get(`${BASE}/branches/mine`),
  setBranchStaff: (id: string, staff: BranchStaffDto[]): Promise<BranchDto> => rawApiClient.put(`${BASE}/branches/${id}/staff`, { staff }),
  createBranch:  (body: BranchRequest): Promise<BranchDto> => rawApiClient.post(`${BASE}/branches`, body),
  updateBranch:  (id: string, body: BranchRequest): Promise<BranchDto> => rawApiClient.put(`${BASE}/branches/${id}`, body),
  deleteBranch:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/branches/${id}`),

  getMembershipTypes:   (activeOnly = false): Promise<MembershipTypeDto[]> => rawApiClient.get(`${BASE}/membership-types${qs({ activeOnly })}`),
  createMembershipType: (body: MembershipTypeRequest): Promise<MembershipTypeDto> => rawApiClient.post(`${BASE}/membership-types`, body),
  updateMembershipType: (id: string, body: MembershipTypeRequest): Promise<MembershipTypeDto> => rawApiClient.put(`${BASE}/membership-types/${id}`, body),
  deleteMembershipType: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/membership-types/${id}`),

  // Catalogue
  getTitles: (p: { search?: string; category?: string; branchId?: string; availableOnly?: boolean; page?: number; pageSize?: number }): Promise<Paged<TitleSummaryDto>> =>
    rawApiClient.get(`${BASE}/titles${qs(p)}`),
  getCategories: (): Promise<string[]> => rawApiClient.get(`${BASE}/titles/categories`),
  getTitle:      (id: string): Promise<TitleDetailDto> => rawApiClient.get(`${BASE}/titles/${id}`),
  createTitle:   (body: TitleRequest): Promise<TitleDetailDto> => rawApiClient.post(`${BASE}/titles`, body),
  updateTitle:   (id: string, body: TitleRequest): Promise<TitleDetailDto> => rawApiClient.put(`${BASE}/titles/${id}`, body),
  deleteTitle:   (id: string): Promise<void> => rawApiClient.delete(`${BASE}/titles/${id}`),

  /** At most 1,000 rows a call — the import screen sends a large file in parts. */
  importTitles: (body: { rows: Record<string, unknown>[]; defaultBranchId: string | null; createBranches: boolean }): Promise<ImportResultDto> =>
    rawApiClient.post(`${BASE}/titles/import`, body),
  importMembers: (body: { rows: Record<string, unknown>[]; defaultMembershipTypeId: string | null }): Promise<ImportResultDto> =>
    rawApiClient.post(`${BASE}/members/import`, { ...body, today: localToday() }),

  addCopies:        (titleId: string, body: AddCopiesRequest): Promise<TitleDetailDto> => rawApiClient.post(`${BASE}/titles/${titleId}/copies`, body),
  getCopies: (p: { search?: string; branchId?: string; titleId?: string; status?: string; addedFrom?: string; page?: number; pageSize?: number }): Promise<Paged<CopyDto>> =>
    rawApiClient.get(`${BASE}/copies${qs(p)}`),
  getCopyByBarcode: (barcode: string): Promise<CopyDto> => rawApiClient.get(`${BASE}/copies/by-barcode/${encodeURIComponent(barcode)}`),
  getInTransit:     (): Promise<CopyDto[]> => rawApiClient.get(`${BASE}/copies/in-transit`),
  updateCopy:       (id: string, body: CopyRequest): Promise<CopyDto> => rawApiClient.put(`${BASE}/copies/${id}`, body),
  deleteCopy:       (id: string): Promise<void> => rawApiClient.delete(`${BASE}/copies/${id}`),
  transferCopy:     (id: string, toBranchId: string): Promise<CopyDto> => rawApiClient.post(`${BASE}/copies/${id}/transfer`, { toBranchId }),
  receiveCopy:      (id: string): Promise<CopyDto> => rawApiClient.post(`${BASE}/copies/${id}/receive`, { today: localToday() }),

  // Members
  getMembers: (p: { search?: string; status?: string; page?: number; pageSize?: number }): Promise<Paged<MemberDto>> =>
    rawApiClient.get(`${BASE}/members${qs({ ...p, today: localToday() })}`),
  getMember:    (id: string): Promise<MemberDto> => rawApiClient.get(`${BASE}/members/${id}${qs({ today: localToday() })}`),
  createMember: (body: MemberRequest): Promise<MemberDto> => rawApiClient.post(`${BASE}/members`, { ...body, today: localToday() }),
  updateMember: (id: string, body: MemberRequest): Promise<MemberDto> => rawApiClient.put(`${BASE}/members/${id}`, { ...body, today: localToday() }),
  deleteMember: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/members/${id}`),

  // Circulation
  getLoans: (f: LoanFilter): Promise<Paged<LoanDto>> => rawApiClient.get(`${BASE}/loans${qs({ ...f, today: localToday() })}`),
  issue: (body: { memberId: string; copyId: string; dueDate?: string | null }): Promise<LoanDto> =>
    rawApiClient.post(`${BASE}/loans`, { ...body, today: localToday() }),
  returnLoan: (id: string, body: { returnBranchId?: string | null; damaged?: boolean; notes?: string | null }): Promise<ReturnResultDto> =>
    rawApiClient.post(`${BASE}/loans/${id}/return`, { ...body, today: localToday() }),
  renew:    (id: string): Promise<LoanDto> => rawApiClient.post(`${BASE}/loans/${id}/renew`, { today: localToday() }),
  markLost: (id: string): Promise<LoanDto> => rawApiClient.post(`${BASE}/loans/${id}/lost`, { today: localToday() }),

  getReservations: (p: { status?: string; branchId?: string; memberId?: string; titleId?: string }): Promise<ReservationDto[]> =>
    rawApiClient.get(`${BASE}/reservations${qs({ ...p, today: localToday() })}`),
  reserve: (body: { titleId: string; memberId: string; pickupBranchId: string }): Promise<ReservationDto> =>
    rawApiClient.post(`${BASE}/reservations`, { ...body, today: localToday() }),
  cancelReservation: (id: string): Promise<void> => rawApiClient.post(`${BASE}/reservations/${id}/cancel`, { today: localToday() }),

  // Reminders
  getReminderSettings:    (): Promise<ReminderSettingsDto> => rawApiClient.get(`${BASE}/reminders/settings`),
  updateReminderSettings: (body: ReminderSettingsRequest): Promise<ReminderSettingsDto> => rawApiClient.put(`${BASE}/reminders/settings`, body),
  runReminders:           (dryRun: boolean): Promise<ReminderRunDto> => rawApiClient.post(`${BASE}/reminders/run`, { dryRun, today: localToday() }),
  getReminderLog:         (): Promise<ReminderLogDto[]> => rawApiClient.get(`${BASE}/reminders/log`),

  // Fines
  getFines: (p: { status?: string; memberId?: string; search?: string }): Promise<FineDto[]> => rawApiClient.get(`${BASE}/fines${qs(p)}`),
  getFinesSummary: (): Promise<FinesSummaryDto> => rawApiClient.get(`${BASE}/fines/summary${qs({ today: localToday() })}`),
  createFine: (body: { memberId: string; type: string; amount: number; reason?: string | null }): Promise<FineDto> =>
    rawApiClient.post(`${BASE}/fines`, { ...body, today: localToday() }),
  payFine: (id: string, body: { amount: number; method?: string | null }): Promise<FineDto> =>
    rawApiClient.post(`${BASE}/fines/${id}/pay`, { ...body, today: localToday() }),
  waiveFine: (id: string, reason?: string | null): Promise<FineDto> =>
    rawApiClient.post(`${BASE}/fines/${id}/waive`, { reason, today: localToday() }),
};
