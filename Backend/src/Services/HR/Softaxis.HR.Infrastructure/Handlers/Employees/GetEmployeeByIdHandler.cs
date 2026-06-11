using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Employees.Dtos;
using Softaxis.HR.Application.Employees.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Employees;

internal sealed class GetEmployeeByIdHandler(HrDbContext db)
    : IQueryHandler<GetEmployeeByIdQuery, EmployeeDto>
{
    public async Task<Result<EmployeeDto>> Handle(GetEmployeeByIdQuery query, CancellationToken ct)
    {
        var emp = await db.Employees
            .AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new EmployeeDto(
                x.Id, x.EmployeeNumber, x.FirstName, x.LastName,
                x.FirstName + " " + x.LastName,
                x.Email, x.Phone, x.JobTitle, x.DepartmentId, x.DepartmentName,
                x.EmploymentType, x.BasicSalary, x.JoiningDate, x.TerminationDate,
                x.Status, x.ManagerId, x.Notes, x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        if (emp is null)
            return Result.Failure<EmployeeDto>(Error.NotFoundById("Employee", query.Id));

        return Result.Success(emp);
    }
}
