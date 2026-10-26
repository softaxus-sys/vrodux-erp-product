import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";

const BASE = "/api/hospitality/tours";

// Mirrors Softaxis.Hospitality.Application/Tours -- and the web's lib/hospitality/tours.api.ts. Only
// what the phone shows or does is typed here: the dashboard, packages and departures to look up,
// bookings to follow and collect on. Building a package or a booking from scratch stays on the web.

/** View/act keys. The server accepts any of the listed keys on the shared reads. */
export const TOURS_BOOKINGS_VIEW = "hospitality.tour-bookings.view";
export const TOURS_BOOKINGS_EDIT = "hospitality.tour-bookings.edit";
export const TOURS_BOOKINGS_RECORD = "hospitality.tour-bookings.record";
export const TOURS_PACKAGES_VIEW = "hospitality.tours.view";

export type TourBookingStatus = "enquiry" | "confirmed" | "completed" | "cancelled";
export type InstalmentStatus = "paid" | "partial" | "overdue" | "due" | "upcoming";

export interface TourDepartureDto {
  id: string;
  packageId: string;
  packageCode: string;
  packageName: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  capacity: number;
  seatsBooked: number;
  seatsLeft: number;
  adultPrice: number;
  childPrice: number;
  status: string;
  bookingCount: number;
  revenue: number;
}

export interface TourPackageDto {
  id: string;
  code: string;
  name: string;
  destination: string | null;
  category: string | null;
  durationDays: number;
  pricePerAdult: number;
  pricePerChild: number;
  isActive: boolean;
  upcomingDepartures: number;
}

export interface TourBookingDto {
  id: string;
  bookingNumber: string;
  title: string;
  startDate: string;
  endDate: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  adults: number;
  children: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: TourBookingStatus;
  nextDueDate: string | null;
  overdueAmount: number;
  cancelReason: string | null;
  notes: string | null;
}

export interface TourTravellerDto {
  id: string;
  fullName: string;
  type: string;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportProblem: boolean;
}

export interface TourServiceDto {
  id: string;
  type: string;
  supplierName: string;
  description: string;
  serviceDate: string | null;
  confirmationNumber: string | null;
  status: string;
  sellPrice: number;
  isExtra: boolean;
}

export interface TourInstalmentDto {
  id: string;
  label: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: InstalmentStatus;
}

export interface TourPaymentDto {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidOn: string;
  receivedBy: string | null;
  isVoided: boolean;
}

export interface TourBookingDetailDto {
  booking: TourBookingDto;
  packageName: string | null;
  destination: string | null;
  travellers: TourTravellerDto[];
  services: TourServiceDto[];
  instalments: TourInstalmentDto[];
  payments: TourPaymentDto[];
}

export interface TourAttentionDto {
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  title: string;
  startDate: string;
  kind: "payment" | "enquiry" | "travellers" | "passport" | "supplier";
  message: string;
  amount: number | null;
}

export interface TourDashboardDto {
  enquiries: number;
  confirmed: number;
  travellingNow: number;
  departingNext30Days: number;
  balanceDue: number;
  overdueAmount: number;
  salesThisMonth: number;
  servicesNotConfirmed: number;
  upcomingDepartures: TourDepartureDto[];
  attention: TourAttentionDto[];
}

/** The device's own calendar day -- the server judges "overdue" and "travelling now" by it. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const toursApi = {
  dashboard: (): Promise<TourDashboardDto> => apiClient.get(`${BASE}/dashboard?today=${localToday()}`),

  packages: (): Promise<TourPackageDto[]> => apiClient.get(`${BASE}/packages`),
  departures: (): Promise<TourDepartureDto[]> => apiClient.get(`${BASE}/departures?from=${localToday()}&includeClosed=false`),

  bookings: (p: VerticalPageParams): Promise<VerticalPage<TourBookingDto>> => {
    const q = new URLSearchParams({ page: String(p.page ?? 1), pageSize: String(p.pageSize ?? 25), today: localToday() });
    if (p.status) q.set("status", p.status);
    if (p.search) q.set("search", p.search);
    return apiClient.get(`${BASE}/bookings?${q}`);
  },
  booking: (id: string): Promise<TourBookingDetailDto> => apiClient.get(`${BASE}/bookings/${id}?today=${localToday()}`),
  setStatus: (id: string, action: "confirm" | "complete" | "reopen" | "cancel", reason?: string): Promise<TourBookingDto> =>
    apiClient.post(`${BASE}/bookings/${id}/status`, { action, reason }),
  addPayment: (id: string, d: { amount: number; method: string; reference?: string | null; paidOn?: string | null }): Promise<TourPaymentDto> =>
    apiClient.post(`${BASE}/bookings/${id}/payments`, d),
};

export const TOUR_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
] as const;
