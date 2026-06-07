import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { educationApi, type CreateAdmissionReq, type CreateStudentReq, type CreateEnrollmentReq } from "@/lib/education/education.api";

const QK = "education";

export function useEducationSummary() { return useQuery({ queryKey: [QK, "summary"], queryFn: educationApi.getSummary }); }
export function useAdmissions()  { return useQuery({ queryKey: [QK, "admissions"], queryFn: educationApi.getAdmissions }); }
export function useStudents()    { return useQuery({ queryKey: [QK, "students"], queryFn: educationApi.getStudents }); }
export function useEnrollments() { return useQuery({ queryKey: [QK, "enrollments"], queryFn: educationApi.getEnrollments }); }

function useM<T>(fn: (a: T) => Promise<unknown>, msg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      [["summary"], ["admissions"], ["students"], ["enrollments"]].forEach(k => qc.invalidateQueries({ queryKey: [QK, ...k] }));
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateAdmission()    { return useM((d: CreateAdmissionReq) => educationApi.createAdmission(d), "Admission created."); }
export function useSetAdmissionStatus() { return useM(({ id, status }: { id: string; status: string }) => educationApi.setAdmissionStatus(id, status), "Admission updated."); }
export function useEnrollAdmission()    { return useM((id: string) => educationApi.enrollAdmission(id), "Student enrolled."); }
export function useDeleteAdmission()    { return useM((id: string) => educationApi.deleteAdmission(id), "Admission removed."); }

export function useCreateStudent() { return useM((d: CreateStudentReq) => educationApi.createStudent(d), "Student added."); }
export function useDeleteStudent() { return useM((id: string) => educationApi.deleteStudent(id), "Student removed."); }

export function useCreateEnrollment()    { return useM((d: CreateEnrollmentReq) => educationApi.createEnrollment(d), "Enrollment created."); }
export function useRecordFee()           { return useM(({ id, amount }: { id: string; amount: number }) => educationApi.recordFee(id, amount), "Fee payment recorded."); }
export function useSetEnrollmentStatus() { return useM(({ id, status }: { id: string; status: string }) => educationApi.setEnrollmentStatus(id, status), "Enrollment updated."); }
export function useDeleteEnrollment()    { return useM((id: string) => educationApi.deleteEnrollment(id), "Enrollment removed."); }
