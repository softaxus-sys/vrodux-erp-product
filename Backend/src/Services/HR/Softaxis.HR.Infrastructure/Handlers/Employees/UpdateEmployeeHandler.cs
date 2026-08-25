using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class UpdateEmployeeHandler(HrDbContext db)
    : ICommandHandler<UpdateEmployeeCommand>
{
    public async Task<Result> Handle(UpdateEmployeeCommand cmd, CancellationToken ct)
    {
        var employee = await db.Employees.FindAsync([cmd.Id], ct);
        if (employee is null)
            return Result.Failure(Error.NotFoundById("Employee", cmd.Id));

        var email = cmd.Email.Trim().ToLowerInvariant();
        if (await db.Employees.AnyAsync(e => !e.IsDeleted && e.Id != cmd.Id && e.Email == email, ct))
            return Result.Failure(Error.Custom(
                "Employee.Duplicate", $"Another employee already uses the email '{email}'."));

        employee.Update(
            cmd.FirstName, cmd.LastName, cmd.Email, cmd.Phone,
            cmd.JobTitle, cmd.DepartmentId, cmd.DepartmentName,
            cmd.EmploymentType, cmd.BasicSalary, cmd.JoiningDate,
            cmd.ManagerId, cmd.Notes, cmd.Status, cmd.AvatarData);
        if (cmd.RemoveAvatar) employee.RemoveAvatar();
        employee.SetPersonalDetails(cmd.Nationality, cmd.EmiratesId, cmd.PassportNumber, cmd.VisaExpiry, cmd.ReportingTo);
        employee.SetBankDetails(cmd.BankAccount, cmd.Iban, cmd.MedicalInsurance,
            cmd.LabourCardNumber, cmd.BankRoutingCode);


        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
