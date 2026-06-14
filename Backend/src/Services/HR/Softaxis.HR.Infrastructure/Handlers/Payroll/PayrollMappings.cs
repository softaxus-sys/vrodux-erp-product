using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal static class PayrollMappings
{
    public static PayrollSlipDto ToDto(PayrollSlip s) => new(
        s.Id, s.EmployeeId, s.EmployeeName, s.JobTitle, s.DepartmentName,
        s.BasicSalary, s.Allowances, s.Deductions, s.NetSalary, s.Notes,
        s.EmailSentAt, s.EmailSentTo);

    public static PayrollRunDto ToDto(PayrollRun r) => new(
        r.Id, r.RunNumber, r.Period,
        r.TotalBasicSalary, r.TotalAllowances, r.TotalDeductions, r.TotalNetSalary,
        r.Status, r.Notes, r.CreatedByName, r.RejectionReason, r.RejectedByName,
        r.Slips.Count,
        r.ProcessedAt, r.PaidAt, r.RejectedAt, r.CreatedAt, r.UpdatedAt);

    public static PayrollRunDetailDto ToDetailDto(PayrollRun r) => new(
        r.Id, r.RunNumber, r.Period,
        r.TotalBasicSalary, r.TotalAllowances, r.TotalDeductions, r.TotalNetSalary,
        r.Status, r.Notes, r.CreatedByName, r.RejectionReason, r.RejectedByName,
        r.Slips.Select(ToDto).ToList(),
        r.ProcessedAt, r.PaidAt, r.RejectedAt, r.CreatedAt, r.UpdatedAt);
}
