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
    string?   EmailSentTo);

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
