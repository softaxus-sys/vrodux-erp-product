import { rawApiClient } from "@/lib/api-client";

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/real-estate`;

export interface SiteVisitDto {
  id: string; visitNumber: string; leadId?: string | null; customerId?: string | null;
  customerName: string; propertyId: string; unitId?: string | null; scheduledAt: string;
  status: string; feedback?: string | null; assignedTo: string; notes?: string | null; createdAt: string;
}
export interface ReservationDto {
  id: string; reservationNumber: string; leadId?: string | null; dealId?: string | null; customerId?: string | null;
  customerName: string; propertyId: string; unitId: string; reservationDate: string; expiryDate: string;
  tokenAmount: number; status: string; notes?: string | null; createdAt: string;
}
export interface BookingDto {
  id: string; bookingNumber: string; dealId?: string | null; customerId?: string | null; customerName: string;
  propertyId: string; unitId: string; bookingDate: string; salePrice: number; downPayment: number;
  installmentCount: number; installmentAmount: number; paidAmount: number; balance: number;
  status: string; broker?: string | null; notes?: string | null; createdAt: string;
}
export interface ReSalesSummaryDto {
  siteVisits: number; activeReservations: number; bookings: number;
  bookedValue: number; collected: number; outstanding: number; inHandover: number;
}

export interface CreateVisitReq { leadId?: string | null; customerId?: string | null; customerName: string; propertyId: string; unitId?: string | null; scheduledAt: string; assignedTo?: string | null; notes?: string | null; }
export interface CreateReservationReq { leadId?: string | null; dealId?: string | null; customerId?: string | null; customerName: string; propertyId: string; unitId: string; reservationDate: string; expiryDate: string; tokenAmount: number; notes?: string | null; }
export interface CreateBookingReq { dealId?: string | null; customerId?: string | null; customerName: string; propertyId: string; unitId: string; bookingDate: string; salePrice: number; downPayment: number; installmentCount: number; broker?: string | null; notes?: string | null; }

export const reSalesApi = {
  getSummary:      (): Promise<ReSalesSummaryDto> => rawApiClient.get(`${BASE}/sales/summary`),

  getSiteVisits:   (): Promise<SiteVisitDto[]> => rawApiClient.get(`${BASE}/site-visits`),
  createSiteVisit: (d: CreateVisitReq): Promise<SiteVisitDto> => rawApiClient.post(`${BASE}/site-visits`, d),
  completeSiteVisit:(id: string, feedback?: string | null): Promise<void> => rawApiClient.post(`${BASE}/site-visits/${id}/complete`, { feedback }),
  deleteSiteVisit: (id: string): Promise<void> => rawApiClient.delete(`${BASE}/site-visits/${id}`),

  getReservations:    (): Promise<ReservationDto[]> => rawApiClient.get(`${BASE}/reservations`),
  createReservation:  (d: CreateReservationReq): Promise<ReservationDto> => rawApiClient.post(`${BASE}/reservations`, d),
  setReservationStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/reservations/${id}/status`, { status }),
  deleteReservation:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/reservations/${id}`),

  getBookings:    (): Promise<BookingDto[]> => rawApiClient.get(`${BASE}/bookings`),
  createBooking:  (d: CreateBookingReq): Promise<BookingDto> => rawApiClient.post(`${BASE}/bookings`, d),
  recordPayment:  (id: string, amount: number): Promise<BookingDto> => rawApiClient.post(`${BASE}/bookings/${id}/payment`, { amount }),
  setBookingStatus:(id: string, status: string): Promise<void> => rawApiClient.patch(`${BASE}/bookings/${id}/status`, { status }),
  deleteBooking:  (id: string): Promise<void> => rawApiClient.delete(`${BASE}/bookings/${id}`),
};
