using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal static class PayrollMappings
{
    /// <param name="bank">
    /// Employee number + IBAN, looked up per employee. The slip does not store them, and the WPS
    /// SIF export cannot be submitted without both.
    /// </param>
    public static PayrollSlipDto ToDto(PayrollSlip s, (string? Number, string? Iban) bank = default) => new(
        s.Id, s.EmployeeId, s.EmployeeName, s.JobTitle, s.DepartmentName,
        s.BasicSalary, s.Allowances, s.Deductions, s.NetSalary, s.Notes,
        s.EmailSentAt, s.EmailSentTo, bank.Number, bank.Iban);

    public static PayrollRunDto ToDto(PayrollRun r) => new(
        r.Id, r.RunNumber, r.Period,
        r.TotalBasicSalary, r.TotalAllowances, r.TotalDeductions, r.TotalNetSalary,
        r.Status, r.Notes, r.CreatedByName, r.RejectionReason, r.RejectedByName,
        r.FinanceApprovedByName, r.FinanceApprovedAt, r.JournalEntryId, r.JournalEntryNumber,
        r.Slips.Count,
        r.ProcessedAt, r.PaidAt, r.RejectedAt, r.CreatedAt, r.UpdatedAt);

    public static PayrollRunDetailDto ToDetailDto(
        PayrollRun r,
        IReadOnlyDictionary<Guid, (string? Number, string? Iban)> bank) => new(
        r.Id, r.RunNumber, r.Period,
        r.TotalBasicSalary, r.TotalAllowances, r.TotalDeductions, r.TotalNetSalary,
        r.Status, r.Notes, r.CreatedByName, r.RejectionReason, r.RejectedByName,
        r.FinanceApprovedByName, r.FinanceApprovedAt, r.JournalEntryId, r.JournalEntryNumber,
        r.Slips.Select(s => ToDto(s, bank.TryGetValue(s.EmployeeId, out var b) ? b : default)).ToList(),
        r.ProcessedAt, r.PaidAt, r.RejectedAt, r.CreatedAt, r.UpdatedAt);
}
