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
        var employee = new Employee(
            cmd.FirstName, cmd.LastName, cmd.Email, cmd.Phone,
            cmd.JobTitle, cmd.DepartmentId, cmd.DepartmentName,
            cmd.EmploymentType, cmd.BasicSalary, cmd.JoiningDate,
            cmd.ManagerId, cmd.Notes);

        db.Employees.Add(employee);
        await db.SaveChangesAsync(ct);

        return Result.Success(EmployeeMappings.ToDto(employee));
    }
}
