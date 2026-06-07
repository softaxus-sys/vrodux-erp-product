import type { Metadata } from "next";
import { BookingsView } from "@/modules/hospitality/bookings/components/bookings-view";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return <BookingsView />;
}
