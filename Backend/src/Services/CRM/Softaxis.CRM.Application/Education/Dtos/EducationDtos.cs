namespace Softaxis.CRM.Application.Education.Dtos;

public sealed record AdmissionDto(
    Guid Id, string AdmissionNumber, Guid? LeadId, Guid? StudentId, string ApplicantName, string Program,
    string IntakeTerm, string? GuardianName, string? Phone, string? Email, string Status, string AppliedDate,
    string? Notes, DateTime CreatedAt);

public sealed record StudentDto(
    Guid Id, string StudentNumber, Guid? CustomerId, string FullName, string Gender, string Program,
    string? GuardianName, string? Phone, string? Email, string Status, string EnrolledDate,
    string? Notes, DateTime CreatedAt);

public sealed record EnrollmentDto(
    Guid Id, string EnrollmentNumber, Guid StudentId, string StudentName, string Course, string Term,
    decimal FeeTotal, decimal FeePaid, decimal FeeBalance, string Status, string EnrollDate,
    string? Notes, DateTime CreatedAt);

public sealed record EnrollAdmissionResultDto(Guid StudentId, string StudentNumber);

public sealed record EducationSummaryDto(
    int OpenInquiries, int TotalAdmissions, int EnrolledStudents, int ActiveEnrollments,
    decimal FeesBilled, decimal FeesCollected, decimal FeesOutstanding);
