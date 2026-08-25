using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Commands;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class CreateEmployeeHandler(HrDbContext db)
    : ICommandHandler<CreateEmployeeCommand, EmployeeDto>
{
    public async Task<Result<EmployeeDto>> Handle(CreateEmployeeCommand cmd, CancellationToken ct)
    {
        // Email is unique per tenant among live employees. Checked here so a duplicate is a
        // clear 409 rather than an unhandled DbUpdateException from the index.
        var email = cmd.Email.Trim().ToLowerInvariant();
        if (await db.Employees.AnyAsync(e => !e.IsDeleted && e.Email == email, ct))
            return Result.Failure<EmployeeDto>(Error.Custom(
                "Employee.Duplicate", $"An employee with the email '{email}' already exists."));

        var employee = new Employee(
            cmd.FirstName, cmd.LastName, cmd.Email, cmd.Phone,
            cmd.JobTitle, cmd.DepartmentId, cmd.DepartmentName,
            cmd.EmploymentType, cmd.BasicSalary, cmd.JoiningDate,
            cmd.ManagerId, cmd.Notes, cmd.AvatarData);
        employee.SetPersonalDetails(cmd.Nationality, cmd.EmiratesId, cmd.PassportNumber, cmd.VisaExpiry, cmd.ReportingTo);
        employee.SetBankDetails(cmd.BankAccount, cmd.Iban, cmd.MedicalInsurance,
            cmd.LabourCardNumber, cmd.BankRoutingCode);


        db.Employees.Add(employee);
        await db.SaveChangesAsync(ct);

        return Result.Success(EmployeeMappings.ToDto(employee));
    }
}
