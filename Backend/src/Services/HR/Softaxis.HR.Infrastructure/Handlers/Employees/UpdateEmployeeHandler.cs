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

        employee.Update(
            cmd.FirstName, cmd.LastName, cmd.Email, cmd.Phone,
            cmd.JobTitle, cmd.DepartmentId, cmd.DepartmentName,
            cmd.EmploymentType, cmd.BasicSalary, cmd.JoiningDate,
            cmd.ManagerId, cmd.Notes, cmd.Status);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
