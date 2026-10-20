import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";

const BASE = `${getApiBaseUrl()}/api/hospitality`;

// Every type here mirrors a server DTO field for field. A field the API does not return must not
// be declared: an undeclared field fails the build, a fictional one silently renders as blank.

// ─── Rooms & room types ───────────────────────────────────────────────────────

export type RoomStatus = "available" | "occupied" | "maintenance" | "cleaning";
export type HousekeepingStatus = "clean" | "dirty" | "inspected";

export interface RoomDto {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  ratePerNight: number;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  currentGuestName: string | null;
  currentBookingId: string | null;
  view: string | null;
  hasBalcony: boolean;
  roomTypeId: string | null;
  notes: string | null;
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

export interface RoomTypeDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  amenities: string | null;
  baseRate: number;
  maxAdults: number;
  maxChildren: number;
  isActive: boolean;
  roomCount: number;
}

export interface RoomTypeRequest {
  code: string; name: string; baseRate: number; maxAdults: number; maxChildren: number;
  description?: string | null; amenities?: string | null; isActive?: boolean;
}

export interface RoomRequest {
  roomNumber: string; roomTypeId: string; floor: number; capacity: number; ratePerNight: number;
  view?: string | null; hasBalcony: boolean; notes?: string | null;
}

export interface RoomBlockDto { id: string; roomId: string; roomNumber: string; fromDate: string; toDate: string; reason: string }

// ─── Rates ────────────────────────────────────────────────────────────────────

export type MealPlan = "room_only" | "bed_breakfast" | "half_board" | "full_board" | "all_inclusive";

export const MEAL_PLAN_LABELS: Record<MealPlan, string> = {
  room_only: "Room only", bed_breakfast: "Bed & breakfast", half_board: "Half board",
  full_board: "Full board", all_inclusive: "All inclusive",
};

export interface SeasonalRateDto {
  id: string; ratePlanId: string; roomTypeId: string; roomTypeName: string; label: string;
  fromDate: string; toDate: string; weekdayRate: number; weekendRate: number | null; minNights: number;
}

export interface RatePlanDto {
  id: string; code: string; name: string; mealPlan: MealPlan; isRefundable: boolean;
  description: string | null; isDefault: boolean; isActive: boolean; seasons: SeasonalRateDto[];
}

export interface RatePlanRequest {
  code: string; name: string; mealPlan: MealPlan; isRefundable: boolean; description?: string | null; isActive?: boolean;
}

export interface SeasonRequest {
  roomTypeId: string; label: string; fromDate: string; toDate: string;
  weekdayRate: number; weekendRate?: number | null; minNights: number;
}

export interface HotelSettingsDto {
  propertyName: string | null;
  weekendDays: string;
  checkInTime: string;
  checkOutTime: string;
  taxPercent: number;
  taxLabel: string;
  serviceChargePercent: number;
  nightlyFee: number;
  nightlyFeeLabel: string | null;
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface NightRateDto { date: string; rate: number; isWeekend: boolean; season: string | null }

export interface StayQuoteDto {
  nights: NightRateDto[]; roomCharge: number; serviceAmount: number; taxAmount: number;
  feeAmount: number; total: number; minNightsRequired: number;
}

export interface AvailableRoomDto { id: string; roomNumber: string; floor: number; view: string | null; hasBalcony: boolean; housekeepingStatus: string }

export interface RoomTypeAvailabilityDto {
  roomTypeId: string; code: string; name: string; maxAdults: number; maxChildren: number;
  totalRooms: number; availableCount: number; fitsParty: boolean; rooms: AvailableRoomDto[]; quote: StayQuoteDto;
}

export interface AvailabilityResultDto {
  checkIn: string; checkOut: string; nights: number; ratePlanId: string | null; ratePlanName: string | null;
  roomTypes: RoomTypeAvailabilityDto[];
}

export interface TapeRoomDto { id: string; roomNumber: string; roomType: string; roomTypeId: string | null; floor: number; status: RoomStatus; housekeepingStatus: string }
export interface TapeBookingDto {
  id: string; roomId: string; bookingNumber: string; guestName: string; checkIn: string; checkOut: string;
  status: BookingStatus; balance: number; adults: number; children: number; source: string;
}
export interface TapeChartDto { from: string; days: number; rooms: TapeRoomDto[]; bookings: TapeBookingDto[]; blocks: RoomBlockDto[] }

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";

export const BOOKING_SOURCES = [
  { value: "direct", label: "Direct" }, { value: "walk_in", label: "Walk-in" }, { value: "phone", label: "Phone" },
  { value: "website", label: "Website" }, { value: "ota", label: "Online travel agency" },
  { value: "agent", label: "Travel agent" }, { value: "corporate", label: "Corporate" },
];

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
  status: BookingStatus;
  source: string;
  specialRequests: string | null;
  guestId: string | null;
  roomTypeId: string | null;
  ratePlanId: string | null;
  ratePlanName: string | null;
  mealPlan: MealPlan | null;
  roomCharge: number;
  extrasTotal: number;
  discountAmount: number;
  serviceAmount: number;
  taxAmount: number;
  feeAmount: number;
  cancelReason: string | null;
  notes: string | null;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  createdAt: string | null;
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

/** Mirrors CreateBookingCommand. The server prices the stay; no rate or total is sent. */
export interface CreateBookingRequest {
  roomId: string; guestName: string; guestEmail?: string | null; guestPhone?: string | null; guestNationality?: string | null;
  checkIn: string; checkOut: string; nights: number; adults: number; children: number;
  source: string; specialRequests?: string | null;
  paidAmount?: number | null; paymentMethod?: string | null; paymentReference?: string | null;
  guestId?: string | null; ratePlanId?: string | null;
  discountAmount?: number | null; discountReason?: string | null; notes?: string | null;
}
export interface CreateBookingResult { id: string; bookingNumber: string; totalAmount: number }

export interface BookingPaymentDto {
  id: string; bookingId: string; amount: number; method: string; paidOn: string;
  reference: string | null; paidTotal: number; balance: number;
}

export const FOLIO_CATEGORIES = [
  { value: "food", label: "Food" }, { value: "beverage", label: "Beverage" }, { value: "room_service", label: "Room service" },
  { value: "minibar", label: "Minibar" }, { value: "laundry", label: "Laundry" }, { value: "spa", label: "Spa" },
  { value: "transport", label: "Transport" }, { value: "telephone", label: "Telephone" }, { value: "extra_bed", label: "Extra bed" },
  { value: "late_checkout", label: "Late check-out" }, { value: "damage", label: "Damage" },
  { value: "cancellation_fee", label: "Cancellation fee" }, { value: "other", label: "Other" },
];

export interface FolioChargeDto {
  id: string; date: string; category: string; description: string; quantity: number; unitPrice: number;
  amount: number; postedBy: string | null; isVoided: boolean; voidReason: string | null;
}

export interface FolioDto {
  bookingId: string; bookingNumber: string; status: BookingStatus; guestName: string; roomNumber: string;
  checkIn: string; checkOut: string;
  nights: NightRateDto[]; charges: FolioChargeDto[]; payments: BookingPaymentDto[];
  roomCharge: number; extrasTotal: number; discountAmount: number; discountReason: string | null;
  serviceChargePercent: number; serviceAmount: number; taxPercent: number; taxLabel: string; taxAmount: number;
  nightlyFee: number; nightlyFeeLabel: string | null; feeAmount: number; total: number; paid: number; balance: number;
}

export interface FrontDeskDto {
  today: string; totalRooms: number; outOfOrder: number; occupiedTonight: number; occupancyPercent: number;
  averageDailyRate: number; revPar: number; roomRevenueTonight: number; dirtyRooms: number;
  arrivalsPending: number; departuresPending: number;
  arrivals: BookingDto[]; departures: BookingDto[]; inHouse: BookingDto[]; noShows: BookingDto[];
}

// ─── Guests ───────────────────────────────────────────────────────────────────

export interface GuestDto {
  id: string; fullName: string; email: string | null; phone: string | null; nationality: string | null;
  documentType: string | null; documentNumber: string | null; documentExpiry: string | null; dateOfBirth: string | null;
  address: string | null; company: string | null; isVip: boolean; notes: string | null;
  stayCount: number; totalSpent: number; lastStayOn: string | null; createdAt: string;
}

export interface GuestDetailDto { guest: GuestDto; bookings: BookingDto[] }

export type GuestRequest = Omit<GuestDto, "id" | "stayCount" | "totalSpent" | "lastStayOn" | "createdAt">;

// ─── Housekeeping ─────────────────────────────────────────────────────────────

export type HKStatus  = "pending" | "in_progress" | "completed" | "inspected";
export type TaskType  = "checkout" | "stayover" | "deep_clean" | "inspection" | "turndown";
export type Priority  = "urgent" | "high" | "normal" | "low";

export interface HKChecklistItem { item: string; done: boolean }

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
  total: number; pending: number; inProgress: number; completed: number; inspected: number;
  urgent: number; checkouts: number; stayovers: number;
}

// ─── Paging ───────────────────────────────────────────────────────────────────

export interface HospPageParams { page?: number; pageSize?: number; status?: string }
export interface HKTaskParams extends HospPageParams { taskType?: string; search?: string }
export interface BookingListParams extends HospPageParams { search?: string; from?: string; to?: string; guestId?: string }
export interface HospPaged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }

const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return p.toString();
};

/** The desk's own date — the server uses it when it is within a day of UTC. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ─── API ──────────────────────────────────────────────────────────────────────

export const hospitalityApi = {
  // Rooms
  getRooms:        (): Promise<RoomDto[]>         => rawApiClient.get(`${BASE}/rooms`),
  getRoomsSummary: (): Promise<RoomsSummaryDto>   => rawApiClient.get(`${BASE}/rooms/summary`),
  createRoom:      (d: RoomRequest): Promise<RoomDto> => rawApiClient.post(`${BASE}/rooms`, d),
  updateRoom:      (id: string, d: RoomRequest): Promise<RoomDto> => rawApiClient.put(`${BASE}/rooms/${id}`, d),
  deleteRoom:      (id: string): Promise<void> => rawApiClient.delete(`${BASE}/rooms/${id}`),
  setMaintenance:  (id: string, inMaintenance: boolean): Promise<RoomDto> => rawApiClient.patch(`${BASE}/rooms/${id}/maintenance`, { inMaintenance }),
  setHousekeeping: (id: string, status: HousekeepingStatus): Promise<RoomDto> => rawApiClient.patch(`${BASE}/rooms/${id}/housekeeping`, { status }),

  getRoomTypes:   (includeInactive = false): Promise<RoomTypeDto[]> => rawApiClient.get(`${BASE}/room-types?${qs({ includeInactive })}`),
  createRoomType: (d: RoomTypeRequest): Promise<RoomTypeDto> => rawApiClient.post(`${BASE}/room-types`, d),
  updateRoomType: (id: string, d: RoomTypeRequest): Promise<RoomTypeDto> => rawApiClient.put(`${BASE}/room-types/${id}`, d),
  deleteRoomType: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/room-types/${id}`),

  getBlocks:   (from?: string, to?: string): Promise<RoomBlockDto[]> => rawApiClient.get(`${BASE}/rooms/blocks?${qs({ from, to })}`),
  createBlock: (d: { roomId: string; fromDate: string; toDate: string; reason: string }): Promise<RoomBlockDto> => rawApiClient.post(`${BASE}/rooms/blocks`, d),
  deleteBlock: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/rooms/blocks/${id}`),

  searchAvailability: (p: { checkIn: string; checkOut: string; adults: number; children: number; roomTypeId?: string; ratePlanId?: string; excludeBookingId?: string }): Promise<AvailabilityResultDto> =>
    rawApiClient.get(`${BASE}/rooms/availability?${qs(p)}`),
  getTapeChart: (from: string, days: number): Promise<TapeChartDto> => rawApiClient.get(`${BASE}/rooms/tape-chart?${qs({ from, days })}`),

  // Rates
  getRatePlans:     (includeInactive = false): Promise<RatePlanDto[]> => rawApiClient.get(`${BASE}/rate-plans?${qs({ includeInactive })}`),
  createRatePlan:   (d: RatePlanRequest): Promise<RatePlanDto> => rawApiClient.post(`${BASE}/rate-plans`, d),
  updateRatePlan:   (id: string, d: RatePlanRequest): Promise<RatePlanDto> => rawApiClient.put(`${BASE}/rate-plans/${id}`, d),
  deleteRatePlan:   (id: string): Promise<void> => rawApiClient.delete(`${BASE}/rate-plans/${id}`),
  setDefaultPlan:   (id: string): Promise<RatePlanDto> => rawApiClient.post(`${BASE}/rate-plans/${id}/default`, {}),
  addSeason:        (planId: string, d: SeasonRequest): Promise<RatePlanDto> => rawApiClient.post(`${BASE}/rate-plans/${planId}/seasons`, d),
  deleteSeason:     (planId: string, seasonId: string): Promise<RatePlanDto> => rawApiClient.delete(`${BASE}/rate-plans/${planId}/seasons/${seasonId}`),

  getSettings:    (): Promise<HotelSettingsDto> => rawApiClient.get(`${BASE}/settings`),
  updateSettings: (d: HotelSettingsDto): Promise<HotelSettingsDto> => rawApiClient.put(`${BASE}/settings`, d),

  // Bookings
  getBookings: (p: BookingListParams = {}): Promise<HospPaged<BookingDto>> =>
    rawApiClient.get(`${BASE}/bookings?${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, status: p.status, search: p.search?.trim(), from: p.from, to: p.to, guestId: p.guestId })}`),
  getBookingsSummary: (): Promise<BookingsSummaryDto> => rawApiClient.get(`${BASE}/bookings/summary`),
  getBooking:         (id: string): Promise<BookingDto> => rawApiClient.get(`${BASE}/bookings/${id}`),
  getFrontDesk:       (): Promise<FrontDeskDto> => rawApiClient.get(`${BASE}/bookings/front-desk?${qs({ today: localToday() })}`),
  createBooking:      (d: CreateBookingRequest): Promise<CreateBookingResult> => rawApiClient.post(`${BASE}/bookings`, d),
  updateBookingDetails: (id: string, d: { guestName: string; guestEmail?: string | null; guestPhone?: string | null; guestNationality?: string | null; adults: number; children: number; source: string; specialRequests?: string | null; notes?: string | null }): Promise<BookingDto> =>
    rawApiClient.put(`${BASE}/bookings/${id}`, d),
  amendStay:   (id: string, checkIn: string, checkOut: string): Promise<BookingDto> => rawApiClient.post(`${BASE}/bookings/${id}/amend`, { checkIn, checkOut }),
  moveRoom:    (id: string, roomId: string, reprice: boolean): Promise<BookingDto> => rawApiClient.post(`${BASE}/bookings/${id}/move`, { roomId, reprice }),
  cancelBooking: (id: string, reason: string, cancellationFee?: number | null): Promise<void> => rawApiClient.post(`${BASE}/bookings/${id}/cancel`, { reason, cancellationFee }),
  markNoShow:  (id: string, fee?: number | null): Promise<void> => rawApiClient.post(`${BASE}/bookings/${id}/no-show`, { today: localToday(), fee }),
  checkInBooking:  (id: string, roomId?: string | null): Promise<void> => rawApiClient.patch(`${BASE}/bookings/${id}/checkin`, { today: localToday(), roomId }),
  checkOutBooking: (id: string, allowBalance = false): Promise<void> => rawApiClient.patch(`${BASE}/bookings/${id}/checkout`, { today: localToday(), allowBalance }),
  recordBookingPayment: (id: string, d: { amount: number; method: string; reference?: string | null }): Promise<BookingPaymentDto> =>
    rawApiClient.post(`${BASE}/bookings/${id}/payments`, d),
  getBookingPayments: (id: string): Promise<BookingPaymentDto[]> => rawApiClient.get(`${BASE}/bookings/${id}/payments`),

  getFolio:    (id: string): Promise<FolioDto> => rawApiClient.get(`${BASE}/bookings/${id}/folio`),
  postCharge:  (id: string, d: { category: string; description: string; quantity: number; unitPrice: number; date?: string | null; postedBy?: string | null }): Promise<FolioDto> =>
    rawApiClient.post(`${BASE}/bookings/${id}/folio/charges`, d),
  voidCharge:  (id: string, chargeId: string, reason: string): Promise<FolioDto> => rawApiClient.post(`${BASE}/bookings/${id}/folio/charges/${chargeId}/void`, { reason }),
  setDiscount: (id: string, amount: number, reason?: string | null): Promise<FolioDto> => rawApiClient.put(`${BASE}/bookings/${id}/folio/discount`, { amount, reason }),

  // Guests
  getGuests:   (p: { search?: string; page?: number; pageSize?: number } = {}): Promise<HospPaged<GuestDto>> =>
    rawApiClient.get(`${BASE}/guests?${qs({ search: p.search?.trim(), page: p.page ?? 1, pageSize: p.pageSize ?? 30 })}`),
  getGuest:    (id: string): Promise<GuestDetailDto> => rawApiClient.get(`${BASE}/guests/${id}`),
  createGuest: (d: GuestRequest): Promise<GuestDto> => rawApiClient.post(`${BASE}/guests`, d),
  updateGuest: (id: string, d: GuestRequest): Promise<GuestDto> => rawApiClient.put(`${BASE}/guests/${id}`, d),
  deleteGuest: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/guests/${id}`),

  // Housekeeping
  getHKTasks: (p: HKTaskParams = {}): Promise<HospPaged<HKTaskDto>> =>
    rawApiClient.get(`${BASE}/housekeeping?${qs({ page: p.page ?? 1, pageSize: p.pageSize ?? 30, status: p.status, taskType: p.taskType, search: p.search?.trim() })}`),
  getHKSummary: (): Promise<HKSummaryDto> => rawApiClient.get(`${BASE}/housekeeping/summary`),
  createHKTask: (data: Record<string, unknown>): Promise<HKTaskDto> => rawApiClient.post(`${BASE}/housekeeping`, data),
};
