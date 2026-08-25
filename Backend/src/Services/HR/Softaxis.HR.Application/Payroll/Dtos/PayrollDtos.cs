namespace Softaxis.HR.Application.Payroll.Dtos;

public sealed record PayrollSlipDto(
    Guid      Id,
    Guid      EmployeeId,
    string    EmployeeName,
    string?   JobTitle,
    string?   DepartmentName,
    decimal   BasicSalary,
    decimal   Allowances,
    decimal   Deductions,
    decimal   NetSalary,
    string?   Notes,
    DateTime? EmailSentAt,
    string?   EmailSentTo,
    // Both are read from the employee record, not stored on the slip: the WPS SIF export needs
    // them and they were absent, so every generated file had an empty employee number and IBAN.
    string?   EmployeeNumber = null,
    string?   Iban = null);

public sealed record PayrollRunDto(
    Guid      Id,
    string    RunNumber,
    string    Period,
    decimal   TotalBasicSalary,
    decimal   TotalAllowances,
    decimal   TotalDeductions,
    decimal   TotalNetSalary,
    string    Status,
    string?   Notes,
    string?   CreatedByName,
    string?   RejectionReason,
    string?   RejectedByName,

    /// <summary>Who in Finance signed the run off, and when — null until they have.</summary>
    string?   FinanceApprovedByName,
    DateTime? FinanceApprovedAt,

    /// <summary>The accounting entry the approval posted, so the ledger is reachable from payroll.</summary>
    Guid?     JournalEntryId,
    string?   JournalEntryNumber,

    int       SlipCount,
    DateTime? ProcessedAt,
    DateTime? PaidAt,
    DateTime? RejectedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PayrollRunDetailDto(
    Guid      Id,
    string    RunNumber,
    string    Period,
    decimal   TotalBasicSalary,
    decimal   TotalAllowances,
    decimal   TotalDeductions,
    decimal   TotalNetSalary,
    string    Status,
    string?   Notes,
    string?   CreatedByName,
    string?   RejectionReason,
    string?   RejectedByName,

    /// <summary>Who in Finance signed the run off, and when — null until they have.</summary>
    string?   FinanceApprovedByName,
    DateTime? FinanceApprovedAt,

    /// <summary>The accounting entry the approval posted, so the ledger is reachable from payroll.</summary>
    Guid?     JournalEntryId,
    string?   JournalEntryNumber,

    IReadOnlyList<PayrollSlipDto> Slips,
    DateTime? ProcessedAt,
    DateTime? PaidAt,
    DateTime? RejectedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PayrollSlipDetailDto(
    Guid      Id,
    Guid      EmployeeId,
    string    EmployeeName,
    string?   JobTitle,
    string?   DepartmentName,
    decimal   BasicSalary,
    decimal   Allowances,
    decimal   Deductions,
    decimal   NetSalary,
    string?   Notes,
    DateTime? EmailSentAt,
    string?   EmailSentTo,
    string    Period,
    string    RunNumber,
    string    RunStatus,
    DateTime? PaidAt);

public sealed record PayrollSlipInputDto(
    Guid    EmployeeId,
    string  EmployeeName,
    string? JobTitle,
    string? DepartmentName,
    decimal BasicSalary,
    decimal Allowances,
    decimal Deductions,
    string? Notes);

public sealed record PayrollAllTimeDto(int Draft, int Processed, int Paid, int Total);

public sealed record PayrollThisMonthDto(string Status, decimal TotalNetSalary, int EmployeeCount);

public sealed record PayrollSummaryDto(
    PayrollAllTimeDto    AllTime,
    PayrollThisMonthDto? ThisMonth);

public sealed record SendPayrollSlipEmailResultDto(string SentTo, DateTime? SentAt);

public sealed record EmployeePayslipDto(
    Guid      RunId,
    Guid      SlipId,
    string    RunNumber,
    string    Period,
    string    RunStatus,
    decimal   BasicSalary,
    decimal   Allowances,
    decimal   Deductions,
    decimal   NetSalary,
    DateTime? ProcessedAt,
    DateTime? PaidAt);
