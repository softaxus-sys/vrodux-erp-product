namespace Softaxis.VisaServices.Application.VisaCases.Dtos;

public sealed record ApplicantDto(
    Guid Id, string FirstName, string LastName, string FullName, string Nationality,
    string PassportNumber, string? PassportExpiry, string? DateOfBirth,
    string? EmiratesId, string? UidNumber, string Relationship);

public sealed record CaseDocumentDto(
    Guid Id, Guid? ApplicantId, string Name, string Status, string? FileUrl,
    string? ExpiryDate, string? Notes, DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record CaseStatusEventDto(
    Guid Id, string EventType, string? FromStatus, string? ToStatus, string? Note,
    string ByName, DateTime CreatedAt);

/// <summary>List-row shape: enough for the board/table without loading children.</summary>
public sealed record VisaCaseSummaryDto(
    Guid Id, string CaseNumber, Guid VisaTypeId, string VisaTypeName, string Channel,
    string Emirate, Guid? CustomerId, string? CustomerName, string Status, string Priority,
    string AssignedTo, decimal ServiceFee, decimal GovtFee, string? GovtReference,
    string? SlaDueDate, string PrimaryApplicantName, int ApplicantCount,
    int DocumentsPending, int DocumentsTotal, Guid? InvoiceId, string? InvoiceNumber,
    DateTime CreatedAt, DateTime? UpdatedAt);

/// <summary>Drawer shape: the case plus its applicants, checklist, and timeline.</summary>
public sealed record VisaCaseDetailDto(
    Guid Id, string CaseNumber, Guid VisaTypeId, string VisaTypeName, string Channel,
    string Emirate, Guid? CustomerId, string? CustomerName, string Status, string Priority,
    string AssignedTo, decimal ServiceFee, decimal GovtFee, string? GovtReference,
    string? VisaExpiryDate, string? SlaDueDate, string? RejectionReason, string? Notes,
    Guid? InvoiceId, string? InvoiceNumber,
    IReadOnlyList<ApplicantDto> Applicants,
    IReadOnlyList<CaseDocumentDto> Documents,
    IReadOnlyList<CaseStatusEventDto> Timeline,
    DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record VisaCasesSummaryDto(
    int Total, int Open, int DocsPending, int Submitted, int ApprovedThisMonth,
    int Rejected, decimal OpenServiceFees, decimal OpenGovtFees);

public sealed record VisaTypeDto(
    Guid Id, string Code, string Name, string Category, string Channel,
    decimal DefaultGovtFee, decimal DefaultServiceFee, int ProcessingDays,
    IReadOnlyList<string> RequiredDocuments);

// ── Dashboard ─────────────────────────────────────────────────────────────────

public sealed record VisaCountItem(string Key, int Count);
public sealed record VisaRevenueItem(string Key, decimal ServiceFees, decimal GovtFees);
public sealed record VisaWorkloadItem(string AssignedTo, int OpenCount);

public sealed record VisaDashboardDto(
    int TotalCases, int OpenCases, int OverdueCases, int DueThisWeek,
    decimal OpenServiceFees, decimal OpenGovtFees,
    int ExpiringDocuments30, int ExpiringPassports90, int ExpiringVisas90,
    IReadOnlyList<VisaCountItem> ByStatus,
    IReadOnlyList<VisaCountItem> ByType,
    IReadOnlyList<VisaRevenueItem> RevenueByType,
    IReadOnlyList<VisaWorkloadItem> Workload);

// ── Renewals / expiries ───────────────────────────────────────────────────────

/// <summary>An upcoming or overdue expiry (a passport or a case document) that needs action.</summary>
public sealed record RenewalItemDto(
    string Kind, Guid CaseId, string CaseNumber, string VisaTypeName,
    string Subject, string? ExpiryDate, int DaysLeft, string CaseStatus, string AssignedTo);
