import { rawApiClient } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/desktop";
import { localToday, type HospPaged } from "./hospitality.api";

const BASE = `${getApiBaseUrl()}/api/hospitality/tours`;

// Mirrors the server DTOs in Softaxis.Hospitality.Application/Tours field for field.

export type TourBookingStatus = "enquiry" | "confirmed" | "completed" | "cancelled";
export type DepartureStatus = "open" | "closed" | "cancelled" | "completed";
export type ServiceType = "hotel" | "flight" | "car" | "transfer" | "rail" | "cruise" | "bus" | "visa" | "activity" | "guide" | "insurance" | "other";
export type ServiceStatus = "pending" | "requested" | "confirmed" | "cancelled";
export type InstalmentStatus = "paid" | "partial" | "overdue" | "due" | "upcoming";

export interface ItineraryDayDto { dayNumber: number; title: string; description: string | null; accommodation: string | null; meals: string | null }

export interface TourPackageDto {
  id: string; code: string; name: string; destination: string | null; category: string | null; durationDays: number;
  description: string | null; inclusions: string | null; exclusions: string | null;
  pricePerAdult: number; pricePerChild: number; singleSupplement: number; isActive: boolean;
  days: ItineraryDayDto[]; upcomingDepartures: number; createdAt: string;
}

export interface TourDepartureDto {
  id: string; packageId: string; packageCode: string; packageName: string; destination: string | null;
  startDate: string; endDate: string; capacity: number; seatsBooked: number; seatsLeft: number;
  adultPrice: number; childPrice: number; hasPriceOverride: boolean;
  status: DepartureStatus; notes: string | null; bookingCount: number; revenue: number;
}

export interface TourBookingDto {
  id: string; bookingNumber: string; packageId: string | null; departureId: string | null; title: string;
  startDate: string; endDate: string; guestId: string | null; customerName: string; customerEmail: string | null; customerPhone: string | null;
  adults: number; children: number; singleRooms: number; adultPrice: number; childPrice: number; singleSupplement: number;
  packageAmount: number; extrasAmount: number; discountAmount: number; taxPercent: number; taxAmount: number;
  totalAmount: number; amountPaid: number; balance: number; costAmount: number | null; margin: number | null;
  status: TourBookingStatus; source: string | null; cancelReason: string | null; notes: string | null; createdByName: string | null;
  nextDueDate: string | null; overdueAmount: number; createdAt: string;
}

export interface TourTravellerDto {
  id: string; fullName: string; type: "adult" | "child" | "infant"; gender: string | null; dateOfBirth: string | null;
  nationality: string | null; passportNumber: string | null; passportExpiry: string | null; notes: string | null; passportProblem: boolean;
}

export interface TourServiceDto {
  id: string; type: ServiceType; supplierName: string; description: string; serviceDate: string | null; endDate: string | null;
  confirmationNumber: string | null; cost: number | null; supplierPaid: number | null; supplierBalance: number | null;
  isExtra: boolean; sellPrice: number; status: ServiceStatus; notes: string | null;
  /** Type-specific details (flight number, check-in, pick-up place…) as name/value pairs. */
  details: Record<string, string>;
}

export interface TourInstalmentDto { id: string; label: string; dueDate: string; amount: number; paid: number; status: InstalmentStatus }

export interface TourPaymentDto {
  id: string; amount: number; method: string; reference: string | null; paidOn: string; receivedBy: string | null;
  isVoided: boolean; voidReason: string | null; createdAt: string;
}

export interface TourBookingDetailDto {
  booking: TourBookingDto; packageName: string | null; destination: string | null; inclusions: string | null; exclusions: string | null;
  itinerary: ItineraryDayDto[]; travellers: TourTravellerDto[]; services: TourServiceDto[];
  instalments: TourInstalmentDto[]; payments: TourPaymentDto[]; canSeeCosts: boolean;
}

export interface TourAttentionDto {
  bookingId: string; bookingNumber: string; customerName: string; title: string; startDate: string;
  kind: "payment" | "enquiry" | "travellers" | "passport" | "supplier"; message: string; amount: number | null;
}

export interface TourDashboardDto {
  enquiries: number; confirmed: number; travellingNow: number; departingNext30Days: number;
  balanceDue: number; overdueAmount: number; supplierBalanceDue: number | null; marginThisMonth: number | null;
  salesThisMonth: number; servicesNotConfirmed: number;
  upcomingDepartures: TourDepartureDto[]; attention: TourAttentionDto[];
}

// ── Requests ──

export interface ItineraryDayInput { title: string; description?: string | null; accommodation?: string | null; meals?: string | null }
export interface TourPackageRequest {
  code: string; name: string; destination?: string | null; category?: string | null; durationDays: number;
  description?: string | null; inclusions?: string | null; exclusions?: string | null;
  pricePerAdult: number; pricePerChild: number; singleSupplement: number; isActive: boolean; days: ItineraryDayInput[];
}
export interface TourDepartureRequest {
  packageId: string; startDate: string; endDate?: string | null; capacity: number;
  adultPrice?: number | null; childPrice?: number | null; notes?: string | null;
}
export interface TravellerInput {
  fullName: string; type: string; gender?: string | null; dateOfBirth?: string | null; nationality?: string | null;
  passportNumber?: string | null; passportExpiry?: string | null; notes?: string | null;
}
export interface CreateTourBookingRequest {
  departureId?: string | null; packageId?: string | null; title?: string | null; startDate?: string | null; endDate?: string | null;
  guestId?: string | null; customerName: string; customerEmail?: string | null; customerPhone?: string | null;
  adults: number; children: number; singleRooms: number;
  adultPrice?: number | null; childPrice?: number | null; singleSupplement?: number | null;
  discount: number; taxPercent: number; source?: string | null; notes?: string | null; confirm: boolean;
  travellers?: TravellerInput[];
}
export interface UpdateTourBookingRequest {
  title: string; startDate: string; endDate: string; customerName: string; customerEmail?: string | null; customerPhone?: string | null;
  adults: number; children: number; singleRooms: number; adultPrice: number; childPrice: number; singleSupplement: number;
  discount: number; taxPercent: number; source?: string | null; notes?: string | null;
}
export interface TourServiceRequest {
  type: ServiceType; supplierName: string; description: string; serviceDate?: string | null; endDate?: string | null;
  confirmationNumber?: string | null; cost: number; supplierPaid: number; isExtra: boolean; sellPrice: number;
  status: ServiceStatus; notes?: string | null; details?: Record<string, string>;
}
export interface InstalmentInput { label: string; dueDate: string; amount: number }
export interface TourPaymentRequest { amount: number; method: string; reference?: string | null; paidOn?: string | null }

export interface TourBookingListParams {
  status?: string; search?: string; departureId?: string; guestId?: string; from?: string; to?: string;
  balanceOnly?: boolean; page?: number; pageSize?: number;
}

const qs = (o: Record<string, string | number | boolean | undefined | null>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const toursApi = {
  dashboard: (): Promise<TourDashboardDto> => rawApiClient.get(`${BASE}/dashboard?${qs({ today: localToday() })}`),

  packages: (includeInactive = false, search?: string): Promise<TourPackageDto[]> =>
    rawApiClient.get(`${BASE}/packages?${qs({ includeInactive, search })}`),
  package: (id: string): Promise<TourPackageDto> => rawApiClient.get(`${BASE}/packages/${id}`),
  createPackage: (d: TourPackageRequest): Promise<TourPackageDto> => rawApiClient.post(`${BASE}/packages`, d),
  updatePackage: (id: string, d: TourPackageRequest): Promise<TourPackageDto> => rawApiClient.put(`${BASE}/packages/${id}`, d),
  deletePackage: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/packages/${id}`),

  departures: (p: { packageId?: string; from?: string; to?: string; includeClosed?: boolean } = {}): Promise<TourDepartureDto[]> =>
    rawApiClient.get(`${BASE}/departures?${qs(p)}`),
  createDeparture: (d: TourDepartureRequest): Promise<TourDepartureDto> => rawApiClient.post(`${BASE}/departures`, d),
  updateDeparture: (id: string, d: TourDepartureRequest): Promise<TourDepartureDto> => rawApiClient.put(`${BASE}/departures/${id}`, d),
  setDepartureStatus: (id: string, status: DepartureStatus): Promise<TourDepartureDto> =>
    rawApiClient.patch(`${BASE}/departures/${id}/status`, { status }),
  deleteDeparture: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/departures/${id}`),

  bookings: (p: TourBookingListParams = {}): Promise<HospPaged<TourBookingDto>> =>
    rawApiClient.get(`${BASE}/bookings?${qs({ ...p, today: localToday() })}`),
  booking: (id: string): Promise<TourBookingDetailDto> => rawApiClient.get(`${BASE}/bookings/${id}?${qs({ today: localToday() })}`),
  createBooking: (d: CreateTourBookingRequest): Promise<TourBookingDto> => rawApiClient.post(`${BASE}/bookings`, d),
  updateBooking: (id: string, d: UpdateTourBookingRequest): Promise<TourBookingDto> => rawApiClient.put(`${BASE}/bookings/${id}`, d),
  setStatus: (id: string, action: "confirm" | "complete" | "reopen" | "cancel", reason?: string): Promise<TourBookingDto> =>
    rawApiClient.post(`${BASE}/bookings/${id}/status`, { action, reason }),
  deleteBooking: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/bookings/${id}`),
  saveTravellers: (id: string, travellers: TravellerInput[]): Promise<void> => rawApiClient.put(`${BASE}/bookings/${id}/travellers`, { travellers }),
  addService: (id: string, d: TourServiceRequest): Promise<TourServiceDto> => rawApiClient.post(`${BASE}/bookings/${id}/services`, d),
  updateService: (id: string, serviceId: string, d: TourServiceRequest): Promise<TourServiceDto> =>
    rawApiClient.put(`${BASE}/bookings/${id}/services/${serviceId}`, d),
  deleteService: (id: string, serviceId: string): Promise<void> => rawApiClient.delete(`${BASE}/bookings/${id}/services/${serviceId}`),
  saveInstalments: (id: string, instalments: InstalmentInput[]): Promise<void> =>
    rawApiClient.put(`${BASE}/bookings/${id}/instalments`, { instalments }),
  addPayment: (id: string, d: TourPaymentRequest): Promise<TourPaymentDto> => rawApiClient.post(`${BASE}/bookings/${id}/payments`, d),
  voidPayment: (id: string, paymentId: string, reason: string): Promise<void> =>
    rawApiClient.post(`${BASE}/bookings/${id}/payments/${paymentId}/void`, { reason }),
};
