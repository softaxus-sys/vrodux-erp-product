export type HKStatus = "pending" | "in_progress" | "completed" | "inspected";
export type TaskType = "checkout" | "stayover" | "deep_clean" | "inspection" | "turndown";
export type Priority = "urgent" | "high" | "normal" | "low";

export interface HKChecklist {
  item: string;
  done: boolean;
}

export interface HKTask {
  id: string;
  taskNumber: string;
  roomNumber: string;
  floor: number;
  roomType: string;
  taskType: TaskType;
  status: HKStatus;
  priority: Priority;
  assignedTo: string;
  supervisedBy: string;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  inspectedBy: string | null;
  notes: string;
  checklist: HKChecklist[];
}

const CHECKOUT_CHECKLIST: HKChecklist[] = [
  { item: "Strip all bed linens and pillowcases", done: false },
  { item: "Replace with fresh linens", done: false },
  { item: "Clean and sanitise bathroom", done: false },
  { item: "Replace all towels and amenities", done: false },
  { item: "Vacuum carpets and mop hard floors", done: false },
  { item: "Dust all surfaces and furniture", done: false },
  { item: "Clean windows and mirrors", done: false },
  { item: "Check and restock mini bar", done: false },
  { item: "Empty all bins", done: false },
  { item: "Check all appliances functional", done: false },
  { item: "Final walkthrough and inspection", done: false },
];

const STAYOVER_CHECKLIST: HKChecklist[] = [
  { item: "Make bed (do not strip unless requested)", done: false },
  { item: "Tidy bathroom and replace used towels", done: false },
  { item: "Vacuum visible areas", done: false },
  { item: "Dust surfaces", done: false },
  { item: "Restock amenities", done: false },
  { item: "Empty bins", done: false },
  { item: "Check mini bar levels", done: false },
];

const TURNDOWN_CHECKLIST: HKChecklist[] = [
  { item: "Turn down bed", done: false },
  { item: "Place turndown chocolates", done: false },
  { item: "Close curtains/blinds", done: false },
  { item: "Tidy bathroom — replace towels if needed", done: false },
  { item: "Dim room lighting", done: false },
  { item: "Leave weather card and morning menu", done: false },
];

export const mockHKTasks: HKTask[] = [
  {
    id: "hk-001", taskNumber: "HK-2026-0501", roomNumber: "0302", floor: 3, roomType: "Standard",
    taskType: "checkout", status: "in_progress", priority: "urgent",
    assignedTo: "Maria Santos", supervisedBy: "Fatima Khalil",
    scheduledAt: "09:00", startedAt: "09:15", completedAt: null, inspectedBy: null,
    notes: "VIP check-in arriving 11am — priority",
    checklist: CHECKOUT_CHECKLIST.map((c, i) => ({ ...c, done: i < 5 })),
  },
  {
    id: "hk-002", taskNumber: "HK-2026-0502", roomNumber: "0701", floor: 7, roomType: "Standard",
    taskType: "checkout", status: "in_progress", priority: "high",
    assignedTo: "Liza Gonzalez", supervisedBy: "Fatima Khalil",
    scheduledAt: "09:00", startedAt: "09:30", completedAt: null, inspectedBy: null,
    notes: "",
    checklist: CHECKOUT_CHECKLIST.map((c, i) => ({ ...c, done: i < 3 })),
  },
  {
    id: "hk-003", taskNumber: "HK-2026-0503", roomNumber: "1801", floor: 18, roomType: "Studio",
    taskType: "checkout", status: "pending", priority: "normal",
    assignedTo: "Ruth Mensah", supervisedBy: "Nadia Al Balushi",
    scheduledAt: "10:00", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "Guest had late checkout — room available from 12pm",
    checklist: CHECKOUT_CHECKLIST.map(c => ({ ...c, done: false })),
  },
  {
    id: "hk-004", taskNumber: "HK-2026-0504", roomNumber: "1201", floor: 12, roomType: "Suite",
    taskType: "stayover", status: "completed", priority: "high",
    assignedTo: "Grace Okonkwo", supervisedBy: "Nadia Al Balushi",
    scheduledAt: "10:00", startedAt: "10:05", completedAt: "10:48", inspectedBy: null,
    notes: "DND removed at 10am. Guest requested extra towels.",
    checklist: STAYOVER_CHECKLIST.map(c => ({ ...c, done: true })),
  },
  {
    id: "hk-005", taskNumber: "HK-2026-0505", roomNumber: "0801", floor: 8, roomType: "Deluxe",
    taskType: "stayover", status: "inspected", priority: "normal",
    assignedTo: "Maria Santos", supervisedBy: "Fatima Khalil",
    scheduledAt: "09:30", startedAt: "09:35", completedAt: "10:10", inspectedBy: "Fatima Khalil",
    notes: "",
    checklist: STAYOVER_CHECKLIST.map(c => ({ ...c, done: true })),
  },
  {
    id: "hk-006", taskNumber: "HK-2026-0506", roomNumber: "0502", floor: 5, roomType: "Standard",
    taskType: "stayover", status: "pending", priority: "normal",
    assignedTo: "Liza Gonzalez", supervisedBy: "Fatima Khalil",
    scheduledAt: "11:00", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "",
    checklist: STAYOVER_CHECKLIST.map(c => ({ ...c, done: false })),
  },
  {
    id: "hk-007", taskNumber: "HK-2026-0507", roomNumber: "0901", floor: 9, roomType: "Suite",
    taskType: "deep_clean", status: "pending", priority: "low",
    assignedTo: "Ruth Mensah", supervisedBy: "Nadia Al Balushi",
    scheduledAt: "13:00", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "Monthly deep clean — room not occupied until 22 May",
    checklist: [
      { item: "Full deep clean of all surfaces", done: false },
      { item: "Shampoo carpets", done: false },
      { item: "Clean curtains and upholstery", done: false },
      { item: "Descale bathroom fixtures", done: false },
      { item: "Clean behind and under furniture", done: false },
      { item: "HVAC vents and filters check", done: false },
      { item: "Full amenity restock", done: false },
      { item: "Supervisor inspection sign-off", done: false },
    ],
  },
  {
    id: "hk-008", taskNumber: "HK-2026-0508", roomNumber: "1202", floor: 12, roomType: "Deluxe",
    taskType: "inspection", status: "pending", priority: "normal",
    assignedTo: "Fatima Khalil", supervisedBy: "Ahmed Hassan",
    scheduledAt: "14:00", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "Pre-arrival inspection for VIP check-in tomorrow",
    checklist: [
      { item: "Verify room is spotless", done: false },
      { item: "Check all amenities present", done: false },
      { item: "Test all electronics and TV", done: false },
      { item: "Confirm welcome gift placed", done: false },
      { item: "Check AC temperature set to 22°C", done: false },
    ],
  },
  {
    id: "hk-009", taskNumber: "HK-2026-0509", roomNumber: "2001", floor: 20, roomType: "Penthouse",
    taskType: "inspection", status: "pending", priority: "urgent",
    assignedTo: "Nadia Al Balushi", supervisedBy: "Ahmed Hassan",
    scheduledAt: "15:00", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "VVIP check-in tomorrow — Zhang Wei. Full pre-arrival setup.",
    checklist: [
      { item: "Full room setup per VIP protocol", done: false },
      { item: "Champagne & fruit basket on arrival table", done: false },
      { item: "Verify all electronics operational", done: false },
      { item: "Plunge pool clean and temperature set", done: false },
      { item: "Check all premium amenities present", done: false },
      { item: "Welcome card written in Mandarin", done: false },
      { item: "GM inspection sign-off required", done: false },
    ],
  },
  {
    id: "hk-010", taskNumber: "HK-2026-0510", roomNumber: "1201", floor: 12, roomType: "Suite",
    taskType: "turndown", status: "pending", priority: "high",
    assignedTo: "Grace Okonkwo", supervisedBy: "Nadia Al Balushi",
    scheduledAt: "18:30", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "Gold loyalty guest — extra turndown chocolates",
    checklist: TURNDOWN_CHECKLIST.map(c => ({ ...c, done: false })),
  },
  {
    id: "hk-011", taskNumber: "HK-2026-0511", roomNumber: "0801", floor: 8, roomType: "Deluxe",
    taskType: "turndown", status: "pending", priority: "normal",
    assignedTo: "Maria Santos", supervisedBy: "Fatima Khalil",
    scheduledAt: "18:30", startedAt: null, completedAt: null, inspectedBy: null,
    notes: "",
    checklist: TURNDOWN_CHECKLIST.map(c => ({ ...c, done: false })),
  },
];

export const hkSummary = {
  total: mockHKTasks.length,
  pending: mockHKTasks.filter(t => t.status === "pending").length,
  inProgress: mockHKTasks.filter(t => t.status === "in_progress").length,
  completed: mockHKTasks.filter(t => t.status === "completed").length,
  inspected: mockHKTasks.filter(t => t.status === "inspected").length,
  urgent: mockHKTasks.filter(t => t.priority === "urgent").length,
  checkouts: mockHKTasks.filter(t => t.taskType === "checkout").length,
  stayovers: mockHKTasks.filter(t => t.taskType === "stayover").length,
};
