export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
export type BookingSource = "direct" | "ota" | "agent" | "walk_in" | "corporate";
export type RoomType = "standard" | "deluxe" | "suite" | "penthouse" | "studio";

export interface Booking {
  id: string;
  bookingNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  roomId: string;
  roomNumber: string;
  roomType: RoomType;
  floor: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: BookingStatus;
  ratePerNight: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  source: BookingSource;
  specialRequests: string;
  notes: string;
}

export const mockBookings: Booking[] = [
  {
    id: "bk-001", bookingNumber: "BK-2026-0841", guestName: "Mohammed Al Rashidi",
    guestEmail: "m.rashidi@gmail.com", guestPhone: "+971 50 112 3344", guestNationality: "UAE",
    roomId: "rm-012", roomNumber: "1201", roomType: "suite", floor: 12,
    checkIn: "2026-05-20", checkOut: "2026-05-24", nights: 4, adults: 2, children: 1,
    status: "checked_in", ratePerNight: 1800, totalAmount: 7200, paidAmount: 7200, balance: 0,
    source: "direct", specialRequests: "High floor, sea view, crib for infant", notes: "VIP guest — loyalty tier Gold",
  },
  {
    id: "bk-002", bookingNumber: "BK-2026-0842", guestName: "Sarah Mitchell",
    guestEmail: "s.mitchell@outlook.com", guestPhone: "+44 7700 900123", guestNationality: "UK",
    roomId: "rm-008", roomNumber: "0804", roomType: "deluxe", floor: 8,
    checkIn: "2026-05-20", checkOut: "2026-05-22", nights: 2, adults: 2, children: 0,
    status: "checked_in", ratePerNight: 950, totalAmount: 1900, paidAmount: 950, balance: 950,
    source: "ota", specialRequests: "Late checkout if possible", notes: "Booked via Booking.com",
  },
  {
    id: "bk-003", bookingNumber: "BK-2026-0843", guestName: "Rahul Verma",
    guestEmail: "rahul.v@tcs.com", guestPhone: "+91 98765 43210", guestNationality: "India",
    roomId: "rm-005", roomNumber: "0503", roomType: "standard", floor: 5,
    checkIn: "2026-05-20", checkOut: "2026-05-21", nights: 1, adults: 1, children: 0,
    status: "checked_in", ratePerNight: 550, totalAmount: 550, paidAmount: 550, balance: 0,
    source: "corporate", specialRequests: "", notes: "Corporate rate — TCS account",
  },
  {
    id: "bk-004", bookingNumber: "BK-2026-0844", guestName: "Zhang Wei",
    guestEmail: "zhangwei@baidu.com", guestPhone: "+86 135 0000 1234", guestNationality: "China",
    roomId: "rm-020", roomNumber: "2001", roomType: "penthouse", floor: 20,
    checkIn: "2026-05-21", checkOut: "2026-05-26", nights: 5, adults: 2, children: 0,
    status: "confirmed", ratePerNight: 4500, totalAmount: 22500, paidAmount: 11250, balance: 11250,
    source: "agent", specialRequests: "Mandarin-speaking butler, halal dining options", notes: "VVIP — champagne on arrival",
  },
  {
    id: "bk-005", bookingNumber: "BK-2026-0845", guestName: "Emma Dubois",
    guestEmail: "emma.dubois@orange.fr", guestPhone: "+33 6 12 34 56 78", guestNationality: "France",
    roomId: "rm-015", roomNumber: "1502", roomType: "suite", floor: 15,
    checkIn: "2026-05-22", checkOut: "2026-05-25", nights: 3, adults: 2, children: 2,
    status: "confirmed", ratePerNight: 1950, totalAmount: 5850, paidAmount: 2925, balance: 2925,
    source: "ota", specialRequests: "Extra bed, hypoallergenic pillows", notes: "Expedia booking — loyalty gold",
  },
  {
    id: "bk-006", bookingNumber: "BK-2026-0846", guestName: "Khalid Al Mansoori",
    guestEmail: "k.mansoori@adnoc.ae", guestPhone: "+971 56 778 9900", guestNationality: "UAE",
    roomId: "rm-003", roomNumber: "0302", roomType: "deluxe", floor: 3,
    checkIn: "2026-05-19", checkOut: "2026-05-20", nights: 1, adults: 1, children: 0,
    status: "checked_out", ratePerNight: 950, totalAmount: 950, paidAmount: 950, balance: 0,
    source: "direct", specialRequests: "", notes: "Corporate — ADNOC account. Checked out on time.",
  },
  {
    id: "bk-007", bookingNumber: "BK-2026-0847", guestName: "Priya Nair",
    guestEmail: "priya.nair@wipro.com", guestPhone: "+971 55 334 4556", guestNationality: "India",
    roomId: "rm-007", roomNumber: "0701", roomType: "standard", floor: 7,
    checkIn: "2026-05-18", checkOut: "2026-05-20", nights: 2, adults: 1, children: 0,
    status: "checked_out", ratePerNight: 550, totalAmount: 1100, paidAmount: 1100, balance: 0,
    source: "corporate", specialRequests: "Early check-in", notes: "Wipro corporate account.",
  },
  {
    id: "bk-008", bookingNumber: "BK-2026-0848", guestName: "James Okafor",
    guestEmail: "james.o@gmail.com", guestPhone: "+234 812 345 6789", guestNationality: "Nigeria",
    roomId: "rm-011", roomNumber: "1104", roomType: "standard", floor: 11,
    checkIn: "2026-05-23", checkOut: "2026-05-27", nights: 4, adults: 2, children: 1,
    status: "confirmed", ratePerNight: 600, totalAmount: 2400, paidAmount: 1200, balance: 1200,
    source: "ota", specialRequests: "Twin beds", notes: "",
  },
  {
    id: "bk-009", bookingNumber: "BK-2026-0849", guestName: "Isabella Rossi",
    guestEmail: "i.rossi@eni.com", guestPhone: "+39 06 1234 5678", guestNationality: "Italy",
    roomId: "rm-016", roomNumber: "1603", roomType: "deluxe", floor: 16,
    checkIn: "2026-05-24", checkOut: "2026-05-28", nights: 4, adults: 1, children: 0,
    status: "confirmed", ratePerNight: 1050, totalAmount: 4200, paidAmount: 4200, balance: 0,
    source: "agent", specialRequests: "High floor, non-smoking", notes: "Fully prepaid via DNATA.",
  },
  {
    id: "bk-010", bookingNumber: "BK-2026-0850", guestName: "Omar Abdullah",
    guestEmail: "omar.a@kaust.sa", guestPhone: "+966 50 234 5678", guestNationality: "Saudi Arabia",
    roomId: "rm-018", roomNumber: "1801", roomType: "studio", floor: 18,
    checkIn: "2026-05-15", checkOut: "2026-05-20", nights: 5, adults: 1, children: 0,
    status: "no_show", ratePerNight: 750, totalAmount: 3750, paidAmount: 750, balance: 3000,
    source: "direct", specialRequests: "", notes: "No-show. First night charged as per policy.",
  },
  {
    id: "bk-011", bookingNumber: "BK-2026-0851", guestName: "Fatima Al Zaabi",
    guestEmail: "f.zaabi@gmail.com", guestPhone: "+971 54 556 7788", guestNationality: "UAE",
    roomId: "rm-009", roomNumber: "0902", roomType: "suite", floor: 9,
    checkIn: "2026-05-10", checkOut: "2026-05-12", nights: 2, adults: 2, children: 0,
    status: "cancelled", ratePerNight: 1800, totalAmount: 3600, paidAmount: 0, balance: 0,
    source: "direct", specialRequests: "", notes: "Cancelled 48hrs before. No charge applied.",
  },
  {
    id: "bk-012", bookingNumber: "BK-2026-0852", guestName: "David Park",
    guestEmail: "d.park@samsung.com", guestPhone: "+82 10 1234 5678", guestNationality: "South Korea",
    roomId: "rm-014", roomNumber: "1402", roomType: "deluxe", floor: 14,
    checkIn: "2026-05-25", checkOut: "2026-05-29", nights: 4, adults: 2, children: 0,
    status: "confirmed", ratePerNight: 1000, totalAmount: 4000, paidAmount: 2000, balance: 2000,
    source: "corporate", specialRequests: "Samsung corporate rate, fast Wi-Fi", notes: "Samsung MENA HQ account.",
  },
];

export const bookingsSummary = {
  total: mockBookings.length,
  checkedIn: mockBookings.filter(b => b.status === "checked_in").length,
  confirmed: mockBookings.filter(b => b.status === "confirmed").length,
  checkedOut: mockBookings.filter(b => b.status === "checked_out").length,
  cancelled: mockBookings.filter(b => b.status === "cancelled").length,
  noShow: mockBookings.filter(b => b.status === "no_show").length,
  totalRevenue: mockBookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.paidAmount, 0),
  outstandingBalance: mockBookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.balance, 0),
  occupancyRate: 76,
  avgNightlyRate: Math.round(
    mockBookings.filter(b => b.status !== "cancelled").reduce((s, b) => s + b.ratePerNight, 0) /
    mockBookings.filter(b => b.status !== "cancelled").length
  ),
};
