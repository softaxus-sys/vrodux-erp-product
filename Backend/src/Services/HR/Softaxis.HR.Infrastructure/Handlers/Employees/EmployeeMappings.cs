using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

/// <summary>
/// The single source of truth for Employee -> EmployeeDto. Every read handler MUST go through
/// this: EmployeeDto has optional trailing parameters, so a hand-written projection that omits
/// them still compiles and silently returns nulls.
/// </summary>
internal static class EmployeeMappings
{
    /// <param name="linkedAccount">
    /// Live Identity state for the linked login. Only the detail read supplies it — a list must
    /// not join Identity per row.
    /// </param>
    public static EmployeeDto ToDto(Employee e, LinkedAccountDto? linkedAccount = null) => new(
        e.Id, e.EmployeeNumber, e.FirstName, e.LastName, e.FullName,
        e.Email, e.Phone, e.JobTitle, e.DepartmentId, e.DepartmentName,
        e.EmploymentType, e.BasicSalary, e.JoiningDate, e.TerminationDate,
        e.Status, e.ManagerId, e.Notes, e.CreatedAt, e.UpdatedAt, e.AvatarData,
        e.Nationality, e.EmiratesId, e.PassportNumber, e.VisaExpiry, e.ReportingTo,
        e.BankAccount, e.Iban, e.MedicalInsurance,
        e.LabourCardNumber, e.BankRoutingCode,
        e.UserId, linkedAccount);
}
