using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal static class EducationMappings
{
    public static AdmissionDto ToDto(Admission a) => new(
        a.Id, a.AdmissionNumber, a.LeadId, a.StudentId, a.ApplicantName, a.Program,
        a.IntakeTerm, a.GuardianName, a.Phone, a.Email, a.Status, a.AppliedDate, a.Notes, a.CreatedAt);

    public static StudentDto ToDto(Student s) => new(
        s.Id, s.StudentNumber, s.CustomerId, s.FullName, s.Gender, s.Program,
        s.GuardianName, s.Phone, s.Email, s.Status, s.EnrolledDate, s.Notes, s.CreatedAt);

    public static EnrollmentDto ToDto(Enrollment e) => new(
        e.Id, e.EnrollmentNumber, e.StudentId, e.StudentName, e.Course, e.Term,
        e.FeeTotal, e.FeePaid, e.FeeBalance, e.Status, e.EnrollDate, e.Notes, e.CreatedAt);
}
