import { rawApiClient } from "@/lib/api-client";

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/hospitality`;

// ─── Rooms ────────────────────────────────────────────────────────────────────
export type RoomStatus = "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
export type RoomType   = "standard" | "deluxe" | "suite" | "penthouse" | "studio";
export type BedType    = "king" | "queen" | "twin" | "double";
export type ViewType   = "city" | "sea" | "pool" | "garden" | "courtyard";

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

export interface BookingSummaryDto {
  total: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  occupancyRate: number;
  totalRevenue: number;
  avgRatePerNight: number;
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────
export type HKStatus  = "pending" | "in_progress" | "completed" | "inspected";
export type TaskType  = "checkout" | "stayover" | "deep_clean" | "inspection" | "turndown";
export type HKPriority = "urgent" | "high" | "normal" | "low";

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
  priority: HKPriority;
  assignedTo: string;
  supervisedBy: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  inspectedBy: string | null;
  notes: string;
  checklist: HKChecklistItem[];
}

export interface HotelSummaryDto {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  checkedInToday: number;
  checkoutsToday: number;
  pendingHKTasks: number;
  todayRevenue: number;
}

export const hospitalityApi = {
  getRooms: (params?: { status?: string; type?: string }): Promise<RoomDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type)   qs.set("type",   params.type);
    const query = qs.toString();
    return rawApiClient.get<RoomDto[]>(`${BASE}/rooms${query ? "?" + query : ""}`);
  },
  getRoom: (id: string): Promise<RoomDto> =>
    rawApiClient.get<RoomDto>(`${BASE}/rooms/${id}`),

  getBookings: (params?: { status?: string; checkIn?: string; checkOut?: string }): Promise<BookingDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status)   qs.set("status",   params.status);
    if (params?.checkIn)  qs.set("checkIn",  params.checkIn);
    if (params?.checkOut) qs.set("checkOut", params.checkOut);
    const query = qs.toString();
    return rawApiClient.get<BookingDto[]>(`${BASE}/bookings${query ? "?" + query : ""}`);
  },
  getBooking: (id: string): Promise<BookingDto> =>
    rawApiClient.get<BookingDto>(`${BASE}/bookings/${id}`),
  checkIn: (id: string): Promise<BookingDto> =>
    rawApiClient.put<BookingDto>(`${BASE}/bookings/${id}/check-in`, {}),
  checkOut: (id: string): Promise<BookingDto> =>
    rawApiClient.put<BookingDto>(`${BASE}/bookings/${id}/check-out`, {}),

  getHKTasks: (params?: { status?: string; assignedTo?: string }): Promise<HKTaskDto[]> => {
    const qs = new URLSearchParams();
    if (params?.status)     qs.set("status",     params.status);
    if (params?.assignedTo) qs.set("assignedTo", params.assignedTo);
    const query = qs.toString();
    return rawApiClient.get<HKTaskDto[]>(`${BASE}/housekeeping${query ? "?" + query : ""}`);
  },
  updateHKTask: (id: string, status: HKStatus): Promise<HKTaskDto> =>
    rawApiClient.put<HKTaskDto>(`${BASE}/housekeeping/${id}/status`, { status }),

  getBookingSummary: (): Promise<BookingSummaryDto> =>
    rawApiClient.get<BookingSummaryDto>(`${BASE}/bookings/summary`),

  getHotelSummary: (): Promise<HotelSummaryDto> =>
    rawApiClient.get<HotelSummaryDto>(`${BASE}/summary`),
};
