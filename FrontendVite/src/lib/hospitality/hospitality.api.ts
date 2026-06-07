import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/hospitality`;

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

export const hospitalityApi = {
  getRooms:          (): Promise<RoomDto[]>          => rawApiClient.get(`${BASE}/rooms`),
  getRoomsSummary:   (): Promise<RoomsSummaryDto>    => rawApiClient.get(`${BASE}/rooms/summary`),
  getBookings:       (): Promise<BookingDto[]>       => rawApiClient.get(`${BASE}/bookings`),
  getBookingsSummary:(): Promise<BookingsSummaryDto> => rawApiClient.get(`${BASE}/bookings/summary`),
  getHKTasks:        (): Promise<HKTaskDto[]>        => rawApiClient.get(`${BASE}/housekeeping`),
  getHKSummary:      (): Promise<HKSummaryDto>       => rawApiClient.get(`${BASE}/housekeeping/summary`),
};
