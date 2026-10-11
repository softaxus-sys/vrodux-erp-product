import { rawApiClient } from "@/lib/api-client";

import { getApiBaseUrl } from "@/lib/desktop";
const BASE = `${getApiBaseUrl()}/api/hospitality`;

// ─── Rooms ────────────────────────────────────────────────────────────────────

export type RoomStatus = "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
export type RoomType   = "standard" | "deluxe" | "suite" | "penthouse" | "studio";
export type BedType    = "king" | "queen" | "twin" | "double";
export type ViewType   = "city" | "sea" | "pool" | "garden" | "courtyard";

/** Mirrors CreateBookingCommand. The server prices the stay from the room, so no rate or total is sent. */
export interface CreateBookingRequest {
  roomId: string; guestName: string; guestEmail: string; guestPhone: string; guestNationality: string;
  checkIn: string; checkOut: string; nights: number; adults: number; children: number;
  source: string; specialRequests?: string | null;
  paidAmount?: number | null; paymentMethod?: string | null;
}
export interface CreateBookingResult { id: string; bookingNumber: string; totalAmount: number }

export interface RoomDto {
  id: string;
  roomNumber: string;
  floor: number;
  type: RoomType;
  bedType: BedType;
  view: ViewType;
  capacity: number;
  sizeSqm: number;
  status: RoomStatus;
  ratePerNight: number;
  amenities: string[];
  currentGuestName: string | null;
  currentBookingId: string | null;
  checkoutDate: string | null;
  lastCleaned: string;
  isSmokingAllowed: boolean;
  isAccessible: boolean;
}

export interface RoomsSummaryDto {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  cleaning: number;
  occupancyRate: number;
  avgRate: number;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
export type BookingSource = "direct" | "ota" | "agent" | "walk_in" | "corporate";

export interface BookingDto {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  roomId: string;
  roomNumber: string;
  roomType: RoomType;
  floor: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: BookingStatus;
  ratePerNight: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  source: BookingSource;
  specialRequests: string;
  notes: string;
}

export interface BookingsSummaryDto {
  total: number;
  checkedIn: number;
  confirmed: number;
  checkedOut: number;
  cancelled: number;
  noShow: number;
  totalRevenue: number;
  outstandingBalance: number;
  occupancyRate: number;
  avgNightlyRate: number;
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────

export type HKStatus  = "pending" | "in_progress" | "completed" | "inspected";
export type TaskType  = "checkout" | "stayover" | "deep_clean" | "inspection" | "turndown";
export type Priority  = "urgent" | "high" | "normal" | "low";

export interface HKChecklistItem {
  item: string;
  done: boolean;
}

export interface HKTaskDto {
  id: string;
  taskNumber: string;
  roomNumber: string;
  floor: number;
  roomType: string;
  taskType: TaskType;
  status: HKStatus;
  priority: Priority;
  assignedTo: string;
  supervisedBy: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  inspectedBy: string | null;
  notes: string;
  checklist: HKChecklistItem[];
}

export interface HKSummaryDto {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  inspected: number;
  urgent: number;
  checkouts: number;
  stayovers: number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** Paging for the hospitality lists that grow with trading — bookings and housekeeping tasks. */
export interface HospPageParams { page?: number; pageSize?: number; status?: string; }

export interface HKTaskParams extends HospPageParams { taskType?: string; search?: string; }

export interface HospPaged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const hospitalityApi = {
  getRooms:           (): Promise<RoomDto[]>          => rawApiClient.get(`${BASE}/rooms`),
  getRoomsSummary:    (): Promise<RoomsSummaryDto>    => rawApiClient.get(`${BASE}/rooms/summary`),
  createRoom:         (data: Record<string, unknown>): Promise<RoomDto> => rawApiClient.post(`${BASE}/rooms`, data),

  getBookings: (p: HospPageParams & { search?: string } = {}): Promise<HospPaged<BookingDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/bookings?${qs}`);
  },
  getBookingsSummary: (): Promise<BookingsSummaryDto> => rawApiClient.get(`${BASE}/bookings/summary`),
  createBooking:      (data: CreateBookingRequest): Promise<CreateBookingResult> => rawApiClient.post(`${BASE}/bookings`, data),
  checkInBooking:  (id: string): Promise<void> => rawApiClient.patch(`${BASE}/bookings/${id}/checkin`),
  checkOutBooking: (id: string): Promise<void> => rawApiClient.patch(`${BASE}/bookings/${id}/checkout`),
  recordBookingPayment: (id: string, data: { amount: number; method: string; reference?: string | null }): Promise<BookingPaymentDto> =>
    rawApiClient.post(`${BASE}/bookings/${id}/payments`, data),
  getBookingPayments: (id: string): Promise<BookingPaymentDto[]> => rawApiClient.get(`${BASE}/bookings/${id}/payments`),

  getHKTasks: (p: HKTaskParams = {}): Promise<HospPaged<HKTaskDto>> => {
    const qs = new URLSearchParams();
    qs.set("page", String(p.page ?? 1));
    qs.set("pageSize", String(p.pageSize ?? 30));
    if (p.status) qs.set("status", p.status);
    if (p.taskType) qs.set("taskType", p.taskType);
    if (p.search?.trim()) qs.set("search", p.search.trim());
    return rawApiClient.get(`${BASE}/housekeeping?${qs}`);
  },
  getHKSummary:       (): Promise<HKSummaryDto>       => rawApiClient.get(`${BASE}/housekeeping/summary`),
  createHKTask:       (data: Record<string, unknown>): Promise<HKTaskDto> => rawApiClient.post(`${BASE}/housekeeping`, data),
};

export interface BookingPaymentDto {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  paidOn: string;
  reference: string | null;
  paidTotal: number;
  balance: number;
}
