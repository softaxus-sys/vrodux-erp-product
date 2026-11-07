import { apiClient } from "@/lib/api-client";
import type { VerticalPage, VerticalPageParams } from "@/lib/verticals-shared";
import type { FolioDto, FrontDeskDto, BookingDto, BookingsSummaryDto, HousekeepingSummaryDto, HousekeepingTaskDto, RoomDto, RoomsSummaryDto } from "@/types/hospitality";

const BASE = "/api/hospitality";

function qs(p: VerticalPageParams & { taskType?: string }): string {
  const q = new URLSearchParams();
  q.set("page", String(p.page ?? 1));
  q.set("pageSize", String(p.pageSize ?? 30));
  if (p.status) q.set("status", p.status);
  if (p.taskType) q.set("taskType", p.taskType);
  if (p.search) q.set("search", p.search);
  return q.toString();
}

export const hospitalityApi = {
  getRoomsSummary: (): Promise<RoomsSummaryDto> => apiClient.get(`${BASE}/rooms/summary`),
  getRooms: (): Promise<RoomDto[]> => apiClient.get(`${BASE}/rooms`),

  getBookingsSummary: (): Promise<BookingsSummaryDto> => apiClient.get(`${BASE}/bookings/summary`),
  getBookings: (p: VerticalPageParams): Promise<VerticalPage<BookingDto>> => apiClient.get(`${BASE}/bookings?${qs(p)}`),
  getFrontDesk: (): Promise<FrontDeskDto> => apiClient.get(`${BASE}/bookings/front-desk`),
  getFolio: (id: string): Promise<FolioDto> => apiClient.get(`${BASE}/bookings/${id}/folio`),
  recordPayment: (id: string, b: { amount: number; method: string; reference?: string | null }): Promise<unknown> =>
    apiClient.post(`${BASE}/bookings/${id}/payments`, b),
  postCharge: (id: string, b: { category: string; description: string; quantity: number; unitPrice: number }): Promise<unknown> =>
    apiClient.post(`${BASE}/bookings/${id}/folio/charges`, b),
  voidCharge: (id: string, chargeId: string, reason: string): Promise<unknown> =>
    apiClient.post(`${BASE}/bookings/${id}/folio/charges/${chargeId}/void`, { reason }),
  cancelBooking: (id: string, reason: string, cancellationFee?: number): Promise<unknown> =>
    apiClient.post(`${BASE}/bookings/${id}/cancel`, { reason, cancellationFee }),
  markNoShow: (id: string): Promise<unknown> => apiClient.post(`${BASE}/bookings/${id}/no-show`, {}),
  checkOutWithBalance: (id: string): Promise<BookingDto> => apiClient.patch(`${BASE}/bookings/${id}/checkout`, { allowBalance: true }),
  checkIn: (id: string): Promise<BookingDto> => apiClient.patch(`${BASE}/bookings/${id}/checkin`, {}),
  checkOut: (id: string): Promise<BookingDto> => apiClient.patch(`${BASE}/bookings/${id}/checkout`, {}),

  getHousekeepingSummary: (): Promise<HousekeepingSummaryDto> => apiClient.get(`${BASE}/housekeeping/summary`),
  getHousekeepingTasks: (p: VerticalPageParams & { taskType?: string }): Promise<VerticalPage<HousekeepingTaskDto>> =>
    apiClient.get(`${BASE}/housekeeping?${qs(p)}`),
  startTask: (id: string): Promise<HousekeepingTaskDto> => apiClient.patch(`${BASE}/housekeeping/${id}/start`, {}),
  completeTask: (id: string): Promise<HousekeepingTaskDto> => apiClient.patch(`${BASE}/housekeeping/${id}/complete`, {}),
  verifyTask: (id: string): Promise<HousekeepingTaskDto> => apiClient.patch(`${BASE}/housekeeping/${id}/verify`, {}),
};
