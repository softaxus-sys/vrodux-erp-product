import { useQuery } from "@tanstack/react-query";
import { educationApi } from "@/lib/education.api";
import { usePagedVerticalList } from "@/hooks/use-vertical-list";

const QK = "education" as const;

export function useEducationSummary(enabled = true) {
  return useQuery({ queryKey: [QK, "summary"], queryFn: educationApi.getSummary, enabled });
}

export function useAdmissionsList(enabled = true) {
  return usePagedVerticalList([QK, "admissions"], educationApi.getAdmissions, enabled);
}

export function useStudentsList(enabled = true) {
  return usePagedVerticalList([QK, "students"], educationApi.getStudents, enabled);
}

export function useEnrollmentsList(enabled = true) {
  return usePagedVerticalList([QK, "enrollments"], educationApi.getEnrollments, enabled);
}
