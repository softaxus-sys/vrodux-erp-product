import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  toursApi, type TourBookingListParams, type TourPackageRequest, type TourDepartureRequest, type CreateTourBookingRequest,
  type UpdateTourBookingRequest, type TravellerInput, type TourServiceRequest, type InstalmentInput, type TourPaymentRequest,
  type DepartureStatus,
} from "@/lib/hospitality/tours.api";

// Under the hospitality key, so any hotel or tour change refreshes both sides (a guest's history spans both).
const QK = ["hospitality", "tours"] as const;

export const useTourDashboard = () => useQuery({ queryKey: [...QK, "dashboard"], queryFn: toursApi.dashboard, staleTime: 30_000 });
export const useTourPackages = (includeInactive = false) =>
  useQuery({ queryKey: [...QK, "packages", includeInactive], queryFn: () => toursApi.packages(includeInactive), staleTime: 60_000 });
export const useTourPackage = (id: string | null) =>
  useQuery({ queryKey: [...QK, "package", id], queryFn: () => toursApi.package(id!), enabled: !!id });
export const useTourDepartures = (p: { packageId?: string; from?: string; to?: string; includeClosed?: boolean } = {}, enabled = true) =>
  useQuery({ queryKey: [...QK, "departures", p], queryFn: () => toursApi.departures(p), enabled, staleTime: 30_000 });
export const useTourBookings = (p: TourBookingListParams = {}) =>
  useQuery({ queryKey: [...QK, "bookings", p], queryFn: () => toursApi.bookings(p), placeholderData: keepPreviousData, staleTime: 30_000 });
export const useTourBooking = (id: string | null) =>
  useQuery({ queryKey: [...QK, "booking", id], queryFn: () => toursApi.booking(id!), enabled: !!id });

function useTourMutation<TArgs, TResult = unknown>(fn: (a: TArgs) => Promise<TResult>, success?: string | ((r: TResult) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["hospitality"] });
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useSavePackage = () => useTourMutation((v: { id?: string; data: TourPackageRequest }) =>
  v.id ? toursApi.updatePackage(v.id, v.data) : toursApi.createPackage(v.data), "Package saved.");
export const useDeletePackage = () => useTourMutation((id: string) => toursApi.deletePackage(id), "Package removed.");

export const useSaveDeparture = () => useTourMutation((v: { id?: string; data: TourDepartureRequest }) =>
  v.id ? toursApi.updateDeparture(v.id, v.data) : toursApi.createDeparture(v.data), "Departure saved.");
export const useSetDepartureStatus = () => useTourMutation((v: { id: string; status: DepartureStatus }) =>
  toursApi.setDepartureStatus(v.id, v.status), r => `Departure ${r.status}.`);
export const useDeleteDeparture = () => useTourMutation((id: string) => toursApi.deleteDeparture(id), "Departure removed.");

export const useCreateTourBooking = () => useTourMutation((d: CreateTourBookingRequest) => toursApi.createBooking(d),
  r => `Booking ${r.bookingNumber} created.`);
export const useUpdateTourBooking = () => useTourMutation((v: { id: string; data: UpdateTourBookingRequest }) =>
  toursApi.updateBooking(v.id, v.data), "Booking saved.");
export const useTourBookingStatus = () => useTourMutation((v: { id: string; action: "confirm" | "complete" | "reopen" | "cancel"; reason?: string }) =>
  toursApi.setStatus(v.id, v.action, v.reason), r => `Booking ${r.status}.`);
export const useDeleteTourBooking = () => useTourMutation((id: string) => toursApi.deleteBooking(id), "Booking deleted.");
export const useSaveTravellers = () => useTourMutation((v: { id: string; travellers: TravellerInput[] }) =>
  toursApi.saveTravellers(v.id, v.travellers), "Travellers saved.");
export const useSaveService = () => useTourMutation((v: { bookingId: string; id?: string; data: TourServiceRequest }) =>
  v.id ? toursApi.updateService(v.bookingId, v.id, v.data) : toursApi.addService(v.bookingId, v.data), "Supplier booking saved.");
export const useDeleteService = () => useTourMutation((v: { bookingId: string; id: string }) =>
  toursApi.deleteService(v.bookingId, v.id), "Supplier booking removed.");
export const useSaveInstalments = () => useTourMutation((v: { id: string; instalments: InstalmentInput[] }) =>
  toursApi.saveInstalments(v.id, v.instalments), "Payment schedule saved.");
export const useAddTourPayment = () => useTourMutation((v: { id: string; data: TourPaymentRequest }) =>
  toursApi.addPayment(v.id, v.data), "Payment recorded.");
export const useVoidTourPayment = () => useTourMutation((v: { id: string; paymentId: string; reason: string }) =>
  toursApi.voidPayment(v.id, v.paymentId, v.reason), "Payment voided.");
