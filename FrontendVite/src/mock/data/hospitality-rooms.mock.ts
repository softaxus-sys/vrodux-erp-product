export type RoomStatus = "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
export type RoomType = "standard" | "deluxe" | "suite" | "penthouse" | "studio";
export type BedType = "king" | "queen" | "twin" | "double";
export type ViewType = "city" | "sea" | "pool" | "garden" | "courtyard";

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  type: RoomType;
  bedType: BedType;
  view: ViewType;
  capacity: number;
  sizeSqm: number;
  status: RoomStatus;
  ratePerNight: number;
  amenities: string[];
  currentGuestName: string | null;
  currentBookingId: string | null;
  checkoutDate: string | null;
  lastCleaned: string;
  isSmokingAllowed: boolean;
  isAccessible: boolean;
}

const AMENITY_SETS: Record<RoomType, string[]> = {
  standard:   ["Wi-Fi", "Smart TV", "Air Conditioning", "Mini Bar", "Safe", "Ensuite Bathroom"],
  studio:     ["Wi-Fi", "Smart TV", "Air Conditioning", "Kitchenette", "Work Desk", "Safe", "Washer/Dryer"],
  deluxe:     ["Wi-Fi", "Smart TV 55\"", "Air Conditioning", "Mini Bar", "Safe", "Rain Shower", "Bathtub", "Work Desk", "Nespresso"],
  suite:      ["Wi-Fi", "Smart TV 65\"", "Air Conditioning", "Full Bar", "Safe", "Rain Shower", "Jacuzzi", "Living Room", "Butler Service", "Nespresso", "Pillow Menu"],
  penthouse:  ["Wi-Fi", "Smart TV 75\"", "Air Conditioning", "Full Bar", "Safe", "Rain Shower", "Jacuzzi", "Living Room", "Dining Room", "Private Terrace", "Plunge Pool", "Butler Service", "Nespresso", "Pillow Menu", "Kitchen"],
};

export const mockRooms: Room[] = [
  // Floor 3
  { id: "rm-001", roomNumber: "0301", floor: 3, type: "standard", bedType: "king", view: "city", capacity: 2, sizeSqm: 32, status: "available", ratePerNight: 550, amenities: AMENITY_SETS.standard, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-002", roomNumber: "0302", floor: 3, type: "standard", bedType: "twin", view: "city", capacity: 2, sizeSqm: 32, status: "cleaning", ratePerNight: 550, amenities: AMENITY_SETS.standard, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-19", isSmokingAllowed: false, isAccessible: true },
  { id: "rm-003", roomNumber: "0303", floor: 3, type: "deluxe", bedType: "king", view: "pool", capacity: 2, sizeSqm: 45, status: "available", ratePerNight: 950, amenities: AMENITY_SETS.deluxe, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 5
  { id: "rm-004", roomNumber: "0501", floor: 5, type: "standard", bedType: "queen", view: "city", capacity: 2, sizeSqm: 32, status: "maintenance", ratePerNight: 550, amenities: AMENITY_SETS.standard, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-18", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-005", roomNumber: "0502", floor: 5, type: "standard", bedType: "king", view: "garden", capacity: 2, sizeSqm: 32, status: "occupied", ratePerNight: 550, amenities: AMENITY_SETS.standard, currentGuestName: "Rahul Verma", currentBookingId: "bk-003", checkoutDate: "2026-05-21", lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-006", roomNumber: "0503", floor: 5, type: "studio", bedType: "king", view: "city", capacity: 2, sizeSqm: 48, status: "available", ratePerNight: 750, amenities: AMENITY_SETS.studio, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: true },
  // Floor 7
  { id: "rm-007", roomNumber: "0701", floor: 7, type: "standard", bedType: "king", view: "city", capacity: 2, sizeSqm: 32, status: "cleaning", ratePerNight: 580, amenities: AMENITY_SETS.standard, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-008", roomNumber: "0702", floor: 7, type: "deluxe", bedType: "king", view: "sea", capacity: 2, sizeSqm: 48, status: "available", ratePerNight: 1050, amenities: AMENITY_SETS.deluxe, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 8
  { id: "rm-009", roomNumber: "0801", floor: 8, type: "deluxe", bedType: "king", view: "sea", capacity: 2, sizeSqm: 48, status: "occupied", ratePerNight: 950, amenities: AMENITY_SETS.deluxe, currentGuestName: "Sarah Mitchell", currentBookingId: "bk-002", checkoutDate: "2026-05-22", lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-010", roomNumber: "0802", floor: 8, type: "standard", bedType: "twin", view: "city", capacity: 3, sizeSqm: 35, status: "reserved", ratePerNight: 600, amenities: AMENITY_SETS.standard, currentGuestName: null, currentBookingId: "bk-008", checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 9
  { id: "rm-011", roomNumber: "0901", floor: 9, type: "suite", bedType: "king", view: "sea", capacity: 4, sizeSqm: 85, status: "available", ratePerNight: 1800, amenities: AMENITY_SETS.suite, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-012", roomNumber: "0902", floor: 9, type: "suite", bedType: "king", view: "sea", capacity: 4, sizeSqm: 88, status: "maintenance", ratePerNight: 1900, amenities: AMENITY_SETS.suite, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-19", isSmokingAllowed: false, isAccessible: true },
  // Floor 12
  { id: "rm-013", roomNumber: "1201", floor: 12, type: "suite", bedType: "king", view: "sea", capacity: 4, sizeSqm: 90, status: "occupied", ratePerNight: 1800, amenities: AMENITY_SETS.suite, currentGuestName: "Mohammed Al Rashidi", currentBookingId: "bk-001", checkoutDate: "2026-05-24", lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-014", roomNumber: "1202", floor: 12, type: "deluxe", bedType: "king", view: "sea", capacity: 2, sizeSqm: 50, status: "reserved", ratePerNight: 1000, amenities: AMENITY_SETS.deluxe, currentGuestName: null, currentBookingId: "bk-012", checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 15
  { id: "rm-015", roomNumber: "1501", floor: 15, type: "suite", bedType: "king", view: "sea", capacity: 6, sizeSqm: 110, status: "reserved", ratePerNight: 1950, amenities: AMENITY_SETS.suite, currentGuestName: null, currentBookingId: "bk-005", checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-016", roomNumber: "1502", floor: 15, type: "studio", bedType: "queen", view: "city", capacity: 2, sizeSqm: 52, status: "available", ratePerNight: 780, amenities: AMENITY_SETS.studio, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: true },
  // Floor 16
  { id: "rm-017", roomNumber: "1601", floor: 16, type: "deluxe", bedType: "king", view: "sea", capacity: 2, sizeSqm: 50, status: "available", ratePerNight: 1100, amenities: AMENITY_SETS.deluxe, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-018", roomNumber: "1602", floor: 16, type: "deluxe", bedType: "twin", view: "city", capacity: 2, sizeSqm: 48, status: "reserved", ratePerNight: 1050, amenities: AMENITY_SETS.deluxe, currentGuestName: null, currentBookingId: "bk-009", checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 18
  { id: "rm-019", roomNumber: "1801", floor: 18, type: "studio", bedType: "king", view: "sea", capacity: 2, sizeSqm: 55, status: "cleaning", ratePerNight: 850, amenities: AMENITY_SETS.studio, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-020", roomNumber: "1802", floor: 18, type: "suite", bedType: "king", view: "sea", capacity: 4, sizeSqm: 92, status: "available", ratePerNight: 2200, amenities: AMENITY_SETS.suite, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  // Floor 20 — Penthouse
  { id: "rm-021", roomNumber: "2001", floor: 20, type: "penthouse", bedType: "king", view: "sea", capacity: 6, sizeSqm: 280, status: "reserved", ratePerNight: 4500, amenities: AMENITY_SETS.penthouse, currentGuestName: null, currentBookingId: "bk-004", checkoutDate: null, lastCleaned: "2026-05-20", isSmokingAllowed: false, isAccessible: false },
  { id: "rm-022", roomNumber: "2002", floor: 20, type: "penthouse", bedType: "king", view: "sea", capacity: 8, sizeSqm: 320, status: "available", ratePerNight: 5500, amenities: AMENITY_SETS.penthouse, currentGuestName: null, currentBookingId: null, checkoutDate: null, lastCleaned: "2026-05-19", isSmokingAllowed: false, isAccessible: true },
];

export const roomsSummary = {
  total: mockRooms.length,
  available: mockRooms.filter(r => r.status === "available").length,
  occupied: mockRooms.filter(r => r.status === "occupied").length,
  reserved: mockRooms.filter(r => r.status === "reserved").length,
  maintenance: mockRooms.filter(r => r.status === "maintenance").length,
  cleaning: mockRooms.filter(r => r.status === "cleaning").length,
  occupancyRate: Math.round((mockRooms.filter(r => r.status === "occupied").length / mockRooms.length) * 100),
  avgRate: Math.round(mockRooms.reduce((s, r) => s + r.ratePerNight, 0) / mockRooms.length),
};
