import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hospitalityApi, type HKTaskParams, type BookingListParams, type CreateBookingRequest,
  type RoomRequest, type RoomTypeRequest, type RatePlanRequest, type SeasonRequest,
  type HotelSettingsDto, type GuestRequest, type HousekeepingStatus,
} from "@/lib/hospitality/hospitality.api";

const QK = "hospitality";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useRooms         = () => useQuery({ queryKey: [QK, "rooms"], queryFn: hospitalityApi.getRooms, staleTime: 60_000 });
export const useRoomsSummary  = () => useQuery({ queryKey: [QK, "rooms-summary"], queryFn: hospitalityApi.getRoomsSummary, staleTime: 60_000 });
export const useRoomTypes     = (includeInactive = false) =>
  useQuery({ queryKey: [QK, "room-types", includeInactive], queryFn: () => hospitalityApi.getRoomTypes(includeInactive), staleTime: 5 * 60_000 });
export const useRatePlans     = (includeInactive = false) =>
  useQuery({ queryKey: [QK, "rate-plans", includeInactive], queryFn: () => hospitalityApi.getRatePlans(includeInactive), staleTime: 5 * 60_000 });
export const useHotelSettings = () => useQuery({ queryKey: [QK, "settings"], queryFn: hospitalityApi.getSettings, staleTime: 10 * 60_000 });
export const useRoomBlocks    = () => useQuery({ queryKey: [QK, "blocks"], queryFn: () => hospitalityApi.getBlocks() });

export function useBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: [QK, "bookings", params],
    queryFn: () => hospitalityApi.getBookings(params),
    // Keeps the current page on screen while the next one loads, so paging never blanks the list.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
export const useBookingsSummary = () => useQuery({ queryKey: [QK, "bookings-summary"], queryFn: hospitalityApi.getBookingsSummary, staleTime: 60_000 });
export const useBooking = (id: string | null) =>
  useQuery({ queryKey: [QK, "booking", id], queryFn: () => hospitalityApi.getBooking(id!), enabled: !!id });
export const useFolio = (id: string | null) =>
  useQuery({ queryKey: [QK, "folio", id], queryFn: () => hospitalityApi.getFolio(id!), enabled: !!id });
// The desk screen is watched all day; a minute-old board is the most it should ever show.
export const useFrontDesk = () =>
  useQuery({ queryKey: [QK, "front-desk"], queryFn: hospitalityApi.getFrontDesk, refetchInterval: 60_000, staleTime: 15_000 });

export function useAvailability(p: { checkIn: string; checkOut: string; adults: number; children: number; ratePlanId?: string; excludeBookingId?: string } | null) {
  return useQuery({
    queryKey: [QK, "availability", p],
    queryFn: () => hospitalityApi.searchAvailability(p!),
    enabled: !!p && !!p.checkIn && !!p.checkOut && p.checkOut > p.checkIn,
    // Availability is the one thing that must never be stale when a room is picked.
    staleTime: 0,
  });
}

export const useTapeChart = (from: string, days: number) =>
  useQuery({ queryKey: [QK, "tape", from, days], queryFn: () => hospitalityApi.getTapeChart(from, days), placeholderData: keepPreviousData, staleTime: 15_000 });

export const useGuests = (p: { search?: string; page?: number; pageSize?: number } = {}) =>
  useQuery({ queryKey: [QK, "guests", p], queryFn: () => hospitalityApi.getGuests(p), placeholderData: keepPreviousData, staleTime: 30_000 });
export const useGuest = (id: string | null) =>
  useQuery({ queryKey: [QK, "guest", id], queryFn: () => hospitalityApi.getGuest(id!), enabled: !!id });

export function useHKTasks(params: HKTaskParams = {}) {
  return useQuery({
    queryKey: [QK, "hk-tasks", params],
    queryFn: () => hospitalityApi.getHKTasks(params),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
  });
}
export const useHKSummary = () => useQuery({ queryKey: [QK, "hk-summary"], queryFn: hospitalityApi.getHKSummary, staleTime: 2 * 60_000 });

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * One desk action moves several screens at once — a check-out changes the booking, the room, the
 * tape chart, the front desk board and housekeeping — so every mutation refreshes the whole module.
 * The queries are small and keyed per screen, so this costs little and nothing is left stale.
 */
function useHospMutation<TArgs, TResult = unknown>(fn: (a: TArgs) => Promise<TResult>, success?: string | ((r: TResult) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateRoom      = () => useHospMutation((d: RoomRequest) => hospitalityApi.createRoom(d), "Room added.");
export const useUpdateRoom      = () => useHospMutation((v: { id: string; data: RoomRequest }) => hospitalityApi.updateRoom(v.id, v.data), "Room saved.");
export const useDeleteRoom      = () => useHospMutation((id: string) => hospitalityApi.deleteRoom(id), "Room removed.");
export const useSetMaintenance  = () => useHospMutation((v: { id: string; on: boolean }) => hospitalityApi.setMaintenance(v.id, v.on),
  r => r.status === "maintenance" ? `Room ${r.roomNumber} is out of service.` : `Room ${r.roomNumber} is back in service.`);
export const useSetHousekeeping = () => useHospMutation((v: { id: string; status: HousekeepingStatus }) => hospitalityApi.setHousekeeping(v.id, v.status),
  r => `Room ${r.roomNumber} marked ${r.housekeepingStatus}.`);

export const useCreateRoomType = () => useHospMutation((d: RoomTypeRequest) => hospitalityApi.createRoomType(d), "Room type added.");
export const useUpdateRoomType = () => useHospMutation((v: { id: string; data: RoomTypeRequest }) => hospitalityApi.updateRoomType(v.id, v.data), "Room type saved.");
export const useDeleteRoomType = () => useHospMutation((id: string) => hospitalityApi.deleteRoomType(id), "Room type removed.");

export const useCreateBlock = () => useHospMutation((d: { roomId: string; fromDate: string; toDate: string; reason: string }) => hospitalityApi.createBlock(d), "Room taken out of order for those nights.");
export const useDeleteBlock = () => useHospMutation((id: string) => hospitalityApi.deleteBlock(id), "Block removed.");

export const useCreateRatePlan = () => useHospMutation((d: RatePlanRequest) => hospitalityApi.createRatePlan(d), "Rate plan added.");
export const useUpdateRatePlan = () => useHospMutation((v: { id: string; data: RatePlanRequest }) => hospitalityApi.updateRatePlan(v.id, v.data), "Rate plan saved.");
export const useDeleteRatePlan = () => useHospMutation((id: string) => hospitalityApi.deleteRatePlan(id), "Rate plan removed.");
export const useSetDefaultPlan = () => useHospMutation((id: string) => hospitalityApi.setDefaultPlan(id), r => `${r.name} is now the default rate.`);
export const useAddSeason      = () => useHospMutation((v: { planId: string; data: SeasonRequest }) => hospitalityApi.addSeason(v.planId, v.data), "Season added.");
export const useDeleteSeason   = () => useHospMutation((v: { planId: string; seasonId: string }) => hospitalityApi.deleteSeason(v.planId, v.seasonId), "Season removed.");

export const useUpdateSettings = () => useHospMutation((d: HotelSettingsDto) => hospitalityApi.updateSettings(d), "Hotel settings saved.");

export const useCreateBooking = () => useHospMutation((d: CreateBookingRequest) => hospitalityApi.createBooking(d), r => `Booking ${r.bookingNumber} confirmed.`);
export const useUpdateBookingDetails = () => useHospMutation(
  (v: { id: string; data: Parameters<typeof hospitalityApi.updateBookingDetails>[1] }) => hospitalityApi.updateBookingDetails(v.id, v.data), "Booking saved.");
export const useAmendStay   = () => useHospMutation((v: { id: string; checkIn: string; checkOut: string }) => hospitalityApi.amendStay(v.id, v.checkIn, v.checkOut), "Dates changed and the stay repriced.");
export const useMoveRoom    = () => useHospMutation((v: { id: string; roomId: string; reprice: boolean }) => hospitalityApi.moveRoom(v.id, v.roomId, v.reprice), r => `Moved to room ${r.roomNumber}.`);
export const useCancelBooking = () => useHospMutation((v: { id: string; reason: string; fee?: number | null }) => hospitalityApi.cancelBooking(v.id, v.reason, v.fee), "Booking cancelled.");
export const useMarkNoShow  = () => useHospMutation((v: { id: string; fee?: number | null }) => hospitalityApi.markNoShow(v.id, v.fee), "Marked as no-show.");
export const useCheckInBooking  = () => useHospMutation((v: { id: string; roomId?: string | null }) => hospitalityApi.checkInBooking(v.id, v.roomId), "Guest checked in.");
export const useCheckOutBooking = () => useHospMutation((v: { id: string; allowBalance?: boolean }) => hospitalityApi.checkOutBooking(v.id, v.allowBalance), "Guest checked out. Housekeeping has the room.");
export const useRecordBookingPayment = () => useHospMutation(
  (v: { id: string; amount: number; method: string; reference?: string | null }) => hospitalityApi.recordBookingPayment(v.id, { amount: v.amount, method: v.method, reference: v.reference }),
  "Payment recorded.");

export const usePostCharge = () => useHospMutation(
  (v: { id: string; category: string; description: string; quantity: number; unitPrice: number; postedBy?: string | null }) =>
    hospitalityApi.postCharge(v.id, v), "Charge posted to the bill.");
export const useVoidCharge  = () => useHospMutation((v: { id: string; chargeId: string; reason: string }) => hospitalityApi.voidCharge(v.id, v.chargeId, v.reason), "Charge voided.");
export const useSetDiscount = () => useHospMutation((v: { id: string; amount: number; reason?: string | null }) => hospitalityApi.setDiscount(v.id, v.amount, v.reason), "Discount saved.");

export const useCreateGuest = () => useHospMutation((d: GuestRequest) => hospitalityApi.createGuest(d), "Guest added.");
export const useUpdateGuest = () => useHospMutation((v: { id: string; data: GuestRequest }) => hospitalityApi.updateGuest(v.id, v.data), "Guest saved.");
export const useDeleteGuest = () => useHospMutation((id: string) => hospitalityApi.deleteGuest(id), "Guest removed.");

export const useCreateHKTask = () => useHospMutation((d: Record<string, unknown>) => hospitalityApi.createHKTask(d), "Task created.");
