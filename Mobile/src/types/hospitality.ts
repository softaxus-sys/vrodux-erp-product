import type { Tone } from "@/theme";

/** Hospitality: Rooms, Bookings (front desk check-in/out), Housekeeping (start/complete/verify).
 *  No permission gate exists on the backend at all (RoomsController/BookingsController/
 *  HousekeepingController are [Authorize]-only) -- mobile gates purely on module access. */

export interface RoomDto {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  ratePerNight: number;
  status: string;
  housekeepingStatus: string;
  currentGuestName: string | null;
  currentBookingId: string | null;
  view: string | null;
  hasBalcony: boolean;
}

export interface RoomsSummaryDto {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  cleaning: number;
  occupancyRate: number;
  dirtyRooms: number;
  avgRate: number;
}

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  maintenance: "Maintenance",
  cleaning: "Cleaning",
};

export const ROOM_STATUS_TONE: Record<string, Tone> = {
  available: "success",
  occupied: "warning",
  maintenance: "destructive",
  cleaning: "info",
};

export interface BookingDto {
  id: string;
  bookingNumber: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  ratePerNight: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  source: string;
  specialRequests: string | null;
}

export interface BookingsSummaryDto {
  total: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  totalRevenue: number;
  totalCollected: number;
  outstanding: number;
}

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_TONE: Record<string, Tone> = {
  confirmed: "info",
  checked_in: "success",
  checked_out: "neutral",
  cancelled: "destructive",
};

export interface HousekeepingTaskDto {
  id: string;
  roomId: string;
  roomNumber: string;
  taskType: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface HousekeepingSummaryDto {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  verified: number;
  urgent: number;
  high: number;
}

export const HOUSEKEEPING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  verified: "Verified",
};

export const HOUSEKEEPING_STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  in_progress: "warning",
  completed: "success",
  verified: "info",
};

export const PRIORITY_TONE: Record<string, Tone> = {
  urgent: "destructive",
  high: "warning",
  medium: "info",
  normal: "neutral",
  low: "neutral",
};

export interface FolioChargeDto {
  id: string; date: string; category: string; description: string; quantity: number; unitPrice: number;
  amount: number; postedBy: string | null; isVoided: boolean; voidReason: string | null;
}
export interface FolioPaymentDto {
  id: string; bookingId: string; amount: number; method: string; paidOn: string; reference: string | null;
  paidTotal: number; balance: number;
}
export interface FolioDto {
  bookingId: string; bookingNumber: string; status: string; guestName: string; roomNumber: string;
  checkIn: string; checkOut: string; charges: FolioChargeDto[]; payments: FolioPaymentDto[];
  roomCharge: number; extrasTotal: number; discountAmount: number; discountReason: string | null;
  serviceChargePercent: number; serviceAmount: number; taxPercent: number; taxLabel: string; taxAmount: number;
  nightlyFee: number; nightlyFeeLabel: string | null; feeAmount: number; total: number; paid: number; balance: number;
}
export interface FrontDeskDto {
  today: string; totalRooms: number; occupiedTonight: number; occupancyPercent: number; dirtyRooms: number;
  arrivalsPending: number; departuresPending: number;
  arrivals: BookingDto[]; departures: BookingDto[]; inHouse: BookingDto[]; noShows: BookingDto[];
}
export const FOLIO_CATEGORIES = ["food", "beverage", "minibar", "laundry", "spa", "transport", "telephone", "other"] as const;
export const HOTEL_PAYMENT_METHODS = ["cash", "card", "bank_transfer", "other"] as const;
