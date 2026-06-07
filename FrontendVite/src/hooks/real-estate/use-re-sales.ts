import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reSalesApi, type CreateVisitReq, type CreateReservationReq, type CreateBookingReq } from "@/lib/real-estate/sales.api";

const QK = "re-sales";

export function useReSalesSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: reSalesApi.getSummary }); }
export function useSiteVisits()     { return useQuery({ queryKey: [QK, "visits"], queryFn: reSalesApi.getSiteVisits }); }
export function useReservations()   { return useQuery({ queryKey: [QK, "reservations"], queryFn: reSalesApi.getReservations }); }
export function useBookings()       { return useQuery({ queryKey: [QK, "bookings"], queryFn: reSalesApi.getBookings }); }

function useReSalesMutation<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["visits"], ["reservations"], ["bookings"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateSiteVisit()   { return useReSalesMutation((d: CreateVisitReq) => reSalesApi.createSiteVisit(d), "Site visit scheduled."); }
export function useCompleteSiteVisit() { return useReSalesMutation(({ id, feedback }: { id: string; feedback?: string | null }) => reSalesApi.completeSiteVisit(id, feedback), "Visit completed."); }
export function useDeleteSiteVisit()   { return useReSalesMutation((id: string) => reSalesApi.deleteSiteVisit(id), "Visit removed."); }

export function useCreateReservation()    { return useReSalesMutation((d: CreateReservationReq) => reSalesApi.createReservation(d), "Unit reserved."); }
export function useSetReservationStatus() { return useReSalesMutation(({ id, status }: { id: string; status: string }) => reSalesApi.setReservationStatus(id, status), "Reservation updated."); }
export function useDeleteReservation()    { return useReSalesMutation((id: string) => reSalesApi.deleteReservation(id), "Reservation removed."); }

export function useCreateBooking()    { return useReSalesMutation((d: CreateBookingReq) => reSalesApi.createBooking(d), "Booking created."); }
export function useRecordPayment()    { return useReSalesMutation(({ id, amount }: { id: string; amount: number }) => reSalesApi.recordPayment(id, amount), "Payment recorded."); }
export function useSetBookingStatus() { return useReSalesMutation(({ id, status }: { id: string; status: string }) => reSalesApi.setBookingStatus(id, status), "Booking updated."); }
export function useDeleteBooking()    { return useReSalesMutation((id: string) => reSalesApi.deleteBooking(id), "Booking removed."); }
