import { mockEmployees } from "./hr.mock";

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave" | "holiday" | "weekend";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: AttendanceStatus;
  note?: string;
}

export interface DailyAttendanceSummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  total: number;
}

// Generate attendance for May 2026 (current month)
const statuses: AttendanceStatus[] = ["present", "present", "present", "present", "late", "absent", "on_leave"];

const checkInTimes = ["08:00", "08:15", "08:30", "09:00", "09:15", "09:30", "07:55", "08:05"];
const checkOutTimes = ["17:00", "17:15", "17:30", "18:00", "18:30", "17:45", "16:00", "17:10"];

function getHours(ci: string, co: string): number {
  const [ch, cm] = ci.split(":").map(Number);
  const [oh, om] = co.split(":").map(Number);
  return parseFloat(((oh * 60 + om - ch * 60 - cm) / 60).toFixed(1));
}

export const mockAttendanceRecords: AttendanceRecord[] = [];

const workDays = Array.from({ length: 19 }, (_, i) => {
  const d = new Date(2026, 4, i + 1); // May 2026
  return { day: i + 1, isWeekend: d.getDay() === 5 || d.getDay() === 6 };
});

mockEmployees.forEach(emp => {
  workDays.forEach(({ day, isWeekend }) => {
    const date = `2026-05-${String(day).padStart(2, "0")}`;
    const id = `att-${emp.id}-${date}`;

    if (isWeekend) {
      mockAttendanceRecords.push({ id, employeeId: emp.id, employeeName: emp.fullName, department: emp.department, date, status: "weekend" });
      return;
    }

    if (emp.status === "on_leave" && day >= 12 && day <= 16) {
      mockAttendanceRecords.push({ id, employeeId: emp.id, employeeName: emp.fullName, department: emp.department, date, status: "on_leave", note: "Annual Leave" });
      return;
    }

    // Seeded pseudo-random
    const seed = (emp.id.charCodeAt(4) + day) % statuses.length;
    const status: AttendanceStatus = emp.status === "probation" && day % 7 === 0 ? "late" : statuses[seed];

    if (status === "absent") {
      mockAttendanceRecords.push({ id, employeeId: emp.id, employeeName: emp.fullName, department: emp.department, date, status, note: "Unplanned absence" });
      return;
    }

    const ciIdx = (emp.id.charCodeAt(4) + day) % checkInTimes.length;
    const coIdx = (emp.id.charCodeAt(5) + day) % checkOutTimes.length;
    const ci = status === "late" ? checkInTimes[ciIdx < 4 ? ciIdx + 4 : ciIdx] : checkInTimes[ciIdx < 4 ? ciIdx : ciIdx % 4];
    const co = checkOutTimes[coIdx];

    mockAttendanceRecords.push({
      id, employeeId: emp.id, employeeName: emp.fullName, department: emp.department,
      date, checkIn: ci, checkOut: co, hoursWorked: getHours(ci, co), status,
    });
  });
});

export const attendanceSummary = {
  presentToday: mockAttendanceRecords.filter(r => r.date === "2026-05-19" && r.status === "present").length,
  lateToday: mockAttendanceRecords.filter(r => r.date === "2026-05-19" && r.status === "late").length,
  absentToday: mockAttendanceRecords.filter(r => r.date === "2026-05-19" && r.status === "absent").length,
  onLeaveToday: mockAttendanceRecords.filter(r => r.date === "2026-05-19" && r.status === "on_leave").length,
  avgHoursThisMonth: 8.2,
  totalEmployees: mockEmployees.length,
};
